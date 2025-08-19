import { Request, Response } from 'express';
import { IssueType, IIssueType } from '../models/IssueType.model';
import { sendSuccess, sendError } from '../../utils/helper';

// Create a new issue type
export const createIssueType = async (req: Request, res: Response) :Promise<any> => {
  try {
    const { name, description, type, dt } = req.body;
    const existing = await IssueType.findOne({ name });
    if (existing) {
      return sendError(res, 'Issue type with this name already exists', 409);
    }
    const issueType = new IssueType({ name, description, type, dt });
    await issueType.save();
    return sendSuccess(res, issueType, 'Issue type created successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to create issue type', 400, error);
  }
};

// Create bulk issue types
export const createBulkIssueTypes = async (req: Request, res: Response) :Promise<any> => {
  try {
    const { issueTypes } = req.body;
    
    if (!Array.isArray(issueTypes) || issueTypes.length === 0) {
      return sendError(res, 'Issue types array is required and must not be empty', 400);
    }

    const results = [];
    const errors = [];

    for (const issueTypeData of issueTypes) {
      try {
        const { name, description, type, dt } = issueTypeData;
        
        // Validate required fields
        if (!name || !type || !dt) {
          errors.push({ name: name || 'unknown', error: 'Missing required fields: name, type, and dt are required' });
          continue;
        }

        // Validate type
        if (!['WIFI', 'CCTV'].includes(type)) {
          errors.push({ name, error: 'Type must be either WIFI or CCTV' });
          continue;
        }

        // Check if already exists
        const existing = await IssueType.findOne({ name });
        if (existing) {
          errors.push({ name, error: 'Issue type with this name already exists' });
          continue;
        }

        const issueType = new IssueType({ name, description, type, dt });
        await issueType.save();
        results.push(issueType);
      } catch (error: any) {
        errors.push({ name: issueTypeData.name || 'unknown', error: error.message });
      }
    }

    const response = {
      created: results,
      errors: errors,
      summary: {
        total: issueTypes.length,
        successful: results.length,
        failed: errors.length
      }
    };

    if (results.length > 0) {
      return sendSuccess(res, response, `Bulk creation completed. ${results.length} created, ${errors.length} failed`);
    } else {
      return sendError(res, 'No issue types were created', 400, response);
    }
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to create bulk issue types', 400, error);
  }
};

// Get all issue types
export const getAllIssueTypes = async (_req: Request, res: Response):Promise<any> => {
  try {
    const wifiIssueTypes = await IssueType.find({ type: 'WIFI' }, '_id name').sort({name: 1});
    const cctvIssueTypes = await IssueType.find({ type: 'CCTV' }, '_id name').sort({name: 1});
    
    const result = {
      wifi: wifiIssueTypes,
      cctv: cctvIssueTypes
    };
    
    return sendSuccess(res, result, 'Issue types retrieved successfully');
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
    const { name, description, type, dt } = req.body;
    const issueType = await IssueType.findByIdAndUpdate(
      req.params.id,
      { name, description, type, dt },
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