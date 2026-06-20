import express from 'express';
import productRoute from './routes/productRoute.route.js';
import errorHandlerMiddleware from '../backend/middleware/error.middleware.js';
import authRoute from './routes/auth.route.js';
import orderRoute from './routes/order.route.js';
import cookieParser from "cookie-parser"
import cors from "cors"
import path from 'path'
import fileUpload from 'express-fileupload';


const app = express();

//middleware
app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(cookieParser())
app.use(express.static(path.join(path.resolve(), 'public')))//path for static files like images,css,js etc. we will put all our static files in public folder and access them from there
app.use(cors({
    origin:"http://localhost:5173",
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials:true
}))
app.use(fileUpload())

app.use("/api/v1",productRoute);
app.use("/api/v1",authRoute);
app.use("/api/v1",orderRoute);
app.get("/healthCheck",(req,res)=>{
    res.status(200).json({message:"Server is healthy"})
})


app.use(errorHandlerMiddleware)

export default app;