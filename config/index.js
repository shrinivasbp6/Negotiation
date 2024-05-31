import dotenv from 'dotenv';
const result = dotenv.config();

export const port = process.env.PORT;
export const apiKey = process.env.OPEN_AI_API_KEY;
export const orgKey = process.env.OPEN_AI_ORGANISATION_KEY;