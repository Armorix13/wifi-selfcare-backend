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

const router = express.Router();

// Add new OTT installation request
router.post('/', addOttInstallationRequest);

// Get all OTT installation requests (with pagination and filtering)
router.get('/', getAllOttInstallationRequests);

// Get OTT installation request by ID
router.get('/:id', getInstallRequestById);

// Get requests by user ID
router.get('/user/:userId', getRequestsByUserId);

// Assign engineer to request
router.patch('/:id/assign-engineer', assignEngineer);

// Update status and remarks
router.patch('/:id/status', updateStatusAndRemarks);

// Decline request
router.patch('/:id/decline', declineRequest);

// Update installation details
router.patch('/:id/installation-details', updateInstallationDetails);

export default router;
