import express from "express";
import { loginUser, registerUser , logout,requestPasswordReset,resetPassword,getUserDetail,updatePassword,updateProfile} from "../controllers/auth.controller.js";
import { loginValidator, userValidator } from "../validators/index.js";
import validateRequest from "../middleware/validator.middleware.js";
import { verifyUserAuth } from "../middleware/userAuth.middleware.js";

const router = express.Router();

router.post("/signup",userValidator(),validateRequest,registerUser)
router.post("/SignIn",loginValidator(),validateRequest,loginUser)
router.route("/logout").post(logout)
router.route("/password/forgot").post(requestPasswordReset)//forgot password
router.route("/password/reset/:token").post(resetPassword)//reset password
router.route("/profile").post(verifyUserAuth,getUserDetail) //get user details
router.post("/password/update",verifyUserAuth,updatePassword) //update password
router.post("/profile/update",verifyUserAuth,updateProfile) //update profile
export default router;