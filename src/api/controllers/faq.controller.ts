import { Request, Response } from 'express';
import { FAQ } from '../models/faq.model';
import { sendError, sendSuccess } from '../../utils/helper';
import mongoose from 'mongoose';

// Create single FAQ
export const createFAQ = async (req: Request, res: Response): Promise<any> => {
    try {
        const {
            question,
            answer,
            category,
            tags,
            status
        } = req.body;

        const userId = (req as any).userId;

        // Validate required fields
        if (!question || !answer) {
            return sendError(res, 'Missing required fields: question, answer, category', 400);
        }

        const faq = new FAQ({
            question,
            answer,
            category,
            tags: tags || [],
            status: status || 'active',
            createdBy: userId
        });

        const savedFAQ = await faq.save();

        return sendSuccess(res, savedFAQ, 'FAQ created successfully', 201);
    } catch (error) {
        console.error('Error creating FAQ:', error);
        return sendError(res, 'Internal server error', 500, error instanceof Error ? error.message : 'Unknown error');
    }
};

// Create multiple FAQs in bulk
export const createBulkFAQs = async (req: Request, res: Response): Promise<any> => {
    try {
        const { faqs } = req.body;
        const userId = (req as any).userId;

        if (!Array.isArray(faqs) || faqs.length === 0) {
            return sendError(res, 'FAQs array is required and must not be empty', 400);
        }

        // Validate each FAQ
        for (const faq of faqs) {
            if (!faq.question || !faq.answer || !faq.category) {
                return sendError(res, 'Each FAQ must have question, answer, and category', 400);
            }
        }

        // Prepare FAQs with user info
        const faqsToCreate = faqs.map(faq => ({
            ...faq,
            tags: faq.tags || [],
            status: faq.status || 'active',
            createdBy: userId
        }));

        const createdFAQs = await FAQ.insertMany(faqsToCreate);

        return sendSuccess(res, createdFAQs, `${createdFAQs.length} FAQs created successfully`, 201);
    } catch (error) {
        console.error('Error creating bulk FAQs:', error);
        return sendError(res, 'Internal server error', 500, error instanceof Error ? error.message : 'Unknown error');
    }
};

// Get FAQ by ID
export const getFAQById = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;

        if (!id) {
            return sendError(res, 'FAQ ID is required', 400);
        }

        const faq = await FAQ.findOne({ _id: id, isDeleted: { $ne: true } })
            .populate('createdBy', 'firstName lastName email')
            .populate('updatedBy', 'firstName lastName email');

        if (!faq) {
            return sendError(res, 'FAQ not found', 404);
        }

        return sendSuccess(res, faq, 'FAQ retrieved successfully');
    } catch (error) {
        console.error('Error getting FAQ by ID:', error);
        return sendError(res, 'Internal server error', 500, error instanceof Error ? error.message : 'Unknown error');
    }
};

// Get all FAQs with pagination and filters
export const getAllFAQs = async (req: Request, res: Response): Promise<any> => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            category,
            search
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        // Build filter object
        const filter: any = { isDeleted: { $ne: true } };

        if (status) filter.status = status;
        if (category) filter.category = category;

        if (search) {
            filter.$or = [
                { question: { $regex: search, $options: 'i' } },
                { answer: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search as string, 'i')] } }
            ];
        }

        const faqs = await FAQ.find(filter)
            .populate('createdBy', 'firstName lastName email')
            .populate('updatedBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        const total = await FAQ.countDocuments(filter);

        const pagination = {
            currentPage: pageNum,
            totalPages: Math.ceil(total / limitNum),
            totalItems: total,
            itemsPerPage: limitNum
        };

        return sendSuccess(res, faqs, 'FAQs retrieved successfully', 200, pagination);
    } catch (error) {
        console.error('Error getting all FAQs:', error);
        return sendError(res, 'Internal server error', 500, error instanceof Error ? error.message : 'Unknown error');
    }
};

