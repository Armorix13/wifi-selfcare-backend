import { Router } from 'express';
import { upload } from '../services/upload.service';
import authenticate from '../../middleware/auth.middleware';
import {
  addAdvertisement,
  updateAdvertisement,
  deleteAdvertisement,
  getAllAdvertisements
} from '../controllers/advertisement.controller';

const router = Router();

// Add advertisement (with image upload)
router.post('/', authenticate, upload.single('image'), addAdvertisement);

// Update advertisement (optionally with new image)
router.patch('/:id', authenticate, upload.single('image'), updateAdvertisement);

// Delete advertisement
router.delete('/:id', authenticate, deleteAdvertisement);

// Get all advertisements
router.get('/', authenticate, getAllAdvertisements);

export default router; 