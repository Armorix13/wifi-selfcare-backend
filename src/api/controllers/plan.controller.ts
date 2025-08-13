import { Request, Response } from 'express';
import { Plan } from '../models/plan.model';
import { sendSuccess, sendError } from '../../utils/helper';

// Add a new plan
export const addPlan = async (req: Request, res: Response): Promise<any> => {
  try {
    // Check if logo is uploaded
    if (!req.file) {
      return sendError(res, 'Logo image is required', 400);
    }

    // Extract file URL/path
    function extractViewUrl(filePath: string): string {
      const normalized = filePath.replace(/\\/g, '/');
      const idx = normalized.indexOf('/view/');
      return idx !== -1 ? normalized.substring(idx) : normalized;
    }

    const logoUrl = extractViewUrl(req.file.path);
    const data = req.body;

    // Parse benefits array if it's a string
    let benefits: string[] = [];
    if (data.benefits) {
      if (typeof data.benefits === 'string') {
        benefits = JSON.parse(data.benefits);
      } else {
        benefits = data.benefits;
      }
    }

    const plan = new Plan({ 
      title: data.title, 
      price: Number(data.price), 
      validity: Number(data.validity), 
      speed: Number(data.speed), 
      dataLimit: Number(data.dataLimit), 
      provider: data.provider, 
      logo: logoUrl, 
      benefits: benefits, 
      description: data.description, 
      planType: data.planType 
    });
    
    await plan.save();
    return sendSuccess(res, plan, 'Plan added successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to add plan', 400, error);
  }
};

// Update a plan by ID
export const updatePlan = async (req: Request, res: Response): Promise<any> => {
  try {
    const data = req.body;
    const updateData: any = {};

    // Handle logo update if new file is uploaded
    if (req.file) {
      function extractViewUrl(filePath: string): string {
        const normalized = filePath.replace(/\\/g, '/');
        const idx = normalized.indexOf('/view/');
        return idx !== -1 ? normalized.substring(idx) : normalized;
      }
      updateData.logo = extractViewUrl(req.file.path);
    }

    // Update other fields
    if (data.title) updateData.title = data.title;
    if (data.price) updateData.price = Number(data.price);
    if (data.validity) updateData.validity = Number(data.validity);
    if (data.speed) updateData.speed = Number(data.speed);
    if (data.dataLimit) updateData.dataLimit = Number(data.dataLimit);
    if (data.provider) updateData.provider = data.provider;
    if (data.description) updateData.description = data.description;
    if (data.planType) updateData.planType = data.planType;

    // Handle benefits array update
    if (data.benefits) {
      let benefits: string[] = [];
      if (typeof data.benefits === 'string') {
        benefits = JSON.parse(data.benefits);
      } else {
        benefits = data.benefits;
      }
      updateData.benefits = benefits;
    }

    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      updateData,
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