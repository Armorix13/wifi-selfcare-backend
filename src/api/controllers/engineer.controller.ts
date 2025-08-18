import { Request, Response } from "express";
import { Role, UserModel } from "../models/user.model";
import { EngineerAttendanceModel, AttendanceStatus } from "../models/engineerAttendance.model";
import { LeaveRequestModel, LeaveType, LeaveStatus, LeaveReason } from "../models/leaveRequest.model";
import { sendSuccess, sendError, generateAccessToken, generateRefreshToken, generateRandomJti, comparePassword } from '../../utils/helper';

const engineerLogin = async (req: Request, res: Response): Promise<any> => {
    try {
        const { email, password, deviceType, deviceToken } = req.body;

        if (!email || !password) {
            return sendError(res, "Email and password are required", 400);
        }

        const user = await UserModel.findOne({ email });
        if (!user) {
            return sendError(res, "User not found", 404);
        }

        if (user.role !== Role.ENGINEER) {
            return sendError(res, "Access denied. Engineer privileges required.", 403);
        }

        if (user.isDeleted) {
            return sendError(res, "Account is deleted", 403);
        }
        if (user.isDeactivated) {
            return sendError(res, "Account is deactivated", 403);
        }
        if (user.isSuspended) {
            return sendError(res, "Account is suspended", 403);
        }

        if (!user.isAccountVerified) {
            return sendError(res, "Account is not verified. Please verify your account.", 403);
        }

        if (!user.password) {
            return sendError(res, "Password not set. Please contact administrator.", 400);
        }

        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
            return sendError(res, "Invalid credentials", 400);
        }

        const jti = generateRandomJti();
        user.jti = jti;
        user.lastLogin = new Date();
        user.deviceType = deviceType;
        user.deviceToken = deviceToken;
        await user.save();

        // Generate access and refresh tokens
        const accessToken = generateAccessToken({ userId: String(user._id), role: user.role, jti });
        const refreshToken = generateRefreshToken({ userId: String(user._id), role: user.role, jti });

        // Prepare engineer info for response
        const engineerInfo = {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            countryCode: user.countryCode,
            role: user.role,
            profileImage: user.profileImage,
            status: user.status,
            group: user.group,
            zone: user.zone,
            area: user.area,
            mode: user.mode,
            lastLogin: user.lastLogin,
            accessToken,
            refreshToken
        };

        return sendSuccess(res, engineerInfo, "Engineer login successful");
    } catch (error) {
        console.error("Engineer login error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

const getEngineerProfile = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId;
        
        if (!userId) {
            return sendError(res, "User ID is required", 400);
        }

        const engineer = await UserModel.findById(userId)
            .select('-password -otp -otpExpiry -otpPurpose -__v');
            
        if (!engineer) {
            return sendError(res, "Engineer not found", 404);
        }

        if (engineer.role !== Role.ENGINEER) {
            return sendError(res, "Access denied. Engineer privileges required.", 403);
        }

        return sendSuccess(res, engineer, "Engineer profile fetched successfully");
    } catch (error) {
        console.error("Get engineer profile error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

const updateEngineerProfile = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId;
        
        if (!userId) {
            return sendError(res, "User ID is required", 400);
        }

        // Exclude fields that should not be updated via this endpoint
        const forbiddenFields = ["email", "role", "password", "_id", "__v", "jti"];
        const updateData: any = {};
        
        for (const key in req.body) {
            if (!forbiddenFields.includes(key)) {
                updateData[key] = req.body[key];
            }
        }

        if (Object.keys(updateData).length === 0) {
            return sendError(res, "No valid fields to update", 400);
        }

        const updatedEngineer = await UserModel.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('-password -otp -otpExpiry -otpPurpose -__v');

        if (!updatedEngineer) {
            return sendError(res, "Engineer not found", 404);
        }

        if (updatedEngineer.role !== Role.ENGINEER) {
            return sendError(res, "Access denied. Engineer privileges required.", 403);
        }

        return sendSuccess(res, updatedEngineer, "Engineer profile updated successfully");
    } catch (error) {
        console.error("Update engineer profile error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

const engineerLogout = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId;
        
        if (!userId) {
            return sendError(res, "User ID is required", 400);
        }

        const engineer = await UserModel.findById(userId);
        if (!engineer) {
            return sendError(res, "Engineer not found", 404);
        }

        if (engineer.role !== Role.ENGINEER) {
            return sendError(res, "Access denied. Engineer privileges required.", 403);
        }

        // Clear device token and JTI
        engineer.deviceToken = undefined;
        engineer.jti = undefined;
        engineer.lastLogin = new Date();
        await engineer.save();

        return sendSuccess(res, {}, "Engineer logged out successfully");
    } catch (error) {
        console.error("Engineer logout error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

// Mark attendance for the current day
const markAttendance = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId; // Logged in engineer ID
        
        if (!userId) {
            return sendError(res, "User ID is required", 400);
        }

        // Get current date (start of day)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if attendance already marked for today
        const existingAttendance = await EngineerAttendanceModel.findOne({
            engineer: userId,
            date: today
        });

        if (existingAttendance) {
            return sendError(res, "Attendance already marked for today", 400);
        }

        // Automatically mark as present with current time as check-in
        const attendanceData = {
            engineer: userId,
            date: today,
            status: 'present', // Default to present
            checkInTime: new Date(), // Current time as check-in
            markedBy: userId
        };

        const attendance = await EngineerAttendanceModel.create(attendanceData);

        // Populate engineer details
        await attendance.populate('engineer', 'firstName lastName email phoneNumber');

        return sendSuccess(res, attendance, "Attendance marked as present successfully");
    } catch (error: any) {
        console.error("Mark attendance error:", error);
        
        // Handle duplicate key error (if somehow attendance was marked twice)
        if (error.code === 11000) {
            return sendError(res, "Attendance already marked for today", 400);
        }
        
        return sendError(res, "Failed to mark attendance", 500, error);
    }
};

// Mark attendance with specific status
const markAttendanceWithStatus = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId; // Logged in engineer ID
        const { status, remark } = req.body;

        if (!status) {
            return sendError(res, "Attendance status is required", 400);
        }

        // Validate status
        if (!Object.values(AttendanceStatus).includes(status)) {
            return sendError(res, "Invalid attendance status", 400);
        }

        // Get current date (start of day)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if attendance already marked for today
        const existingAttendance = await EngineerAttendanceModel.findOne({
            engineer: userId,
            date: today
        });

        if (existingAttendance) {
            return sendError(res, "Attendance already marked for today", 400);
        }

        // Create attendance record with specified status
        const attendanceData: any = {
            engineer: userId,
            date: today,
            status: status,
            markedBy: userId
        };

        // Add check-in time for present status
        if (status === 'present') {
            attendanceData.checkInTime = new Date();
        }

        // Add remark if provided
        if (remark) {
            attendanceData.remark = remark;
        }

        const attendance = await EngineerAttendanceModel.create(attendanceData);

        // Populate engineer details
        await attendance.populate('engineer', 'firstName lastName email phoneNumber');

        return sendSuccess(res, attendance, `Attendance marked as ${status} successfully`);
    } catch (error: any) {
        console.error("Mark attendance with status error:", error);
        
        if (error.code === 11000) {
            return sendError(res, "Attendance already marked for today", 400);
        }
        
        return sendError(res, "Failed to mark attendance", 500, error);
    }
};

// Mark check-out time for today
const markCheckOut = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId; // Logged in engineer ID
        
        if (!userId) {
            return sendError(res, "User ID is required", 400);
        }

        // Get current date (start of day)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find today's attendance record
        const attendance = await EngineerAttendanceModel.findOne({
            engineer: userId,
            date: today
        });

        if (!attendance) {
            return sendError(res, "No attendance record found for today. Please mark attendance first.", 400);
        }

        if (attendance.checkOutTime) {
            return sendError(res, "Check-out time already marked for today", 400);
        }

        // Mark check-out time
        attendance.checkOutTime = new Date();
        await attendance.save();

        // Populate engineer details
        await attendance.populate('engineer', 'firstName lastName email phoneNumber');

        return sendSuccess(res, attendance, "Check-out time marked successfully");
    } catch (error: any) {
        console.error("Mark check-out error:", error);
        return sendError(res, "Failed to mark check-out time", 500, error);
    }
};

