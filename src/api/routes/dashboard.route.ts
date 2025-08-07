import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware';
import { getProductDashboardAnalytics } from '../controllers/dashboard.controller';

const dashboardRoute = Router();

dashboardRoute.get('/product-analytics', authenticate,getProductDashboardAnalytics);

export default dashboardRoute; 