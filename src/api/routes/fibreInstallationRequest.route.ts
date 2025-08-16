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
import authenticate from '../../middleware/auth.middleware';

const router = express.Router();

// Add new fibre installation request
router.post('/',authenticate, addFibreInstallationRequest);

// Get all fibre installation requests (with pagination and filtering)
router.get('/',authenticate, getAllFibreInstallationRequests);

// Get fibre installation request by ID
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
