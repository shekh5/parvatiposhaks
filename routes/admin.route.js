import { Router } from 'express';
import { getStats } from '../controllers/admin.controller.js';
import { roleBasedAccess, verifyUserAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/admin/stats', verifyUserAuth, roleBasedAccess('admin'), getStats);

export default router;
