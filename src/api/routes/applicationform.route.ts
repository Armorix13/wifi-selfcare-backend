import { Router } from 'express';
import {
    applyApplication,
    getApplicationById,
    getUserApplications,
    getAllApplications,
    updateApplicationStatus,
    deleteApplication
} from '../controllers/applicationform.controller';
import authenticate from '../../middleware/auth.middleware';

const router = Router();

// Apply for WiFi service (requires authentication)
router.post('/apply', authenticate, applyApplication);

// Get user's applications (requires authentication)
router.get('/user', authenticate, getUserApplications);

// Get specific application by ID (requires authentication)
router.get('/:id',authenticate, getApplicationById);

// Get all applications (admin only - requires authentication)
router.get('/', authenticate, getAllApplications);

// Update application status (admin only - requires authentication)
router.patch('/:id/status',authenticate, updateApplicationStatus);

// Delete application (admin only - requires authentication)
router.delete('/:id', authenticate, deleteApplication);

export default router; 