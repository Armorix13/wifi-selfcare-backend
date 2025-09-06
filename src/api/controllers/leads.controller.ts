import { Request, Response } from "express";
import { Leads, ILeads, LeadStatus, LeadPlatform } from "../models/leads.model";
import { UserModel } from "../models/user.model";
import { OLTModel } from "../models/olt.model";

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
      companyName,
      priority,
      estimatedCost,
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
      companyName,
      source,
      priority,
      estimatedCost,
      status: LeadStatus.UNTRACKED,
      isTracked: false,
      contactAttempts: 0,
    });

    if(byUserId){
      newLead.byUserId = byUserId;
    }

    if(byEngineerId){
      newLead.byEngineerId = byEngineerId;
    }

    // Handle assignment based on provided parameters
    // if (byUserId) {
    //   // Manual assignment to specific user
    //   newLead.assignedTo = byUserId;
    // } else if (byEngineerId) {
    //   // Assignment to specific engineer
    //   newLead.assignedTo = byEngineerId;
    // } else {
      // If no specific user or engineer assigned, find nearest OLT and assign to its owner
      if(req.body.latitude && req.body.longitude){
      const userLatitude = req.body.latitude;
      const userLongitude = req.body.longitude;
      
      // Validate location coordinates
      if (!userLatitude || !userLongitude) {
        return res.status(400).json({
          success: false,
          message: "Latitude and longitude are required for automatic assignment",
        });
      }

      try {
        // Find the nearest OLT among ALL OLTs (no distance limit)
        const nearestOLT = await OLTModel.findOne({
          location: {
            $near: {
              $geometry: {
                type: "Point",
                coordinates: [userLongitude, userLatitude] // GeoJSON uses [lng, lat] order
              }
            }
          },
          ownedBy: { $exists: true } // Ensure OLT has an owner
        }).populate('ownedBy', '_id');

        if (nearestOLT && nearestOLT.ownedBy) {
          // Assign lead to the OLT owner
          newLead.assignedTo = nearestOLT.ownedBy as any;
          
          console.log(`Lead assigned to nearest OLT owner (OLT: ${nearestOLT.oltId})`);
        } else {
          // No OLT found, create untracked lead
          console.log('No OLT found, creating untracked lead');
          newLead.status = LeadStatus.UNTRACKED;
          newLead.isTracked = false;
        }
      } catch (locationError) {
        console.error('Error finding nearest OLT:', locationError);
        // Fallback: create untracked lead
        newLead.status = LeadStatus.UNTRACKED;
        newLead.isTracked = false;
      }
    }

    const savedLead = await newLead.save();

    res.status(201).json({
      success: true,
      message: savedLead.assignedTo 
        ? "Lead created and assigned successfully"
        : "Lead created successfully (untracked)",
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
      limit = 6, // Changed default to 6 per page
      status,
      leadPlatform,
      byUserId,
      byEngineerId,
      search,
      isTracked,
      priority,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const companyId = (req as any).userId;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get company users and engineers
    const [companyUsers, companyEngineers] = await Promise.all([
      UserModel.find({ assignedCompany: companyId }).select("_id"),
      UserModel.find({ parentCompany: companyId }).select("_id")
    ]);
    
    const companyUserIds = companyUsers.map(user => user._id);
    const companyEngineerIds = companyEngineers.map(user => user._id);

    // Build company-based filter for 3 scenarios:
    // 1. byUserId is in our company users
    // 2. byEngineerId is in our company engineers  
    // 3. assignedTo is equal to our company ID
    const companyFilter = {
      $or: [
        { byUserId: { $in: companyUserIds } },
        { byEngineerId: { $in: companyEngineerIds } },
        { assignedTo: companyId }
      ]
    };


    




    // Build additional filter object for query parameters
    const additionalFilter: any = {};

    if (status) additionalFilter.status = status;
    if (leadPlatform) additionalFilter.leadPlatform = leadPlatform;
    if (byUserId) additionalFilter.byUserId = byUserId;
    if (byEngineerId) additionalFilter.byEngineerId = byEngineerId;
    if (isTracked !== undefined) additionalFilter.isTracked = isTracked === 'true';
    if (priority) additionalFilter.priority = priority;

    // Search functionality
    if (search) {
      additionalFilter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { companyName: { $regex: search, $options: "i" } },
        { installationAddress: { $regex: search, $options: "i" } },
        { trackingNotes: { $regex: search, $options: "i" } },
      ];
    }

    // Combine company filter with additional filters
    const finalFilter = {
      $and: [companyFilter, additionalFilter]
    };

    // Build sort object
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

    // Get leads with pagination
    const leads = await Leads.find(finalFilter)
      .populate("byUserId", "firstName lastName email phoneNumber role")
      .populate("byEngineerId", "firstName lastName email phoneNumber role")
      .populate("assignedTo", "firstName lastName email phoneNumber role")
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const totalLeads = await Leads.countDocuments(finalFilter);
    const totalPages = Math.ceil(totalLeads / limitNum);

    // Get comprehensive statistics
    const [
      statusStats,
      platformStats,
      trackingStats,
      priorityStats,
      todayLeads,
      monthlyLeads,
      highPriorityCount
    ] = await Promise.all([
      // Status distribution
      Leads.aggregate([
        { $match: finalFilter },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
      // Platform distribution
      Leads.aggregate([
        { $match: finalFilter },
        {
          $group: {
            _id: "$leadPlatform",
            count: { $sum: 1 },
          },
        },
      ]),
      // Tracking statistics
      Leads.aggregate([
        { $match: finalFilter },
        {
          $group: {
            _id: null,
            totalTracked: { $sum: { $cond: ["$isTracked", 1, 0] } },
            totalUntracked: { $sum: { $cond: ["$isTracked", 0, 1] } },
            totalContactAttempts: { $sum: "$contactAttempts" },
            avgContactAttempts: { $avg: "$contactAttempts" }
          }
        }
      ]),
      // Priority distribution
      Leads.aggregate([
        { $match: finalFilter },
        {
          $group: {
            _id: "$priority",
            count: { $sum: 1 },
          },
        },
      ]),
      // Today's leads
      Leads.countDocuments({
        ...finalFilter,
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }),
      // Monthly leads
      Leads.countDocuments({
        ...finalFilter,
        createdAt: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      }),
      // High priority leads
      Leads.countDocuments({
        ...finalFilter,
        priority: "high",
      })
    ]);

    // Format statistics
    const statistics = {
      totalLeads,
      todayLeads,
      monthlyLeads,
      highPriorityCount,
      statusDistribution: statusStats,
      platformDistribution: platformStats,
      priorityDistribution: priorityStats,
      trackingStats: trackingStats[0] || {
        totalTracked: 0,
        totalUntracked: 0,
        totalContactAttempts: 0,
        avgContactAttempts: 0
      }
    };

    res.status(200).json({
      success: true,
      message: "Leads and statistics retrieved successfully",
      data: {
        leads,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalLeads,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: limitNum,
        },
        statistics
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
      .populate("byUserId", "firstName lastName email phoneNumber role")
      .populate("byEngineerId", "firstName lastName email phoneNumber role")
      .populate("assignedTo", "firstName lastName email phoneNumber role");

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
    ).populate("byUserId", "firstName lastName email phoneNumber role")
      .populate("byEngineerId", "firstName lastName email phoneNumber role")
      .populate("assignedTo", "firstName lastName email phoneNumber role");

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
    ).populate("byUserId", "firstName lastName email phoneNumber role")
      .populate("byEngineerId", "firstName lastName email phoneNumber role")
      .populate("assignedTo", "firstName lastName email phoneNumber role");

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

// Update lead tracking
export const updateLeadTracking = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { isTracked } = req.body;

    if (isTracked === undefined) {
      return res.status(400).json({
        success: false,
        message: "isTracked field is required",
      });
    }

    const updatedLead = await Leads.findByIdAndUpdate(
      id,
      { isTracked },
      { new: true, runValidators: true }
    ).populate("byUserId", "firstName lastName email phoneNumber role")
      .populate("byEngineerId", "firstName lastName email phoneNumber role")
      .populate("assignedTo", "firstName lastName email phoneNumber role");

    if (!updatedLead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lead tracking updated successfully",
      data: updatedLead,
    });
  } catch (error) {
    console.error("Error updating lead tracking:", error);
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
    const { page = 1, limit = 6, status } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { byUserId: userId };
    if (status) filter.status = status;

    const leads = await Leads.find(filter)
      .populate("byUserId", "firstName lastName email phoneNumber role")
      .populate("byEngineerId", "firstName lastName email phoneNumber role")
      .populate("assignedTo", "firstName lastName email phoneNumber role")
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
          limit: limitNum,
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
    const { page = 1, limit = 6, status } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { byEngineerId: engineerId };
    if (status) filter.status = status;

    const leads = await Leads.find(filter)
      .populate("byUserId", "firstName lastName email phoneNumber role")
      .populate("byEngineerId", "firstName lastName email phoneNumber role")
      .populate("assignedTo", "firstName lastName email phoneNumber role")
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
          limit: limitNum,
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

// Get comprehensive lead data with tracking (wrapper for getAllLeads)
export const getComprehensiveLeadData = async (req: Request, res: Response): Promise<any> => {
  // Simply call getAllLeads since it now includes all statistics
  return getAllLeads(req, res);
};
