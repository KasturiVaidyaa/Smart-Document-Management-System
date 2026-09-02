import  express from 'express';
import dotenv from 'dotenv';
import connectDb from './database/db.js';
import bodyParser from 'body-parser';
import path from 'path';
import cookieParser from 'cookie-parser';
import cloudinary from 'cloudinary';
import axios from 'axios';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import FormData from 'form-data';
dotenv.config();
const port=process.env.PORT || 5005;

cloudinary.v2.config({
    cloud_name: process.env.Cloud_Name,
    api_key: process.env.Cloud_Api,
    api_secret: process.env.Cloud_Secret,
  });

const app=express();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(bodyParser.json()); 
app.use(express.json());
app.use(cookieParser());


import userRoutes from './routes/userRoutes.js';

app.use('/api/user', userRoutes);  



connectDb().then(() => {
  app.listen(process.env.PORT || port, () => {
    console.log(`Server is running on http://localhost:${process.env.PORT || port}`);
  });
});

