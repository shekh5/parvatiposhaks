import { Router } from 'express';
import {
  getSubscribers,
  sendContactMessage,
  subscribeNewsletter,
} from '../controllers/contact.controller.js';
import { roleBasedAccess, verifyUserAuth } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rateLimit.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { contactValidator, newsletterValidator } from '../validators/index.js';

const router = Router();

router.post('/contact', authLimiter, contactValidator(), validate, sendContactMessage);
router.post('/newsletter', authLimiter, newsletterValidator(), validate, subscribeNewsletter);
router.get('/admin/subscribers', verifyUserAuth, roleBasedAccess('admin'), getSubscribers);

export default router;
