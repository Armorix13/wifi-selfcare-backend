import { Request, Response } from 'express';
import { IssueType, IIssueType } from '../models/IssueType.model';
import { sendSuccess, sendError } from '../../utils/helper';

// Create a new issue type
export const createIssueType = async (req: Request, res: Response) :Promise<any> => {
  try {
    const { name, description } = req.body;
    const existing = await IssueType.findOne({ name });
    if (existing) {
      return sendError(res, 'Issue type with this name already exists', 409);
    }
    const issueType = new IssueType({ name, description });
    await issueType.save();
    return sendSuccess(res, issueType, 'Issue type created successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to create issue type', 400, error);
  }
};

// Get all issue types
export const getAllIssueTypes = async (_req: Request, res: Response):Promise<any> => {
  try {
    const issueTypes = await IssueType.find({}, '_id name').sort({name: 1});
    return sendSuccess(res, issueTypes, 'Issue types retrieved successfully');
  } catch (error: any) {
    return sendError(res, 'Internal server error', 500, error);
  }
};

// Get a single issue type by ID
export const getIssueTypeById = async (req: Request, res: Response) :Promise<any> => {
  try {
    const issueType = await IssueType.findById(req.params.id);
    if (!issueType) {
      return sendError(res, 'Issue type not found', 404);
    }
    return sendSuccess(res, issueType, 'Issue type retrieved successfully');
  } catch (error: any) {
    return sendError(res, 'Internal server error', 500, error);
  }
};

// Update an issue type
export const updateIssueType = async (req: Request, res: Response) :Promise<any> => {
  try {
    const { name, description } = req.body;
    const issueType = await IssueType.findByIdAndUpdate(
      req.params.id,
      { name, description },
      { new: true, runValidators: true }
    );
    if (!issueType) {
      return sendError(res, 'Issue type not found', 404);
    }
    return sendSuccess(res, issueType, 'Issue type updated successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to update issue type', 400, error);
  }
};

// Delete an issue type
export const deleteIssueType = async (req: Request, res: Response) :Promise<any> => {
  try {
    const issueType = await IssueType.findByIdAndDelete(req.params.id);
    if (!issueType) {
      return sendError(res, 'Issue type not found', 404);
    }
    return sendSuccess(res, { message: 'Issue type deleted successfully' });
  } catch (error: any) {
    return sendError(res, 'Internal server error', 500, error);
  }
}; 