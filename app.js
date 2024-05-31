import express from 'express'; 
  
const app = express(); 
const PORT = 4000; 
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

  
app.listen(PORT, (error) => { 
    if(!error) 
        console.log("Server is Successfully Running, and App is listening on port "+ PORT) 
    else 
        console.log("Error occurred, server can't start", error); 
    } 
); 