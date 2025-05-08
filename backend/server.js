import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';

import authRoute from './routes/auth.route.js';
import productRoute from './routes/product.route.js';
import cartRoute from './routes/cart.route.js';
import couponRoute from './routes/coupon.route.js';
import paymentRoute from './routes/payment.route.js';
import analyticsRoute from './routes/analytics.route.js';

import { connectDB } from './lib/db.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const __dirname = path.resolve();

app.use(express.json({limit: "10mb"}));
app.use(cookieParser());


app.use("/api/auth", authRoute);
app.use("/api/products",productRoute);
app.use("/api/carts",cartRoute);
app.use("/api/coupons",couponRoute);
app.use("/api/payments",paymentRoute);
app.use("/api/analytics",analyticsRoute);

if(process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "/frontend/dist")));

    app.get("*",(req,res)=>{
        res.sendFile(path.resolve(__dirname,"frontend","dist","index.html"));
    })
}




app.listen(PORT,()=> {
    console.log("Server is running on http://localhost:"+PORT);

    connectDB();
})