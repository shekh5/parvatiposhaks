import Product from "../models/product.models.js"
import asyncHandler from "../utils/async-handler.js"
import ErrorHandler from "../utils/api.Error.js" 
import apiResponse from "../utils/api.Response.js"
import apiFunctionality from "../utils/api.functionality.js"

// create product
const createProduct = asyncHandler(async (req,res)=>{
    req.body.user = req.user._id;
    const {name,description,price,category,Stock,Image} = req.body;
    const product = await Product.create({
        name,
        description,
        price,
        category, 
        Stock,
        Image,
        user:req.user._id
    })
    if(!product){
        return next(new ErrorHandler("Failed to create product",500))
    }else{
        return res.status(201).json({message:"Product created successfully",product})
    }
})

// get all products
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

// update product
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

// delete product
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

// accessing single product
const getSingleProduct = asyncHandler(async (req,res,next)=>{
    const product = await Product.findById(req.params.id);
    if(!product){
        return next(new ErrorHandler("Product not found",404))
    }
    res.status(200).json({message:"single product",product})
})

//creating and updating product review
const createProductReview = asyncHandler(async (req,res,next)=>{.0
    const {rating,comment} = req.body;
    const review = {
        user:req.user._id,
        name:req.user.name,
        rating:Number(rating),
        comment
    }
    // const product = await Product.findByIdAndUpdate(
    //     req.body.productId,
    //     {$push:{reviews:review},//push review to reviews array
    //     $inc:{noOfreviews:1} //increment noOfreviews by 1
    // },
    //     { new: true, runValidators: false }
    // );

    const product = await Product.findById(req.body.productId);
    const reviewExists = product.reviews.find(review=>review.user && review.user.toString() === req.user._id.toString())
    if(reviewExists){
        product.reviews.forEach(review=>{
            if(review.user && review.user.toString() === req.user._id.toString()){
                review.comment = comment;
                review.rating = rating;
            }
        })
    }else{
        product.reviews.push(review);
        product.noOfreviews = product.reviews.length;
    }

    let sum=0;
    product.reviews.forEach(review=>sum+=review.rating)
    product.ratings =product.reviews.length>0? sum/product.reviews.length:0;

    await product.save({validateBeforeSave:false});
    res.status(200).json(new apiResponse(200,"Review added/updated successfully",product,true))
})

//getting review
const getProductReviews = asyncHandler(async (req,res,next)=>{
    const product = await Product.findById(req.query.id);
    if(!product){
        return next(new ErrorHandler("Product not found",404))
    }
    res.status(200).json(new apiResponse(200,"Product reviews retrieved successfully",product.reviews))
})

//delete review
const deleteReview = asyncHandler(async (req,res,next)=>{
    const product = await Product.findById(req.query.productId);
    if(!product){
        return next(new ErrorHandler("Product not found",404))
    }
    const reviews = product.reviews.filter(review=>review._id.toString() !== req.query.id.toString())
    console.log("reviews",reviews)
    const noOfreviews = reviews.length;
    let sum=0;
    reviews.forEach(review=>sum+=review.rating)
    const ratings = reviews.length>0? sum/reviews.length:0;

    await Product.findByIdAndUpdate(req.query.productId,{reviews,noOfreviews,ratings},{new:true,runValidators:false})
    res.status(200).json(new apiResponse(200,"Review deleted successfully",null,true))
})

// admin getting all products without pagination and filter
const getAdminProducts = asyncHandler(async (req,res,next)=>{
    const products = await Product.find()
    res.status(200).json({sucess:true,products})
})

export {getAllProducts,getSingleProduct,createProduct,updateProduct,deleteProduct,getAdminProducts,createProductReview,getProductReviews,deleteReview}