import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware';
import { 
  addIVR,
  getAllIVRs,
  getIVRById,
  updateIVR,
  deleteIVR,
  assignIVRToCompany,
  unassignIVRFromCompany,
  getIVRsByCompany,
  getAssignedIVRs,
  getUnassignedIVRs,
  getIVRsByArea,
  toggleIVRStatus,
  checkCustomerDetails,
  addComplaintByIVR,
  addLeadFromIvr,
  complaintCheck
} from '../controllers/ivr.controller';

const ivrRoute = Router();

// Add IVR - requires authentication
ivrRoute.post('/add', authenticate, addIVR);

// Get All IVRs with filters (isAssigned, area, status, companyId) - requires authentication
ivrRoute.get('/all', authenticate, getAllIVRs);

// Get IVR by ID - requires authentication
ivrRoute.get('/:ivrId', authenticate, getIVRById);

// Update IVR - requires authentication
ivrRoute.put('/:ivrId', authenticate, updateIVR);

// Delete IVR - requires authentication
ivrRoute.delete('/:ivrId', authenticate, deleteIVR);

// Assign IVR to Company - requires authentication
ivrRoute.post('/:ivrId/assign', authenticate, assignIVRToCompany);

// Unassign IVR from Company - requires authentication
ivrRoute.post('/:ivrId/unassign', authenticate, unassignIVRFromCompany);

// Get IVRs by Company - requires authentication
ivrRoute.get('/company/:companyId', authenticate, getIVRsByCompany);

// Get Assigned IVRs - requires authentication
ivrRoute.get('/status/assigned', authenticate, getAssignedIVRs);

// Get Unassigned IVRs - requires authentication
ivrRoute.get('/status/unassigned', authenticate, getUnassignedIVRs);

// Get IVRs by Area - requires authentication
ivrRoute.get('/area/:area', authenticate, getIVRsByArea);

// Toggle IVR Status - requires authentication
ivrRoute.patch('/:ivrId/status', authenticate, toggleIVRStatus);

// Check Customer Details by Mobile Number - can be public or authenticated depending on IVR system requirements
ivrRoute.post('/check-customer', checkCustomerDetails);

// Add Complaint by IVR - public endpoint for IVR systems
ivrRoute.post('/add-complaint', addComplaintByIVR);

// Add Lead from IVR - public endpoint for IVR systems
ivrRoute.post('/add-lead', addLeadFromIvr);

// Check Complaint Status by User ID - public endpoint for IVR systems
ivrRoute.post('/check-complaint', complaintCheck);

export default ivrRoute;

