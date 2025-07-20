import { Router } from 'express';
import {
  addPlan,
  updatePlan,
  deletePlan,
  getAllPlans,
  getPlanById
} from '../controllers/plan.controller';

const router = Router();

// Add a new plan
router.post('/', addPlan);

// Update a plan by ID
router.put('/:id', updatePlan);

// Delete a plan by ID
router.delete('/:id', deletePlan);

// Get all plans (with pagination)
router.get('/', getAllPlans);

// Get a plan by ID
router.get('/:id', getPlanById);

export default router; 