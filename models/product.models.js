 import mongoose from "mongoose";

 const productSchema = new mongoose.Schema({
    name: {
        type:String,
        required:[true,"Please enter product name"],
        trim:true
    },
    description:{
        type:String,
        required:[true,"Please enter product description"]
     },
    price:{
        type:Number,
        required:[true,"Please enter product price"],
        MaxLength:[8,"Price cannot exceed 8 characters"]
    },
    ratings:{
        type:Number,
        default:0
    },
    Image:[
        {
            public_id:{
                type:String,
                required:true
            },
            url:{
                type:String,
                required:true 
            }
        }
    ],
    category:{
        type:String,
        required:[true,"Please enter product category"]
    }, 
    Stock:{
        type:Number,
        required:[true,"Please enter product stock"],
        MaxLength:[7,"Stock cannot exceed 7 characters"],
        default:1
    },
    noOfreviews:{
        type:Number,
        default:0
    },
    reviews:[
        {
            name:{
                type:String,
                required:true
            },
            rating:{
                type:Number,
                required:true
            },
            comment:{
                type:String,
                required:true
            },
            timestamp:{
                type:Date,
                default:Date.now
            }
        }
    ],
    createdAt:{
        type:Date,
        default:Date.now
    } 
})

export default mongoose.model("Product",productSchema)