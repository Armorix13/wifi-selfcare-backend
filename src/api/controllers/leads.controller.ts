import { Request, Response } from "express";
import { Leads, ILeads, LeadStatus, LeadPlatform } from "../models/leads.model";
import { UserModel } from "../models/user.model";

// Create a new lead
export const createLead = async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      byUserId,
      byEngineerId,
      firstName,
      lastName,
      phoneNumber,
      countryCode,
      connectionType,
      installationAddress,
      leadPlatform,
      source,
      email,
    } = req.body;

    console.log("body",req.body);
    

    // Validate required fields
    if (!firstName || !lastName || !phoneNumber || !countryCode || !installationAddress) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Validate leadPlatform enum
    if (!Object.values(LeadPlatform).includes(leadPlatform)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead platform",
      });
    }

    if (byUserId) {
      const user = await UserModel.findById(byUserId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
    }

    // Check if engineer exists if byEngineerId is provided
    if (byEngineerId) {
      const engineer = await UserModel.findById(byEngineerId);
      if (!engineer || engineer.role !== "engineer") {
        return res.status(404).json({
          success: false,
          message: "Engineer not found or invalid",
        });
      }
    }

    // Create new lead
    const newLead = new Leads({
      byUserId,
      byEngineerId,
      firstName,
      lastName,
      phoneNumber,
      countryCode,
      connectionType,
      installationAddress,
      leadPlatform,
      email,
      source,
      status: LeadStatus.INREVIEW,
    });

    const savedLead = await newLead.save();

    res.status(201).json({
      success: true,
      message: "Lead created successfully",
      data: savedLead,
    });
  } catch (error) {
    console.error("Error creating lead:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get all leads with pagination and filters
export const getAllLeads = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      leadPlatform,
      byUserId,
      byEngineerId,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build filter object
    const filter: any = {};

    if (status) filter.status = status;
    if (leadPlatform) filter.leadPlatform = leadPlatform;
    if (byUserId) filter.byUserId = byUserId;
    if (byEngineerId) filter.byEngineerId = byEngineerId;

    // Search functionality
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { companyName: { $regex: search, $options: "i" } },
      ];
    }

    // Build sort object
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

    const leads = await Leads.find(filter)
      .populate("byUserId", "firstName lastName email phoneNumber")
      .populate("byEngineerId", "firstName lastName email phoneNumber")
      .populate("assignedTo", "firstName lastName email phoneNumber")
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const totalLeads = await Leads.countDocuments(filter);
    const totalPages = Math.ceil(totalLeads / limitNum);

    res.status(200).json({
      success: true,
      message: "Leads retrieved successfully",
      data: {
        leads,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalLeads,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error getting leads:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get lead by ID
export const getLeadById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const lead = await Leads.findById(id)
      .populate("byUserId", "firstName lastName email phoneNumber")
      .populate("byEngineerId", "firstName lastName email phoneNumber")
      .populate("assignedTo", "firstName lastName email phoneNumber");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lead retrieved successfully",
      data: lead,
    });
  } catch (error) {
    console.error("Error getting lead:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Update lead
export const updateLead = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData.byUserId;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // Validate status if provided
    if (updateData.status && !Object.values(LeadStatus).includes(updateData.status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    // Validate leadPlatform if provided
    if (updateData.leadPlatform && !Object.values(LeadPlatform).includes(updateData.leadPlatform)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead platform",
      });
    }

    // Check if engineer exists if byEngineerId is being updated
    if (updateData.byEngineerId) {
      const engineer = await UserModel.findById(updateData.byEngineerId);
      if (!engineer || engineer.role !== "engineer") {
        return res.status(404).json({
          success: false,
          message: "Engineer not found or invalid",
        });
      }
    }

    const updatedLead = await Leads.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate("byUserId", "firstName lastName email phoneNumber")
      .populate("byEngineerId", "firstName lastName email phoneNumber")
      .populate("assignedTo", "firstName lastName email phoneNumber");

    if (!updatedLead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      data: updatedLead,
    });
  } catch (error) {
    console.error("Error updating lead:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Delete lead
export const deleteLead = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const deletedLead = await Leads.findByIdAndDelete(id);

    if (!deletedLead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
      data: deletedLead,
    });
  } catch (error) {
    console.error("Error deleting lead:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Update lead status
export const updateLeadStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { status, remarks, assignedTo } = req.body;

    if (!status || !Object.values(LeadStatus).includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    // Check if assignedTo exists if provided
    if (assignedTo) {
      const user = await UserModel.findById(assignedTo);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Assigned user not found",
        });
      }
    }

    const updatedLead = await Leads.findByIdAndUpdate(
      id,
      { status, remarks, assignedTo },
      { new: true, runValidators: true }
    ).populate("byUserId", "firstName lastName email phoneNumber")
      .populate("byEngineerId", "firstName lastName email phoneNumber")
      .populate("assignedTo", "firstName lastName email phoneNumber");

    if (!updatedLead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lead status updated successfully",
      data: updatedLead,
    });
  } catch (error) {
    console.error("Error updating lead status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get leads by user ID
export const getLeadsByUserId = async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { byUserId: userId };
    if (status) filter.status = status;

    const leads = await Leads.find(filter)
      .populate("byUserId", "firstName lastName email phoneNumber")
      .populate("byEngineerId", "firstName lastName email phoneNumber")
      .populate("assignedTo", "firstName lastName email phoneNumber")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalLeads = await Leads.countDocuments(filter);
    const totalPages = Math.ceil(totalLeads / limitNum);

    res.status(200).json({
      success: true,
      message: "User leads retrieved successfully",
      data: {
        leads,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalLeads,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error getting user leads:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get leads by engineer ID
export const getLeadsByEngineerId = async (req: Request, res: Response): Promise<any> => {
  try {
    const { engineerId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { byEngineerId: engineerId };
    if (status) filter.status = status;

    const leads = await Leads.find(filter)
      .populate("byUserId", "firstName lastName email phoneNumber")
      .populate("byEngineerId", "firstName lastName email phoneNumber")
      .populate("assignedTo", "firstName lastName email phoneNumber")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalLeads = await Leads.countDocuments(filter);
    const totalPages = Math.ceil(totalLeads / limitNum);

    res.status(200).json({
      success: true,
      message: "Engineer leads retrieved successfully",
      data: {
        leads,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalLeads,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error getting engineer leads:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get lead statistics
export const getLeadStatistics = async (req: Request, res: Response): Promise<any> => {
  try {
    const stats = await Leads.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const platformStats = await Leads.aggregate([
      {
        $group: {
          _id: "$leadPlatform",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalLeads = await Leads.countDocuments();
    const todayLeads = await Leads.countDocuments({
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    });

    const monthlyLeads = await Leads.countDocuments({
      createdAt: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    });

    res.status(200).json({
      success: true,
      message: "Lead statistics retrieved successfully",
      data: {
        totalLeads,
        todayLeads,
        monthlyLeads,
        statusDistribution: stats,
        platformDistribution: platformStats,
      },
    });
  } catch (error) {
    console.error("Error getting lead statistics:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
