import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware';
import { upload, excelUpload } from '../services/upload.service';
import { getProductDashboardAnalytics, getAllServicePlans, getEngineerAnalytics, getEngineerById, addEngineer, updateEngineer, deleteEngineer, getAllComplaintForEnginer, getEngineerDashboardAnalytics, addUserFromExcel, getAllLeaveRequests, getLeaveRequestAnalytics, approveRejectLeaveRequest, addUser, getUserManagementData, getUserDetailForUpdate, updateUser, getFullClientDetailsById, getExcelUsersWithoutCompleteData, getFullEngineerDetailsById, getAllUserForComplaintAssign, getAllUserForConnect, connectUserToDevice, mainDashboardData, fdbAvailablePort, connectDeviceToPort, disconnectDeviceFromPort, addBsnlUserFromExcel, addRailWireUserFromExcel, addMyInternetUserFromExcel, addConnectUserFromExcel, checkEmail } from '../controllers/dashboard.controller';
import { getAllOltTOAdminPanel } from '../controllers/olt.controller';

const dashboardRoute = Router();

// Main Dashboard Data Route
dashboardRoute.get('/main-data', authenticate, mainDashboardData);

dashboardRoute.get('/product-analytics', authenticate, getProductDashboardAnalytics);
dashboardRoute.get('/service-plans', authenticate, getAllServicePlans);

// Engineer Analytics Routes
dashboardRoute.get('/engineer-analytics', authenticate, getEngineerAnalytics);
dashboardRoute.get('/engineers/:id', authenticate, getEngineerById);
dashboardRoute.get('/engineers/:id/full-details', authenticate, getFullEngineerDetailsById);
dashboardRoute.post('/add-engineer', authenticate, upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'aadhaarFront', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 },
  { name: 'panCard', maxCount: 1 }
]), addEngineer);
dashboardRoute.put('/update-engineer', authenticate, upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'aadhaarFront', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 },
  { name: 'panCard', maxCount: 1 }
]), updateEngineer);
dashboardRoute.delete('/engineers/:id', authenticate, deleteEngineer);

// User Management Routes
dashboardRoute.post('/add-user', authenticate, addUser);
dashboardRoute.get('/user-management', authenticate, getUserManagementData);
dashboardRoute.get('/excel-users-incomplete', authenticate, getExcelUsersWithoutCompleteData);
dashboardRoute.get('/user/:id/details-for-update', authenticate, getUserDetailForUpdate);
dashboardRoute.put('/update-user', authenticate, updateUser);
dashboardRoute.get('/client/:id/full-details', authenticate, getFullClientDetailsById);
dashboardRoute.get('/users-for-complaint-assign', authenticate, getAllUserForComplaintAssign);
dashboardRoute.get('/users-for-connect', authenticate, getAllUserForConnect);
dashboardRoute.post('/connect-user-to-device', authenticate, connectUserToDevice);
dashboardRoute.post('/check-email', authenticate, checkEmail);

// Engineer Complaint Routes
dashboardRoute.get('/engineer-complaints', authenticate, getAllComplaintForEnginer);
dashboardRoute.get('/engineer-dashboard', authenticate, getEngineerDashboardAnalytics);

// Leave Request Routes
dashboardRoute.get('/leave-requests', authenticate, getAllLeaveRequests);
dashboardRoute.get('/leave-requests-analytics', authenticate, getLeaveRequestAnalytics);
dashboardRoute.post('/leave-requests/approve-reject', authenticate, approveRejectLeaveRequest);

// Excel Upload Routes
dashboardRoute.post('/upload-users-excel', authenticate, excelUpload.array('files', 10), addUserFromExcel);

//New workflow for company
dashboardRoute.post('/upload-bsnl-users-excel', authenticate, excelUpload.array('files', 10), addBsnlUserFromExcel);
dashboardRoute.post('/upload-railwire-users-excel', authenticate, excelUpload.array('files', 10), addRailWireUserFromExcel);
dashboardRoute.post('/upload-myinternet-users-excel', authenticate, excelUpload.array('files', 10), addMyInternetUserFromExcel);
dashboardRoute.post('/upload-connect-users-excel', authenticate, excelUpload.array('files', 10), addConnectUserFromExcel);


// OLT Routes
dashboardRoute.get('/olts', authenticate, getAllOltTOAdminPanel);

// FDB Routes
dashboardRoute.get('/fdb/:fdbId/ports', authenticate, fdbAvailablePort);
dashboardRoute.post('/fdb/connect-port', authenticate, connectDeviceToPort);
dashboardRoute.post('/fdb/disconnect-port', authenticate, disconnectDeviceFromPort);

export default dashboardRoute; 