import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware';
import { upload, excelUpload } from '../services/upload.service';
import { getProductDashboardAnalytics, getAllServicePlans, getEngineerAnalytics, getEngineerById, addEngineer, updateEngineer, deleteEngineer, getAllComplaintForEnginer, getEngineerDashboardAnalytics, addUserFromExcel, getAllLeaveRequests, getLeaveRequestAnalytics, approveRejectLeaveRequest, addUser, getUserManagementData, getUserDetailForUpdate, updateUser, getFullClientDetailsById } from '../controllers/dashboard.controller';
import { getAllOltTOAdminPanel } from '../controllers/olt.controller';

const dashboardRoute = Router();

dashboardRoute.get('/product-analytics', authenticate, getProductDashboardAnalytics);
dashboardRoute.get('/service-plans', authenticate, getAllServicePlans);

// Engineer Analytics Routes
dashboardRoute.get('/engineer-analytics', authenticate, getEngineerAnalytics);
dashboardRoute.get('/engineers/:id', authenticate, getEngineerById);
dashboardRoute.post('/add-engineer', authenticate, upload.single('profileImage'), addEngineer);
dashboardRoute.put('/update-engineer', authenticate, upload.single('profileImage'), updateEngineer);
dashboardRoute.delete('/engineers/:id', authenticate, deleteEngineer);

// User Management Routes
dashboardRoute.post('/add-user', authenticate, addUser);
dashboardRoute.get('/user-management', authenticate, getUserManagementData);
dashboardRoute.get('/user/:id/details-for-update', authenticate, getUserDetailForUpdate);
dashboardRoute.put('/update-user', authenticate, updateUser);
dashboardRoute.get('/client/:id/full-details', authenticate, getFullClientDetailsById);

// Engineer Complaint Routes
dashboardRoute.get('/engineer-complaints', authenticate, getAllComplaintForEnginer);
dashboardRoute.get('/engineer-dashboard', authenticate, getEngineerDashboardAnalytics);

// Leave Request Routes
dashboardRoute.get('/leave-requests', authenticate, getAllLeaveRequests);
dashboardRoute.get('/leave-requests-analytics', authenticate, getLeaveRequestAnalytics);
dashboardRoute.post('/leave-requests/approve-reject', authenticate, approveRejectLeaveRequest);

// Excel Upload Routes
dashboardRoute.post('/upload-users-excel', authenticate, excelUpload.array('files', 10), addUserFromExcel);

// OLT Routes
dashboardRoute.get('/olts', authenticate, getAllOltTOAdminPanel);

export default dashboardRoute; 