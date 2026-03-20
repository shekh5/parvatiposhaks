import express from "express";
import { loginUser, registerUser , logout,requestPasswordReset,resetPassword,getUserDetail,updatePassword,updateProfile,getUserList,getSingleUser,updateUserRole,deleteUser} from "../controllers/auth.controller.js";
import { loginValidator, userValidator } from "../validators/index.js";
import validateRequest from "../middleware/validator.middleware.js";
import { roleBasedAccess, verifyUserAuth } from "../middleware/userAuth.middleware.js";

const router = express.Router();
router.route("/admin/users").get(verifyUserAuth,roleBasedAccess("admin"),getUserList) //admin get all users
router.route("/admin/user/:id")
.get(verifyUserAuth,roleBasedAccess("admin"),getSingleUser) //admin get single user details
.put(verifyUserAuth,roleBasedAccess("admin"),updateUserRole) //admin update user role
.delete(verifyUserAuth,roleBasedAccess("admin"),deleteUser) //admin delete user

router.post("/signup",userValidator(),validateRequest,registerUser)
router.post("/SignIn",loginValidator(),validateRequest,loginUser)
router.route("/logout").post(logout)
router.route("/password/forgot").post(requestPasswordReset)//forgot password
router.route("/password/reset/:token").post(resetPassword)//reset password
router.route("/profile").post(verifyUserAuth,getUserDetail) //get user details
router.post("/password/update",verifyUserAuth,updatePassword) //update password
router.post("/profile/update",verifyUserAuth,updateProfile) //update profile
export default router;