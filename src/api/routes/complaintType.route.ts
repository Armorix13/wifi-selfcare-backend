import { Router } from 'express';
import {
  createComplaintType,
  getAllComplaintTypes,
  getComplaintTypeById,
  updateComplaintType,
  deleteComplaintType
} from '../controllers/complaintType.controller';

const router = Router();

// Create a new complaint type
router.post('/complaint-types', (req, res, next) => { createComplaintType(req, res).catch(next); });

// Get all complaint types
router.get('/complaint-types', (req, res, next) => { getAllComplaintTypes(req, res).catch(next); });

// Get a single complaint type by ID
router.get('/complaint-types/:id', (req, res, next) => { getComplaintTypeById(req, res).catch(next); });

// Update a complaint type
router.put('/complaint-types/:id', (req, res, next) => { updateComplaintType(req, res).catch(next); });

// Delete a complaint type
router.delete('/complaint-types/:id', (req, res, next) => { deleteComplaintType(req, res).catch(next); });

export default router; 