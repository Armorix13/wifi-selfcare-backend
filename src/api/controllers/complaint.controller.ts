import { Request, Response } from "express";
import mongoose from "mongoose";
import { ComplaintModel, ComplaintStatus, Priority } from "../models/complaint.model";
import { UserModel, Role } from "../models/user.model";
import { sendSuccess, sendError, sendMessage } from "../../utils/helper";
import { AssignEngineerBody, CreateComplaintBody, UpdateStatusBody, CloseComplaintBody } from "../../type/complaint.interface";
import { CustomerModel } from "../models/customer.model";
import Modem from "../models/modem.model";


const validatePriority = (priority: string): boolean => {
    return Object.values(Priority).includes(priority as Priority);
};

const validateStatus = (status: string): boolean => {
    return Object.values(ComplaintStatus).includes(status as ComplaintStatus);
};

const createComplaint = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId;

        console.log("userId", userId);

        const { title, issueDescription, issueType, phoneNumber, attachments, complaintType, type }: CreateComplaintBody = req.body;
        console.log("createComplaint", req.body);


        if (!title || !issueDescription || !issueType || !phoneNumber || !type) {
            return sendError(res, "Title, issue description, issue type, phone number, and type are required", 400);
        }

        // Get user to access their location
        const user = await UserModel.findById(userId);
        if (!user) {
            return sendError(res, "User not found", 404);
        }

        // Create complaint with user's location
        const complaint = await ComplaintModel.create({
            user: userId,
            title: title.trim(),
            issueDescription: issueDescription.trim(),
            complaintType,
            type,
            issueType,
            phoneNumber: phoneNumber.trim(),
            status: ComplaintStatus.PENDING,
            attachments: attachments || []
        });

        // Initialize status history with initial status
        await complaint.initializeStatusHistory(userId);

        return sendSuccess(res, { complaint }, "Complaint created successfully", 201);
    } catch (error) {
        console.error("Create complaint error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

export const addComplaintByAdmin = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId;
        const { title, issueDescription, priority, issueType, phoneNumber, complaintType, type, user, engineer } = req.body;

        // Debug logging
        console.log("Request files:", req.files);
        console.log("Request body:", req.body);

        // Handle file uploads for attachments
        let attachments: string[] = [];
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            attachments = req.files.map(f => `/view/image/${f.filename}`);
            console.log("Processed attachments:", attachments);
        } else {
            console.log("No files found in request");
        }

        // Create complaint data object with required fields
        const complaintData: any = {
            title,
            issueDescription,
            issueType,
            phoneNumber,
            complaintType,
            type,
            user,
            priority,
            assignedBy: userId,
            status: ComplaintStatus.PENDING,
        };

        // Add attachments if files were uploaded
        if (attachments.length > 0) {
            complaintData.attachments = attachments;
            console.log("Added attachments to complaint data:", complaintData.attachments);
        }

        // Add engineer if provided
        if (engineer) {
            complaintData.engineer = engineer;
        }

        console.log("Final complaint data:", complaintData);

        const complaint = await ComplaintModel.create(complaintData);

        await complaint.initializeStatusHistory(user);

        return sendSuccess(res, complaint, "Complaint created successfully by admin", 201);

    } catch (error) {
        console.error("Add complaint error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
}

// 2. Get All Complaints (Admin / Manager)
const getAllComplaints = async (req: Request, res: Response): Promise<any> => {
    try {
        // const userRole = (req as any).role;

        // Check if user has permission
        // if (![Role.ADMIN, Role.MANAGER, Role.SUPERADMIN].includes(userRole)) {
        //     return sendError(res, "Access denied. Admin/Manager access required", 403);
        // }
        const companyId = (req as any).userId;

        // Validate company ID
        if (!mongoose.Types.ObjectId.isValid(companyId)) {
            return sendError(res, "Invalid company ID", 400);
        }

        // Get all users assigned to this company
        const getOurCompanyUsers = await UserModel.find({ assignedCompany: companyId }).select("_id");
        const companyUserIds = getOurCompanyUsers.map(user => user._id);

        console.log(`Found ${companyUserIds.length} users in company ${companyId}`);

        // If no users found in company, return empty result
        if (companyUserIds.length === 0) {
            return sendSuccess(res, {
                complaints: [],
                pagination: {
                    page: 1,
                    limit: 10,
                    total: 0,
                    pages: 0
                }
            }, "No users found in your company");
        }

        const {
            status,
            priority,
            issueType,
            type,
            startDate,
            endDate,
            page = 1,
            limit = 10,
            sortBy = "createdAt",
            sortOrder = "desc"
        } = req.query;

        // Build filter object - only include complaints from users in our company
        const filter: any = {
            user: { $in: companyUserIds } // Filter complaints by company users only
        };

        console.log(`Filtering complaints for company users:`, companyUserIds);

        if (status && validateStatus(status as string)) {
            filter.status = status;
        }

        if (priority && validatePriority(priority as string)) {
            filter.priority = priority;
        }

        if (issueType) {
            filter.issueType = issueType;
        }

        if (type) {
            filter.type = type;
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate as string);
            if (endDate) filter.createdAt.$lte = new Date(endDate as string);
        }

        // Build sort object
        const sort: any = {};
        sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

        // Calculate pagination
        const skip = (Number(page) - 1) * Number(limit);

        const complaints = await ComplaintModel.find(filter)
            .populate("user", "firstName lastName email phoneNumber")
            .populate("engineer", "firstName lastName email phoneNumber")
            .populate("assignedBy", "firstName lastName email")
            .populate("statusHistory.updatedBy", "firstName lastName email")
            .sort(sort)
            .skip(skip)
            .limit(Number(limit));

        const total = await ComplaintModel.countDocuments(filter);

        return sendSuccess(res, {
            complaints,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            },
            companyInfo: {
                companyId,
                totalCompanyUsers: companyUserIds.length,
                filteredByCompany: true
            }
        }, `Complaints retrieved successfully for ${companyUserIds.length} company users`);
    } catch (error) {
        console.error("Get all complaints error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

// 3. Get Complaints of Logged-in User
const getMyComplaints = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId;

        console.log("user", userId);

        const { status, page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = req.query;

        const filter: any = { user: new mongoose.Types.ObjectId(userId) };

        if (status && validateStatus(status as string)) {
            filter.status = status;
        }


        // Build sort object
        const sort: any = {};
        sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

        const skip = (Number(page) - 1) * Number(limit);

        console.log("filter", filter);


        const complaints = await ComplaintModel.find(filter)
            .populate("engineer", "firstName lastName email phoneNumber")
            .populate("assignedBy", "firstName lastName email")
            .populate("statusHistory.updatedBy", "firstName lastName email")
            .sort(sort)
            .skip(skip)
            .limit(Number(limit));

        const total = await ComplaintModel.countDocuments(filter);

        // Get status counts for the user
        const statusCounts = await ComplaintModel.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Calculate resolution time for resolved complaints
        const resolutionStats = await ComplaintModel.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    status: ComplaintStatus.RESOLVED,
                    resolutionDate: { $exists: true }
                }
            },
            {
                $addFields: {
                    resolutionTimeHours: {
                        $divide: [
                            { $subtract: ["$resolutionDate", "$createdAt"] },
                            1000 * 60 * 60 // Convert to hours
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgResolutionTime: { $avg: "$resolutionTimeHours" },
                    totalResolved: { $sum: 1 }
                }
            }
        ]);

        return sendSuccess(res, {
            complaints,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            },
            summary: {
                statusCounts,
                resolutionStats: resolutionStats[0] || {
                    avgResolutionTime: 0,
                    totalResolved: 0
                }
            }
        }, "Your complaints retrieved successfully");
    } catch (error) {
        console.error("Get my complaints error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

// 4. Get Complaint by ID (with enhanced user access)
const getComplaintById = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const userId = (req as any).userId;
        const userRole = (req as any).role;
        const isMyComplaint = req.path.includes('/my/');

        const complaint = await ComplaintModel.findById(id)
            .populate("user", "firstName lastName email phoneNumber")
            .populate("engineer", "firstName lastName email phoneNumber")
            .populate("assignedBy", "firstName lastName email")
            .populate("statusHistory.updatedBy", "firstName lastName email");

        if (!complaint) {
            return sendError(res, "Complaint not found", 404);
        }

        // Check access permissions
        const isOwner = complaint.user._id.toString() === userId;
        const isAssignedEngineer = complaint.engineer?._id.toString() === userId;
        const isAdmin = [Role.ADMIN, Role.MANAGER, Role.SUPERADMIN].includes(userRole);

        // For /my/:id route, only allow owner access
        if (isMyComplaint && !isOwner) {
            return sendError(res, "Access denied. You can only view your own complaints", 403);
        }

        // For /:id route, allow owner, assigned engineer, or admin
        if (!isMyComplaint && !isOwner && !isAssignedEngineer && !isAdmin) {
            return sendError(res, "Access denied", 403);
        }

        // Add resolution time calculation for user's own complaints
        let complaintData: any = complaint.toObject();
        if (isOwner && complaint.resolutionDate && complaint.createdAt) {
            const resolutionTimeHours = Math.round(
                (complaint.resolutionDate.getTime() - complaint.createdAt.getTime()) / (1000 * 60 * 60)
            );
            complaintData.resolutionTimeHours = resolutionTimeHours;
        }

        // Add status history to the response
        complaintData.statusHistory = complaint.getFormattedStatusHistory();

        // Add engineer assignment information
        complaintData.hasEngineerAssigned = complaint.hasEngineerAssigned();
        complaintData.engineerAssignmentHistory = complaint.getEngineerAssignmentHistory();
        complaintData.statusHistoryCount = (complaint as any).statusHistoryCount;
        complaintData.latestStatusChange = (complaint as any).latestStatusChange;

        // Get customer details for the complaint user (not the requesting user)
        try {
            const customerDetails = await CustomerModel.findOne({ userId: complaint.user._id })
                .populate("fdbId", "fdbId fdbName fdbPower fdbType status location address city state")
                .populate("oltId", "oltId name oltIp oltType status location address city state");
            complaintData.customerDetails = customerDetails;
        } catch (customerError) {
            console.error("Error fetching customer details:", customerError);
            complaintData.customerDetails = null;
        }

        // Get modem details for the complaint user (not the requesting user)
        try {
            const modem = await Modem.findOne({ userId: complaint.user._id });
            complaintData.modemDetails = modem;
        } catch (modemError) {
            console.error("Error fetching modem details:", modemError);
            complaintData.modemDetails = null;
        }

        // Add additional metadata
        complaintData.hasCustomerDetails = !!complaintData.customerDetails;
        complaintData.hasModemDetails = !!complaintData.modemDetails;

        return sendSuccess(res, { complaint: complaintData }, "Complaint retrieved successfully");
    } catch (error) {
        console.error("Get complaint by ID error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

// 5. Assign Engineer to Complaint (Admin only)
const assignEngineer = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const { engineerId, priority }: AssignEngineerBody = req.body;
        const adminId = (req as any).userId;
        // const userRole = (req as any).role;

        // Check admin permission
        // if (![Role.ADMIN, Role.MANAGER, Role.SUPERADMIN].includes(userRole)) {
        //     return sendError(res, "Access denied. Admin access required", 403);
        // }

        if (!engineerId) {
            return sendError(res, "Engineer ID is required", 400);
        }

        if (priority && !validatePriority(priority)) {
            return sendError(res, "Invalid priority level", 400);
        }

        // Validate engineer exists and is actually an engineer
        const engineer = await UserModel.findById(engineerId);
        if (!engineer) {
            return sendError(res, "Engineer not found", 404);
        }

        if (engineer.role !== Role.ENGINEER) {
            return sendError(res, "User is not an engineer", 400);
        }

        const complaint = await ComplaintModel.findById(id);
        if (!complaint) {
            return sendError(res, "Complaint not found", 404);
        }

        // Assign engineer and update priority if provided
        await complaint.assignEngineer(new mongoose.Types.ObjectId(engineerId), new mongoose.Types.ObjectId(adminId));

        if (priority) {
            complaint.priority = priority;
            await complaint.save();
        }

        const updatedComplaint = await ComplaintModel.findById(id)
            .populate("user", "firstName lastName email phoneNumber")
            .populate("engineer", "firstName lastName email phoneNumber")
            .populate("assignedBy", "firstName lastName email")
            .populate("statusHistory.updatedBy", "firstName lastName email");

        return sendSuccess(res, { complaint: updatedComplaint }, "Engineer assigned successfully");
    } catch (error) {
        console.error("Assign engineer error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

// 6. Update Complaint Status (Engineer)
const updateComplaintStatus = async (req: Request, res: Response): Promise<any> => {
    try {


        const { id } = req.params;
        const { status, resolved, remark, notResolvedReason, resolutionNotes }: UpdateStatusBody = req.body;
        const userId = (req as any).userId;
        const userRole = (req as any).role;

        console.log("updateComplaintStatus", req.body);
        console.log("userId", userId);
        console.log("userRole", userRole);


        // Check if user is engineer or admin
        if (userRole !== Role.ENGINEER && ![Role.ADMIN, Role.MANAGER, Role.SUPERADMIN].includes(userRole)) {
            return sendError(res, "Access denied. Engineer access required", 403);
        }

        if (!status || !validateStatus(status)) {
            return sendError(res, "Valid status is required", 400);
        }

        const complaint = await ComplaintModel.findById(id);
        if (!complaint) {
            return sendError(res, "Complaint not found", 404);
        }

        // Check if engineer is assigned to this complaint (unless admin)
        if (userRole === Role.ENGINEER && complaint.engineer?.toString() !== userId) {
            return sendError(res, "You can only update complaints assigned to you", 403);
        }

        // Update status with notes and track who made the change
        await complaint.updateStatus(status,remark || resolutionNotes, userId);

        // Update additional fields if provided
        if (remark) {
            complaint.remark = remark;
        }

        if (notResolvedReason) {
            complaint.notResolvedReason = notResolvedReason;
        }
        if(resolutionNotes){
            complaint.resolutionNotes = resolutionNotes;
        }

        if (resolved !== undefined) {
            complaint.resolved = resolved;
        }

        await complaint.save();

        const updatedComplaint = await ComplaintModel.findById(id)
            .populate("user", "firstName lastName email phoneNumber")
            .populate("engineer", "firstName lastName email phoneNumber")
            .populate("assignedBy", "firstName lastName email")
            .populate("statusHistory.updatedBy", "firstName lastName email");

        return sendSuccess(res, { complaint: updatedComplaint }, "Complaint status updated successfully");
    } catch (error) {
        console.error("Update complaint status error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

// 7. Delete Complaint (Admin or User)
const deleteComplaint = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const userId = (req as any).userId;
        const userRole = (req as any).role;

        const complaint = await ComplaintModel.findById(id);
        if (!complaint) {
            return sendError(res, "Complaint not found", 404);
        }

        // Check permissions
        const isOwner = complaint.user.toString() === userId;
        const isAdmin = [Role.ADMIN, Role.MANAGER, Role.SUPERADMIN].includes(userRole);

        if (!isOwner && !isAdmin) {
            return sendError(res, "Access denied", 403);
        }

        // Only allow deletion if complaint is pending or cancelled
        if (!isAdmin && ![ComplaintStatus.PENDING, ComplaintStatus.CANCELLED].includes(complaint.status)) {
            return sendError(res, "Cannot delete complaint that is not pending or cancelled", 400);
        }

        await ComplaintModel.findByIdAndDelete(id);

        return sendSuccess(res, {}, "Complaint deleted successfully");
    } catch (error) {
        console.error("Delete complaint error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

// 8. Get Complaints Assigned to Engineer
const getAssignedComplaints = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId;
        const userRole = (req as any).role;
        const { status, page = 1, limit = 10 } = req.query;

        // Check if user is engineer
        if (userRole !== Role.ENGINEER) {
            return sendError(res, "Access denied. Engineer access required", 403);
        }

        const filter: any = { engineer: userId };

        if (status && validateStatus(status as string)) {
            filter.status = status;
        }

        const skip = (Number(page) - 1) * Number(limit);

        const complaints = await ComplaintModel.find(filter)
            .populate("user", "firstName lastName email phoneNumber")
            .populate("assignedBy", "firstName lastName email")
            .populate("statusHistory.updatedBy", "firstName lastName email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const total = await ComplaintModel.countDocuments(filter);

        return sendSuccess(res, {
            complaints,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        }, "Assigned complaints retrieved successfully");
    } catch (error) {
        console.error("Get assigned complaints error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

// 9. Get Complaint Stats by Status
const getComplaintStats = async (req: Request, res: Response): Promise<any> => {
    try {
        const userRole = (req as any).role;
        const companyId = (req as any).userId;

        // Check admin permission
        if (![Role.ADMIN, Role.MANAGER, Role.SUPERADMIN].includes(userRole)) {
            return sendError(res, "Access denied. Admin access required", 403);
        }

        // Validate company ID
        if (!mongoose.Types.ObjectId.isValid(companyId)) {
            return sendError(res, "Invalid company ID", 400);
        }

        // Get all users assigned to this company
        const getOurCompanyUsers = await UserModel.find({ assignedCompany: companyId }).select("_id");
        const companyUserIds = getOurCompanyUsers.map(user => user._id);

        console.log(`Stats: Found ${companyUserIds.length} users in company ${companyId}`);

        // If no users found in company, return empty stats
        if (companyUserIds.length === 0) {
            return sendSuccess(res, {
                stats: {
                    statusStats: [],
                    typeStats: [],
                    priorityStats: [],
                    totalComplaints: 0,
                    resolvedComplaints: 0,
                    pendingComplaints: 0,
                    resolutionRate: 0
                },
                companyInfo: {
                    companyId,
                    totalCompanyUsers: 0,
                    filteredByCompany: true
                }
            }, "No users found in your company");
        }

        const { startDate, endDate } = req.query;

        // Build filter with company user filtering
        const filter: any = {
            user: { $in: companyUserIds } // Filter by company users
        };

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate as string);
            if (endDate) filter.createdAt.$lte = new Date(endDate as string);
        }

        // Get stats by status
        const statusStats = await ComplaintModel.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Get stats by priority
        const priorityStats = await ComplaintModel.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: "$priority",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Get stats by issue type
        const issueTypeStats = await ComplaintModel.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: "$issueType",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Get stats by complaint type
        const complaintTypeStats = await ComplaintModel.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: "$type",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Get total counts
        const totalComplaints = await ComplaintModel.countDocuments(filter);
        const resolvedComplaints = await ComplaintModel.countDocuments({ ...filter, status: ComplaintStatus.RESOLVED });
        const pendingComplaints = await ComplaintModel.countDocuments({ ...filter, status: ComplaintStatus.PENDING });

        // Calculate average resolution time
        const resolutionTimeStats = await ComplaintModel.aggregate([
            { $match: { ...filter, status: ComplaintStatus.RESOLVED, resolutionDate: { $exists: true } } },
            {
                $addFields: {
                    resolutionTimeHours: {
                        $divide: [
                            { $subtract: ["$resolutionDate", "$createdAt"] },
                            1000 * 60 * 60 // Convert to hours
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgResolutionTime: { $avg: "$resolutionTimeHours" },
                    minResolutionTime: { $min: "$resolutionTimeHours" },
                    maxResolutionTime: { $max: "$resolutionTimeHours" }
                }
            }
        ]);

        const stats = {
            total: totalComplaints,
            resolved: resolvedComplaints,
            pending: pendingComplaints,
            resolutionRate: totalComplaints > 0 ? ((resolvedComplaints / totalComplaints) * 100).toFixed(2) : 0,
            byStatus: statusStats,
            byPriority: priorityStats,
            byIssueType: issueTypeStats,
            byComplaintType: complaintTypeStats,
            resolutionTime: resolutionTimeStats[0] || {
                avgResolutionTime: 0,
                minResolutionTime: 0,
                maxResolutionTime: 0
            }
        };

        return sendSuccess(res, {
            stats,
            companyInfo: {
                companyId,
                totalCompanyUsers: companyUserIds.length,
                filteredByCompany: true
            }
        }, `Complaint statistics retrieved successfully for ${companyUserIds.length} company users`);
    } catch (error) {
        console.error("Get complaint stats error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

// 10. Get Comprehensive Dashboard Data
const getDashboardData = async (req: Request, res: Response): Promise<any> => {
    try {
        const userRole = (req as any).role;
        const companyId = (req as any).userId;

        // Check admin permission
        if (![Role.ADMIN, Role.MANAGER, Role.SUPERADMIN].includes(userRole)) {
            return sendError(res, "Access denied. Admin access required", 403);
        }

        // Validate company ID
        if (!mongoose.Types.ObjectId.isValid(companyId)) {
            return sendError(res, "Invalid company ID", 400);
        }

        // Get all users assigned to this company
        const getOurCompanyUsers = await UserModel.find({ assignedCompany: companyId }).select("_id");
        const companyUserIds = getOurCompanyUsers.map(user => user._id);

        console.log(`Dashboard: Found ${companyUserIds.length} users in company ${companyId}`);

        // If no users found in company, return empty dashboard
        if (companyUserIds.length === 0) {
            return sendSuccess(res, {
                dashboardData: {
                    kpis: {
                        totalComplaints: { value: 0, change: "0.0", trend: "neutral" },
                        resolutionRate: { value: 0, change: "0.0", trend: "neutral" },
                        avgResolutionTime: { value: 0, change: "0.0", trend: "neutral" },
                        pendingIssues: { value: 0, change: "0.0", trend: "neutral" }
                    },
                    distributions: { status: [], type: [] },
                    trends: { daily: [] },
                    summary: { currentPeriod: {}, lastMonth: {} },
                    additionalData: { priorityDistribution: [], topIssueTypes: [], engineerPerformance: [], recentActivity: [] }
                },
                companyInfo: {
                    companyId,
                    totalCompanyUsers: 0,
                    filteredByCompany: true
                }
            }, "No users found in your company");
        }

        const { startDate, endDate } = req.query;

        // Current period filter - include company user filter
        const currentFilter: any = {
            user: { $in: companyUserIds } // Filter by company users
        };
        if (startDate || endDate) {
            currentFilter.createdAt = {};
            if (startDate) currentFilter.createdAt.$gte = new Date(startDate as string);
            if (endDate) currentFilter.createdAt.$lte = new Date(endDate as string);
        }

        // Last month filter for comparison - include company user filter
        const lastMonthStart = new Date();
        lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
        lastMonthStart.setDate(1);
        lastMonthStart.setHours(0, 0, 0, 0);

        const lastMonthEnd = new Date();
        lastMonthEnd.setDate(0); // Last day of previous month
        lastMonthEnd.setHours(23, 59, 59, 999);

        const lastMonthFilter = {
            user: { $in: companyUserIds }, // Filter by company users
            createdAt: {
                $gte: lastMonthStart,
                $lte: lastMonthEnd
            }
        };

        // 1. Current Period KPIs
        const currentTotal = await ComplaintModel.countDocuments(currentFilter);
        const currentResolved = await ComplaintModel.countDocuments({ ...currentFilter, status: ComplaintStatus.RESOLVED });
        const currentPending = await ComplaintModel.countDocuments({ ...currentFilter, status: ComplaintStatus.PENDING });

        // 2. Last Month KPIs for comparison
        const lastMonthTotal = await ComplaintModel.countDocuments(lastMonthFilter);
        const lastMonthResolved = await ComplaintModel.countDocuments({ ...lastMonthFilter, status: ComplaintStatus.RESOLVED });
        const lastMonthPending = await ComplaintModel.countDocuments({ ...lastMonthFilter, status: ComplaintStatus.PENDING });

        // 3. Resolution Time Statistics
        const resolutionTimeStats = await ComplaintModel.aggregate([
            { $match: { ...currentFilter, status: ComplaintStatus.RESOLVED, resolutionDate: { $exists: true } } },
            {
                $addFields: {
                    resolutionTimeHours: {
                        $divide: [
                            { $subtract: ["$resolutionDate", "$createdAt"] },
                            1000 * 60 * 60 // Convert to hours
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgResolutionTime: { $avg: "$resolutionTimeHours" },
                    totalResolved: { $sum: 1 }
                }
            }
        ]);

        const lastMonthResolutionTimeStats = await ComplaintModel.aggregate([
            { $match: { ...lastMonthFilter, status: ComplaintStatus.RESOLVED, resolutionDate: { $exists: true } } },
            {
                $addFields: {
                    resolutionTimeHours: {
                        $divide: [
                            { $subtract: ["$resolutionDate", "$createdAt"] },
                            1000 * 60 * 60
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgResolutionTime: { $avg: "$resolutionTimeHours" },
                    totalResolved: { $sum: 1 }
                }
            }
        ]);

        // 4. Status Distribution
        const statusDistribution = await ComplaintModel.aggregate([
            { $match: currentFilter },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            },
            {
                $addFields: {
                    percentage: {
                        $multiply: [
                            { $divide: ["$count", currentTotal] },
                            100
                        ]
                    }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // 5. Type Distribution (WIFI vs CCTV)
        const typeDistribution = await ComplaintModel.aggregate([
            { $match: currentFilter },
            {
                $group: {
                    _id: "$type",
                    count: { $sum: 1 }
                }
            },
            {
                $addFields: {
                    percentage: {
                        $multiply: [
                            { $divide: ["$count", currentTotal] },
                            100
                        ]
                    }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // 6. Daily Trends (Last 7 days) - include company user filter
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const dailyTrends = await ComplaintModel.aggregate([
            {
                $match: {
                    user: { $in: companyUserIds }, // Filter by company users
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $addFields: {
                    date: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$createdAt"
                        }
                    },
                    isResolved: {
                        $cond: [
                            { $eq: ["$status", ComplaintStatus.RESOLVED] },
                            1,
                            0
                        ]
                    },
                    isNew: 1
                }
            },
            {
                $group: {
                    _id: "$date",
                    newComplaints: { $sum: "$isNew" },
                    resolved: { $sum: "$isResolved" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Fill missing dates with zero values
        const filledDailyTrends = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(sevenDaysAgo);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];

            const existingData = dailyTrends.find(item => item._id === dateStr);
            filledDailyTrends.push({
                date: dateStr,
                newComplaints: existingData ? existingData.newComplaints : 0,
                resolved: existingData ? existingData.resolved : 0
            });
        }

        // 7. Calculate Trends and Percentages
        const currentResolutionRate = currentTotal > 0 ? (currentResolved / currentTotal) * 100 : 0;
        const lastMonthResolutionRate = lastMonthTotal > 0 ? (lastMonthResolved / lastMonthTotal) * 100 : 0;
        const resolutionRateChange = currentResolutionRate - lastMonthResolutionRate;

        const totalComplaintsChange = lastMonthTotal > 0 ? ((currentTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;
        const pendingIssuesChange = lastMonthPending > 0 ? ((currentPending - lastMonthPending) / lastMonthPending) * 100 : 0;

        const currentAvgResolutionTime = resolutionTimeStats[0]?.avgResolutionTime || 0;
        const lastMonthAvgResolutionTime = lastMonthResolutionTimeStats[0]?.avgResolutionTime || 0;
        const resolutionTimeChange = currentAvgResolutionTime - lastMonthAvgResolutionTime;

        // 8. Prepare Dashboard Data
        const dashboardData: any = {
            kpis: {
                totalComplaints: {
                    value: currentTotal,
                    change: totalComplaintsChange.toFixed(1),
                    trend: totalComplaintsChange >= 0 ? "up" : "down"
                },
                resolutionRate: {
                    value: currentResolutionRate.toFixed(1),
                    change: resolutionRateChange.toFixed(1),
                    trend: resolutionRateChange >= 0 ? "up" : "down"
                },
                avgResolutionTime: {
                    value: currentAvgResolutionTime.toFixed(1),
                    change: resolutionTimeChange.toFixed(1),
                    trend: resolutionTimeChange <= 0 ? "up" : "down" // Lower time is better
                },
                pendingIssues: {
                    value: currentPending,
                    change: pendingIssuesChange.toFixed(1),
                    trend: pendingIssuesChange <= 0 ? "up" : "down" // Lower pending is better
                }
            },
            distributions: {
                status: statusDistribution.map(item => ({
                    status: item._id,
                    count: item.count,
                    percentage: item.percentage.toFixed(1)
                })),
                type: typeDistribution.map(item => ({
                    type: item._id,
                    count: item.count,
                    percentage: item.percentage.toFixed(1)
                }))
            },
            trends: {
                daily: filledDailyTrends
            },
            summary: {
                currentPeriod: {
                    total: currentTotal,
                    resolved: currentResolved,
                    pending: currentPending,
                    avgResolutionTime: currentAvgResolutionTime
                },
                lastMonth: {
                    total: lastMonthTotal,
                    resolved: lastMonthResolved,
                    pending: lastMonthPending,
                    avgResolutionTime: lastMonthAvgResolutionTime
                }
            }
        };

        // 9. Additional Global Data
        // Priority Distribution
        const priorityDistribution = await ComplaintModel.aggregate([
            { $match: currentFilter },
            {
                $group: {
                    _id: "$priority",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Top Issue Types
        const topIssueTypes = await ComplaintModel.aggregate([
            { $match: currentFilter },
            {
                $lookup: {
                    from: "issuetypes",
                    localField: "issueType",
                    foreignField: "_id",
                    as: "issueTypeData"
                }
            },
            {
                $group: {
                    _id: "$issueType",
                    count: { $sum: 1 },
                    issueTypeName: { $first: { $arrayElemAt: ["$issueTypeData.name", 0] } }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // Engineer Performance (Top 5)
        const engineerPerformance = await ComplaintModel.aggregate([
            { $match: { ...currentFilter, engineer: { $exists: true, $ne: null } } },
            {
                $lookup: {
                    from: "users",
                    localField: "engineer",
                    foreignField: "_id",
                    as: "engineerData"
                }
            },
            {
                $group: {
                    _id: "$engineer",
                    totalAssigned: { $sum: 1 },
                    resolved: {
                        $sum: {
                            $cond: [
                                { $eq: ["$status", ComplaintStatus.RESOLVED] },
                                1,
                                0
                            ]
                        }
                    },
                    engineerName: {
                        $first: {
                            $concat: [
                                { $arrayElemAt: ["$engineerData.firstName", 0] },
                                " ",
                                { $arrayElemAt: ["$engineerData.lastName", 0] }
                            ]
                        }
                    }
                }
            },
            {
                $addFields: {
                    resolutionRate: {
                        $multiply: [
                            { $divide: ["$resolved", "$totalAssigned"] },
                            100
                        ]
                    }
                }
            },
            { $sort: { resolutionRate: -1 } },
            { $limit: 5 }
        ]);

        // Recent Activity (Last 10 complaints)
        const recentActivity = await ComplaintModel.find(currentFilter)
            .populate("user", "firstName lastName")
            .populate("engineer", "firstName lastName")
            .sort({ createdAt: -1 })
            .limit(10)
            .select("title status createdAt user engineer type priority");

        // Add the additional data to dashboard
        dashboardData.additionalData = {
            priorityDistribution: priorityDistribution.map(item => ({
                priority: item._id,
                count: item.count
            })),
            topIssueTypes: topIssueTypes.map(item => ({
                issueType: item.issueTypeName || "Unknown",
                count: item.count
            })),
            engineerPerformance: engineerPerformance.map(item => ({
                engineer: item.engineerName,
                totalAssigned: item.totalAssigned,
                resolved: item.resolved,
                resolutionRate: item.resolutionRate.toFixed(1)
            })),
            recentActivity: recentActivity.map(item => ({
                id: item._id,
                title: item.title,
                status: item.status,
                type: item.type,
                priority: item.priority,
                createdAt: item.createdAt,
                user: item.user && typeof item.user === 'object' && 'firstName' in item.user
                    ? `${(item.user as any).firstName} ${(item.user as any).lastName}`
                    : "Unknown",
                engineer: item.engineer && typeof item.engineer === 'object' && 'firstName' in item.engineer
                    ? `${(item.engineer as any).firstName} ${(item.engineer as any).lastName}`
                    : "Unassigned"
            }))
        };

        return sendSuccess(res, {
            dashboardData,
            companyInfo: {
                companyId,
                totalCompanyUsers: companyUserIds.length,
                filteredByCompany: true
            }
        }, `Dashboard data retrieved successfully for ${companyUserIds.length} company users`);
    } catch (error) {
        console.error("Get dashboard data error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

// Get complaint status history
const getComplaintStatusHistory = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const userId = (req as any).userId;
        const userRole = (req as any).role;

        // Check if user has access to this complaint
        const complaint = await ComplaintModel.findById(id);
        if (!complaint) {
            return sendError(res, "Complaint not found", 404);
        }

        // Check if user is authorized to view this complaint
        const isOwner = complaint.user.toString() === userId;
        const isAssignedEngineer = complaint.engineer?.toString() === userId;
        const isAdmin = [Role.ADMIN, Role.MANAGER, Role.SUPERADMIN].includes(userRole);

        if (!isOwner && !isAssignedEngineer && !isAdmin) {
            return sendError(res, "Access denied", 403);
        }

        // Get status history with user details
        const statusHistory = await ComplaintModel.aggregate([
            { $match: { _id: complaint._id } },
            { $unwind: "$statusHistory" },
            {
                $lookup: {
                    from: "users",
                    localField: "statusHistory.updatedBy",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            {
                $addFields: {
                    "statusHistory.updatedByUser": {
                        $arrayElemAt: ["$userData", 0]
                    }
                }
            },
            {
                $project: {
                    status: "$statusHistory.status",
                    remarks: "$statusHistory.remarks",
                    updatedAt: "$statusHistory.updatedAt",
                    previousStatus: "$statusHistory.previousStatus",
                    updatedBy: {
                        firstName: "$statusHistory.updatedByUser.firstName",
                        lastName: "$statusHistory.updatedByUser.lastName",
                        email: "$statusHistory.updatedByUser.email"
                    },
                    metadata: "$statusHistory.metadata",
                    additionalInfo: "$statusHistory.additionalInfo"
                }
            },
            { $sort: { updatedAt: -1 } }
        ]);

        return sendSuccess(res, { statusHistory }, "Status history retrieved successfully");
    } catch (error) {
        console.error("Get status history error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

// Close complaint with OTP and resolution attachments
const closeComplaint = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const { resolutionAttachments, notes }: CloseComplaintBody = req.body;
        const userId = (req as any).userId;
        const userRole = (req as any).role;

        // Check if user is engineer or admin
        if (userRole !== Role.ENGINEER && ![Role.ADMIN, Role.MANAGER, Role.SUPERADMIN].includes(userRole)) {
            return sendError(res, "Access denied. Engineer access required", 403);
        }

        // Validate resolution attachments
        if (!resolutionAttachments || resolutionAttachments.length < 2 || resolutionAttachments.length > 4) {
            return sendError(res, "Resolution attachments must be between 2 and 4 image URLs", 400);
        }

        const complaint = await ComplaintModel.findById(id);
        if (!complaint) {
            return sendError(res, "Complaint not found", 404);
        }

        // Check if engineer is assigned to this complaint (unless admin)
        if (userRole === Role.ENGINEER && complaint.engineer?.toString() !== userId) {
            return sendError(res, "You can only close complaints assigned to you", 403);
        }

        // Check if complaint is already resolved
        if (complaint.status === ComplaintStatus.RESOLVED) {
            return sendError(res, "Complaint is already resolved", 400);
        }
        // Close the complaint (this will generate OTP and update status)
        await complaint.closeComplaint("", resolutionAttachments, notes, userId);

        // Get updated complaint with populated fields
        const updatedComplaint = await ComplaintModel.findById(id)
            .populate("user", "firstName lastName email phoneNumber")
            .populate("engineer", "firstName lastName email phoneNumber")
            .populate("assignedBy", "firstName lastName email")
            .populate("statusHistory.updatedBy", "firstName lastName email");

        if (!updatedComplaint) {
            return sendError(res, "Failed to retrieve updated complaint", 500);
        }

        // Send Happy Code email to customer
        try {
            const userEmail = (updatedComplaint.user as any).email;
            const happyCode = updatedComplaint.otp;
            const complaintId = updatedComplaint.id;

            if (userEmail && happyCode && complaintId) {
                const emailSubject = `✅ WiFi Issue Resolved – Please Confirm with Happy Code`;
                const emailText = `Dear Customer,\n\nWe hope you're doing well.\n\nWe're pleased to inform you that our engineer has successfully worked on your recent WiFi service complaint (ID: ${complaintId}). As per our records, the issue has now been resolved.\n\nTo help us confirm that everything is working perfectly on your end, please use the Happy Code: ${happyCode}.\n\nYou may be asked to provide this code during confirmation with our team.\n\nWe truly appreciate your patience and cooperation throughout the process. Thank you for choosing our service.\n\nBest regards,\nWiFi SelfCare Team`;
                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #28A745;">✅ WiFi Issue Resolved – Please Confirm with Happy Code</h2>
                        <p>Dear Customer,</p>
                        <p>We hope you're doing well.</p>
                        <p>We're pleased to inform you that our engineer has successfully worked on your recent WiFi service complaint (ID: <strong>${complaintId}</strong>). As per our records, the issue has now been resolved.</p>
                        <p>To help us confirm that everything is working perfectly on your end, please use the Happy Code: <strong style="color: #007bff; font-size: 18px;">${happyCode}</strong>.</p>
                        <p>You may be asked to provide this code during confirmation with our team.</p>
                        <p>We truly appreciate your patience and cooperation throughout the process. Thank you for choosing our service.</p>
                        <br>
                        <p>Best regards,<br>WiFi SelfCare Team</p>
                    </div>
                `;

                await sendMessage.sendEmail({
                    userEmail,
                    subject: emailSubject,
                    text: emailText,
                    html: emailHtml
                });

                console.log(`Happy Code email sent successfully to ${userEmail} for complaint ${id}`);
            } else {
                console.warn(`Missing required data for email: email=${userEmail}, happyCode=${happyCode}, id=${complaintId}`);
            }
        } catch (emailError) {
            console.error('Email sending error:', emailError);
            // Don't fail the request if email fails
        }

        return sendSuccess(res, {
            complaint: updatedComplaint,
            message: `Complaint closed successfully. Happy Code ${updatedComplaint.otp} has been sent to customer's email.`
        }, "Complaint closed successfully");
    } catch (error) {
        console.error("Close complaint error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

// Verify OTP to complete complaint closure
const verifyOTP = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const { otp } = req.body;
        const userId = (req as any).userId;

        if (!otp) {
            return sendError(res, "OTP is required", 400);
        }

        const complaint = await ComplaintModel.findById(id);
        if (!complaint) {
            return sendError(res, "Complaint not found", 404);
        }

        // Check if user is the complaint owner
        // if (complaint.user.toString() !== userId) {
        //     return sendError(res, "Access denied. You can only verify OTP for your own complaints", 403);
        // }

        // Check if complaint is already resolved
        if (complaint.status !== ComplaintStatus.RESOLVED) {
            return sendError(res, "Complaint is not resolved yet", 400);
        }

        // Check if OTP is already verified
        if (complaint.otpVerified) {
            return sendError(res, "OTP is already verified", 400);
        }

        // Verify OTP
        await complaint.verifyOTP(otp);

        // Get updated complaint
        const updatedComplaint = await ComplaintModel.findById(id)
            .populate("user", "firstName lastName email phoneNumber")
            .populate("engineer", "firstName lastName email phoneNumber")
            .populate("assignedBy", "firstName lastName email")
            .populate("statusHistory.updatedBy", "firstName lastName email");

        if (!updatedComplaint) {
            return sendError(res, "Failed to retrieve updated complaint", 500);
        }

        return sendSuccess(res, {
            complaint: updatedComplaint,
            message: "OTP verified successfully. Complaint is now fully closed."
        }, "OTP verified successfully");
    } catch (error: any) {
        console.error("Verify OTP error:", error);
        if (error.message === 'Invalid OTP') {
            return sendError(res, "Invalid OTP", 400);
        }
        return sendError(res, "Internal server error", 500, error);
    }
};

// Reassign complaint to different engineer
const reassignComplaint = async (req: Request, res: Response): Promise<any> => {
    try {
        const adminUserId = (req as any).userId; // Logged in admin ID
        const { complaintId, engineerId } = req.body;

        console.log("Admin reassigning complaint with data:", req.body);

        // Validate required fields
        if (!complaintId || !engineerId) {
            return sendError(res, "Complaint ID and Engineer ID are required", 400);
        }

        // Validate complaint exists
        const complaint = await ComplaintModel.findById(complaintId)
            .populate('user', 'firstName lastName email phoneNumber')
            .populate('engineer', 'firstName lastName email phoneNumber role')
            .populate('assignedBy', 'firstName lastName email phoneNumber role');

        if (!complaint) {
            return sendError(res, "Complaint not found", 404);
        }

        // Validate engineer exists and is an engineer
        const engineer = await UserModel.findById(engineerId);
        if (!engineer) {
            return sendError(res, "Engineer not found", 404);
        }

        if (engineer.role !== Role.ENGINEER) {
            return sendError(res, "Selected user is not an engineer", 400);
        }

        if (engineer.isDeleted) {
            return sendError(res, "Engineer account is deleted", 400);
        }

        if (engineer.isDeactivated) {
            return sendError(res, "Engineer account is deactivated", 400);
        }

        if (engineer.isSuspended) {
            return sendError(res, "Engineer account is suspended", 400);
        }

        // Check if complaint is already assigned to the same engineer
        if (complaint.engineer && complaint.engineer.toString() === engineerId) {
            return sendError(res, "Complaint is already assigned to this engineer", 400);
        }

        // Check if complaint can be reassigned (not in certain statuses)
        const nonReassignableStatuses = [
            ComplaintStatus.RESOLVED,
            ComplaintStatus.CANCELLED,
            ComplaintStatus.NOT_RESOLVED
        ];

        if (nonReassignableStatuses.includes(complaint.status)) {
            return sendError(res, `Cannot reassign complaint with status: ${complaint.status}`, 400);
        }

        // Store previous engineer for history
        const previousEngineer = complaint.engineer;

        // Update complaint with new engineer
        const updatedComplaint = await ComplaintModel.findByIdAndUpdate(
            complaintId,
            {
                engineer: engineerId,
                assignedBy: adminUserId,
                status: ComplaintStatus.ASSIGNED, // Reset to assigned status
                statusColor: "#007BFF" // Blue color for assigned status
            },
            { new: true, runValidators: true }
        ).populate('user', 'firstName lastName email phoneNumber')
         .populate('engineer', 'firstName lastName email phoneNumber role')
         .populate('assignedBy', 'firstName lastName email phoneNumber role');

        // Add status history entry for reassignment
        const statusHistoryEntry = {
            status: ComplaintStatus.ASSIGNED,
            remarks: `Complaint reassigned from ${previousEngineer ? 'previous engineer' : 'unassigned'} to new engineer`,
            metadata: {
                previousEngineer: previousEngineer || null,
                newEngineer: engineerId,
                reassignedBy: adminUserId,
                reassignmentDate: new Date()
            },
            updatedBy: adminUserId,
            previousStatus: complaint.status,
            additionalInfo: {
                action: 'reassignment',
                reason: 'admin_reassignment'
            }
        };

        // Add to status history
        await ComplaintModel.findByIdAndUpdate(
            complaintId,
            { $push: { statusHistory: statusHistoryEntry } }
        );

        // Get the updated complaint with all populated fields
        const finalComplaint = await ComplaintModel.findById(complaintId)
            .populate('user', 'firstName lastName email phoneNumber')
            .populate('engineer', 'firstName lastName email phoneNumber role')
            .populate('assignedBy', 'firstName lastName email phoneNumber role');

        return sendSuccess(res, finalComplaint, "Complaint reassigned successfully");
    } catch (error: any) {
        console.error("Reassign complaint error:", error);
        return sendError(res, "Failed to reassign complaint", 500, error);
    }
};

export {
    createComplaint,
    getAllComplaints,
    getMyComplaints,
    getComplaintById,
    assignEngineer,
    reassignComplaint,
    updateComplaintStatus,
    deleteComplaint,
    getAssignedComplaints,
    getComplaintStats,
    getDashboardData,
    getComplaintStatusHistory,
    closeComplaint,
    verifyOTP
};