// Get monthly attendance for the current month
const getMonthlyAttendance = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId; // Logged in engineer ID
        
        if (!userId) {
            return sendError(res, "User ID is required", 400);
        }

        // Get year and month from query params, default to current month
        const year = parseInt(req.query.year as string) || new Date().getFullYear();
        const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

        // Validate year and month
        if (year < 2020 || year > 2030) {
            return sendError(res, "Invalid year", 400);
        }
        if (month < 1 || month > 12) {
            return sendError(res, "Invalid month", 400);
        }

        // Get start and end dates for the month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        const daysInMonth = endDate.getDate();

        // Get current date for comparison
        const currentDate = new Date();
        const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

        // Get attendance records for the month
        const attendanceRecords = await EngineerAttendanceModel.find({
            engineer: userId,
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 });

        // Get approved leave requests for the month
        const approvedLeaves = await LeaveRequestModel.getApprovedLeaveRequests(userId, startDate, endDate);

        // Get monthly statistics
        const monthlyStats = await EngineerAttendanceModel.getMonthlyStats(userId, year, month);

        // Create calendar data for all days in the month (1 to 31)
        const calendarData = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDateInMonth = new Date(year, month - 1, day);
            const attendanceRecord = attendanceRecords.find(record => 
                record.date.getDate() === day
            );

            // Check if there's an approved leave for this date
            const leaveRequest = approvedLeaves.find(leave => {
                const leaveFromDate = new Date(leave.fromDate);
                const leaveToDate = new Date(leave.toDate);
                return currentDateInMonth >= leaveFromDate && currentDateInMonth <= leaveToDate;
            });

            let status = 'not_marked';
            let isMarked = false;
            let leaveInfo = null;

            // Determine status based on date, attendance record, and leave requests
            if (currentDateInMonth < today) {
                // Past date
                if (leaveRequest) {
                    // There's an approved leave for this past date
                    status = 'leave';
                    isMarked = true;
                    leaveInfo = {
                        leaveType: leaveRequest.leaveType,
                        reason: leaveRequest.reason,
                        description: leaveRequest.description
                    };
                } else if (attendanceRecord) {
                    // Attendance was marked for this past date
                    status = attendanceRecord.status;
                    isMarked = true;
                } else {
                    // No attendance marked for past date = absent
                    status = 'absent';
                    isMarked = false;
                }
            } else if (currentDateInMonth.getTime() === today.getTime()) {
                // Today
                if (leaveRequest) {
                    // There's an approved leave for today
                    status = 'leave';
                    isMarked = true;
                    leaveInfo = {
                        leaveType: leaveRequest.leaveType,
                        reason: leaveRequest.reason,
                        description: leaveRequest.description
                    };
                } else if (attendanceRecord) {
                    // Attendance marked for today
                    status = attendanceRecord.status;
                    isMarked = true;
                } else {
                    // No attendance marked for today = not_marked
                    status = 'not_marked';
                    isMarked = false;
                }
            } else {
                // Future date
                if (leaveRequest) {
                    // There's an approved leave for this future date
                    status = 'leave';
                    isMarked = true;
                    leaveInfo = {
                        leaveType: leaveRequest.leaveType,
                        reason: leaveRequest.reason,
                        description: leaveRequest.description
                    };
                } else {
                    // No leave approved for future date = not_marked
                    status = 'not_marked';
                    isMarked = false;
                }
            }

            calendarData.push({
                date: currentDateInMonth,
                day: day,
                dayName: currentDateInMonth.toLocaleDateString('en-US', { weekday: 'short' }),
                status: status,
                checkInTime: attendanceRecord?.checkInTime || null,
                checkOutTime: attendanceRecord?.checkOutTime || null,
                totalHours: attendanceRecord?.totalHours || 0,
                location: attendanceRecord?.location || null,
                remark: attendanceRecord?.remark || null,
                isMarked: isMarked,
                isToday: currentDateInMonth.getTime() === today.getTime(),
                isPast: currentDateInMonth < today,
                isFuture: currentDateInMonth > today,
                isLeave: status === 'leave', // New key to identify leave days
                leaveInfo: leaveInfo // Information about approved leave if any
            });
        }

        // Calculate summary including all statuses
        const totalDays = daysInMonth;
        const presentDays = calendarData.filter(day => day.status === 'present').length;
        const absentDays = calendarData.filter(day => day.status === 'absent').length;
        const halfDayDays = calendarData.filter(day => day.status === 'half_day').length;
        const leaveDays = calendarData.filter(day => day.status === 'leave').length;
        const holidayDays = calendarData.filter(day => day.status === 'holiday').length;
        const notMarkedDays = calendarData.filter(day => day.status === 'not_marked').length;
        const workingDays = presentDays + halfDayDays;

        // Update monthly stats to include all statuses
        const updatedStats = {
            ...monthlyStats,
            absent: absentDays, // Past days without attendance
            not_marked: notMarkedDays, // Future days + today if not marked
            leave: leaveDays // Days with approved leave
        };

        const response = {
            month: month,
            year: year,
            monthName: startDate.toLocaleDateString('en-US', { month: 'long' }),
            currentDate: today.toISOString().split('T')[0], // Current date for reference
            summary: {
                totalDays,
                workingDays,
                presentDays,
                absentDays,
                halfDayDays,
                leaveDays,
                holidayDays,
                notMarkedDays,
                attendancePercentage: totalDays > 0 ? Math.round((workingDays / totalDays) * 100) : 0
            },
            statistics: updatedStats,
            calendar: calendarData,
            attendanceRecords: attendanceRecords.map(record => ({
                _id: record._id,
                date: record.date,
                status: record.status,
                checkInTime: record.checkInTime,
                checkOutTime: record.checkOutTime,
                totalHours: record.totalHours,
                location: record.location,
                remark: record.remark,
                createdAt: record.createdAt
            })),
            leaveRequests: approvedLeaves.map(leave => ({
                _id: leave._id,
                leaveType: leave.leaveType,
                fromDate: leave.fromDate,
                toDate: leave.toDate,
                reason: leave.reason,
                description: leave.description,
                totalDays: leave.totalDays,
                status: leave.status
            }))
        };

        return sendSuccess(res, response, "Monthly attendance retrieved successfully");
    } catch (error: any) {
        console.error("Get monthly attendance error:", error);
        return sendError(res, "Failed to get monthly attendance", 500, error);
    }
};

