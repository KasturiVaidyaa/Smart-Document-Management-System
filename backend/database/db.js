import mongoose from "mongoose";

const connectDb=async()=>{
    try{
        await mongoose.connect(process.env.MONGO_URL,{
            dbName : "smart_document_management_system",
        });

        console.log("connected")

    }catch(error){
        console.log(error)
    }
};

export default connectDb;