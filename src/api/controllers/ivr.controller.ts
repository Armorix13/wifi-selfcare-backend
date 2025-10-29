import { Request, Response, NextFunction } from 'express';
import { IVRModel, AreaType, IVRStatus } from '../models/ivr.model';
import { UserModel, Role } from '../models/user.model';
import { sendError, sendSuccess } from '../../utils/helper';
import mongoose from 'mongoose';

// Add IVR
export const addIVR = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const { ivrNumber, name, area, description, associatedCompany, status } = req.body;

    // Validate required fields
    if (!ivrNumber || !name || !area) {
      return sendError(res, "IVR number, name, and area are required", 400);
    }

    // Validate area
    if (!Object.values(AreaType).includes(area)) {
      return sendError(res, "Invalid area type. Must be 'rural' or 'urban'", 400);
    }

    // Check if IVR number already exists
    const existingIVR = await IVRModel.findOne({ ivrNumber: ivrNumber.trim() });
    if (existingIVR) {
      return sendError(res, "IVR number already exists", 400);
    }

    // Create new IVR
    const newIVR = new IVRModel({
      ivrNumber: ivrNumber.trim(),
      name: name.trim(),
      area,
      description: description ? description.trim() : '',
      associatedCompany: associatedCompany || undefined,
      status: status || IVRStatus.INACTIVE,
      addedBy: userId,
      isAssigned: false
    });

    const savedIVR = await newIVR.save();

    return sendSuccess(res, {
      ivr: savedIVR
    }, "IVR added successfully", 201);

  } catch (error) {
    console.error("Error in addIVR:", error);
    next(error);
  }
};

// Get All IVRs with Associated Companies
export const getAllIVRs = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { isAssigned, area, status, companyId } = req.query;

    // Build query
    const query: any = {};
    
    if (isAssigned !== undefined) {
      query.isAssigned = isAssigned === 'true';
    }
    
    if (area) {
      query.area = area;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (companyId) {
      query.assignedToCompany = companyId;
    }

    // Find IVRs with populated company information
    const ivrs = await IVRModel.find(query)
      .populate('assignedToCompany', 'companyName email companyPhone firstName lastName')
      .populate('associatedCompany', 'companyName email companyPhone firstName lastName')
      .populate('addedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    const assignedCount = ivrs.filter(ivr => ivr.isAssigned).length;
    const unassignedCount = ivrs.filter(ivr => !ivr.isAssigned).length;

    return sendSuccess(res, {
      ivrs,
      summary: {
        total: ivrs.length,
        assigned: assignedCount,
        unassigned: unassignedCount
      }
    }, "IVRs fetched successfully");

  } catch (error) {
    console.error("Error in getAllIVRs:", error);
    next(error);
  }
};

// Get IVR by ID
export const getIVRById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { ivrId } = req.params;

    if (!ivrId) {
      return sendError(res, "IVR ID is required", 400);
    }

    const ivr = await IVRModel.findById(ivrId)
      .populate('assignedToCompany', 'companyName email companyPhone firstName lastName')
      .populate('associatedCompany', 'companyName email companyPhone firstName lastName')
      .populate('addedBy', 'firstName lastName email');

    if (!ivr) {
      return sendError(res, "IVR not found", 404);
    }

    return sendSuccess(res, {
      ivr
    }, "IVR fetched successfully");

  } catch (error) {
    console.error("Error in getIVRById:", error);
    next(error);
  }
};

// Update IVR
export const updateIVR = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { ivrId } = req.params;
    const { ivrNumber, name, area, description, status } = req.body;

    if (!ivrId) {
      return sendError(res, "IVR ID is required", 400);
    }

    // Find IVR
    const ivr = await IVRModel.findById(ivrId);
    if (!ivr) {
      return sendError(res, "IVR not found", 404);
    }

    // Check if IVR number is being updated and if it already exists
    if (ivrNumber && ivrNumber !== ivr.ivrNumber) {
      const existingIVR = await IVRModel.findOne({ 
        ivrNumber: ivrNumber.trim(),
        _id: { $ne: ivrId }
      });
      if (existingIVR) {
        return sendError(res, "IVR number already exists", 400);
      }
    }

    // Validate area if provided
    if (area && !Object.values(AreaType).includes(area)) {
      return sendError(res, "Invalid area type. Must be 'rural' or 'urban'", 400);
    }

    // Build update data
    const updateData: any = {};
    if (ivrNumber) updateData.ivrNumber = ivrNumber.trim();
    if (name) updateData.name = name.trim();
    if (area) updateData.area = area;
    if (description !== undefined) updateData.description = description.trim();
    if (status) updateData.status = status;

    const updatedIVR = await IVRModel.findByIdAndUpdate(
      ivrId,
      updateData,
      { new: true }
    ).populate('assignedToCompany', 'companyName email companyPhone')
      .populate('associatedCompany', 'companyName email companyPhone');

    return sendSuccess(res, {
      ivr: updatedIVR
    }, "IVR updated successfully");

  } catch (error) {
    console.error("Error in updateIVR:", error);
    next(error);
  }
};

