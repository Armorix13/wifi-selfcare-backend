import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware';
import { upload } from '../services/upload.service';
import { getProductDashboardAnalytics, getAllServicePlans, getEngineerAnalytics, getEngineerById, addEngineer, updateEngineer } from '../controllers/dashboard.controller';

const dashboardRoute = Router();

dashboardRoute.get('/product-analytics', authenticate, getProductDashboardAnalytics);
dashboardRoute.get('/service-plans', authenticate, getAllServicePlans);

// Engineer Analytics Routes
dashboardRoute.get('/engineer-analytics', authenticate, getEngineerAnalytics);
dashboardRoute.get('/engineers/:id', authenticate, getEngineerById);
dashboardRoute.post('/add-engineer', authenticate, upload.single('profileImage'), addEngineer);
dashboardRoute.put('/update-engineer', authenticate, upload.single('profileImage'), updateEngineer);

export default dashboardRoute; 