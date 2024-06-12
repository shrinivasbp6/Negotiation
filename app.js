import express from 'express'; 
import { port, apiKey, orgKey } from './config/index.js';
  
const app = express(); 
console.log(process.env.OPEN_AI_API_KEY, 'process.env')
import openAiService from './src/index.js';

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.get('/', async (req, res)=>{ 
  res.status(200); 
    res.send("found"); 
}); 

app.post('/', async (req, res)=>{ 
  res.status(200); 
  const result = await openAiService.chatWithAssitent(req.body);
  console.log({result})
  res.send(result); 
});

app.post('/message', async (req, res) => {
  console.log({req})
  const result = await openAiService.postNewMessage(req.body);
  res.send(result)
})

app.post('/assistant/delete', async (req, res) => {
  console.log({req})
  const result = await openAiService.deleteAssistant(req.body);
  res.send(result)
});

app.post('/supplier-suggestions', async (req, res) => {
  console.log({req})
  const result = await openAiService.suggestSuggestions(req.body);
  res.send(result)
});

app.post('/generate-sow', async (req, res) => {
  console.log({req})
  const result = await openAiService.generateSOW(req.body);
  res.send(result)
});

app.post('/generate-questionnaire-and-cost-components', async (req, res) => {
  console.log({req})
  const result = await openAiService.generateQuestionnaireAndCostComponents(req.body);
  res.send(result)
});

app.post('/product-search', async (req, res)=> {
  const result = await openAiService.chatWithAssitentForProductSearch(req.body);
  console.log({result})
  res.status(200);
  res.send(result); 
});

app.post('/category-search', async (req, res)=> {
  const result = await openAiService.chatWithAssitentForCategorySearch(req.body);
  console.log({result})
  res.status(200);
  res.send(result); 
});

  
app.listen(port, (error) => {
    if(!error) 
        console.log("Server is Successfully Running, and App is listening on port "+ port) 
    else 
        console.log("Error occurred, server can't start", error); 
    } 
);