// Apply for leave
const applyLeave = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId; // Logged in engineer ID
        const { leaveType, fromDate, toDate, reason, description, documents } = req.body;

        // Validate required fields
        if (!leaveType || !fromDate || !toDate || !reason || !description) {
            return sendError(res, "Leave type, from date, to date, reason, and description are required", 400);
        }

        // Validate leave type
        if (!Object.values(LeaveType).includes(leaveType)) {
            return sendError(res, "Invalid leave type", 400);
        }

        // Validate reason
        if (!Object.values(LeaveReason).includes(reason)) {
            return sendError(res, "Invalid leave reason", 400);
        }

        // Parse and validate dates
        const fromDateObj = new Date(fromDate);
        const toDateObj = new Date(toDate);
        
        if (isNaN(fromDateObj.getTime()) || isNaN(toDateObj.getTime())) {
            return sendError(res, "Invalid date format", 400);
        }

        // Check if from date is not in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (fromDateObj < today) {
            return sendError(res, "Cannot apply leave for past dates", 400);
        }

        // Check if to date is after from date
        if (toDateObj < fromDateObj) {
            return sendError(res, "To date must be after from date", 400);
        }

        // Check for overlapping leave requests
        const overlappingLeaves = await LeaveRequestModel.find({
            engineer: userId,
            status: { $in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
            $or: [
                { fromDate: { $gte: fromDateObj, $lte: toDateObj } },
                { toDate: { $gte: fromDateObj, $lte: toDateObj } },
                { $and: [{ fromDate: { $lte: fromDateObj } }, { toDate: { $gte: toDateObj } }] }
            ]
        });

        if (overlappingLeaves.length > 0) {
            return sendError(res, "You already have a leave request for these dates", 400);
        }

        // Create leave request
        const leaveRequestData: any = {
            engineer: userId,
            leaveType,
            fromDate: fromDateObj,
            toDate: toDateObj,
            reason,
            description,
            documents: documents || []
        };

        const leaveRequest = await LeaveRequestModel.create(leaveRequestData);

        // Populate engineer details
        await leaveRequest.populate('engineer', 'firstName lastName email phoneNumber');

        return sendSuccess(res, leaveRequest, "Leave request submitted successfully");
    } catch (error: any) {
        console.error("Apply leave error:", error);
        return sendError(res, "Failed to submit leave request", 500, error);
    }
};

