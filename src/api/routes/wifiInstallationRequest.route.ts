import { Router } from 'express';
import { upload } from '../services/upload.service';
import authenticate from '../../middleware/auth.middleware';
import { addWifiInstallationRequest, updateWifiInstallationRequestStatus, assignEngineerToWifiInstallationRequest, getAllWifiInstallationRequests, makeInstallationRequestActive } from '../controllers/wifiInstallationRequest.controller';

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

// Engineer: Make installation request active with images (3-4 images required)
router.post(
  '/:userId/make-active',
  authenticate,
  upload.array('images', 4),
  makeInstallationRequestActive
);

export default router; 