import { Request, Response } from 'express';
import mongoose from 'mongoose';
import moment from 'moment';
import { WifiInstallationRequest } from '../models/wifiInstallationRequest.model';
import { ApplicationForm } from '../models/applicationform.model';
import { UserModel } from '../models/user.model';
import { sendSuccess, sendError } from '../../utils/helper';
import Modem from '../models/modem.model';
import { CustomerModel } from '../models/customer.model';
import { OLTModel } from '../models/olt.model';
import { FDBModel } from '../models/fdb.model';

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

    const { id } = req.params;
    const { status, remarks, assignedEngineer, oltId, fdbId, modemName, ontType, modelNumber, serialNumber, ontMac, username, password ,mtceFranchise,bbUserId,ftthExchangePlan,bbPlan,workingStatus,ruralUrban,
      acquisitionType } = req.body;

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

    const request = await WifiInstallationRequest.findById(id);
    if (!request) {
      return sendError(res, 'Installation request not found', 404);
    }

    if (status === 'approved') {
      
      const fdb = await FDBModel.findOne({
        fdbId: fdbId
      });
  
      if(!fdb) {
        return sendError(res, 'FDB not found', 404);
      }
      update.approvedDate = new Date();
      //adding modem data to modem model
      await Modem.create({
        userId: request.userId,
        modemName: modemName,
        ontType: ontType,
        modelNumber: modelNumber,
        serialNumber: serialNumber,
        ontMac: ontMac,
        username: username,
        password: password
      });

      await CustomerModel.create({
        userId: request.userId,
        fdbId: fdb._id,
        oltId: oltId,
        installationDate: Date.now()
      });
      
      // Add user connection to FDB outputs
      if(fdb._id){
        try {
          const fdbData = await FDBModel.findById(fdb._id);
          if(fdbData){
            // Initialize outputs array if it doesn't exist
            if (!fdbData.outputs) {
              fdbData.outputs = [];
            }
            
            // Check if user is already connected to prevent duplicates
            const existingUserConnection = fdbData.outputs.find(
              output => output.type === 'user' && output.id === request.userId.toString()
            );
            
            if (!existingUserConnection) {
              fdbData.outputs.push({
                type: 'user',
                id: request.userId.toString(),
                description: `User connection for ${request.name || 'Customer'}`
              });
              await fdbData.save();
            } else {
              console.log(`User ${request.userId} is already connected to FDB ${fdb.fdbId}`);
            }
          }
        } catch (error) {
          console.error('Error adding user to FDB outputs:', error);
          // Continue execution as this is not critical for the main flow
        }
      }
      const user = await UserModel.findById(request.userId);
      if(user) {
        user.mtceFranchise = mtceFranchise;
        user.bbUserId = bbUserId;
        user.ftthExchangePlan = ftthExchangePlan;
        user.bbPlan = bbPlan;
        user.workingStatus = workingStatus;
        user.ruralUrban = ruralUrban;
        user.acquisitionType = acquisitionType;
        await user.save();
      }
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

      // For approved requests, fetch additional customer and modem details
      const requestsWithDetails = await Promise.all(requests.map(async (request) => {
        const requestObj = request.toObject();
        
        if (request.status === 'approved') {
          // Fetch customer details
          const customerDetails = await CustomerModel.findOne({ userId: request.userId })
            .populate('fdbId', 'fdbName fdbType fdbPower latitude longitude input serialNumber powerStatus')
            .populate('oltId', 'oltName oltType oltPower latitude longitude serialNumber powerStatus');

          // Fetch modem details
          const modemDetails = await Modem.findOne({ userId: request.userId });

          return {
            ...requestObj,
            customerDetails: customerDetails || null,
            modemDetails: modemDetails || null
          };
        }

        return requestObj;
      }));

      const total = requestsWithDetails.length;

      return sendSuccess(res, {
        requests: requestsWithDetails,
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

    // For approved requests, fetch additional customer and modem details
    const requestsWithDetails = await Promise.all(requests.map(async (request) => {
      const requestObj = request.toObject();
      
      if (request.status === 'approved') {
        // Fetch customer details
        const customerDetails = await CustomerModel.findOne({ userId: request.userId })
          .populate('fdbId', 'fdbName fdbType fdbPower latitude longitude input serialNumber powerStatus status attachments')
          .populate('oltId', 'oltName oltType oltPower latitude longitude serialNumber powerStatus status');

        // Fetch modem details
        const modemDetails = await Modem.findOne({ userId: request.userId });

        const userDetails = await UserModel.findById(request.userId);

        if(!userDetails) {
          return sendError(res, 'User not found', 404);
        }

        const businessInformationDetails = {
          mtceFranchise: userDetails.mtceFranchise,
        bbUserId: userDetails.bbUserId,
        ftthExchangePlan: userDetails.ftthExchangePlan,
        bbPlan: userDetails.bbPlan,
        workingStatus: userDetails.workingStatus,
        ruralUrban: userDetails.ruralUrban,
        acquisitionType: userDetails.acquisitionType
        }

        return {
          ...requestObj,
          customerDetails: customerDetails || null,
          modemDetails: modemDetails || null,
          businessInformationDetails: businessInformationDetails || null
        };
      }

      return requestObj;
    }));

    const total = await WifiInstallationRequest.countDocuments(filter);

    return sendSuccess(res, {
      requests: requestsWithDetails,
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
 * Includes customer details and user model data
 */

export const getAllUserInstallationRequests = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    // Extract and validate user ID from request
    const userId = req.userId;
    const { isInstalled } = req.query; // Get isInstalled filter from query

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

    // Build match conditions for the aggregation
    const matchConditions: any = {
      'application.assignedCompany': new mongoose.Types.ObjectId(companyId)
    };

    // Add isInstalled filter if provided
    if (isInstalled !== undefined) {
      const isInstalledValue = isInstalled === 'true' || isInstalled === '1';
      matchConditions['customerDetails.isInstalled'] = isInstalledValue;
    }

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
        $lookup: {
          from: 'customers',
          localField: 'userId',
          foreignField: 'userId',
          as: 'customerDetails'
        }
      },
      {
        $match: matchConditions
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
        $lookup: {
          from: 'customers',
          localField: '_id',
          foreignField: 'userId',
          as: 'customerDetails'
        }
      },
      {
        $lookup: {
          from: 'fdbs',
          localField: 'customerDetails.fdbId',
          foreignField: '_id',
          as: 'fdbDetails'
        }
      },
      {
        $lookup: {
          from: 'olts',
          localField: 'customerDetails.oltId',
          foreignField: '_id',
          as: 'oltDetails'
        }
      },
      {
        $lookup: {
          from: 'modems',
          localField: '_id',
          foreignField: 'userId',
          as: 'modemDetails'
        }
      },
      {
        $project: {
          _id: 1,
          // User Details
          user: {
            firstName: '$userDetails.firstName',
            lastName: '$userDetails.lastName',
            email: '$userDetails.email',
            phoneNumber: '$userDetails.phoneNumber',
            countryCode: '$userDetails.countryCode',
            profileImage: '$userDetails.profileImage',
            location: '$userDetails.location',
            userName: '$userDetails.userName',
            status: '$userDetails.status',
            role: '$userDetails.role',
            permanentAddress: '$userDetails.permanentAddress',
            billingAddress: '$userDetails.billingAddress',
            balanceDue: '$userDetails.balanceDue',
            activationDate: '$userDetails.activationDate',
            expirationDate: '$userDetails.expirationDate',
            staticIp: '$userDetails.staticIp',
            macIp: '$userDetails.macIp',
            type: '$userDetails.type',
            fatherName: '$userDetails.fatherName',
            area: '$userDetails.area',
            mode: '$userDetails.mode',
            provider: '$userDetails.provider',
            providerId: '$userDetails.providerId',
            isAccountVerified: '$userDetails.isAccountVerified',
            lastLogin: '$userDetails.lastLogin',
            createdAt: '$userDetails.createdAt',
            updatedAt: '$userDetails.updatedAt',
            mtceFranchise: '$userDetails.mtceFranchise',
            bbUserId: '$userDetails.bbUserId',
            ftthExchangePlan: '$userDetails.ftthExchangePlan',
            bbPlan: '$userDetails.bbPlan',
            workingStatus: '$userDetails.workingStatus',
            ruralUrban: '$userDetails.ruralUrban',
            acquisitionType: '$userDetails.acquisitionType',
            consumedWire: '$userDetails.consumedWire',
            remarks: '$userDetails.remarks'
          },
          // Customer Details
          customer: {
            $cond: {
              if: { $gt: [{ $size: '$customerDetails' }, 0] },
              then: {
                _id: { $arrayElemAt: ['$customerDetails._id', 0] },
                fdbId: { $arrayElemAt: ['$customerDetails.fdbId', 0] },
                oltId: { $arrayElemAt: ['$customerDetails.oltId', 0] },
                installationDate: { $arrayElemAt: ['$customerDetails.installationDate', 0] },
                activationDate: { $arrayElemAt: ['$customerDetails.activationDate', 0] },
                expirationDate: { $arrayElemAt: ['$customerDetails.expirationDate', 0] },
                balanceDue: { $arrayElemAt: ['$customerDetails.balanceDue', 0] },
                lastPaymentDate: { $arrayElemAt: ['$customerDetails.lastPaymentDate', 0] },
                lastPaymentAmount: { $arrayElemAt: ['$customerDetails.lastPaymentAmount', 0] },
                billingCycle: { $arrayElemAt: ['$customerDetails.billingCycle', 0] },
                isOverdue: { $arrayElemAt: ['$customerDetails.isOverdue', 0] },
                createdAt: { $arrayElemAt: ['$customerDetails.createdAt', 0] },
                updatedAt: { $arrayElemAt: ['$customerDetails.updatedAt', 0] },
                isInstalled: { $arrayElemAt: ['$customerDetails.isInstalled', 0] },
                attachments: { $arrayElemAt: ['$customerDetails.attachments', 0] }
              },
              else: null
            }
          },
          // FDB Details
          fdb: {
            $cond: {
              if: { $gt: [{ $size: '$fdbDetails' }, 0] },
              then: {
                _id: { $arrayElemAt: ['$fdbDetails._id', 0] },
                fdbId: { $arrayElemAt: ['$fdbDetails.fdbId', 0] },
                fdbName: { $arrayElemAt: ['$fdbDetails.fdbName', 0] },
                fdbPower: { $arrayElemAt: ['$fdbDetails.fdbPower', 0] },
                fdbType: { $arrayElemAt: ['$fdbDetails.fdbType', 0] },
                status: { $arrayElemAt: ['$fdbDetails.status', 0] },
                location: { $arrayElemAt: ['$fdbDetails.location', 0] },
                address: { $arrayElemAt: ['$fdbDetails.address', 0] },
                city: { $arrayElemAt: ['$fdbDetails.city', 0] },
                state: { $arrayElemAt: ['$fdbDetails.state', 0] }
              },
              else: null
            }
          },
          // OLT Details
          olt: {
            $cond: {
              if: { $gt: [{ $size: '$oltDetails' }, 0] },
              then: {
                _id: { $arrayElemAt: ['$oltDetails._id', 0] },
                oltId: { $arrayElemAt: ['$oltDetails.oltId', 0] },
                name: { $arrayElemAt: ['$oltDetails.name', 0] },
                oltIp: { $arrayElemAt: ['$oltDetails.oltIp', 0] },
                oltType: { $arrayElemAt: ['$oltDetails.oltType', 0] },
                status: { $arrayElemAt: ['$oltDetails.status', 0] },
                location: { $arrayElemAt: ['$oltDetails.location', 0] },
                address: { $arrayElemAt: ['$oltDetails.address', 0] },
                city: { $arrayElemAt: ['$oltDetails.city', 0] },
                state: { $arrayElemAt: ['$oltDetails.state', 0] }
              },
              else: null
            }
          },
          // Modem Details
          modem: {
            $cond: {
              if: { $gt: [{ $size: '$modemDetails' }, 0] },
              then: {
                _id: { $arrayElemAt: ['$modemDetails._id', 0] },
                modemName: { $arrayElemAt: ['$modemDetails.modemName', 0] },
                ontType: { $arrayElemAt: ['$modemDetails.ontType', 0] },
                modelNumber: { $arrayElemAt: ['$modemDetails.modelNumber', 0] },
                serialNumber: { $arrayElemAt: ['$modemDetails.serialNumber', 0] },
                ontMac: { $arrayElemAt: ['$modemDetails.ontMac', 0] },
                username: { $arrayElemAt: ['$modemDetails.username', 0] },
                password: { $arrayElemAt: ['$modemDetails.password', 0] },
                isActive: { $arrayElemAt: ['$modemDetails.isActive', 0] },
                createdAt: { $arrayElemAt: ['$modemDetails.createdAt', 0] },
                updatedAt: { $arrayElemAt: ['$modemDetails.updatedAt', 0] }
              },
              else: null
            }
          }
        }
      },
      {
        $sort: { 'user.firstName': 1 }
      }
    ]);

    // Filter results based on isInstalled status if provided
    let filteredResults = uniqueUsers;
    if (isInstalled !== undefined) {
      const isInstalledValue = isInstalled === 'true' || isInstalled === '1';
      filteredResults = uniqueUsers.filter(user => {
        if (isInstalledValue) {
          // For true: must have customer details and isInstalled must be true
          return user.customer && user.customer.isInstalled === true;
        } else {
          // For false: either no customer details or isInstalled is false/null/undefined
          return !user.customer || user.customer.isInstalled !== true;
        }
      });
    }

    return sendSuccess(
      res,
      filteredResults,
      `Successfully fetched ${filteredResults.length} unique user${filteredResults.length !== 1 ? 's' : ''} with customer, service, and modem details`
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


export const makeInstallationRequestActive = async (req: Request, res: Response): Promise<any> => {
  try {
    const engineerId = (req as any).userId;
    const { userId } = req.params;
    const { consumedWire, remarks } = req.body;

    const request = await WifiInstallationRequest.findOne({
      userId: userId,
      status: 'approved',
      assignedEngineer: engineerId
    });

    if (!request) {
      return sendError(res, 'Installation request not found', 404);
    }

    const customer = await CustomerModel.findOne({
      userId: userId,
    });

    if (!customer) {
      return sendError(res, 'Customer not found', 404);
    }

    if (req.files) {
      const files = req.files as Express.Multer.File[];
      
      // Validate minimum and maximum file requirements
      if (files.length < 3) {
        return sendError(res, 'At least 3 images are required', 400);
      }
      
      if (files.length > 4) {
        return sendError(res, 'Maximum 4 images are allowed', 400);
      }
      
      const attachments = files.map((file: Express.Multer.File) => file.path);
      customer.attachments = attachments;
      customer.isInstalled = true;
      customer.activationDate = new Date();
      customer.expirationDate = moment().add(1, 'month').toDate();
      customer.consumedWire = consumedWire || 0;
      customer.remarks = remarks || '';
      await customer.save();
    } else {
      return sendError(res, 'At least 3 images are required', 400);
    }

    return sendSuccess(res, { customer }, 'Installation request activated successfully');


  } catch (error: any) {
    return sendError(
      res,
      'Failed to make installation request active',
      500,
      process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    );
  }
}


