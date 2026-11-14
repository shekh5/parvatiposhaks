import { Router } from 'express';
import {
  deleteUser,
  getSingleUser,
  getUserDetail,
  getUserList,
  loginUser,
  logout,
  logoutAll,
  refreshSession,
  registerUser,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  updatePassword,
  updateProfile,
  updateUserRole,
  verifyEmail,
} from '../controllers/auth.controller.js';
import { roleBasedAccess, verifyUserAuth } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rateLimit.middleware.js';
import validate from '../middleware/validate.middleware.js';
import {
  forgotPasswordValidator,
  loginValidator,
  mongoIdParam,
  resetPasswordValidator,
  roleValidator,
  signupValidator,
  tokenParamValidator,
  updatePasswordValidator,
  updateProfileValidator,
} from '../validators/index.js';

const router = Router();
const admin = [verifyUserAuth, roleBasedAccess('admin')];

router.post('/signup', authLimiter, signupValidator(), validate, registerUser);
router.post('/signin', authLimiter, loginValidator(), validate, loginUser);
router.post('/token/refresh', authLimiter, refreshSession);
router.post('/logout', logout);
router.post('/logout-all', verifyUserAuth, logoutAll);

router.get('/email/verify/:token', tokenParamValidator(), validate, verifyEmail);
router.post('/email/resend', authLimiter, verifyUserAuth, resendVerification);

router.post('/password/forgot', authLimiter, forgotPasswordValidator(), validate, requestPasswordReset);
router.post('/password/reset/:token', authLimiter, resetPasswordValidator(), validate, resetPassword);
router.put('/password/update', verifyUserAuth, updatePasswordValidator(), validate, updatePassword);

router.get('/profile', verifyUserAuth, getUserDetail);
router.put('/profile', verifyUserAuth, updateProfileValidator(), validate, updateProfile);

router.get('/admin/users', admin, getUserList);
router
  .route('/admin/user/:id')
  .get(admin, mongoIdParam(), validate, getSingleUser)
  .put(admin, roleValidator(), validate, updateUserRole)
  .delete(admin, mongoIdParam(), validate, deleteUser);

export default router;
