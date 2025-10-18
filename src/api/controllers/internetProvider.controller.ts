import { Request, Response, NextFunction } from 'express';
import { InternetProviderModel, IInternetProviderModel } from '../models/internetProvider.model';
import { sendError, sendSuccess } from '../../utils/helper';

// Add Internet Provider
export const addInternetProvider = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { name, logo, isActive } = req.body;

    // Validate required fields
    if (!name) {
      return sendError(res, "Provider name is required", 400);
    }

    // Check if provider with same name already exists
    const existingProvider = await InternetProviderModel.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingProvider) {
      return sendError(res, "Provider with this name already exists", 400);
    }

    // Create new provider
    const newProvider = new InternetProviderModel({
      name: name.trim(),
      logo: logo ? logo.trim() : '',
      isActive: isActive !== undefined ? isActive : true
    });

    const savedProvider = await newProvider.save();

    return sendSuccess(res, {
      provider: savedProvider
    }, "Internet provider added successfully");

  } catch (error) {
    console.error("Error in addInternetProvider:", error);
    next(error);
  }
};

// Get All Active Internet Providers
export const getActiveInternetProviders = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const activeProviders = await InternetProviderModel.find({ isActive: true })
      .select('_id name')
      .sort({ name: 1 });

    return sendSuccess(res, {
      providers: activeProviders,
      count: activeProviders.length
    }, "Active internet providers fetched successfully");

  } catch (error) {
    console.error("Error in getActiveInternetProviders:", error);
    next(error);
  }
};

// Get All Internet Providers (Active + Inactive)
export const getAllInternetProviders = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const allProviders = await InternetProviderModel.find().sort({ name: 1 });

    const activeCount = allProviders.filter(provider => provider.isActive).length;
    const inactiveCount = allProviders.filter(provider => !provider.isActive).length;

    return sendSuccess(res, {
      providers: allProviders,
      summary: {
        total: allProviders.length,
        active: activeCount,
        inactive: inactiveCount
      }
    }, "All internet providers fetched successfully");

  } catch (error) {
    console.error("Error in getAllInternetProviders:", error);
    next(error);
  }
};

// Update Internet Provider
export const updateInternetProvider = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { providerId } = req.params;
    const { name, logo, isActive } = req.body;

    // Validate provider ID
    if (!providerId) {
      return sendError(res, "Provider ID is required", 400);
    }

    // Find provider
    const provider = await InternetProviderModel.findById(providerId);
    if (!provider) {
      return sendError(res, "Internet provider not found", 404);
    }

    // Check if name is being updated and if it already exists for another provider
    if (name && name !== provider.name) {
      const existingProvider = await InternetProviderModel.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: providerId }
      });
      if (existingProvider) {
        return sendError(res, "Provider with this name already exists", 400);
      }
    }

    // Update provider
    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (logo !== undefined) updateData.logo = logo.trim();
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedProvider = await InternetProviderModel.findByIdAndUpdate(
      providerId,
      updateData,
      { new: true }
    );

    return sendSuccess(res, {
      provider: updatedProvider
    }, "Internet provider updated successfully");

  } catch (error) {
    console.error("Error in updateInternetProvider:", error);
    next(error);
  }
};

// Delete Internet Provider
export const deleteInternetProvider = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { providerId } = req.params;

    // Validate provider ID
    if (!providerId) {
      return sendError(res, "Provider ID is required", 400);
    }

    // Find and delete provider
    const deletedProvider = await InternetProviderModel.findByIdAndDelete(providerId);
    if (!deletedProvider) {
      return sendError(res, "Internet provider not found", 404);
    }

    return sendSuccess(res, {
      provider: deletedProvider
    }, "Internet provider deleted successfully");

  } catch (error) {
    console.error("Error in deleteInternetProvider:", error);
    next(error);
  }
};

// Toggle Provider Status (Activate/Deactivate)
export const toggleProviderStatus = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { providerId } = req.params;

    // Validate provider ID
    if (!providerId) {
      return sendError(res, "Provider ID is required", 400);
    }

    // Find provider
    const provider = await InternetProviderModel.findById(providerId);
    if (!provider) {
      return sendError(res, "Internet provider not found", 404);
    }

    // Toggle status
    provider.isActive = !provider.isActive;
    const updatedProvider = await provider.save();

    const statusMessage = updatedProvider.isActive ? "activated" : "deactivated";

    return sendSuccess(res, {
      provider: updatedProvider
    }, `Internet provider ${statusMessage} successfully`);

  } catch (error) {
    console.error("Error in toggleProviderStatus:", error);
    next(error);
  }
};