// Update FAQ
export const updateFAQ = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const userId = (req as any).userId;

        if (!id) {
            return sendError(res, 'FAQ ID is required', 400);
        }

        // Remove fields that shouldn't be updated directly
        delete updateData.createdAt;
        delete updateData.updatedAt;
        delete updateData.createdBy;

        // Add updatedBy field
        updateData.updatedBy = userId;

        const faq = await FAQ.findOneAndUpdate(
            { _id: id, isDeleted: { $ne: true } },
            updateData,
            { new: true, runValidators: true }
        ).populate('createdBy', 'firstName lastName email')
         .populate('updatedBy', 'firstName lastName email');

        if (!faq) {
            return sendError(res, 'FAQ not found', 404);
        }

        return sendSuccess(res, faq, 'FAQ updated successfully');
    } catch (error) {
        console.error('Error updating FAQ:', error);
        return sendError(res, 'Internal server error', 500, error instanceof Error ? error.message : 'Unknown error');
    }
};

// Delete single FAQ
export const deleteFAQ = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;

        if (!id) {
            return sendError(res, 'FAQ ID is required', 400);
        }

        const faq = await FAQ.findOneAndUpdate(
            { _id: id, isDeleted: { $ne: true } },
            { isDeleted: true },
            { new: true, runValidators: true }
        );

        if (!faq) {
            return sendError(res, 'FAQ not found', 404);
        }

        return sendSuccess(res, null, 'FAQ deleted successfully');
    } catch (error) {
        console.error('Error deleting FAQ:', error);
        return sendError(res, 'Internal server error', 500, error instanceof Error ? error.message : 'Unknown error');
    }
};

// Delete multiple FAQs by IDs
export const deleteBulkFAQs = async (req: Request, res: Response): Promise<any> => {
    try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return sendError(res, 'FAQ IDs array is required and must not be empty', 400);
        }

        // Validate that all IDs are valid MongoDB ObjectIds
        const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
        
        if (validIds.length !== ids.length) {
            return sendError(res, 'Some FAQ IDs are invalid', 400);
        }

        // Soft delete multiple FAQs
        const result = await FAQ.updateMany(
            { _id: { $in: validIds }, isDeleted: { $ne: true } },
            { isDeleted: true }
        );

        if (result.matchedCount === 0) {
            return sendError(res, 'No FAQs found to delete', 404);
        }

        return sendSuccess(res, { deletedCount: result.modifiedCount }, `${result.modifiedCount} FAQs deleted successfully`);
    } catch (error) {
        console.error('Error deleting bulk FAQs:', error);
        return sendError(res, 'Internal server error', 500, error instanceof Error ? error.message : 'Unknown error');
    }
};

// Get FAQ categories
export const getFAQCategories = async (req: Request, res: Response): Promise<any> => {
    try {
        const categories = await FAQ.aggregate([
            { $match: { isDeleted: { $ne: true } } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const categoryList = categories.map(cat => ({
            category: cat._id,
            count: cat.count
        }));

        return sendSuccess(res, categoryList, 'FAQ categories retrieved successfully');
    } catch (error) {
        console.error('Error getting FAQ categories:', error);
        return sendError(res, 'Internal server error', 500, error instanceof Error ? error.message : 'Unknown error');
    }
};

// Toggle FAQ status
export const toggleFAQStatus = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const userId = (req as any).userId;

        if (!id) {
            return sendError(res, 'FAQ ID is required', 400);
        }

        const faq = await FAQ.findOne({ _id: id, isDeleted: { $ne: true } });

        if (!faq) {
            return sendError(res, 'FAQ not found', 404);
        }

        // Toggle status
        const newStatus = faq.status === 'active' ? 'inactive' : 'active';

        const updatedFAQ = await FAQ.findOneAndUpdate(
            { _id: id, isDeleted: { $ne: true } },
            { 
                status: newStatus,
                updatedBy: userId
            },
            { new: true, runValidators: true }
        ).populate('createdBy', 'firstName lastName email')
         .populate('updatedBy', 'firstName lastName email');

        return sendSuccess(res, updatedFAQ, `FAQ status toggled to ${newStatus} successfully`);
    } catch (error) {
        console.error('Error toggling FAQ status:', error);
        return sendError(res, 'Internal server error', 500, error instanceof Error ? error.message : 'Unknown error');
    }
};