// Get all leave requests for engineer with pagination and filtering
const getAllMyLeaves = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId; // Logged in engineer ID
        
        if (!userId) {
            return sendError(res, "User ID is required", 400);
        }

        // Get pagination and filter parameters
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const status = req.query.status as string;
        const leaveType = req.query.leaveType as string;
        const year = parseInt(req.query.year as string);
        const month = parseInt(req.query.month as string);

        const skip = (page - 1) * limit;

        // Build filter conditions
        const filterConditions: any = { engineer: userId };
        
        if (status && Object.values(LeaveStatus).includes(status as LeaveStatus)) {
            filterConditions.status = status as LeaveStatus;
        }
        
        if (leaveType && Object.values(LeaveType).includes(leaveType as LeaveType)) {
            filterConditions.leaveType = leaveType as LeaveType;
        }

        // Date filtering
        if (year && month) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59, 999);
            filterConditions.$or = [
                { fromDate: { $gte: startDate, $lte: endDate } },
                { toDate: { $gte: startDate, $lte: endDate } },
                { $and: [{ fromDate: { $lte: startDate } }, { toDate: { $gte: endDate } }] }
            ];
        }

        // Get total count
        const totalLeaves = await LeaveRequestModel.countDocuments(filterConditions);

        // Get leave requests with pagination
        const leaveRequests = await LeaveRequestModel.find(filterConditions)
            .populate('approvedBy', 'firstName lastName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Get statistics
        const pendingCount = await LeaveRequestModel.countDocuments({ engineer: userId, status: LeaveStatus.PENDING });
        const approvedCount = await LeaveRequestModel.countDocuments({ engineer: userId, status: LeaveStatus.APPROVED });
        const rejectedCount = await LeaveRequestModel.countDocuments({ engineer: userId, status: LeaveStatus.REJECTED });
        const cancelledCount = await LeaveRequestModel.countDocuments({ engineer: userId, status: LeaveStatus.CANCELLED });

        const totalPages = Math.ceil(totalLeaves / limit);

        const response = {
            leaveRequests,
            pagination: {
                currentPage: page,
                totalPages,
                totalLeaves,
                leavesPerPage: limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            },
            summary: {
                totalLeaves,
                pendingCount,
                approvedCount,
                rejectedCount,
                cancelledCount
            }
        };

        return sendSuccess(res, response, "Leave requests retrieved successfully");
    } catch (error: any) {
        console.error("Get all leaves error:", error);
        return sendError(res, "Failed to retrieve leave requests", 500, error);
    }
};

