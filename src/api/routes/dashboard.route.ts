import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware';
import { upload } from '../services/upload.service';
import { getProductDashboardAnalytics, getAllServicePlans, getEngineerAnalytics, getEngineerById, addEngineer, updateEngineer, deleteEngineer, getAllComplaintForEnginer, getEngineerDashboardAnalytics } from '../controllers/dashboard.controller';

const dashboardRoute = Router();

dashboardRoute.get('/product-analytics', authenticate, getProductDashboardAnalytics);
dashboardRoute.get('/service-plans', authenticate, getAllServicePlans);

// Engineer Analytics Routes
dashboardRoute.get('/engineer-analytics', authenticate, getEngineerAnalytics);
dashboardRoute.get('/engineers/:id', authenticate, getEngineerById);
dashboardRoute.post('/add-engineer', authenticate, upload.single('profileImage'), addEngineer);
dashboardRoute.put('/update-engineer', authenticate, upload.single('profileImage'), updateEngineer);
dashboardRoute.delete('/engineers/:id', authenticate, deleteEngineer);

// Engineer Complaint Routes
dashboardRoute.get('/engineer-complaints', authenticate, getAllComplaintForEnginer);
dashboardRoute.get('/engineer-dashboard', authenticate, getEngineerDashboardAnalytics);

export default dashboardRoute; 