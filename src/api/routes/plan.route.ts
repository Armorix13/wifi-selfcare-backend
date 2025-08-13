import { Router } from 'express';
import {
  addPlan,
  updatePlan,
  deletePlan,
  getAllPlans,
  getPlanById
} from '../controllers/plan.controller';
import { upload } from '../services/upload.service';

const router = Router();

// Add a new plan
router.post('/', upload.single('logo'), addPlan);

// Update a plan by ID
router.put('/:id', upload.single('logo'), updatePlan);

// Delete a plan by ID
router.delete('/:id', deletePlan);

// Get all plans (with pagination)
router.get('/', getAllPlans);

// Get a plan by ID
router.get('/:id', getPlanById);

export default router; 