import express, { json } from "express";
import authroutes from "./routes/auth.js"
import { connectKafka } from "./utils/producer.js";


const app =express();
app.use(express.json({ limit: '50mb' }))

connectKafka();


app.use('/api/auth',authroutes)








export default app