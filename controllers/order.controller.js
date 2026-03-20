import Order from "../models/order.model.js";
import asyncHandler from "../utils/async-handler.js";
import Product from "../models/product.models.js";
import User from "../models/user.models.js";
import ErrorHandler from "../utils/api.Error.js";
import apiResponse from "../utils/api.Response.js";
// import apiFunctionality from "../utils/api.functionality.js";


async function updateQuanity(id,quantity){
    const product = await Product.findById(id);
    if(!product){
        return next(new ErrorHandler("Product not found",404))
    }
    product.stock -= quantity;
    await product.save({validateBeforeSave:false})
}

//create new order
const createOrder = asyncHandler(async (req,res,next)=>{
    const {shippingInfo,orderItems,paymentInfo,itemsPrice,taxPrice,shippingPrice,totalPrice} = req.body;

    const order = await Order.create({
        shippingInfo,
        orderItems,
        user:req.user._id,
        paymentInfo,
        itemsPrice,
        taxPrice,
        shippingPrice,
        totalPrice,
        paidAt:Date.now()
    })

    if(!order){
        return next(new ErrorHandler("Failed to create order",500))
    }else{
        return res.status(201).json({message:"Order created successfully",order})
    }
})

//get single order
const getSingleOrder = asyncHandler(async (req,res,next)=>{
    const order = await Order.findById(req.params.id).populate("user","name email")
    if(!order){
        return next(new ErrorHandler("Order not found",404))
    }else{
        return res.status(200).json({message:"Order details",order})
    }
})

//all my orders
const myOrders = asyncHandler(async (req,res,next)=>{
    const orders = await Order.find({user:req.user._id})
    if(!orders || orders.length === 0){
        return next(new ErrorHandler("No orders found for this user",404))
    }else{
        return res.status(200).json({message:"My orders",orders})
    }
})

//get all orders for admin
const getAllOrders = asyncHandler(async (req,res,next)=>{
    const orders = await Order.find().populate("user","name email")
    let totalAmount = 0;
    orders.forEach(order=>{ totalAmount += order.totalPrice })
    return res.status(200).json({message:"All orders",orders,totalAmount})
})

//updateorder status
const updateOrderStatus = asyncHandler(async (req,res,next)=>{
    const order = await Order.findById(req.params.id)
    if(!order){
        return next(new ErrorHandler("Order not found",404))
    }
    if(order.orderStatus === "Delivered"){
        return next(new ErrorHandler("You have already delivered this order",400))
    }
    await Promise.all(order.orderItems.map(item=>updateQuanity (item.product,item.quantity)))//meaning of this line
    order.orderStatus = req.body.status;
    console.log("order status",order.orderStatus)
    if(req.body.status === "Delivered"){
        order.deliveredAt = Date.now();
    }
    return res.status(200).json({message:"Order status updated successfully",order,success:true})
})


//delete order by admin
const deleteOrder = asyncHandler(async (req,res,next)=>{
    const order = await Order.findById(req.params.id)
    if(!order){
        return next(new ErrorHandler("Order not found",404))
    }
    const orderStatus = order.orderStatus;
    if(orderStatus === "Delivered"){
        await order.deleteOne({_id:req.params.id})
        return res.status(200).json({message:"Order deleted successfully"})
    }
    else{
        return next(new ErrorHandler("You can't delete this order until it's delivered",400))
    }
})

export {createOrder,getSingleOrder,myOrders,getAllOrders,updateOrderStatus,deleteOrder} 