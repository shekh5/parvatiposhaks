import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema({
    name:{type:String, required:true},
    username:{type:String, required:true,unique:true,trim:true,lowercase:true,indexing:true},
    email:{type:String, required:true, unique:true},
    isemailverified:{type:Boolean, default:false},
    password:{type:String, required:true,select:false},
    avatar:{
        public_id:{type:String, required:true},
        url:{type:String, required:true}
    },
    role:{
        type:String,
        default:"user"
    },
    resetPasswordToken:{type:String, default:""},
    resetPasswordExpires:{type:Date, default:null}
},{timestamps:true})

userSchema.pre("save", async function(next){
    if(!this.isModified("password")){
        return next();
    }
    this.password = await bcryptjs.hash(this.password,10);
})

userSchema.methods.getJWTToken = function(){
    const token = jwt.sign({id:this._id},process.env.JWT_SECRET,{
         expiresIn:process.env.JWT_EXPIRES_IN
    })
    return token;
}

userSchema.methods.isPasswordMatch = async function(userEnteredPassword){
    return await bcryptjs.compare(userEnteredPassword,this.password)
}


const User = mongoose.model("User", userSchema);

export default User;