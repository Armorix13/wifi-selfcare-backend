import express from 'express';
import {
  addFibreInstallationRequest,
  getAllFibreInstallationRequests,
  getInstallRequestById,
  assignEngineer,
  updateStatusAndRemarks,
  declineRequest,
  getRequestsByUserId,
  updateInstallationDetails
} from '../controllers/fibreInstallationRequest.controller';

const router = express.Router();

// Add new fibre installation request
router.post('/', addFibreInstallationRequest);

// Get all fibre installation requests (with pagination and filtering)
router.get('/', getAllFibreInstallationRequests);

// Get fibre installation request by ID
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
