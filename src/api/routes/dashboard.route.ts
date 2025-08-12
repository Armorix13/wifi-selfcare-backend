import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware';
import { getProductDashboardAnalytics, getAllServicePlans } from '../controllers/dashboard.controller';

const dashboardRoute = Router();

dashboardRoute.get('/product-analytics', authenticate, getProductDashboardAnalytics);
dashboardRoute.get('/service-plans', authenticate, getAllServicePlans);

export default dashboardRoute; 