// Update attendance to sync with leave requests
const updateAttendance = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId; // Logged in engineer ID
        const { date, status, checkInTime, checkOutTime, location, deviceInfo, remark } = req.body;

        if (!date || !status) {
            return sendError(res, "Date and status are required", 400);
        }

        // Validate status
        if (!Object.values(AttendanceStatus).includes(status)) {
            return sendError(res, "Invalid attendance status", 400);
        }

        // Parse and validate date
        const attendanceDate = new Date(date);
        attendanceDate.setHours(0, 0, 0, 0);
        
        if (isNaN(attendanceDate.getTime())) {
            return sendError(res, "Invalid date format", 400);
        }

        // Check if attendance record exists
        const existingAttendance = await EngineerAttendanceModel.findOne({
            engineer: userId,
            date: attendanceDate
        });

        if (!existingAttendance) {
            return sendError(res, "No attendance record found for this date", 404);
        }

        // Check if there's an approved leave request for this date
        const leaveRequest = await LeaveRequestModel.findOne({
            engineer: userId,
            status: LeaveStatus.APPROVED,
            fromDate: { $lte: attendanceDate },
            toDate: { $gte: attendanceDate }
        });

        // If there's an approved leave, attendance should be 'leave'
        if (leaveRequest && status !== 'leave') {
            return sendError(res, "Cannot update attendance for a date with approved leave. Status should be 'leave'.", 400);
        }

        // Update attendance record
        const updateData: any = { status };
        
        if (checkInTime !== undefined) updateData.checkInTime = checkInTime ? new Date(checkInTime) : null;
        if (checkOutTime !== undefined) updateData.checkOutTime = checkOutTime ? new Date(checkOutTime) : null;
        if (location !== undefined) updateData.location = location;
        if (deviceInfo !== undefined) updateData.deviceInfo = deviceInfo;
        if (remark !== undefined) updateData.remark = remark;

        const updatedAttendance = await EngineerAttendanceModel.findByIdAndUpdate(
            existingAttendance._id,
            updateData,
            { new: true, runValidators: true }
        ).populate('engineer', 'firstName lastName email phoneNumber');

        return sendSuccess(res, updatedAttendance, "Attendance updated successfully");
    } catch (error: any) {
        console.error("Update attendance error:", error);
        return sendError(res, "Failed to update attendance", 500, error);
    }
};

