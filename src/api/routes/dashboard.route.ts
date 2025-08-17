import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware';
import { getProductDashboardAnalytics, getAllServicePlans, getEngineerAnalytics, getEngineerById } from '../controllers/dashboard.controller';

const dashboardRoute = Router();

dashboardRoute.get('/product-analytics', authenticate, getProductDashboardAnalytics);
dashboardRoute.get('/service-plans', authenticate, getAllServicePlans);

// Engineer Analytics Routes
dashboardRoute.get('/engineer-analytics', authenticate, getEngineerAnalytics);
dashboardRoute.get('/engineers/:id', authenticate, getEngineerById);

export default dashboardRoute; 