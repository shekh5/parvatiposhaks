export const sendToken = (user,statusCode,res)=>{
    const token = user.getJWTToken();

    //options for cookie
    const options = {
        expires:new Date(Date.now() + parseInt(process.env.EXPIRES_COOKIE)*24*60*60*1000),
        httpOnly:true
    }

    return res.status(statusCode).cookie("token",token,options).json({
        success:true,
        user,
        token
    })
}