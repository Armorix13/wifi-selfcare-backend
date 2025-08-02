import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { sendSuccess, sendError } from '../../utils/helper';
import { OttPlan } from '../models/ottPlan.model';

export const addOttPlan = async (req: Request, res: Response): Promise<any> => {
  try {
    console.log('Add OTT Plan - Request received');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    
    // Check if logo is uploaded (for single file upload)
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

    // Parse ottApps array if it's a string
    let ottApps: string[] = [];
    if (data.ottApps) {
      if (typeof data.ottApps === 'string') {
        ottApps = JSON.parse(data.ottApps);
      } else {
        ottApps = data.ottApps;
      }
    }

    const newPlan = await OttPlan.create({
      title: data.title,
      price: Number(data.price),
      speedBeforeLimit: data.speedBeforeLimit,
      speedAfterLimit: data.speedAfterLimit,
      dataLimitGB: Number(data.dataLimitGB),
      isUnlimited: data.isUnlimited === 'true',
      validity: data.validity,
      ottApps: ottApps,
      callBenefit: data.callBenefit,
      provider: data.provider,
      logo: logoUrl,
      description: data.description,
      planType: 'ott'
    });
    return sendSuccess(res, newPlan, 'OTT plan created successfully', 201);
  } catch (error: any) {
    return sendError(res, 'Failed to create OTT plan', 500, error.message || error);
  }
};

export const getOttPlanById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid plan ID format', 400);
    }

    const plan = await OttPlan.findById(id);
    
    if (!plan) {
      return sendError(res, 'OTT plan not found', 404);
    }

    return sendSuccess(res, plan, 'OTT plan fetched successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to fetch OTT plan', 500, error.message || error);
  }
};

export const updateOttPlan = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid plan ID format', 400);
    }

    const plan = await OttPlan.findById(id);
    if (!plan) {
      return sendError(res, 'OTT plan not found', 404);
    }

    const data = req.body;
    const updateData: any = {};

    // Handle logo update if new file is uploaded (for single file upload)
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
    if (data.speedBeforeLimit) updateData.speedBeforeLimit = data.speedBeforeLimit;
    if (data.speedAfterLimit) updateData.speedAfterLimit = data.speedAfterLimit;
    if (data.dataLimitGB) updateData.dataLimitGB = Number(data.dataLimitGB);
    if (data.isUnlimited !== undefined) updateData.isUnlimited = data.isUnlimited === 'true';
    if (data.validity) updateData.validity = data.validity;
    if (data.callBenefit) updateData.callBenefit = data.callBenefit;
    if (data.provider) updateData.provider = data.provider;
    if (data.description) updateData.description = data.description;

    // Handle ottApps array update
    if (data.ottApps) {
      let ottApps: string[] = [];
      if (typeof data.ottApps === 'string') {
        ottApps = JSON.parse(data.ottApps);
      } else {
        ottApps = data.ottApps;
      }
      updateData.ottApps = ottApps;
    }

    const updatedPlan = await OttPlan.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    return sendSuccess(res, updatedPlan, 'OTT plan updated successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to update OTT plan', 500, error.message || error);
  }
};

export const deleteOttPlan = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid plan ID format', 400);
    }

    const plan = await OttPlan.findByIdAndDelete(id);
    
    if (!plan) {
      return sendError(res, 'OTT plan not found', 404);
    }

    return sendSuccess(res, {}, 'OTT plan deleted successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to delete OTT plan', 500, error.message || error);
  }
};

export const getAllOttPlans = async (req: Request, res: Response): Promise<any> => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search,
      provider,
      priceMin,
      priceMax,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter: any = {};

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { provider: { $regex: search, $options: 'i' } }
      ];
    }

    if (provider) {
      filter.provider = { $regex: provider, $options: 'i' };
    }

    if (priceMin || priceMax) {
      filter.price = {};
      if (priceMin) filter.price.$gte = Number(priceMin);
      if (priceMax) filter.price.$lte = Number(priceMax);
    }

    // Build sort object
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    const plans = await OttPlan.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await OttPlan.countDocuments(filter);

    return sendSuccess(res, {
      plans,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }, 'OTT plans fetched successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to fetch OTT plans', 500, error.message || error);
  }
};

export const getOttPlanStats = async (req: Request, res: Response): Promise<any> => {
  try {
    // Get total plans
    const totalPlans = await OttPlan.countDocuments();

    // Get plans by provider
    const providerStats = await OttPlan.aggregate([
      {
        $group: {
          _id: '$provider',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get price range stats
    const priceStats = await OttPlan.aggregate([
      {
        $group: {
          _id: null,
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          avgPrice: { $avg: '$price' }
        }
      }
    ]);

    // Get unlimited vs limited plans
    const unlimitedStats = await OttPlan.aggregate([
      {
        $group: {
          _id: '$isUnlimited',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      totalPlans,
      providerStats,
      priceStats: priceStats[0] || { minPrice: 0, maxPrice: 0, avgPrice: 0 },
      unlimitedStats
    };

    return sendSuccess(res, { stats }, 'OTT plan statistics fetched successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to fetch OTT plan statistics', 500, error.message || error);
  }
}; 