// Approve/Reject leave request (for managers, agents, admins)
const approveLeaveRequest = async (req: Request, res: Response): Promise<any> => {
    try {
        const approverId = (req as any).userId; // Logged in user ID (manager/agent/admin)
        const { leaveRequestId, action, remarks, rejectionReason } = req.body;

        // Validate required fields
        if (!leaveRequestId || !action) {
            return sendError(res, "Leave request ID and action are required", 400);
        }

        // Validate action
        if (!['approve', 'reject'].includes(action)) {
            return sendError(res, "Action must be either 'approve' or 'reject'", 400);
        }

        // Check if leave request exists
        const leaveRequest = await LeaveRequestModel.findById(leaveRequestId)
            .populate('engineer', 'firstName lastName email phoneNumber');

        if (!leaveRequest) {
            return sendError(res, "Leave request not found", 404);
        }

        // Check if leave request is already processed
        if (leaveRequest.status !== LeaveStatus.PENDING) {
            return sendError(res, `Leave request is already ${leaveRequest.status}`, 400);
        }

        // Update leave request status
        const updateData: any = {
            approvedBy: approverId,
            approvedAt: new Date()
        };

        if (action === 'approve') {
            updateData.status = LeaveStatus.APPROVED;
            updateData.remarks = remarks || 'Leave approved';
        } else if (action === 'reject') {
            if (!rejectionReason) {
                return sendError(res, "Rejection reason is required when rejecting leave", 400);
            }
            updateData.status = LeaveStatus.REJECTED;
            updateData.rejectionReason = rejectionReason;
            updateData.remarks = remarks || 'Leave rejected';
        }

        // Update the leave request
        const updatedLeaveRequest = await LeaveRequestModel.findByIdAndUpdate(
            leaveRequestId,
            updateData,
            { new: true, runValidators: true }
        ).populate([
            { path: 'engineer', select: 'firstName lastName email phoneNumber' },
            { path: 'approvedBy', select: 'firstName lastName email' }
        ]);

        // If approved, automatically create/update attendance records for leave dates
        if (action === 'approve') {
            const fromDate = new Date(leaveRequest.fromDate);
            const toDate = new Date(leaveRequest.toDate);
            
            // Create attendance records for each leave date
            for (let currentDate = new Date(fromDate); currentDate <= toDate; currentDate.setDate(currentDate.getDate() + 1)) {
                const dayOfWeek = currentDate.getDay();
                
                // Skip weekends for business day calculations
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    const dateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
                    
                    // Check if attendance record already exists
                    let attendanceRecord = await EngineerAttendanceModel.findOne({
                        engineer: leaveRequest.engineer,
                        date: dateOnly
                    });

                    if (attendanceRecord) {
                        // Update existing attendance record to 'leave'
                        await EngineerAttendanceModel.findByIdAndUpdate(
                            attendanceRecord._id,
                            { 
                                status: 'leave',
                                remark: `Approved leave: ${leaveRequest.description}`,
                                updatedAt: new Date()
                            }
                        );
                    } else {
                        // Create new attendance record as 'leave'
                        await EngineerAttendanceModel.create({
                            engineer: leaveRequest.engineer,
                            date: dateOnly,
                            status: 'leave',
                            remark: `Approved leave: ${leaveRequest.description}`,
                            markedBy: approverId
                        });
                    }
                }
            }
        }

        return sendSuccess(res, updatedLeaveRequest, `Leave request ${action}d successfully`);
    } catch (error: any) {
        console.error("Approve leave request error:", error);
        return sendError(res, `Failed to ${req.body.action} leave request`, 500, error);
    }
};

