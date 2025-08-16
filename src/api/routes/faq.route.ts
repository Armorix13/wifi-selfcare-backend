import express from 'express';
import {
    createFAQ,
    createBulkFAQs,
    getFAQById,
    getAllFAQs,
    updateFAQ,
    deleteFAQ,
    deleteBulkFAQs,
    getFAQCategories,
    toggleFAQStatus
} from '../controllers/faq.controller';
import authenticate from '../../middleware/auth.middleware';

const faqRouter = express.Router();

// Create single FAQ
faqRouter.post('/',authenticate, createFAQ);

// Create multiple FAQs in bulk
faqRouter.post('/bulk',authenticate, createBulkFAQs);

// Get FAQ by ID
faqRouter.get('/:id',authenticate, getFAQById);

// Get all FAQs with pagination and filters
faqRouter.get('/',authenticate, getAllFAQs);

// Get FAQ categories
faqRouter.get('/categories/list',authenticate, getFAQCategories);

// Update FAQ
faqRouter.put('/:id',authenticate, updateFAQ);

// Toggle FAQ status
faqRouter.patch('/:id/toggle-status',authenticate, toggleFAQStatus);

// Delete single FAQ
faqRouter.delete('/:id',authenticate, deleteFAQ);

// Delete multiple FAQs by IDs
faqRouter.delete('/bulk',authenticate, deleteBulkFAQs);

export default faqRouter;
