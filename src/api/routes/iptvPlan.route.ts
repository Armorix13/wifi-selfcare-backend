import express from 'express';
import {
  addIptvPlan,
  getIptvPlanById,
  updateIptvPlan,
  deleteIptvPlan,
  getAllIptvPlans,
  getIptvPlanStats
} from '../controllers/iptvPlan.controller';
import { upload } from '../services/upload.service';

const router = express.Router();

// Routes
router.post('/add', upload.single('logo'), addIptvPlan);
router.get('/all', getAllIptvPlans);
router.get('/stats', getIptvPlanStats);
router.get('/:id', getIptvPlanById);
router.put('/:id', upload.single('logo'), updateIptvPlan);
router.delete('/:id', deleteIptvPlan);

export default router; 