import { Request, Response, NextFunction } from 'express';
import { IVRModel, AreaType, IVRStatus } from '../models/ivr.model';
import { UserModel, Role } from '../models/user.model';
import { sendError, sendSuccess } from '../../utils/helper';
import mongoose from 'mongoose';
import { ComplaintModel, ComplaintStatus, ComplaintStatusColor } from '../models/complaint.model';
import { IssueType } from '../models/IssueType.model';
import { LeadPlatform, Leads, LeadStatus } from '../models/leads.model';

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
    const updatedIVR = await IVRModel.assignToCompany(
      new mongoose.Types.ObjectId(ivrId),
      new mongoose.Types.ObjectId(companyId)
    );

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
    const updatedIVR = await IVRModel.unassignFromCompany(
      new mongoose.Types.ObjectId(ivrId)
    );

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
    const ivrs = await IVRModel.findIVRsByCompany(
      new mongoose.Types.ObjectId(companyId)
    );

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

// ============================================================================================
// =============================================================================================


export const checkCustomerDetails = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { mobile } = req.body; //mobile number will be  829433530 or +91829433530 or +91-8294335230

    console.log("body", req.body);

    // Validate mobile number input
    if (!mobile) {
      return sendError(res, "Mobile number is required", 400);
    }

    // Clean and normalize phone number - remove all non-digit characters
    const phoneNumber = mobile.replace(/[^0-9]/g, '');

    // Validate phone number length (should be at least 10 digits)
    if (phoneNumber.length < 10) {
      return sendError(res, "Invalid mobile number format", 400);
    }

    // Extract last 10 digits if number includes country code (e.g., +91-8294335230 -> 8294335230)
    const cleanPhoneNumber = phoneNumber.length > 10 ? phoneNumber.slice(-10) : phoneNumber;

    // Find user by phoneNumber or mobile field
    const user = await UserModel.findOne({
      $or: [
        { phoneNumber: cleanPhoneNumber },
        { mobile: cleanPhoneNumber }
      ]
    }).select('-password -otp -otpExpiry -otpVerified -jti -deviceToken');

    if (!user) {
      return sendError(res, "User not found with this mobile number", 404);
    }
    return sendSuccess(res, {
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        mobile: user.mobile,
        countryCode: user.countryCode,
        userName: user.userName,
        permanentAddress: user.permanentAddress,
        residentialAddress: user.residentialAddress,
        billingAddress: user.billingAddress,
        landlineNumber: user.landlineNumber,
        bbUserId: user.bbUserId,
        bbPlan: user.bbPlan,
        status: user.status,
      }
    }, "User details fetched successfully", 200);

  } catch (error) {
    console.error("Error in checkCustomerDetails:", error);
    next(error);
  }
}

export const addComplaintByIVR = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id, complaintId } = req.body;

    console.log("body", req.body);


    // Validate required fields
    if (!id || !complaintId) {
      return sendError(res, "User ID and Complaint ID are required", 400);
    }

    // Validate ObjectId format for user ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid user ID format", 400);
    }

    // Find user
    const user = await UserModel.findById(id);
    if (!user) {
      return sendError(res, "User not found", 404);
    }

    // Find issue type by dt field (complaintId is the dt value like "2", "3", "4", etc.)
    const issueType = await IssueType.findOne({ dt: complaintId });
    if (!issueType) {
      return sendError(res, "Issue type not found with the provided complaint ID", 404);
    }

    // Create complaint with proper data from IssueType
    const issueTypeId = new mongoose.Types.ObjectId(String(issueType._id));

    const complaint = await ComplaintModel.create({
      user: new mongoose.Types.ObjectId(id),
      complaintId: complaintId,
      title: issueType.name || "Complaint from IVR",
      issueDescription: issueType.description || "Complaint submitted via IVR system",
      issueType: issueTypeId,
      phoneNumber: user.phoneNumber,
      complaintType: issueType.type,
      type: issueType.type,
      status: ComplaintStatus.PENDING,
      statusColor: ComplaintStatusColor[ComplaintStatus.PENDING],
    });

    // Initialize status history
    const userId = new mongoose.Types.ObjectId(String(user._id));
    await complaint.initializeStatusHistory(userId);

    return sendSuccess(res, { complaint }, "Complaint created successfully via IVR", 201);

  } catch (error) {
    console.error("Add complaint error with IVR:", error);
    next(error);
  }
}

