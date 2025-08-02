import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { sendSuccess, sendError } from '../../utils/helper';
import { IptvPlan } from '../models/iptvPlan.model';

export const addIptvPlan = async (req: Request, res: Response): Promise<any> => {
  try {
    console.log('Add IPTV Plan - Request received');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    
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

    // Parse channelList array if it's a string
    let channelList: string[] = [];
    if (data.channelList) {
      if (typeof data.channelList === 'string') {
        channelList = JSON.parse(data.channelList);
      } else {
        channelList = data.channelList;
      }
    }

    const newPlan = await IptvPlan.create({
      name: data.name,
      totalChannels: Number(data.totalChannels),
      payChannels: Number(data.payChannels),
      freeToAirChannels: Number(data.freeToAirChannels),
      price: Number(data.price),
      lcoMarginPercent: Number(data.lcoMarginPercent) || 10,
      distributorMarginPercent: Number(data.distributorMarginPercent) || 5,
      channelList: channelList,
      planType: data.planType,
      quality: data.quality || 'Mixed',
      provider: data.provider || 'Skypro',
      logo: logoUrl,
      description: data.description
    });
    
    return sendSuccess(res, newPlan, 'IPTV plan created successfully', 201);
  } catch (error: any) {
    return sendError(res, 'Failed to create IPTV plan', 500, error.message || error);
  }
};

export const getIptvPlanById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid plan ID format', 400);
    }

    const plan = await IptvPlan.findById(id);
    
    if (!plan) {
      return sendError(res, 'IPTV plan not found', 404);
    }

    return sendSuccess(res, plan, 'IPTV plan fetched successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to fetch IPTV plan', 500, error.message || error);
  }
};

export const updateIptvPlan = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid plan ID format', 400);
    }

    const plan = await IptvPlan.findById(id);
    if (!plan) {
      return sendError(res, 'IPTV plan not found', 404);
    }

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
    if (data.name) updateData.name = data.name;
    if (data.totalChannels) updateData.totalChannels = Number(data.totalChannels);
    if (data.payChannels) updateData.payChannels = Number(data.payChannels);
    if (data.freeToAirChannels) updateData.freeToAirChannels = Number(data.freeToAirChannels);
    if (data.price) updateData.price = Number(data.price);
    if (data.lcoMarginPercent) updateData.lcoMarginPercent = Number(data.lcoMarginPercent);
    if (data.distributorMarginPercent) updateData.distributorMarginPercent = Number(data.distributorMarginPercent);
    if (data.planType) updateData.planType = data.planType;
    if (data.quality) updateData.quality = data.quality;
    if (data.provider) updateData.provider = data.provider;
    if (data.description) updateData.description = data.description;

    // Handle channelList array update
    if (data.channelList) {
      let channelList: string[] = [];
      if (typeof data.channelList === 'string') {
        channelList = JSON.parse(data.channelList);
      } else {
        channelList = data.channelList;
      }
      updateData.channelList = channelList;
    }

    const updatedPlan = await IptvPlan.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    return sendSuccess(res, updatedPlan, 'IPTV plan updated successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to update IPTV plan', 500, error.message || error);
  }
};

export const deleteIptvPlan = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid plan ID format', 400);
    }

    const plan = await IptvPlan.findByIdAndDelete(id);
    
    if (!plan) {
      return sendError(res, 'IPTV plan not found', 404);
    }

    return sendSuccess(res, {}, 'IPTV plan deleted successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to delete IPTV plan', 500, error.message || error);
  }
};

export const getAllIptvPlans = async (req: Request, res: Response): Promise<any> => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search,
      provider,
      planType,
      quality,
      priceMin,
      priceMax,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter: any = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { provider: { $regex: search, $options: 'i' } }
      ];
    }

    if (provider) {
      filter.provider = { $regex: provider, $options: 'i' };
    }

    if (planType) {
      filter.planType = planType;
    }

    if (quality) {
      filter.quality = quality;
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

    const plans = await IptvPlan.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await IptvPlan.countDocuments(filter);

    return sendSuccess(res, {
      plans,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }, 'IPTV plans fetched successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to fetch IPTV plans', 500, error.message || error);
  }
};

export const getIptvPlanStats = async (req: Request, res: Response): Promise<any> => {
  try {
    // Get total plans
    const totalPlans = await IptvPlan.countDocuments();

    // Get plans by provider
    const providerStats = await IptvPlan.aggregate([
      {
        $group: {
          _id: '$provider',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get plans by plan type
    const planTypeStats = await IptvPlan.aggregate([
      {
        $group: {
          _id: '$planType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get plans by quality
    const qualityStats = await IptvPlan.aggregate([
      {
        $group: {
          _id: '$quality',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get price range stats
    const priceStats = await IptvPlan.aggregate([
      {
        $group: {
          _id: null,
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          avgPrice: { $avg: '$price' }
        }
      }
    ]);

    // Get channel stats
    const channelStats = await IptvPlan.aggregate([
      {
        $group: {
          _id: null,
          avgTotalChannels: { $avg: '$totalChannels' },
          avgPayChannels: { $avg: '$payChannels' },
          avgFreeChannels: { $avg: '$freeToAirChannels' }
        }
      }
    ]);

    const stats = {
      totalPlans,
      providerStats,
      planTypeStats,
      qualityStats,
      priceStats: priceStats[0] || { minPrice: 0, maxPrice: 0, avgPrice: 0 },
      channelStats: channelStats[0] || { avgTotalChannels: 0, avgPayChannels: 0, avgFreeChannels: 0 }
    };

    return sendSuccess(res, { stats }, 'IPTV plan statistics fetched successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to fetch IPTV plan statistics', 500, error.message || error);
  }
}; 