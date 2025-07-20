import { Request, Response } from 'express';
import { ComplaintType, IComplaintType } from '../models/ComplaintType.model';
import { sendSuccess, sendError } from '../../utils/helper';

// Create a new complaint type
export const createComplaintType = async (req: Request, res: Response) :Promise<any> => {
  try {
    const { name, description } = req.body;
    const existing = await ComplaintType.findOne({ name });
    if (existing) {
      return sendError(res, 'Complaint type with this name already exists', 409);
    }
    const complaintType = new ComplaintType({ name, description });
    await complaintType.save();
    return sendSuccess(res, complaintType, 'Complaint type created successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to create complaint type', 400, error);
  }
};

// Get all complaint types
export const getAllComplaintTypes = async (_req: Request, res: Response):Promise<any> => {
  try {
    const complaintTypes = await ComplaintType.find();
    return sendSuccess(res, complaintTypes, 'Complaint types retrieved successfully');
  } catch (error: any) {
    return sendError(res, 'Internal server error', 500, error);
  }
};

// Get a single complaint type by ID
export const getComplaintTypeById = async (req: Request, res: Response) :Promise<any> => {
  try {
    const complaintType = await ComplaintType.findById(req.params.id);
    if (!complaintType) {
      return sendError(res, 'Complaint type not found', 404);
    }
    return sendSuccess(res, complaintType, 'Complaint type retrieved successfully');
  } catch (error: any) {
    return sendError(res, 'Internal server error', 500, error);
  }
};

// Update a complaint type
export const updateComplaintType = async (req: Request, res: Response) :Promise<any> => {
  try {
    const { name, description } = req.body;
    const complaintType = await ComplaintType.findByIdAndUpdate(
      req.params.id,
      { name, description },
      { new: true, runValidators: true }
    );
    if (!complaintType) {
      return sendError(res, 'Complaint type not found', 404);
    }
    return sendSuccess(res, complaintType, 'Complaint type updated successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to update complaint type', 400, error);
  }
};

// Delete a complaint type
export const deleteComplaintType = async (req: Request, res: Response) :Promise<any> => {
  try {
    const complaintType = await ComplaintType.findByIdAndDelete(req.params.id);
    if (!complaintType) {
      return sendError(res, 'Complaint type not found', 404);
    }
    return sendSuccess(res, { message: 'Complaint type deleted successfully' });
  } catch (error: any) {
    return sendError(res, 'Internal server error', 500, error);
  }
};