export const addLeadFromIvr = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { mobile, ivrNumber } = req.body; //mobile number will be  829433530 or +91829433530 or +91-8294335230

    console.log("body", req.body);

    // Validate mobile number input
    if (!mobile) {
      return sendError(res, "Mobile number is required", 400);
    }

    // Validate IVR number input
    if (!ivrNumber) {
      return sendError(res, "IVR number is required", 400);
    }

    // Clean and normalize phone number - remove all non-digit characters
    const phoneNumber = mobile.replace(/[^0-9]/g, '');

    // Validate phone number length (should be at least 10 digits)
    if (phoneNumber.length < 10) {
      return sendError(res, "Invalid mobile number format", 400);
    }

    // Extract last 10 digits if number includes country code (e.g., +91-8294335230 -> 8294335230)
    const cleanPhoneNumber = phoneNumber.length > 10 ? phoneNumber.slice(-10) : phoneNumber;

    // Clean and normalize IVR number
    const cleanIvrNumber = ivrNumber.trim();

    // Find user by phoneNumber or mobile field
    const user = await UserModel.findOne({
      $or: [
        { phoneNumber: cleanPhoneNumber },
        { mobile: cleanPhoneNumber }
      ]
    }).select('-password -otp -otpExpiry -otpVerified -jti -deviceToken');

    // Find company associated with the IVR number
    // First, try to find IVR document and get assigned company
    let company = null;
    const ivr = await IVRModel.findOne({ ivrNumber: cleanIvrNumber });

    if (ivr && ivr.assignedToCompany) {
      // If IVR is assigned to a company, use that company
      company = await UserModel.findById(ivr.assignedToCompany)
        .select('_id companyName companyEmail companyPhone firstName lastName email role')
        .lean();
    } else {
      // If IVR is not found or not assigned, try to find company by ivrNumber array in UserModel
      company = await UserModel.findOne({
        role: Role.ADMIN,
        ivrNumber: { $in: [cleanIvrNumber] }
      })
        .select('_id companyName companyEmail companyPhone firstName lastName email role')
        .lean();
    }

    // Extract country code from mobile number if available (e.g., +91-8294335230 -> +91)
    let countryCode = '+91'; // Default country code
    if (mobile.includes('+')) {
      const countryCodeMatch = mobile.match(/^\+(\d{1,3})/);
      if (countryCodeMatch) {
        countryCode = '+' + countryCodeMatch[1];
      }
    }

    // Create lead data - conditionally include user fields if user exists
    const leadData: any = {
      phoneNumber: cleanPhoneNumber,
      countryCode: user ? user.countryCode : countryCode,
      leadPlatform: LeadPlatform.FROM_IVR,
      status: LeadStatus.UNTRACKED,
    };

    // Add user information only if user exists
    if (user) {
      leadData.byUserId = user._id;
      leadData.firstName = user.firstName;
      leadData.lastName = user.lastName;
    }

    // Add company information if found
    if (company) {
      leadData.byCompanyId = company._id;
    }

    const lead = await Leads.create(leadData);
    const savedLead = await lead.save();

    return sendSuccess(
      res,
      {
        savedLead,
        company: company ? {
          id: company._id,
          companyName: company.companyName,
          companyEmail: company.companyEmail,
          companyPhone: company.companyPhone
        } : null
      },
      "Lead created successfully from IVR",
      200
    );
  } catch (error) {
    console.error("Error in addLeadFromIvr:", error);
    next(error);
  }
}

export const complaintCheck = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.body;

    console.log("body", req.body);

    // Validate required fields
    if (!id) {
      return sendError(res, "User ID is required", 400);
    }

    // Validate ObjectId format for user ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid user ID format", 400);
    }

    // Find user
    const user = await UserModel.findById(id);
    if (!user) {
      return sendError(res, "User not found", 404);
    }

    // Find the last added complaint for this user (sorted by createdAt descending)
    const complaint = await ComplaintModel.findOne({ user: id })
      .sort({ createdAt: -1 })
      .select("status resolved");

    // Check if user can add a new complaint
    if (!complaint) {
      // No complaint exists - user can add a new complaint
      return sendSuccess(res, {
        success: true,
        message: "You can add a new complaint"
      }, "You can add a new complaint", 200);
    } else if (complaint.status === ComplaintStatus.RESOLVED && complaint.resolved === true) {
      // Complaint exists and is resolved - user can add a new complaint
      return sendSuccess(res, {
        success: true,
        message: "You can add a new complaint"
      }, "You can add a new complaint", 200);
    } else {
      // Complaint exists but is not resolved - user cannot add new complaint, can only update
      return sendSuccess(res, {
        success: false,
        message: "You have an active complaint. Please update the existing complaint instead of adding a new one"
      }, "You have an active complaint. Please update the existing complaint instead of adding a new one", 200);
    }

  } catch (error) {
    console.error("Complaint check error with IVR:", error);
    next(error);
  }
}

export const checkMultipleAccountNumber = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { mobile } = req.body; //mobile number will be  829433530 or +91829433530 or +91-8294335230

    console.log("body", req.body);

    // Validate mobile number input
    if (!mobile) {
      return sendError(res, "Mobile number is required", 400);
    }

    // Clean and normalize phone number - remove all non-digit characters
    const phoneNumber = mobile.replace(/[^0-9]/g, '');

    // Validate phone number length (should be at least 10 digits)
    if (phoneNumber.length < 10) {
      return sendError(res, "Invalid mobile number format", 400);
    }

    // Extract last 10 digits if number includes country code (e.g., +91-8294335230 -> 8294335230)
    const cleanPhoneNumber = phoneNumber.length > 10 ? phoneNumber.slice(-10) : phoneNumber;

    // Find all users by phoneNumber or mobile field (returns array)
    const users = await UserModel.find({
      $or: [
        { phoneNumber: cleanPhoneNumber },
        { mobile: cleanPhoneNumber }
      ]
    }).select('-password -otp -otpExpiry -otpVerified -jti -deviceToken');

    // Check if users array is empty
    if (!users || users.length === 0) {
      return sendError(res, "No users found with this mobile number", 404);
    }

    // Map users to the required format
    const usersData = users.map(user => ({
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      mobile: user.mobile,
      countryCode: user.countryCode,
      userName: user.userName,
      permanentAddress: user.permanentAddress,
      residentialAddress: user.residentialAddress,
      billingAddress: user.billingAddress,
      landlineNumber: user.landlineNumber,
      bbUserId: user.bbUserId,
      bbPlan: user.bbPlan,
      status: user.status,
    }));

    return sendSuccess(res, {
      success: true,
      users: usersData,
      count: usersData.length
    }, `Found ${usersData.length} account(s) with this mobile number`, 200);
  } catch (error) {
    console.error("Check multiple account number error with IVR:", error);
    next(error);
  }
}