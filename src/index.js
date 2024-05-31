import OpenAI from "openai";
import { apiKey, orgKey } from '../config/index.js';

import { samplePrompt, weightAgePrompt } from './constants.js';
import { getInstructionsForHighestQuotePrice, getInstructionsForHigherQuotePrice, getInstructionsForHighQuotePrice } from './helper.js';

const openAiService = {};


console.log(process.env.OPEN_AI_API_KEY)
const generateInstruction = (weightage) => {
  const conditions = `
  Quoted price is 2500$,
  Till Quoted price comes below 130% negotiate only on price,
  Reveal the target price as range (+/- 10%),
  Then negotiate on other levers for 2 times
  `;
  return `
  a)Negotiation weightage: 
  ${weightage},
  b) Process Condition as below: 
  ${conditions}`
}

const extractPriceDifferent = async (message, samples) => {
  console.log('1111111111111111111111111111111111111111111111111111111111111')
  console.log({ samples })
  console.log('1111111111111111111111111111111111111111111111111111111111111')
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
  console.log('************************************************************************************************')
  console.log(res?.choices[0]?.message?.content)
  console.log('************************************************************************************************')
  const responseText = res.choices[0].message.content;
  console.log('Response:', responseText);

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
    model: "gpt-3.5-turbo-16k-0613",
  });
  return myAssistant.id
}

const createThread = async () => {
  const openai = new OpenAI({
    organization: orgKey,
    apiKey: apiKey
  });
  const emptyThread = await openai.beta.threads.create();
  console.log({ emptyThread });
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
  console.log(threadMessages);
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
  console.log('run', { run })
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
  console.log('run2', { run })
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
  console.log(threadMessages.data);
  return (threadMessages.data);
}

openAiService.chatWithAssitent = async (options) => {
  const openai = new OpenAI({
    organization: orgKey,
    apiKey: apiKey
  });
  const weightage = await openai.chat.completions.create({
    messages: [{ role: "system", content: weightAgePrompt }],
    model: "gpt-4o",
  });
  console.log(weightage?.choices[0]?.message?.content);
  const sample = await openai.chat.completions.create({
    messages: [{ role: "system", content: samplePrompt }],
    model: "gpt-4o",
  });
  console.log(sample?.choices[0]?.message?.content);

  // const assistantId = await createAssistant(mainPrompt);
  const threadId = await createThread();
  let runStatus = undefined;
  if (options.message) {
    const prices = await extractPriceDifferent(options.message, sample?.choices[0]?.message?.content);
    console.log(typeof prices, prices, prices["quotedPrice"], prices["targetPrice"])
    const pricedifferenceInPercentage = (+prices.quotedPrice / +prices.targetPrice) * 100;
    let mainPrompt = ``;
    if (pricedifferenceInPercentage > 130) {
      mainPrompt = getInstructionsForHighestQuotePrice(weightage?.choices[0]?.message?.content, sample?.choices[0]?.message?.content);
    } else if (pricedifferenceInPercentage < 130 && pricedifferenceInPercentage > 110) {
      mainPrompt = getInstructionsForHigherQuotePrice(weightage?.choices[0]?.message?.content, sample?.choices[0]?.message?.content);
    } else {
      mainPrompt = getInstructionsForHighQuotePrice(weightage?.choices[0]?.message?.content, sample?.choices[0]?.message?.content);
    }
    const assistantId = await createAssistant(mainPrompt);
    // const assistantId = 'asst_7SXXkhLkvNw3L5z4wRdFfz3p';
    console.log({ pricedifferenceInPercentage })
    const messageId = await postMessage(options.message, threadId);
    const runId = await createRun(threadId, assistantId);
    let count = 0;
    while (runStatus !== 'completed' && count < 10) {
      count += 1;
      runStatus = await getRunStatus(threadId, runId);
      setTimeout(() => {
        console.log("this is the first message");
      }, 2000);
    }
    if (runStatus === 'completed') {
      const res = await getThreadMessages(threadId)
      console.log(res[0].content[0].text.value)
      return res[0].content[0].text.value;
    }
    return
  }
}

openAiService.postNewMessage = async (values) => {
  console.log({ values })
  let runStatus = undefined;
  const { message, threadId, assistantId } = values;
  if (message) {
    const messageId = await postMessage(message, threadId);
    const runId = await createRun(threadId, assistantId);
    let count = 0;
    while (runStatus !== 'completed' && count < 10) {
      count += 1;
      runStatus = await getRunStatus(threadId, runId);
      setTimeout(() => {
        console.log("this is the first message");
      }, 2000);
    }
  }
  if (runStatus === 'completed') {
    const res = await getThreadMessages(threadId)
    console.log(res[0].content[0].text.value)
    return res
    // return res[0].content[0].text.value;
  }
  return
}

export default openAiService;

