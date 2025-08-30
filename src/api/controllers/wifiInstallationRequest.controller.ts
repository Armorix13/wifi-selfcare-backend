import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { WifiInstallationRequest } from '../models/wifiInstallationRequest.model';
import { ApplicationForm } from '../models/applicationform.model';
import { UserModel } from '../models/user.model';
import { sendSuccess, sendError } from '../../utils/helper';

// TypeScript interfaces for better type safety
interface AuthenticatedRequest extends Request {
  userId?: string;
  role?: string;
}

interface InstallationRequestFilters {
  status?: string;
  search?: string;
  $or?: Array<{
    name?: RegExp;
    email?: RegExp;
    phoneNumber?: RegExp;
  }>;
}

interface PaginationParams {
  page: number;
  limit: number;
  getAll: boolean;
  search?: string;
  status?: string;
  sortBy: string;
  sortOrder: string;
}

interface InstallationRequestResponse {
  requests: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextPage: number | null;
    prevPage: number | null;
  };
  filters: {
    status: string | null;
    search: string | null;
    sortBy: string;
    sortOrder: string;
  };
}

export const addWifiInstallationRequest = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;

    const files = req.files as {
      [fieldname: string]: Express.Multer.File[];
    };
    if (!files || !files['passportPhoto'] || !files['aadhaarFront'] || !files['aadhaarBack']) {

      return sendError(res, 'All images (passportPhoto, aadhaarFront, aadhaarBack) are required.', 400);
    }

    // Extract file URLs/paths, always starting with /view/...
    function extractViewUrl(filePath: string): string {
      const normalized = filePath.replace(/\\/g, '/');
      const idx = normalized.indexOf('/view/');
      return idx !== -1 ? normalized.substring(idx) : normalized;
    }

    const passportPhotoUrl = extractViewUrl(files['passportPhoto'][0].path);
    const aadhaarFrontUrl = extractViewUrl(files['aadhaarFront'][0].path);
    const aadhaarBackUrl = extractViewUrl(files['aadhaarBack'][0].path);

    // Check if user has an approved application
    const approvedApplication = await ApplicationForm.findOne({
      userId,
      status: 'accept'
    });

    if (!approvedApplication) {
      return sendError(res, 'You need an approved application before submitting installation request.', 400);
    }

    // Check for existing installation request
    const lastRequest = await WifiInstallationRequest.findOne({ userId }).sort({ createdAt: -1 });
    if (lastRequest) {
      if (lastRequest.status === 'approved') {
        return sendError(res, 'Your request is approved, an engineer will visit/contact you soon.', 400);
      }
      if (lastRequest.status === 'inreview') {
        return sendError(res, 'You already have a pending installation request.', 400);
      }
    }

    const data = req.body;

    // Remove any status field from request body to prevent conflicts
    const { status, ...cleanData } = data;

    // Debug: Log the request body and clean data
    console.log('Request body:', req.body);
    console.log('Clean data:', cleanData);

    const requestData = {
      userId,
      applicationId: approvedApplication._id,
      name: cleanData.name,
      email: cleanData.email,
      phoneNumber: cleanData.phoneNumber,
      countryCode: cleanData.countryCode,
      alternateCountryCode: cleanData.alternateCountryCode,
      alternatePhoneNumber: cleanData.alternatePhoneNumber,
      passportPhotoUrl,
      aadhaarFrontUrl,
      aadhaarBackUrl,
      status: 'inreview'
    };

    console.log('Final request data:', requestData);

    const newRequest = new WifiInstallationRequest(requestData);

    // Force the status to be correct before saving
    newRequest.status = 'inreview';

    await newRequest.save();
    return sendSuccess(res, newRequest, 'Installation request submitted successfully.', 201);
  } catch (error: any) {
    return sendError(res, 'Failed to submit installation request.', 500, error.message || error);
  }
};

export const updateWifiInstallationRequestStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    // const userRole = (req as any).role;
    // if (!['admin', 'superadmin', 'manager'].includes(userRole)) {
    //   return sendError(res, 'Forbidden: Admins only', 403);
    // }

    const { id } = req.params;
    const { status, remarks, assignedEngineer } = req.body;

    console.log('Update request - ID:', id);
    console.log('Update request - Status:', status);
    console.log('Update request - Assigned Engineer:', assignedEngineer);

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid installation request ID format', 400);
    }

    if (!['inreview', 'approved', 'rejected'].includes(status)) {
      return sendError(res, 'Invalid status. Must be inreview, approved, or rejected', 400);
    }

    const update: any = { status, remarks };

    // Handle engineer assignment
    if (assignedEngineer) {
      // Validate ObjectId format for engineer
      if (!mongoose.Types.ObjectId.isValid(assignedEngineer)) {
        return sendError(res, 'Invalid engineer ID format', 400);
      }

      // Validate that the assigned user is actually an engineer
      const engineer = await UserModel.findById(assignedEngineer);
      if (!engineer) {
        return sendError(res, 'Engineer not found', 404);
      }
      if (engineer.role !== 'engineer') {
        return sendError(res, 'Assigned user is not an engineer', 400);
      }
      update.assignedEngineer = assignedEngineer;
    }

    if (status === 'approved') {
      update.approvedDate = new Date();
    } else if (status === 'rejected') {
      update.approvedDate = null;
    }

    console.log('Update data:', update);

    const updated = await WifiInstallationRequest.findByIdAndUpdate(
      id,
      update,
      { new: true }
    ).populate('userId', 'firstName lastName email phoneNumber')
      .populate('applicationId')
      .populate('assignedEngineer', 'firstName lastName email phoneNumber');

    if (!updated) {
      return sendError(res, 'Installation request not found', 404);
    }

    return sendSuccess(res, updated, `Request status updated to ${status}`);
  } catch (error: any) {
    console.error('Update error:', error);
    return sendError(res, 'Failed to update request status.', 500, error.message || error);
  }
};

