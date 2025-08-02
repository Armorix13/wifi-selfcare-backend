import { Request, Response } from 'express';
import { Plan } from '../models/plan.model';
import { sendSuccess, sendError } from '../../utils/helper';

// Add a new plan
export const addPlan = async (req: Request, res: Response): Promise<any> => {
  try {
    const { title, price, validity, speed, dataLimit, provider, logo, benefits, description, planType } = req.body;
    const plan = new Plan({ title, price, validity, speed, dataLimit, provider, logo, benefits, description, planType });
    await plan.save();
    return sendSuccess(res, plan, 'Plan added successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to add plan', 400, error);
  }
};

// Update a plan by ID
export const updatePlan = async (req: Request, res: Response): Promise<any> => {
  try {
    // Destructure all required fields
    const { title, price, validity, speed, dataLimit, provider, logo, benefits, description, planType } = req.body;
    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      { title, price, validity, speed, dataLimit, provider, logo, benefits, description, planType },
      { new: true, runValidators: true }
    );
    if (!plan) {
      return sendError(res, 'Plan not found', 404);
    }
    return sendSuccess(res, plan, 'Plan updated successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to update plan', 400, error);
  }
};

// Delete a plan by ID
export const deletePlan = async (req: Request, res: Response): Promise<any> => {
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) {
      return sendError(res, 'Plan not found', 404);
    }
    return sendSuccess(res, { message: 'Plan deleted successfully' });
  } catch (error: any) {
    return sendError(res, 'Failed to delete plan', 400, error);
  }
};

// Get all plans with pagination
export const getAllPlans = async (req: Request, res: Response): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const total = await Plan.countDocuments();
    const plans = await Plan.find().skip(skip).limit(limit).sort({ createdAt: -1 });
    return sendSuccess(res, { plans, total, page, limit }, 'Plans retrieved successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to get plans', 400, error);
  }
};

// Get a plan by ID
export const getPlanById = async (req: Request, res: Response): Promise<any> => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return sendError(res, 'Plan not found', 404);
    }
    return sendSuccess(res, plan, 'Plan retrieved successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to get plan', 400, error);
  }
}; 