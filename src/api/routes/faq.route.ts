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

const faqRouter = express.Router();

// Create single FAQ
faqRouter.post('/', createFAQ);

// Create multiple FAQs in bulk
faqRouter.post('/bulk', createBulkFAQs);

// Get FAQ by ID
faqRouter.get('/:id', getFAQById);

// Get all FAQs with pagination and filters
faqRouter.get('/', getAllFAQs);

// Get FAQ categories
faqRouter.get('/categories/list', getFAQCategories);

// Update FAQ
faqRouter.put('/:id', updateFAQ);

// Toggle FAQ status
faqRouter.patch('/:id/toggle-status', toggleFAQStatus);

// Delete single FAQ
faqRouter.delete('/:id', deleteFAQ);

// Delete multiple FAQs by IDs
faqRouter.delete('/bulk', deleteBulkFAQs);

export default faqRouter;