export const getInstallationRequestById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const request = await WifiInstallationRequest.findById(id)
      .populate('userId', 'firstName lastName email phoneNumber countryCode profileImage')
      .populate('applicationId')
      .populate('assignedEngineer', 'firstName lastName email phoneNumber');

    if (!request) {
      return sendError(res, 'Installation request not found', 404);
    }

    return sendSuccess(res, request, 'Installation request fetched successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to fetch installation request', 500, error.message || error);
  }
};

export const getUserInstallationRequests = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return sendError(res, 'User not authenticated', 401);
    }

    const requests = await WifiInstallationRequest.find({ userId })
      .populate('applicationId')
      .sort({ createdAt: -1 });

    return sendSuccess(res, requests, 'User installation requests fetched successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to fetch user installation requests', 500, error.message || error);
  }
};

/**
 * Get all WiFi installation requests for the authenticated company
 * Only returns requests where applicationId.assignedCompany == companyId
 * Supports pagination and status filtering
 */
export const getAllWifiInstallationRequests = async (req: Request, res: Response): Promise<any> => {
  try {
    const companyId = (req as any).userId;

    const { status, page = 1, limit = 10, getAll = false } = req.query;

    const filter: any = {};
    if (status && ['inreview', 'approved', 'rejected'].includes(status as string)) {
      filter.status = status;
    }

    console.log(`🔍 Filtering WiFi installation requests for company: ${companyId}`);

    // First, get all ApplicationForm IDs that belong to this company
    const companyApplications = await ApplicationForm.find({
      assignedCompany: companyId
    }).select('_id');

    if (!companyApplications.length) {
      console.log(`🔍 No applications found for company: ${companyId}`);
      return sendSuccess(res, {
        requests: [],
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: 0,
          pages: 0
        }
      }, 'No installation requests found for this company');
    }

    const applicationIds = companyApplications.map(app => app._id);
    console.log(`🔍 Found ${applicationIds.length} applications for company: ${companyId}`);

    // Add status filter if provided
    if (status && ['inreview', 'approved', 'rejected'].includes(status as string)) {
      filter.status = status;
    }

    // Filter by the application IDs that belong to this company
    filter.applicationId = { $in: applicationIds };

    console.log(`🔍 Applied filter:`, JSON.stringify(filter, null, 2));

    // If getAll is true, return all data without pagination
    if (getAll === 'true' || getAll === '1') {
      const requests = await WifiInstallationRequest.find(filter)
        .populate('userId', 'firstName lastName email phoneNumber countryCode profileImage')
        .populate({
          path: 'applicationId',
          populate: {
            path: 'assignedCompany',
            select: 'companyName companyAddress companyPhone companyEmail'
          }
        })
        .populate('assignedEngineer', 'firstName lastName email phoneNumber')
        .sort({ createdAt: -1 });

      const total = requests.length;

      return sendSuccess(res, {
        requests,
        total,
        message: 'All installation requests fetched successfully (no pagination)'
      }, 'All installation requests fetched successfully');
    }

    // Default pagination behavior
    const skip = (Number(page) - 1) * Number(limit);

    const requests = await WifiInstallationRequest.find(filter)
      .populate('userId', 'firstName lastName email phoneNumber countryCode profileImage')
      .populate({
        path: 'applicationId',
        populate: {
          path: 'assignedCompany',
          select: 'companyName companyAddress companyPhone companyEmail'
        }
      })
      .populate('assignedEngineer', 'firstName lastName email phoneNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await WifiInstallationRequest.countDocuments(filter);

    return sendSuccess(res, {
      requests,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }, 'All installation requests fetched successfully');
  } catch (error: any) {
    console.error('Error in getAllWifiInstallationRequests:', error);
    return sendError(res, 'Failed to fetch installation requests', 500, error.message || error);
  }
};

