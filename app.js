import express from 'express'; 
import { port, apiKey, orgKey } from './config/index.js';
  
const app = express(); 
console.log(process.env.OPEN_AI_API_KEY, 'process.env')
import openAiService from './src/index.js';

app.use(express.json());

app.get('/', async (req, res)=>{ 
  res.status(200); 
  const result = await openAiService.chatWithAssitent(req.query);
  console.log({result})
  res.send(result); 
}); 

app.post('/message', async (req, res) => {
  console.log({req})
  const result = await openAiService.postNewMessage(req.body);
  res.send(result)
})

  
app.listen(port, (error) => { 
    if(!error) 
        console.log("Server is Successfully Running, and App is listening on port "+ port) 
    else 
        console.log("Error occurred, server can't start", error); 
    } 
); 