import ErrorHandler from "../utils/api.Error.js" 

export default (err,req,res,next)=>{
    err.statuscode = err.statuscode || 500;
    err.message = err.message || "Internal Server Error";

    if(err.name ==="CastError"){
        const message = `This is invalid resource ${err.path}`;
        err = new ErrorHandler(message,404)
    }

    if(err.code === 11000){
        const message = `Duplicate ${Object.keys(err.keyValue)} entered. already exists`;
        err = new ErrorHandler(message,400);
    }

    res.status(err.statuscode).json({
        success:false,
        message:err.message
        // message:err.stack
    })
}
