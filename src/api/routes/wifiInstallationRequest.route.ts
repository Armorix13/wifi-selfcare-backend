import { Router } from 'express';
import { upload } from '../services/upload.service';
import authenticate from '../../middleware/auth.middleware';
import { addWifiInstallationRequest, updateWifiInstallationRequestStatus, assignEngineerToWifiInstallationRequest, getAllWifiInstallationRequests } from '../controllers/wifiInstallationRequest.controller';

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

// Admin: Assign engineer to installation request
router.patch('/:id/assign-engineer', authenticate, assignEngineerToWifiInstallationRequest);

router.get("/all-insallation-requests",authenticate,getAllWifiInstallationRequests)

export default router; 