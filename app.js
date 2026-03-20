import express from 'express';
import productRoute from './routes/productRoute.route.js';
import errorHandlerMiddleware from '../backend/middleware/error.middleware.js';
import authRoute from './routes/auth.route.js';
import orderRoute from './routes/order.route.js';
import cookieParser from "cookie-parser"


const app = express();

//middleware
app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(cookieParser())

app.use("/api/v1",productRoute);
app.use("/api/v1",authRoute);
app.use("/api/v1",orderRoute);
app.get("/healthCheck",(req,res)=>{
    res.status(200).json({message:"Server is healthy"})
})


app.use(errorHandlerMiddleware)

export default app;