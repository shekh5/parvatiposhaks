import User from "../models/user.models.js";
import asyncHandler from "../utils/async-handler.js"
import ErrorHandler from "../utils/api.Error.js"
import apiResponse from "../utils/api.Response.js"
import { sendToken } from "../utils/jwtToken.js";
import { sendEmail } from "../utils/sendEmail.js";
import crypto from "crypto"
import { send } from "process";
// import bcrypt from "bcryptjs"

const registerUser = asyncHandler(async (req,res,next)=>{
    const {name,email,password,username} = req.body;

    // const hashedPassword = await bcrypt.hash(password,10);

    // if(await User.findOne({email})){
    //     return next(new ErrorHandler("Email already exists",400))
    // }

    const user = await User.create({
        name,
        email,
        // password:hashedPassword,
        password,
        username,
        avatar:{
            public_id:"sample_id",
            url:"sample_url"
        }
    })

    if(!user){
        return next(new ErrorHandler("Failed to register user",500))
    }

    const token = user.getJWTToken();
    console.log("Generated JWT Token:", token); // Debugging log to check token generation
    return res.status(201).json( new apiResponse(201,"user registered successfully",user,true,token))
})

const loginUser = asyncHandler(async (req,res,next)=>{
    const {email,password} = req.body;

    const user = await User.findOne({email}).select("+password");

    if(!user){
        return next(new ErrorHandler("Invalid Email or Pass",401))
    }

    const isPasswordValid = await user.isPasswordMatch(password)

    if(!isPasswordValid){
        return next(new ErrorHandler("Invalid email or password",401))
    }

    sendToken(user,201,res);

})

const logout = asyncHandler(async (req,res,next)=>{
    res.cookie("token",null,{
        expires:new Date(Date.now()),
        httpOnly:true
    })
    return res.status(200).json(new apiResponse(200,"Logged out successfully",null,true))
})

//forgot password
const requestPasswordReset = asyncHandler(async (req,res,next)=>{
    const user = await User.findOne({email:req.body.email});
    
    if(!user){
        return next(new ErrorHandler("User not found with this email",404))
    }
    let resetToken;
    try {
        resetToken = user.generatePasswordResetToken();
        await user.save({validateBeforeSave:false});
        //return res.status(200).json(new apiResponse(200,"Password reset link sent to your email",null,true))
    } catch (error) {
        return next(new ErrorHandler("could not save reset token, please try again later",500))
    }

    const resetPasswordUrl = `http://localhost:4000/api/v1/password/reset/${resetToken}`

    const message = `use the following link to reset your password:\n\n ${resetPasswordUrl}\n\n this link is valid for 5 minutes. \n\n if you did not request this email, please ignore it.`;
    
    try {
        //send email
        await sendEmail({
            email: user.email,
            subject: "Password Reset Request",
            message:message
        });
        res.status(200).json({success:true,message:`Password reset link sent to your email ${user.email}`})
    } catch (error) {
        user.resetPasswordToken = undefined
        user.resetPasswordExpires = undefined;
        await user.save({validateBeforeSave:false})
        return next(new ErrorHandler("Failed to send email, please try again later",500))
    }
})  

//reset password
const resetPassword = asyncHandler(async (req,res,next)=>{
    const resetToken = req.params.token
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    // console.log("Received reset token:", resetToken); // Debugging log to check received token
    const user = await User.findOne({
        resetPasswordToken:hashedToken,
        resetPasswordExpires:{$gt:Date.now()}
    })
    if(!user){
        return next(new ErrorHandler("Invalid or expired reset token",400))
    }
    const {password,confirmedPassword} = req.body;

    if(password !== confirmedPassword){
        return next(new ErrorHandler("Password and confirmed password do not match",400))
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save()
    sendToken(user,200,res);
})


//get user details
const getUserDetail = asyncHandler(async(req,res,next)=>{
    const user = await User.findById(req.user.id);

    if(!user){
        return next(new ErrorHandler("User not found",404))
    }
    return res.status(200).json(new apiResponse(200,"User details retrieved successfully",user,true))
})

const updatePassword = asyncHandler(async(req,res,next)=>{
    const {oldPassword,newPassword,confirmNewPassword} = req.body;

    const user =await User.findById(req.user.id).select("+password");//?
    if(!user){
        return next(new ErrorHandler("User not found",404))
    }

    const checkPasswordMatch = await user.isPasswordMatch(oldPassword);
    if(!checkPasswordMatch){
        return next(new ErrorHandler("Old password is incorrect",400))
    }

    if(newPassword !== confirmNewPassword){
        return next(new ErrorHandler("New password and confirm new password do not match",400))
    }

    user.password = newPassword;
    await user.save();
    sendToken(user,200,res);
})

const updateProfile = asyncHandler(async(req,res,next)=>{
    const {name,email} = req.body;
    const updateUserdetails = {
        name,
        email
    }
    const user =await User.findByIdAndUpdate(req.user.id,updateUserdetails,{
        new:true,
        runValidators:true
    })
    res.status(200).json(new apiResponse(200,"Profile updated successfully",user,true))
})

const getUserList = asyncHandler(async(req,res,next)=>{
    const users = await User.find();
    res.status(200).json(new apiResponse(200,"User list retrieved successfully",users))
})

const getSingleUser = asyncHandler(async(req,res,next)=>{
    const user = await User.findById(req.params.id)
    if(!user){
        return next(new ErrorHandler("User not found with id " + req.params.id,404))
    }
     res.status(200).json(new apiResponse(200,"User details retrieved successfully",user))
})

//admin- changing user role
const updateUserRole = asyncHandler(async(req,res,next)=>{
    const {role} = req.body;
    const newUserData = {
        role
    }
    const user = await User.findByIdAndUpdate(req.user.id,newUserData,{
        new:true,
        runValidators:true
    })
    if(!user){
        return next(new ErrorHandler("User not found",400))
    }
    res.status(200).json(new apiResponse(200,"User role updated successfully",user))
})

//admin delete user profile
const deleteUser = asyncHandler(async(req,res,next)=>{
    const user = await User.findById(req.params.id);
    if(!user){
        return next(new ErrorHandler("User not found",404))
    }
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json(new apiResponse(200,"User deleted successfully",null,true))
})
export {registerUser,loginUser,logout,requestPasswordReset,resetPassword,getUserDetail,updatePassword,updateProfile,getUserList,getSingleUser,updateUserRole,deleteUser }