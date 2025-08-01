import { Request, Response } from 'express';
import { WifiInstallationRequest } from '../models/wifiInstallationRequest.model';
import { ApplicationForm } from '../models/applicationform.model';
import { sendSuccess, sendError } from '../../utils/helper';

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
    const userRole = (req as any).role;
    if (!['admin', 'superadmin', 'manager'].includes(userRole)) {
      return sendError(res, 'Forbidden: Admins only', 403);
    }
    
    const { id } = req.params;
    const { status, remarks } = req.body;
    
    if (!['inreview', 'approved', 'rejected'].includes(status)) {
      return sendError(res, 'Invalid status. Must be inreview, approved, or rejected', 400);
    }
    
    const update: any = { status, remarks };
    
    if (status === 'approved') {
      update.approvedDate = new Date();
    } else if (status === 'rejected') {
      update.approvedDate = null;
    }
    
    const updated = await WifiInstallationRequest.findByIdAndUpdate(
      id, 
      update, 
      { new: true }
    ).populate('userId', 'firstName lastName email phoneNumber')
     .populate('applicationId');
     
    if (!updated) {
      return sendError(res, 'Installation request not found', 404);
    }
    
    return sendSuccess(res, updated, `Request status updated to ${status}`);
  } catch (error: any) {
    return sendError(res, 'Failed to update request status.', 500, error.message || error);
  }
};

export const getInstallationRequestById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const request = await WifiInstallationRequest.findById(id)
      .populate('userId', 'firstName lastName email phoneNumber countryCode profileImage')
      .populate('applicationId');
      
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

export const getAllWifiInstallationRequests = async (req: Request, res: Response): Promise<any> => {
  try {
    const userRole = (req as any).role;
    if (!['admin', 'superadmin', 'manager'].includes(userRole)) {
      return sendError(res, 'Forbidden: Admins only', 403);
    }
    
    const { status, page = 1, limit = 10 } = req.query;
    
    const filter: any = {};
    if (status && ['inreview', 'approved', 'rejected'].includes(status as string)) {
      filter.status = status;
    }
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const requests = await WifiInstallationRequest.find(filter)
      .populate('userId', 'firstName lastName email phoneNumber countryCode profileImage')
      .populate('applicationId')
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
    return sendError(res, 'Failed to fetch installation requests', 500, error.message || error);
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