// Get all pending leave requests (for managers, agents, admins)
const getAllPendingLeaveRequests = async (req: Request, res: Response): Promise<any> => {
    try {
        // Get pagination parameters
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const engineerId = req.query.engineerId as string;
        const leaveType = req.query.leaveType as string;
        const reason = req.query.reason as string;

        const skip = (page - 1) * limit;

        // Build filter conditions
        const filterConditions: any = { status: LeaveStatus.PENDING };
        
        if (engineerId) {
            filterConditions.engineer = engineerId;
        }
        
        if (leaveType && Object.values(LeaveType).includes(leaveType as LeaveType)) {
            filterConditions.leaveType = leaveType as LeaveType;
        }
        
        if (reason && Object.values(LeaveReason).includes(reason as LeaveReason)) {
            filterConditions.reason = reason as LeaveReason;
        }

        // Get total count
        const totalRequests = await LeaveRequestModel.countDocuments(filterConditions);

        // Get pending leave requests with pagination
        const pendingRequests = await LeaveRequestModel.find(filterConditions)
            .populate('engineer', 'firstName lastName email phoneNumber')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Get statistics
        const totalPending = await LeaveRequestModel.countDocuments({ status: LeaveStatus.PENDING });
        const pendingByType = await LeaveRequestModel.aggregate([
            { $match: { status: LeaveStatus.PENDING } },
            { $group: { _id: '$leaveType', count: { $sum: 1 } } }
        ]);
        const pendingByReason = await LeaveRequestModel.aggregate([
            { $match: { status: LeaveStatus.PENDING } },
            { $group: { _id: '$reason', count: { $sum: 1 } } }
        ]);

        const totalPages = Math.ceil(totalRequests / limit);

        const response = {
            pendingRequests,
            pagination: {
                currentPage: page,
                totalPages,
                totalRequests,
                requestsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            },
            summary: {
                totalPending,
                pendingByType: pendingByType.reduce((acc: any, item: any) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),
                pendingByReason: pendingByReason.reduce((acc: any, item: any) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {})
            }
        };

        return sendSuccess(res, response, "Pending leave requests retrieved successfully");
    } catch (error: any) {
        console.error("Get pending leave requests error:", error);
        return sendError(res, "Failed to retrieve pending leave requests", 500, error);
    }
};

export const engineerController = {
    engineerLogin,
    getEngineerProfile,
    updateEngineerProfile,
    engineerLogout,
    markAttendance,
    markAttendanceWithStatus,
    markCheckOut,
    getMonthlyAttendance,
    applyLeave,
    getAllMyLeaves,
    updateAttendance,
    approveLeaveRequest,
    getAllPendingLeaveRequests
};