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

router.post('/', authenticate, upload.single('image'), addAdvertisement);

router.patch('/:id', authenticate, upload.single('image'), updateAdvertisement);

router.delete('/:id', authenticate, deleteAdvertisement);

router.get('/', authenticate, getAllAdvertisements);

export default router; 