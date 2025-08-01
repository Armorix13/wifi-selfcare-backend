import { Router } from 'express';
import { upload } from '../services/upload.service';
import authenticate from '../../middleware/auth.middleware';
import { addWifiInstallationRequest, updateWifiInstallationRequestStatus } from '../controllers/wifiInstallationRequest.controller';

const router = Router();

router.post(
  '/',
  upload.fields([
    { name: 'passportPhoto', maxCount: 1 },
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 }
  ]),
  authenticate,
  addWifiInstallationRequest
);

// Admin: Approve/reject installation request
router.patch('/:id/status', authenticate, updateWifiInstallationRequestStatus);

export default router; 