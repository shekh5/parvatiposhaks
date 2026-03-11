import Product from "../models/product.models.js"
import asyncHandler from "../utils/async-handler.js"
import ErrorHandler from "../utils/api.Error.js" 
import apiResponse from "../utils/api.Response.js"
import apiFunctionality from "../utils/api.functionality.js"


const createProduct = asyncHandler(async (req,res)=>{
    const {name,description,price,category,Stock,Image} = req.body;
    const product = await Product.create({
        name,
        description,
        price,
        category, 
        Stock,
        Image
    })
    if(!product){
        return next(new ErrorHandler("Failed to create product",500))
    }else{
        return res.status(201).json({message:"Product created successfully",product})
    }
})


const getAllProducts = asyncHandler(async (req,res)=>{
    const resultPerPage =3;

    const apiFeatures = new apiFunctionality(Product.find(),req.query).search().filter();


    //getting filtered query before pagination
    const filteredQuery = apiFeatures.query.clone();//how works
    console.log("filtered query",filteredQuery)
    const productCount = await filteredQuery.countDocuments();//how works

    //calculate totalPages based on filtered count
    const totalPages = Math.ceil(productCount / resultPerPage);
    const page = Number(req.query.page) || 1;
    if(page > totalPages && productCount > 0){
        return next(new ErrorHandler("Page not exist",404))
    }

    //apply pagination after getting filtered query
    apiFeatures.pagination(resultPerPage);

    const products = await apiFeatures.query;

    if(!products || products.length === 0){
        return next(new ErrorHandler("Products not found",404))
    }
    res.status(200).json({message:"all products",products,productCount,resultPerPage,totalPages,currentPage:page})
})

const updateProduct = asyncHandler(async (req,res,next)=>{
    const id = req.params.id;
    if(!id){
        return next(new ErrorHandler("Product id is required",400))
    }
    let product = await Product.findByIdAndUpdate(id);
    if(!product){
        return  next(new ErrorHandler("Product not found",404))
    }
    product = await Product.findByIdAndUpdate(id,req.body,{new:true,runValidators:true})
    return res.status(200).json(new apiResponse(200,"Product updated successfully",product,true))
})


const deleteProduct = asyncHandler(async (req,res,next)=>{
    const id = req.params.id;
    if(!id){
        return next(new ErrorHandler("Product id is required",400))
    }
    const product = await Product.findByIdAndDelete(id);
    if(!product){
        return next(new ErrorHandler("Product not found",404))
    }
    return res.status(200).json({message:"Product deleted successfully"})
})

const getSingleProduct = asyncHandler(async (req,res,next)=>{
    const product = await Product.findById(req.params.id);
    if(!product){
        return next(new ErrorHandler("Product not found",404))
    }
    res.status(200).json({message:"single product",product})
})

export {getAllProducts,getSingleProduct,createProduct,updateProduct,deleteProduct}