import { Router } from 'express';
import { upload } from '../services/upload.service';
import authenticate from '../../middleware/auth.middleware';
import { 
  addOttPlan, 
  getOttPlanById, 
  updateOttPlan, 
  deleteOttPlan, 
  getAllOttPlans,
  getOttPlanStats
} from '../controllers/ottPlan.controller';

const router = Router();

// Get OTT plan statistics (must come before /:id routes)
router.get('/stats/overview', getOttPlanStats);

// Get all OTT plans with pagination and filters (must come before /:id routes)
router.get('/', getAllOttPlans);

// Add new OTT plan (with logo upload)
router.post(
  '/add',
  upload.single('logo'),
  addOttPlan
);

// Add new OTT plan with multiple logos (example)
router.post(
  '/add-multiple-logos',
  upload.array('logos', 5), // Allow up to 5 logo files
  addOttPlan
);

// Get OTT plan by ID
router.get('/:id', getOttPlanById);

// Update OTT plan (with optional logo upload)
router.put(
  '/:id',
  upload.single('logo'),
  updateOttPlan
);

// Delete OTT plan
router.delete('/:id', deleteOttPlan);

export default router; 