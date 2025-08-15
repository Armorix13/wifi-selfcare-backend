import { Request, Response } from "express";
import { CctvRequestModel, CctvStatus } from "../models/cctvRequest.model";
import { UserModel } from "../models/user.model";
import { sendSuccess, sendError } from "../../utils/helper";

// Add new CCTV request
export const addRequest = async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      firstName,
      lastName,
      phoneNumber,
      countryCode,
      pincode,
      area,
      userId,
      priority,
      remarks
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !phoneNumber || !countryCode || !pincode || !area || !userId) {
      return sendError(res, "Missing required fields", 400);
    }

    // Check if user exists
    const userExists = await UserModel.findById(userId);
    if (!userExists) {
      return sendError(res, "User not found", 404);
    }

    const newRequest = new CctvRequestModel({
      firstName,
      lastName,
      phoneNumber,
      countryCode,
      pincode,
      area,
      userId,
      priority: priority || "medium",
      remarks,
      status: CctvStatus.NOT_REQUESTED
    });

    const savedRequest = await newRequest.save();

    return sendSuccess(res, savedRequest, "CCTV request created successfully", 201);
  } catch (error) {
    console.error("Error creating CCTV request:", error);
    return sendError(res, "Internal server error", 500, error);
  }
};

// Get all requests with pagination
export const getAllRequests = async (req: Request, res: Response): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const priority = req.query.priority as string;
    const isActive = req.query.isActive as string;

    const skip = (page - 1) * limit;

    // Build filter object
    const filter: any = {};
    if (status) filter.status = parseInt(status);
    if (priority) filter.priority = priority;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const requests = await CctvRequestModel.find(filter)
      .populate('userId', 'firstName lastName email phoneNumber')
      .populate('assignId', 'firstName lastName email phoneNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await CctvRequestModel.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const pagination = {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };

    return sendSuccess(res, requests, "CCTV requests retrieved successfully", 200, pagination);
  } catch (error) {
    console.error("Error fetching CCTV requests:", error);
    return sendError(res, "Internal server error", 500, error);
  }
};

// Get request by ID
export const getById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const request = await CctvRequestModel.findById(id)
      .populate('userId', 'firstName lastName email phoneNumber countryCode')
      .populate('assignId', 'firstName lastName email phoneNumber');

    if (!request) {
      return sendError(res, "CCTV request not found", 404);
    }

    return sendSuccess(res, request, "CCTV request retrieved successfully");
  } catch (error) {
    console.error("Error fetching CCTV request:", error);
    return sendError(res, "Internal server error", 500, error);
  }
};

// Edit request
export const editRequest = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.status;
    delete updateData.assignId;
    delete updateData.assignDate;
    delete updateData.userId;

    const updatedRequest = await CctvRequestModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('userId', 'firstName lastName email phoneNumber')
     .populate('assignId', 'firstName lastName email phoneNumber');

    if (!updatedRequest) {
      return sendError(res, "CCTV request not found", 404);
    }

    return sendSuccess(res, updatedRequest, "CCTV request updated successfully");
  } catch (error) {
    console.error("Error updating CCTV request:", error);
    return sendError(res, "Internal server error", 500, error);
  }
};

// Assign engineer
export const assignEngineer = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { engineerId } = req.body;

    if (!engineerId) {
      return sendError(res, "Engineer ID is required", 400);
    }

    // Check if engineer exists and has engineer role
    const engineer = await UserModel.findById(engineerId);
    if (!engineer) {
      return sendError(res, "Engineer not found", 404);
    }

    // Check if request exists
    const request = await CctvRequestModel.findById(id);
    if (!request) {
      return sendError(res, "CCTV request not found", 404);
    }

    // Update request with engineer assignment
    const updatedRequest = await CctvRequestModel.findByIdAndUpdate(
      id,
      {
        assignId: engineerId,
        assignDate: new Date(),
        status: CctvStatus.APPLICATION_SUBMITTED
      },
      { new: true, runValidators: true }
    ).populate('userId', 'firstName lastName email phoneNumber')
     .populate('assignId', 'firstName lastName email phoneNumber');

    return sendSuccess(res, updatedRequest, "Engineer assigned successfully");
  } catch (error) {
    console.error("Error assigning engineer:", error);
    return sendError(res, "Internal server error", 500, error);
  }
};

// Admin update status
export const updateStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!status) {
      return sendError(res, "Status is required", 400);
    }

    // Validate status value
    const validStatuses = Object.values(CctvStatus);
    if (!validStatuses.includes(parseInt(status))) {
      return sendError(res, "Invalid status value", 400);
    }

    const updateData: any = { status: parseInt(status) };
    if (remarks) {
      updateData.remarks = remarks;
    }

    const updatedRequest = await CctvRequestModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('userId', 'firstName lastName email phoneNumber')
     .populate('assignId', 'firstName lastName email phoneNumber');

    if (!updatedRequest) {
      return sendError(res, "CCTV request not found", 404);
    }

    return sendSuccess(res, updatedRequest, "Status updated successfully");
  } catch (error) {
    console.error("Error updating status:", error);
    return sendError(res, "Internal server error", 500, error);
  }
};

// Get requests by user ID
export const getRequestsByUser = async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const requests = await CctvRequestModel.find({ userId })
      .populate('assignId', 'firstName lastName email phoneNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await CctvRequestModel.countDocuments({ userId });
    const totalPages = Math.ceil(total / limit);

    const pagination = {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };

    return sendSuccess(res, requests, "User CCTV requests retrieved successfully", 200, pagination);
  } catch (error) {
    console.error("Error fetching user CCTV requests:", error);
    return sendError(res, "Internal server error", 500, error);
  }
};

// Get requests by engineer
export const getRequestsByEngineer = async (req: Request, res: Response): Promise<any> => {
  try {
    const { engineerId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const requests = await CctvRequestModel.find({ assignId: engineerId })
      .populate('userId', 'firstName lastName email phoneNumber countryCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await CctvRequestModel.countDocuments({ assignId: engineerId });
    const totalPages = Math.ceil(total / limit);

    const pagination = {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };

    return sendSuccess(res, requests, "Engineer CCTV requests retrieved successfully", 200, pagination);
  } catch (error) {
    console.error("Error fetching engineer CCTV requests:", error);
    return sendError(res, "Internal server error", 500, error);
  }
};
