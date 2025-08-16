import express from 'express';
import {
  addOttInstallationRequest,
  getAllOttInstallationRequests,
  getInstallRequestById,
  assignEngineer,
  updateStatusAndRemarks,
  declineRequest,
  getRequestsByUserId,
  updateInstallationDetails
} from '../controllers/ottInstallationRequest.controller';
import authenticate from '../../middleware/auth.middleware';

const router = express.Router();

// Add new OTT installation request
router.post('/',authenticate, addOttInstallationRequest);

// Get all OTT installation requests (with pagination and filtering)
router.get('/',authenticate, getAllOttInstallationRequests);

// Get OTT installation request by ID
router.get('/:id',authenticate, getInstallRequestById);

// Get requests by user ID
router.get('/user/:userId',authenticate, getRequestsByUserId);

// Assign engineer to request
router.patch('/:id/assign-engineer',authenticate, assignEngineer);

// Update status and remarks
router.patch('/:id/status',authenticate, updateStatusAndRemarks);

// Decline request
router.patch('/:id/decline',authenticate, declineRequest);

// Update installation details
router.patch('/:id/installation-details',authenticate, updateInstallationDetails);

export default router;
