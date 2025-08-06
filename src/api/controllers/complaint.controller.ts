import { Request, Response } from "express";
import mongoose from "mongoose";
import { ComplaintModel, ComplaintStatus, Priority } from "../models/complaint.model";
import { UserModel, Role } from "../models/user.model";
import { sendSuccess, sendError } from "../../utils/helper";
import { AssignEngineerBody, CreateComplaintBody, UpdateStatusBody } from "../../type/complaint.interface";



const validatePriority = (priority: string): boolean => {
    return Object.values(Priority).includes(priority as Priority);
};

const validateStatus = (status: string): boolean => {
    return Object.values(ComplaintStatus).includes(status as ComplaintStatus);
};

const createComplaint = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId;
        const { title, issueDescription, issueType, phoneNumber, attachments, complaintType, type }: CreateComplaintBody = req.body;

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

        return sendSuccess(res, { complaint }, "Complaint created successfully", 201);
    } catch (error) {
        console.error("Create complaint error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

// 2. Get All Complaints (Admin / Manager)
const getAllComplaints = async (req: Request, res: Response): Promise<any> => {
    try {
        // const userRole = (req as any).role;

        // Check if user has permission
        // if (![Role.ADMIN, Role.MANAGER, Role.SUPERADMIN].includes(userRole)) {
        //     return sendError(res, "Access denied. Admin/Manager access required", 403);
        // }

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

        // Build filter object
        const filter: any = {};

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
            }
        }, "Complaints retrieved successfully");
    } catch (error) {
        console.error("Get all complaints error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

// 3. Get Complaints of Logged-in User
const getMyComplaints = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId;
        const { status, page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = req.query;

        const filter: any = { user: userId };

        if (status && validateStatus(status as string)) {
            filter.status = status;
        }

        // Build sort object
        const sort: any = {};
        sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

        const skip = (Number(page) - 1) * Number(limit);

        const complaints = await ComplaintModel.find(filter)
            .populate("engineer", "firstName lastName email phoneNumber")
            .populate("assignedBy", "firstName lastName email")
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
            .populate("assignedBy", "firstName lastName email");

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
        const userRole = (req as any).role;

        // Check admin permission
        if (![Role.ADMIN, Role.MANAGER, Role.SUPERADMIN].includes(userRole)) {
            return sendError(res, "Access denied. Admin access required", 403);
        }

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
            .populate("assignedBy", "firstName lastName email");

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

        // Update status with notes
        await complaint.updateStatus(status, resolutionNotes);

        // Update additional fields if provided
        if (remark) {
            complaint.remark = remark;
        }

        if (notResolvedReason) {
            complaint.notResolvedReason = notResolvedReason;
        }

        if (resolved !== undefined) {
            complaint.resolved = resolved;
        }

        await complaint.save();

        const updatedComplaint = await ComplaintModel.findById(id)
            .populate("user", "firstName lastName email phoneNumber")
            .populate("engineer", "firstName lastName email phoneNumber")
            .populate("assignedBy", "firstName lastName email");

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

        // Check admin permission
        if (![Role.ADMIN, Role.MANAGER, Role.SUPERADMIN].includes(userRole)) {
            return sendError(res, "Access denied. Admin access required", 403);
        }

        const { startDate, endDate } = req.query;

        const filter: any = {};

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

        return sendSuccess(res, { stats }, "Complaint statistics retrieved successfully");
    } catch (error) {
        console.error("Get complaint stats error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

export {
    createComplaint,
    getAllComplaints,
    getMyComplaints,
    getComplaintById,
    assignEngineer,
    updateComplaintStatus,
    deleteComplaint,
    getAssignedComplaints,
    getComplaintStats
};
