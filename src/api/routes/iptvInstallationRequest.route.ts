import express from 'express';
import {
  addIptvInstallationRequest,
  getAllIptvInstallationRequests,
  getInstallRequestById,
  assignEngineer,
  updateStatusAndRemarks,
  declineRequest,
  getRequestsByUserId,
  updateInstallationDetails
} from '../controllers/iptvInstallationRequest.controller';
import authenticate from '../../middleware/auth.middleware';

const router = express.Router();

// Add new IPTV installation request
router.post('/',authenticate, addIptvInstallationRequest);

// Get all IPTV installation requests (with pagination and filtering)
router.get('/',authenticate, getAllIptvInstallationRequests);

// Get IPTV installation request by ID
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