// Delete IVR
export const deleteIVR = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { ivrId } = req.params;

    if (!ivrId) {
      return sendError(res, "IVR ID is required", 400);
    }

    // Find and delete IVR
    const deletedIVR = await IVRModel.findByIdAndDelete(ivrId);
    if (!deletedIVR) {
      return sendError(res, "IVR not found", 404);
    }

    return sendSuccess(res, {
      ivr: deletedIVR
    }, "IVR deleted successfully");

  } catch (error) {
    console.error("Error in deleteIVR:", error);
    next(error);
  }
};

// Assign IVR to Company
export const assignIVRToCompany = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { ivrId } = req.params;
    const { companyId } = req.body;

    if (!ivrId || !companyId) {
      return sendError(res, "IVR ID and Company ID are required", 400);
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(ivrId) || !mongoose.Types.ObjectId.isValid(companyId)) {
      return sendError(res, "Invalid ID format", 400);
    }

    // Find IVR
    const ivr = await IVRModel.findById(ivrId);
    if (!ivr) {
      return sendError(res, "IVR not found", 404);
    }

    // Check if IVR is already assigned
    if (ivr.isAssigned) {
      return sendError(res, "IVR is already assigned to a company", 400);
    }

    // Find company (user with ADMIN role)
    const company = await UserModel.findById(companyId);
    if (!company) {
      return sendError(res, "Company not found", 404);
    }

    if (company.role !== Role.ADMIN) {
      return sendError(res, "User is not a company admin", 400);
    }

    // Assign IVR to company
    const updatedIVR = await IVRModel.assignToCompany(ivrId, companyId);

    return sendSuccess(res, {
      ivr: updatedIVR
    }, "IVR assigned to company successfully");

  } catch (error) {
    console.error("Error in assignIVRToCompany:", error);
    next(error);
  }
};

// Unassign IVR from Company
export const unassignIVRFromCompany = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { ivrId } = req.params;

    if (!ivrId) {
      return sendError(res, "IVR ID is required", 400);
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(ivrId)) {
      return sendError(res, "Invalid IVR ID format", 400);
    }

    // Find IVR
    const ivr = await IVRModel.findById(ivrId);
    if (!ivr) {
      return sendError(res, "IVR not found", 404);
    }

    // Check if IVR is assigned
    if (!ivr.isAssigned) {
      return sendError(res, "IVR is not assigned to any company", 400);
    }

    // Unassign IVR from company
    const updatedIVR = await IVRModel.unassignFromCompany(ivrId);

    return sendSuccess(res, {
      ivr: updatedIVR
    }, "IVR unassigned from company successfully");

  } catch (error) {
    console.error("Error in unassignIVRFromCompany:", error);
    next(error);
  }
};

// Get IVRs by Company
export const getIVRsByCompany = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return sendError(res, "Company ID is required", 400);
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return sendError(res, "Invalid Company ID format", 400);
    }

    // Find IVRs assigned to company
    const ivrs = await IVRModel.findIVRsByCompany(companyId);

    return sendSuccess(res, {
      ivrs,
      count: ivrs.length
    }, "IVRs fetched successfully");

  } catch (error) {
    console.error("Error in getIVRsByCompany:", error);
    next(error);
  }
};

// Get Assigned IVRs
export const getAssignedIVRs = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const ivrs = await IVRModel.findAssignedIVRs();

    return sendSuccess(res, {
      ivrs,
      count: ivrs.length
    }, "Assigned IVRs fetched successfully");

  } catch (error) {
    console.error("Error in getAssignedIVRs:", error);
    next(error);
  }
};

// Get Unassigned IVRs
export const getUnassignedIVRs = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const ivrs = await IVRModel.findUnassignedIVRs();

    return sendSuccess(res, {
      ivrs,
      count: ivrs.length
    }, "Unassigned IVRs fetched successfully");

  } catch (error) {
    console.error("Error in getUnassignedIVRs:", error);
    next(error);
  }
};

// Get IVRs by Area
export const getIVRsByArea = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { area } = req.params;

    if (!area) {
      return sendError(res, "Area is required", 400);
    }

    // Validate area
    if (!Object.values(AreaType).includes(area as AreaType)) {
      return sendError(res, "Invalid area type. Must be 'rural' or 'urban'", 400);
    }

    const ivrs = await IVRModel.findIVRsByArea(area as AreaType);

    return sendSuccess(res, {
      ivrs,
      count: ivrs.length
    }, "IVRs fetched successfully");

  } catch (error) {
    console.error("Error in getIVRsByArea:", error);
    next(error);
  }
};

// Toggle IVR Status
export const toggleIVRStatus = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { ivrId } = req.params;
    const { status } = req.body;

    if (!ivrId) {
      return sendError(res, "IVR ID is required", 400);
    }

    if (!status || !Object.values(IVRStatus).includes(status)) {
      return sendError(res, "Valid status is required", 400);
    }

    const ivr = await IVRModel.findById(ivrId);
    if (!ivr) {
      return sendError(res, "IVR not found", 404);
    }

    ivr.status = status;
    const updatedIVR = await ivr.save();

    return sendSuccess(res, {
      ivr: updatedIVR
    }, "IVR status updated successfully");

  } catch (error) {
    console.error("Error in toggleIVRStatus:", error);
    next(error);
  }
};

