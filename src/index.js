import OpenAI from "openai";
import { apiKey, orgKey, maxCount } from '../config/index.js';
import _get from 'lodash/get.js';

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

  please provide the output in the above mentioned format and please do not added currency symbol or anything in the output(Target price and Quoted price)
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

const determineEndOfProductOrCategorySearch = async response => {
  const prompt = `

  Response:
  ${response}

  
  Instructions: If the above response has a JSON, then return true, else return false.

  here are few examples of sample output:
  
  Sample Output1 : false

  Sample Output2: true
  
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
  console.log('responseText in prompt:', responseText);
  // Parsing the response text to create an object
  // const [key, value] = responseText.split(': ');

  console.log('value in prompt: ', responseText);
  console.log(responseText === "true", {responseText})
  return responseText === "true";
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
    messages: [{ role: "system", content: generateSamplesPrompt(product, weightage?.choices[0]?.message?.content) }],
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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractData(text) {
  try {
    // Extract supplier details
    const supplierPattern = /{\s+"id": "(.*?)",\s+"name": "(.*?)",\s+"rating": (\d+\.\d+|null),\s+"history": \[\s*([\s\S]*?)\s*\]\s+}/g;
    const historyPattern = /{\s+"service": "(.*?)",\s+"price": (\d+\.?\d*),\s+"date": "(.*?)"\s+}/g;

    const suppliers = [];
    let supplierMatch;
    while ((supplierMatch = supplierPattern.exec(text)) !== null) {
      const historyText = supplierMatch[4];
      const history = [];
      let historyMatch;
      while ((historyMatch = historyPattern.exec(historyText)) !== null) {
        history.push({
          service: historyMatch[1],
          price: parseFloat(historyMatch[2]),
          date: historyMatch[3]
        });
      }
      suppliers.push({
        id: supplierMatch[1],
        name: supplierMatch[2],
        rating: supplierMatch[3] === "null" ? null : parseFloat(supplierMatch[3]),
        history: history
      });
    }

    // Extract similar suppliers (if any)
    const similarPattern = /{\s+"id": (\d+),\s+"name": "(.*?)",\s+"rating": (\d+\.\d+)\s+}/g;
    const similarSuppliers = [];
    let similarMatch;
    while ((similarMatch = similarPattern.exec(text)) !== null) {
      similarSuppliers.push({
        id: parseInt(similarMatch[1]),
        name: similarMatch[2],
        rating: parseFloat(similarMatch[3])
      });
    }

    // Extract target prices
    const targetPricePattern = /"target_price":\s+\{\s+"min": ([\d.]+),\s+"max": ([\d.]+),\s+"average": ([\d.]+),\s+"suggested": ([\d.]+)\s+\}/;
    const targetPriceMatch = targetPricePattern.exec(text);
    const targetPrice = targetPriceMatch ? {
      min: parseFloat(targetPriceMatch[1]),
      max: parseFloat(targetPriceMatch[2]),
      average: parseFloat(targetPriceMatch[3]),
      suggested: parseFloat(targetPriceMatch[4])
    } : null;

    // Create summary
    const summary = {
      suppliers: suppliers,
      similar_suppliers: similarSuppliers,
      target_price: targetPrice
    };

    // Output as JSON
    return summary;
  } catch (error) {
    return { err: error.toString() };
  }
}


const executeRun = async (threadId, assistantId) => {
  try {
    let runStatus = undefined;
    const runId = await createRun(threadId, assistantId);
    let count = 0;
    while (runStatus !== 'completed' && count < 100) {
      console.log({ runStatus, count })
      count += 1;
      runStatus = await getRunStatus(threadId, runId);
      await delay(2000);
    }
    console.log({ runStatus, count })
    if (runStatus === 'completed') {
      const res = await getThreadMessages(threadId)
      console.log(res[0].content[0].text.value)
      return res
    }
    return []
  } catch (err) {
    console.log({ err })
  }
}

const extractJSONFromString = inputString => {
  // Extract the JSON part of the string
  const jsonStartIndex = inputString.indexOf('```json');
  const jsonEndIndex = inputString.indexOf('```', jsonStartIndex + 6);
  const jsonString = inputString.slice(jsonStartIndex + 7, jsonEndIndex).trim();

  // Parse the JSON string into an object
  const jsonData = JSON.parse(jsonString);

  console.log('jsonData: ', jsonData);
  return jsonData;
};

