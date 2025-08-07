import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware';
import { getDashboardAnalytics } from '../controllers/dashboard.controller';

const router = Router();

router.get('/analytics', authenticate, getDashboardAnalytics);

export default router; 