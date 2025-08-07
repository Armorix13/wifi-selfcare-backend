import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware';
import { getProductDashboardAnalytics } from '../controllers/dashboard.controller';

const router = Router();

router.get('/product-analytics', authenticate, getProductDashboardAnalytics);

export default router; 