function extractDataFromString(inputString) {

  const jsonData = extractJSONFromString(inputString);

  // Extract the relevant data
  const data = {
      category: jsonData.category,
      suppliers: jsonData.suppliers.map(supplier => ({
          name: supplier.name,
          id: supplier.id,
          rating: supplier.rating
      })),
      suggestedPrice: jsonData.suggested_price
  };

  return data;
}


openAiService.suggestSuppliers = async (values) => {
  try {
    const threadId = await createThread();
    const messageId = await postMessage(JSON.stringify(values), threadId);
    if (values.tag === 'found') {
      const assistantId = 'asst_YQhyWrHa8ED31u5mvQ42VpAB';
      const res = await executeRun(threadId, assistantId)
      if (res.length) {
        const prompt = `Extract the data from the following text and format it into a JSON object. The JSON should have three main sections: "suppliers," "similar_suppliers," and "target_price."

      The "suppliers" section should contain an array of objects, each representing a supplier with the following fields:
      "id": The id of the supplier.
      "name": The name of the supplier.
      "rating": The rating of the supplier.
      "history": An array of objects, each representing the purchase history of the supplier with the following fields:
      "service": The service provided by the supplier.
      "price": The price per unit charged by the supplier.
      "date": The date when the service was recorded.
      The "similar_suppliers" section should contain an array of objects, each representing a similar supplier with the following fields:
      
      "id": The id of the similar supplier.
      "name": The name of the similar supplier.
      "rating": The rating of the similar supplier.
      The "target_price" section should be an object with the following fields:
      
      "min": The minimum price per unit.
      "max": The maximum price per unit.
      "average": The average price per unit.
      "suggested": The suggested price per unit, considering inflation.
      Here is the text to be processed:
       ${res[0].content[0].text.value}`
        const openai = new OpenAI({
          organization: orgKey,
          apiKey: apiKey
        });
        const response = await openai.chat.completions.create({
          messages: [{ role: "system", content: prompt }],
          model: "gpt-4o",
        });
        const responseText = response.choices[0].message.content;
        console.log({ responseText })
        const data = extractData(responseText);
        console.log({ data })
        return data
      }
    } else {
      const assistantId = 'asst_tfL4xioNajuOwi2515q3Tqg3';
      const res = await executeRun(threadId, assistantId)
      if (res.length) {
        const prompt = `Generate a JSON object based on the following message: ${res[0].content[0].text.value}
        The JSON object should contain the following keys:
        - category
        - suppliers (an array of objects with keys: name, id, rating)
        - suggested_price`;
        const openai = new OpenAI({
          organization: orgKey,
          apiKey: apiKey
        });
        const response = await openai.chat.completions.create({
          messages: [{ role: "system", content: prompt }],
          model: "gpt-4o",
        });
        const responseText = response.choices[0].message.content;
        console.log({responseText})
        const data = extractDataFromString(responseText);
        console.log({ data })
        return data
      }
    }
  } catch (err) {
    console.log({ err })
    throw new Error("No Suppliers")
  }
};

function extractJsonFromString(inputString) {
  // Extract the JSON part of the string
  const jsonStartIndex = inputString.indexOf('```json');
  const jsonEndIndex = inputString.lastIndexOf('```');
  const jsonString = inputString.slice(jsonStartIndex + 7, jsonEndIndex).trim();
  // Parse the JSON string into an object
  const jsonData = JSON.parse(jsonString);
  return jsonData;
}

openAiService.generateSOW = async (values) => {
  try {
    const threadId = await createThread();
    const messageId = await postMessage(JSON.stringify(values), threadId);
    const assistantId = 'asst_WwEYQQ1KamIVZy7VRFj9DBbc';
    const res =  await executeRun(threadId, assistantId)
    if (res.length) {
      const prompt = `Generate a JSON object based on the following message: ${res[0].content[0].text.value}
      The JSON object should contain the following keys:
      sow,
      title,
      description,

      Generate a crisp Title for the above response(job),
      SOW is all the a JSON object with all the key value pairs where key is a header and value is the description of the header and keys should not have '_' or  '-' and first letter should start with capital,
      Description should be a summary of the above response(job)
      `;
      const openai = new OpenAI({
        organization: orgKey,
        apiKey: apiKey
      });
      const response = await openai.chat.completions.create({
        messages: [{ role: "system", content: prompt }],
        model: "gpt-4o",
      });
      const responseText = response.choices[0].message.content;
      console.log({responseText})
      const data = extractJsonFromString(responseText);
      console.log({ data })
      return data
    }
    console.log(res[0].content[0].text.value)
  } catch (err) {
    console.log({ err })
    throw new Error("Please try after some time")
  }
};