export const assignEngineerToWifiInstallationRequest = async (req: Request, res: Response): Promise<any> => {
  try {
    // const userRole = (req as any).role;
    // if (!['admin', 'superadmin', 'manager'].includes(userRole)) {
    //   return sendError(res, 'Forbidden: Admins only', 403);
    // }

    const { id } = req.params;
    const { assignedEngineer } = req.body;

    console.log('Assign engineer - ID:', id);
    console.log('Assign engineer - Engineer ID:', assignedEngineer);

    // Validate ObjectId format for installation request
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid installation request ID format', 400);
    }

    if (!assignedEngineer) {
      return sendError(res, 'Engineer ID is required', 400);
    }

    // Validate ObjectId format for engineer
    if (!mongoose.Types.ObjectId.isValid(assignedEngineer)) {
      return sendError(res, 'Invalid engineer ID format', 400);
    }

    // Validate that the assigned user is actually an engineer
    const engineer = await UserModel.findById(assignedEngineer);
    if (!engineer) {
      return sendError(res, 'Engineer not found', 404);
    }
    if (engineer.role !== 'engineer') {
      return sendError(res, 'Assigned user is not an engineer', 400);
    }

    const updated = await WifiInstallationRequest.findByIdAndUpdate(
      id,
      { assignedEngineer },
      { new: true }
    ).populate('userId', 'firstName lastName email phoneNumber')
      .populate('applicationId')
      .populate('assignedEngineer', 'firstName lastName email phoneNumber');

    if (!updated) {
      return sendError(res, 'Installation request not found', 404);
    }

    return sendSuccess(res, updated, 'Engineer assigned successfully');
  } catch (error: any) {
    console.error('Assign engineer error:', error);
    return sendError(res, 'Failed to assign engineer', 500, error.message || error);
  }
};

export const deleteWifiInstallationRequest = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const userRole = (req as any).role;

    const request = await WifiInstallationRequest.findById(id);
    if (!request) {
      return sendError(res, 'Installation request not found', 404);
    }

    // Check permissions
    const isOwner = request.userId.toString() === userId;
    const isAdmin = ['admin', 'superadmin', 'manager'].includes(userRole);

    if (!isOwner && !isAdmin) {
      return sendError(res, 'Access denied', 403);
    }

    await WifiInstallationRequest.findByIdAndDelete(id);
    return sendSuccess(res, {}, 'Installation request deleted successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to delete installation request', 500, error.message || error);
  }
};



/**
 * Get all unique users who have applied for installation requests in engineer's company
 * Only accessible by engineers
 */

export const getAllUserInstallationRequests = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    // Extract and validate user ID from request
    const userId = req.userId;

    // Verify user is an engineer
    const engineer = await UserModel.findById(userId).select('role parentCompany');
    if (!engineer) {
      return sendError(res, 'Engineer not found', 404);
    }

    if (engineer.role !== 'engineer') {
      return sendError(res, 'Access denied: Only engineers can access this endpoint', 403);
    }

    if (!engineer.parentCompany) {
      return sendError(res, 'Engineer not associated with any company', 400);
    }

    const companyId = engineer.parentCompany;

    const uniqueUsers = await WifiInstallationRequest.aggregate([
      {
        $lookup: {
          from: 'applicationforms',
          localField: 'applicationId',
          foreignField: '_id',
          as: 'application'
        }
      },
      {
        $unwind: '$application'
      },
      {
        $match: {
          'application.assignedCompany': new mongoose.Types.ObjectId(companyId)
        }
      },
      {
        $group: {
          _id: '$userId',
          firstName: { $first: '$firstName' },
          lastName: { $first: '$lastName' },
          email: { $first: '$email' },
          phoneNumber: { $first: '$phoneNumber' },
          countryCode: { $first: '$countryCode' },
          profileImage: { $first: '$profileImage' },
          location: { $first: '$location' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      {
        $unwind: '$userDetails'
      },
      {
        $project: {
          _id: 1,
          firstName: '$userDetails.firstName',
          lastName: '$userDetails.lastName',
          email: '$userDetails.email',
          phoneNumber: '$userDetails.phoneNumber',
          countryCode: '$userDetails.countryCode',
          profileImage: '$userDetails.profileImage'
        }
      },
      {
        $sort: { firstName: 1 }
      }
    ]);

    return sendSuccess(
      res,
      uniqueUsers,
      `Successfully fetched ${uniqueUsers.length} unique user${uniqueUsers.length !== 1 ? 's' : ''}`
    );

  } catch (error: any) {
    console.error('Error in getAllUserInstallationRequests:', error);

    // Handle specific error types
    if (error.name === 'CastError') {
      return sendError(res, 'Invalid ID format provided', 400);
    }

    if (error.name === 'ValidationError') {
      return sendError(res, 'Validation error', 400, error.message);
    }

    return sendError(
      res,
      'Failed to fetch unique users',
      500,
      process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    );
  }
};
