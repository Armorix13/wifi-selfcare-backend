import { Router } from 'express';
import { upload } from '../services/upload.service';
import authenticate from '../../middleware/auth.middleware';
import { addInstallationRequest, updateInstallationRequestStatus } from '../controllers/installationRequest.controller';

const router = Router();

// User: Add installation request with multi-image upload
router.post(
  '/',
  upload.fields([
    { name: 'passportPhoto', maxCount: 1 },
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 }
  ]),
  authenticate,
  addInstallationRequest
);

// Admin: Approve/reject installation request
router.patch('/:id/status', authenticate, updateInstallationRequestStatus);

export default router; 