openAiService.generateQuestionnaireAndCostComponents = async (values) => {
  try {
    const threadId = await createThread();
    const messageId = await postMessage(JSON.stringify(values), threadId);
    const assistantId = 'asst_buYpzv3TnxOPaoMXHLGNitek';
    const res =  await executeRun(threadId, assistantId)
    if (res.length) {
      const prompt = `Generate a JSON object based on the following message: ${res[0].content[0].text.value}
      The JSON object should contain the following keys:
      - questionnaire
      - costComponent
      questionnaire should have list of questions which should be extracted from the message,
      costComponent should have list of items which should also be extracted from the message`;
      const openai = new OpenAI({
        organization: orgKey,
        apiKey: apiKey
      });
      const response = await openai.chat.completions.create({
        messages: [{ role: "system", content: prompt }],
        model: "gpt-4o",
      });
      const responseText = response.choices[0].message.content;
      console.log({responseText})
      const data = extractJsonFromString(responseText);
      console.log({ data })
      return data
    }
    console.log(res[0].content[0].text.value)
  } catch (err) {
    console.log({ err })
    throw new Error("Please try after some time")
  }
}

openAiService.chatWithAssitentForProductSearch = async (values) => {
  console.log('values: ', values);
  let threadId = values.threadId;
  if (!threadId) {
    threadId = await createThread();
  }
  let response = {
    threadId,
    messages: [],
    requiredType: 'product-search',
  };
  try {
    const messageId = await postMessage(values.message, threadId);
    const assistantId = 'asst_dAQllN0HJ9xLoQdql9HBM0FN';
    const run = await executeRun(threadId, assistantId);
    console.log('run: ', run);
    if (run && run.length) {
      response.messages.push(_get(run[0], 'content[0].text.value'));
    }
    const responseResult = await determineEndOfProductOrCategorySearch(_get(run[0], 'content[0].text.value'));
    console.log({responseResult})
    if (responseResult) {
      // response.endOfThread = 1;
      response.requiredType = 'category-search';
      console.log('Calling catgory api!!');
      response = await openAiService.chatWithAssitentForCategorySearch({
        message: response.messages[0],
        });
      response.metaData = extractJSONFromString(_get(run[0], 'content[0].text.value'));
    }
  } catch (err) {
    console.log({err})
    throw new Error("Product search didn't happen properly!!!");
  }
  console.log('response: ', response);
  return response;
}

openAiService.chatWithAssitentForCategorySearch = async values => {
  let threadId = values.threadId;
  if (!threadId) {
    threadId = await createThread();
  }
  const response = {
    threadId,
    messages: [],
    requiredType: 'category-search',
    metaData: values.metaData ? values.metaData : {},
  };
  try {
    const messageId = await postMessage(values.message, threadId);
    const assistantId = 'asst_dbWVvsjZsQ96DXg1bhi6IGkM';
    const run = await executeRun(threadId, assistantId);
    console.log('run: ', run);
    if (run && run.length) {
      response.messages.push(_get(run[0], 'content[0].text.value'));
      const responseResult = await determineEndOfProductOrCategorySearch(_get(run[0], 'content[0].text.value'));
      console.log('responseResult: ', responseResult);
      if (responseResult) {
        response.endOfThread = 1;
        console.log('Calling catgory api done!!');
        response.metaData.category = extractJSONFromString(_get(run[0], 'content[0].text.value'));
        response.messages[0] = 'Thank you for your confirmation.';
      }
    }
  } catch (err) {
    console.log({err})
    throw new Error("Category search didn't happen properly!!!");
  }
  console.log('response in cate api: ', response);
  return response;
};

export default openAiService;

