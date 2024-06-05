import OpenAI from "openai";
import { apiKey, orgKey, maxCount } from '../config/index.js';

import { products } from './constants.js';
import {
  getInstructionsForHighestQuotePrice,
  getInstructionsForHigherQuotePrice,
  getInstructionsForHighQuotePrice,
  generateWeightagePrompt,
  generateSamplesPrompt
} from './helper.js';

const openAiService = {};

console.log(process.env.OPEN_AI_API_KEY);
const extractPriceDifferent = async (message, samples) => {
  const prompt = `Bellow are the user message and the sample deals,
  Rule to follow
  1. please access and let me know what is the price user is quoting from the users message
  2. what can be our best target price based on the sample deals provided.

  users message: ${message},
  
  sample deals: ${samples}
  
  here are few examples of sample output:
  Ex1:
  Target Price: 1000
  Quoted Price: 1500

  Ex2:
  Target Price: 800
  Quoted Price: 700
  
  Ex3:
  Target Price: 20
  Quoted Price: 25
  
  Ex4:
  Target Price: 20000
  Quoted Price: 15000

  please provide the output in the above mentined format and please do not added currency symbol or anything in the output(Target price and Quoted price)
  `;
  const openai = new OpenAI({
    organization: orgKey,
    apiKey: apiKey
  });
  const res = await openai.chat.completions.create({
    messages: [{ role: "system", content: prompt }],
    model: "gpt-4o",
  });
  const responseText = res.choices[0].message.content;
  // Parsing the response text to create an object
  const data = {};
  responseText.split('\n').forEach(line => {
    const [key, value] = line.split(': ');
    data[key.trim().toLowerCase().replace(' ', '_')] = value?.trim();
  });

  // Constructing the output object
  const result = {
    targetPrice: data['target_price'],
    quotedPrice: data['quoted_price']
  };

  return result;
};

const createAssistant = async (prompt) => {
  // const instructions = generateInstruction(weightage);
  const openai = new OpenAI({
    organization: orgKey,
    apiKey: apiKey
  });
  const myAssistant = await openai.beta.assistants.create({
    instructions: prompt,
    name: `Negotiation-Bot-${new Date()}`,
    tools: [{ type: "code_interpreter" }],
    model: "gpt-4o",
  });
  return myAssistant.id
}

const createThread = async () => {
  const openai = new OpenAI({
    organization: orgKey,
    apiKey: apiKey
  });
  const emptyThread = await openai.beta.threads.create();
  return emptyThread.id
}

const postMessage = async (message, threadId) => {
  const openai = new OpenAI({
    organization: orgKey,
    apiKey: apiKey
  });
  const threadMessages = await openai.beta.threads.messages.create(
    threadId,
    { role: "user", content: message }
  );
  return threadMessages.id;
}

const createRun = async (threadId, assistantId) => {
  const openai = new OpenAI({
    organization: orgKey,
    apiKey: apiKey
  });
  const run = await openai.beta.threads.runs.create(
    threadId,
    { assistant_id: assistantId }
  );
  return run.id
}

const getRunStatus = async (threadId, runId) => {
  const openai = new OpenAI({
    organization: orgKey,
    apiKey: apiKey
  });
  const run = await openai.beta.threads.runs.retrieve(
    threadId,
    runId
  );
  return run.status;
}

const getThreadMessages = async (threadId) => {
  const openai = new OpenAI({
    organization: orgKey,
    apiKey: apiKey
  });
  const threadMessages = await openai.beta.threads.messages.list(
    threadId
  );
  return (threadMessages.data);
}

openAiService.chatWithAssitent = async (values) => {
  const openai = new OpenAI({
    organization: orgKey,
    apiKey: apiKey
  });
  const product = products.find(item => item.id === values.productId);

  const weightage = await openai.chat.completions.create({
    messages: [{ role: "system", content: generateWeightagePrompt(product) }],
    model: "gpt-4o",
  });
  const sample = await openai.chat.completions.create({
    messages: [{ role: "system", content: generateSamplesPrompt(product, weightage?.choices[0]?.message?.content)}],
    model: "gpt-4o",
  });

  const threadId = await createThread();
  let runStatus = undefined;
  if (values.message) {
    const prices = await extractPriceDifferent(values.message, sample?.choices[0]?.message?.content);
    const pricedifferenceInPercentage = (+prices.quotedPrice / +prices.targetPrice) * 100;
    let mainPrompt = ``;
    let bot = `target price: ${prices.targetPrice} and choosen assistant`;
    if (pricedifferenceInPercentage > 130) {
      bot += '> 130'
      console.log(' > 130')
      mainPrompt = getInstructionsForHighestQuotePrice(weightage?.choices[0]?.message?.content, sample?.choices[0]?.message?.content, product);
    } else if (pricedifferenceInPercentage < 130 && pricedifferenceInPercentage > 110) {
      bot += '> 110 &&  <130'
      console.log(' > 110 &&  <130')
      mainPrompt = getInstructionsForHigherQuotePrice(weightage?.choices[0]?.message?.content, sample?.choices[0]?.message?.content, product);
    } else {
      bot += '< 110'
      console.log(' < 110')
      mainPrompt = getInstructionsForHighQuotePrice(weightage?.choices[0]?.message?.content, sample?.choices[0]?.message?.content, product);
    }
    const assistantId = await createAssistant(mainPrompt);
    const messageId = await postMessage(values.message, threadId);
    const runId = await createRun(threadId, assistantId);
    let count = 0;
    while (runStatus !== 'completed' && count < maxCount) {
      console.log({ runStatus, count })
      count += 1;
      runStatus = await getRunStatus(threadId, runId);
      setTimeout(() => {
      }, 2000);
    }
    console.log({ runStatus, count })
    if (runStatus === 'completed') {
      const res = await getThreadMessages(threadId)
      console.log(res[0].content[0].text.value)
      {
        return { data: res, threadId, assistantId, meta: bot };
      }
    }
    return {
      data: [], threadId, assistantId
    }
  }
}

openAiService.postNewMessage = async (values) => {
  let runStatus = undefined;
  const { message, threadId, assistantId } = values;
  if (message) {
    const messageId = await postMessage(message, threadId);
    const runId = await createRun(threadId, assistantId);
    let count = 0;
    while (runStatus !== 'completed' && count < 20) {
      count += 1;
      runStatus = await getRunStatus(threadId, runId);
      setTimeout(() => {
      }, 2000);
    }
  }
  if (runStatus === 'completed') {
    const res = await getThreadMessages(threadId)
    return { data: res, threadId, assistantId };
    // return res[0].content[0].text.value;
  }
  return {
    data: [], threadId, assistantId
  }
}

openAiService.deleteAssistant = async (values) => {
  const { assistantId } = values;
  if (assistantId) {
    const openai = new OpenAI({
      organization: orgKey,
      apiKey: apiKey
    });

    const response = await openai.beta.assistants.del(assistantId);
    return response
  }
  return
}

export default openAiService;

