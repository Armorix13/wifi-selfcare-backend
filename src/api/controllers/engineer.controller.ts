import { Request, Response } from "express";
import mongoose from "mongoose";
import { Role, UserModel } from "../models/user.model";
import { EngineerAttendanceModel, AttendanceStatus } from "../models/engineerAttendance.model";
import { LeaveRequestModel, LeaveType, LeaveStatus, LeaveReason } from "../models/leaveRequest.model";
import { sendSuccess, sendError, generateAccessToken, generateRefreshToken, generateRandomJti, comparePassword } from '../../utils/helper';
import moment from 'moment-timezone';
import { ClientUpdateStatus, ExistingClientUpdateModel } from "../models/existingClientUpdate.model";
import Modem from "../models/modem.model";
import { CustomerModel } from "../models/customer.model";
import { FDBModel, PortStatus } from "../models/fdb.model";
import { OLTModel } from "../models/olt.model";

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

        // Get current date and time in IST (India Standard Time)
        const istTime = moment().tz('Asia/Kolkata');
        const currentHour = istTime.hour();
        const currentMinute = istTime.minute();
        const todayStart = istTime.startOf('day').toDate();

        // Debug log for time information
        console.log(`Current IST time: ${istTime.format('YYYY-MM-DD HH:mm:ss')}`);
        console.log(`Current hour: ${currentHour}, Current minute: ${currentMinute}`);

        // Define attendance time windows in IST
        // Engineers can mark attendance from 5:00 AM to 10:00 PM
        // Between 10:00 PM to 12:00 AM (next day) - Attendance marking closed
        // Between 12:00 AM to 5:00 AM - Must wait until 5:00 AM
        const morningStart = 5; // 5:00 AM
        const eveningEnd = 22; // 10:00 PM (22:00)
        const lateNightStart = 0; // 12:00 AM (00:00)
        const lateNightEnd = 5; // 5:00 AM

        // Check current time and provide appropriate message
        if (currentHour >= lateNightStart && currentHour < lateNightEnd) {
            // Between 12:00 AM to 5:00 AM
            console.log(`Attendance attempt at ${currentHour}:${currentMinute} - Too early, must wait until 5:00 AM`);
            return sendError(res, "You can only mark attendance after 5:00 AM", 400);
        } else if (currentHour >= morningStart && currentHour < eveningEnd) {
            // Between 5:00 AM to 10:00 PM - Engineer can mark attendance
            console.log(`Attendance attempt at ${currentHour}:${currentMinute} - Within allowed window (5:00 AM to 10:00 PM)`);
            // Continue with attendance logic
        } else {
            // Between 10:00 PM to 12:00 AM - Attendance marking closed
            console.log(`Attendance attempt at ${currentHour}:${currentMinute} - Too late, attendance marking closed for today`);
            return sendError(res, "Attendance marking is closed for today. You are too late to mark attendance.", 400);
        }

        // Check if attendance already marked for today
        const existingAttendance = await EngineerAttendanceModel.findOne({
            engineer: userId,
            date: todayStart
        });

        if (existingAttendance) {
            return sendError(res, "Attendance already marked for today", 400);
        }

        // Automatically mark as present with current time as check-in
        const attendanceData = {
            engineer: userId,
            date: todayStart,
            status: 'present', // Default to present
            checkInTime: istTime.toDate(), // Current IST time as check-in
            markedBy: userId
        };

        const attendance = await EngineerAttendanceModel.create(attendanceData);

        // Populate engineer details
        await attendance.populate('engineer', 'firstName lastName email phoneNumber');

        console.log(`Attendance marked successfully for engineer ${userId} at ${istTime.format('HH:mm:ss')} IST`);
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

        // Get current date and time in IST (India Standard Time)
        const istTime = moment().tz('Asia/Kolkata');
        const currentHour = istTime.hour();
        const currentMinute = istTime.minute();
        const today = istTime.startOf('day').toDate();

        // Debug log for time information
        console.log(`Mark attendance with status - Current IST time: ${istTime.format('YYYY-MM-DD HH:mm:ss')}`);
        console.log(`Current hour: ${currentHour}, Current minute: ${currentMinute}`);

        // Define attendance time windows in IST
        // Engineers can mark attendance from 5:00 AM to 10:00 PM
        // Between 10:00 PM to 12:00 AM (next day) - Attendance marking closed
        // Between 12:00 AM to 5:00 AM - Must wait until 5:00 AM
        const morningStart = 5; // 5:00 AM
        const eveningEnd = 22; // 10:00 PM (22:00)
        const lateNightStart = 0; // 12:00 AM (00:00)
        const lateNightEnd = 5; // 5:00 AM

        // Check current time and provide appropriate message
        if (currentHour >= lateNightStart && currentHour < lateNightEnd) {
            // Between 12:00 AM to 5:00 AM
            console.log(`Attendance with status attempt at ${currentHour}:${currentMinute} - Too early, must wait until 5:00 AM`);
            return sendError(res, "You can only mark attendance after 5:00 AM", 400);
        } else if (currentHour >= morningStart && currentHour < eveningEnd) {
            // Between 5:00 AM to 10:00 PM - Engineer can mark attendance
            console.log(`Attendance with status attempt at ${currentHour}:${currentMinute} - Within allowed window (5:00 AM to 10:00 PM)`);
            // Continue with attendance logic
        } else {
            // Between 10:00 PM to 12:00 AM - Attendance marking closed
            console.log(`Attendance with status attempt at ${currentHour}:${currentMinute} - Too late, attendance marking closed for today`);
            return sendError(res, "Attendance marking is closed for today. You are too late to mark attendance.", 400);
        }

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
            attendanceData.checkInTime = istTime.toDate();
        }

        // Add remark if provided
        if (remark) {
            attendanceData.remark = remark;
        }

        const attendance = await EngineerAttendanceModel.create(attendanceData);

        // Populate engineer details
        await attendance.populate('engineer', 'firstName lastName email phoneNumber');

        console.log(`Attendance with status '${status}' marked successfully for engineer ${userId} at ${istTime.format('HH:mm:ss')} IST`);
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

        // Get current date and time in IST (India Standard Time)
        const istTime = moment().tz('Asia/Kolkata');
        const today = istTime.startOf('day').toDate();

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

        // Mark check-out time with IST time
        attendance.checkOutTime = istTime.toDate();
        await attendance.save();

        // Populate engineer details
        await attendance.populate('engineer', 'firstName lastName email phoneNumber');

        console.log(`Check-out time marked successfully for engineer ${userId} at ${istTime.format('HH:mm:ss')} IST`);
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

        const engineer = await UserModel.findById(userId);

        if (!engineer) {
            return sendError(res, "engineer not found", 404);
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
            })),
            salary: engineer.salary || 0
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

        // Check if to date is not before from date (allows same date for one day leave)
        if (toDateObj < fromDateObj) {
            return sendError(res, "To date cannot be before from date", 400);
        }

        // Check for overlapping leave requests - FIXED LOGIC
        const overlappingLeaves = await LeaveRequestModel.find({
            engineer: userId,
            status: { $in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
            $or: [
                // Case 1: New leave starts during existing leave
                {
                    fromDate: { $lte: fromDateObj },
                    toDate: { $gte: fromDateObj }
                },
                // Case 2: New leave ends during existing leave
                {
                    fromDate: { $lte: toDateObj },
                    toDate: { $gte: toDateObj }
                },
                // Case 3: New leave completely encompasses existing leave
                {
                    fromDate: { $gte: fromDateObj },
                    toDate: { $lte: toDateObj }
                }
            ]
        });

        if (overlappingLeaves.length > 0) {
            return sendError(res, "You already have a leave request for these dates", 400);
        }

        // Calculate total days (including the start date)
        const timeDiff = toDateObj.getTime() - fromDateObj.getTime();
        const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end dates

        // Create leave request
        const leaveRequestData: any = {
            engineer: userId,
            leaveType,
            fromDate: fromDateObj,
            toDate: toDateObj,
            totalDays, // Add calculated totalDays
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

// Create leave request by admin
const createLeaveRequestByAdmin = async (req: Request, res: Response): Promise<any> => {
    try {
        const adminUserId = (req as any).userId; // Logged in admin ID
        const {
            engineer,
            leaveType,
            fromDate,
            toDate,
            reason,
            description,
            totalDays,
            status,
            remarks,
            documents,
            approvedBy,
            approvedAt,
            rejectionReason
        } = req.body;

        console.log("Admin creating leave request with data:", req.body);

        // Validate required fields
        if (!engineer || !leaveType || !fromDate || !toDate || !reason || !description) {
            return sendError(res, "Engineer, leave type, from date, to date, reason, and description are required", 400);
        }

        // Validate leave type
        if (!Object.values(LeaveType).includes(leaveType)) {
            return sendError(res, "Invalid leave type. Must be one of: " + Object.values(LeaveType).join(", "), 400);
        }

        // Validate reason
        if (!Object.values(LeaveReason).includes(reason)) {
            return sendError(res, "Invalid leave reason. Must be one of: " + Object.values(LeaveReason).join(", "), 400);
        }

        // Validate status if provided
        if (status && !Object.values(LeaveStatus).includes(status)) {
            return sendError(res, "Invalid status. Must be one of: " + Object.values(LeaveStatus).join(", "), 400);
        }

        // Parse and validate dates
        const fromDateObj = new Date(fromDate);
        const toDateObj = new Date(toDate);

        if (isNaN(fromDateObj.getTime()) || isNaN(toDateObj.getTime())) {
            return sendError(res, "Invalid date format. Please provide valid ISO date strings", 400);
        }

        // Check if to date is not before from date (allows same date for one day leave)
        if (toDateObj < fromDateObj) {
            return sendError(res, "To date cannot be before from date", 400);
        }

        // Validate engineer exists and is an engineer
        const engineerUser = await UserModel.findById(engineer);
        if (!engineerUser) {
            return sendError(res, "Engineer not found", 404);
        }

        if (engineerUser.role !== Role.ENGINEER) {
            return sendError(res, "Selected user is not an engineer", 400);
        }

        if (engineerUser.isDeleted) {
            return sendError(res, "Engineer account is deleted", 400);
        }

        if (engineerUser.isDeactivated) {
            return sendError(res, "Engineer account is deactivated", 400);
        }

        if (engineerUser.isSuspended) {
            return sendError(res, "Engineer account is suspended", 400);
        }

        // Validate approvedBy if provided
        if (approvedBy) {
            const approver = await UserModel.findById(approvedBy);
            if (!approver) {
                return sendError(res, "Approver not found", 404);
            }
        }

        // Calculate total days if not provided
        let calculatedTotalDays = totalDays;
        if (!calculatedTotalDays) {
            const timeDiff = toDateObj.getTime() - fromDateObj.getTime();
            calculatedTotalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end dates
        }

        // Validate total days
        if (calculatedTotalDays < 0.5) {
            return sendError(res, "Total days cannot be less than 0.5", 400);
        }

        if (calculatedTotalDays > 365) {
            return sendError(res, "Total days cannot exceed 365", 400);
        }

        // Check for overlapping leave requests only if status is PENDING or APPROVED
        const finalStatus = status || LeaveStatus.PENDING;
        if (finalStatus === LeaveStatus.PENDING || finalStatus === LeaveStatus.APPROVED) {
            const overlappingLeaves = await LeaveRequestModel.find({
                engineer: engineer,
                status: { $in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
                $or: [
                    // Case 1: New leave starts during existing leave
                    {
                        fromDate: { $lte: fromDateObj },
                        toDate: { $gte: fromDateObj }
                    },
                    // Case 2: New leave ends during existing leave
                    {
                        fromDate: { $lte: toDateObj },
                        toDate: { $gte: toDateObj }
                    },
                    // Case 3: New leave completely encompasses existing leave
                    {
                        fromDate: { $gte: fromDateObj },
                        toDate: { $lte: toDateObj }
                    }
                ]
            });

            if (overlappingLeaves.length > 0) {
                return sendError(res, "Engineer already has a leave request for these dates", 400);
            }
        }

        // Validate status-specific fields
        if (finalStatus === LeaveStatus.APPROVED && !approvedBy) {
            // If no approvedBy is provided, use the admin who is creating the request
            console.log("No approvedBy provided, using admin user as approver");
        }

        if (finalStatus === LeaveStatus.REJECTED && !rejectionReason) {
            return sendError(res, "Rejection reason is required when status is rejected", 400);
        }

        // Create leave request
        const leaveRequestData: any = {
            engineer,
            leaveType,
            fromDate: fromDateObj,
            toDate: toDateObj,
            totalDays: calculatedTotalDays,
            reason,
            description,
            status: finalStatus,
            remarks: remarks || undefined,
            documents: documents || [],
            approvedBy: approvedBy || (finalStatus === LeaveStatus.APPROVED ? adminUserId : undefined),
            approvedAt: approvedAt ? new Date(approvedAt) : (finalStatus === LeaveStatus.APPROVED ? new Date() : undefined),
            rejectionReason: rejectionReason || undefined
        };

        const leaveRequest = await LeaveRequestModel.create(leaveRequestData);

        // Populate the created leave request
        const populatedLeaveRequest = await LeaveRequestModel.findById(leaveRequest._id)
            .populate('engineer', 'firstName lastName email phoneNumber role')
            .populate('approvedBy', 'firstName lastName email phoneNumber role');

        return sendSuccess(res, populatedLeaveRequest, "Leave request created successfully by admin");
    } catch (error: any) {
        console.error("Create leave request by admin error:", error);
        return sendError(res, "Failed to create leave request", 500, error);
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


const getEngineerCompanyDetails = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId;

        // Validate user ID
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return sendError(res, "Invalid user ID", 400);
        }

        // Get engineer details with populated company information
        const engineer = await UserModel.findById(userId)
            .populate('parentCompany', 'companyName companyAddress companyPhone companyEmail companyWebsite companyLogo companyDescription companyCity companyState companyCountry companySize contactPerson industry')
            .select('-password -otp -otpExpiry -otpVerified -jti -deviceToken');

        if (!engineer) {
            return sendError(res, "Engineer not found", 404);
        }

        // Verify user is an engineer
        if (engineer.role !== Role.ENGINEER) {
            return sendError(res, "User is not an engineer", 403);
        }

        // Extract essential engineer details based on actual user model fields
        const engineerDetails = {
            id: engineer._id,
            firstName: engineer.firstName,
            lastName: engineer.lastName,
            email: engineer.email,
            phoneNumber: engineer.phoneNumber,
            countryCode: engineer.countryCode,
            role: engineer.role,
            userName: engineer.userName,
            profileImage: engineer.profileImage,
            country: engineer.country,
            state: engineer.state,
            pincode: engineer.pincode,
            permanentAddress: engineer.permanentAddress,
            residentialAddress: engineer.residentialAddress,
            billingAddress: engineer.billingAddress,
            fatherName: engineer.fatherName,
            landlineNumber: engineer.landlineNumber,
            aadhaarNumber: engineer.aadhaarNumber,
            panNumber: engineer.panNumber,
            aadhaarFront: engineer.aadhaarFront,
            aadhaarBack: engineer.aadhaarBack,
            panCard: engineer.panCard,
            residenceAddress: engineer.residenceAddress,
            area: engineer.area,
            mode: engineer.mode,
            provider: engineer.provider,
            providerId: engineer.providerId,
            assigned: engineer.assigned,
            isAccountVerified: engineer.isAccountVerified,
            isDeleted: engineer.isDeleted,
            isDeactivated: engineer.isDeactivated,
            isSuspended: engineer.isSuspended,
            isActivated: engineer.isActivated,
            lastLogin: engineer.lastLogin,
            createdAt: engineer.createdAt,
            updatedAt: engineer.updatedAt,
            parentCompany: engineer.parentCompany
        };

        // Extract company details if engineer has a parent company
        let companyDetails = null;
        if (engineer.parentCompany && typeof engineer.parentCompany === 'object') {
            const company = engineer.parentCompany as any;
            companyDetails = {
                id: company._id,
                companyName: company.companyName,
                companyAddress: company.companyAddress,
                companyPhone: company.companyPhone,
                companyEmail: company.companyEmail,
                companyWebsite: company.companyWebsite,
                companyLogo: company.companyLogo,
                companyDescription: company.companyDescription,
                companyCity: company.companyCity,
                companyState: company.companyState,
                companyCountry: company.companyCountry,
                companySize: company.companySize,
                contactPerson: company.contactPerson,
                industry: company.industry
            };
        }

        // Get engineer statistics
        const engineerStats = {
            assignedComplaints: 0,
            completedComplaints: 0,
            pendingComplaints: 0,
            totalAttendance: 0,
            totalLeaves: 0,
            pendingLeaves: 0
        };

        // Get complaint statistics
        const assignedComplaints = await mongoose.model('Complaint').countDocuments({ engineer: userId });
        const completedComplaints = await mongoose.model('Complaint').countDocuments({
            engineer: userId,
            status: 'resolved'
        });
        const pendingComplaints = await mongoose.model('Complaint').countDocuments({
            engineer: userId,
            status: { $ne: 'resolved' }
        });

        engineerStats.assignedComplaints = assignedComplaints;
        engineerStats.completedComplaints = completedComplaints;
        engineerStats.pendingComplaints = pendingComplaints;

        // Get attendance statistics
        const totalAttendance = await EngineerAttendanceModel.countDocuments({ engineer: userId });
        engineerStats.totalAttendance = totalAttendance;

        // Get leave statistics
        const totalLeaves = await LeaveRequestModel.countDocuments({ engineer: userId });
        const pendingLeaves = await LeaveRequestModel.countDocuments({
            engineer: userId,
            status: 'pending'
        });

        engineerStats.totalLeaves = totalLeaves;
        engineerStats.pendingLeaves = pendingLeaves;

        return sendSuccess(res, {
            engineer: engineerDetails,
            company: companyDetails,
            statistics: engineerStats,
            hasCompany: !!companyDetails
        }, "Engineer and company details retrieved successfully");

    } catch (error) {
        console.error("Get engineer company details error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
}

export const getAllAssignedExistingClienttoUpdates = async (req: Request, res: Response): Promise<any> => {
    try {
        //engineerId logined user
        const userId = (req as any).userId;
        const engineer = await UserModel.findById(userId).select('role parentCompany');
        if (!engineer) {
            return sendError(res, "Engineer not found", 404);
        }
        if (engineer.role !== 'engineer') {
            return sendError(res, "User is not an engineer", 403);
        }
        if (!engineer.parentCompany) {
            return sendError(res, "Engineer not associated with any company", 400);
        }
        const existingClientUpdates = await ExistingClientUpdateModel.find({
            assignedEngineer: userId, status: {
                $in: [ClientUpdateStatus.PENDING, ClientUpdateStatus.VISITED_SITE]
            }
        })
            .populate({
                path: 'user',
                select: 'firstName lastName email phoneNumber countryCode profileImage customerId address billingAddress status'
            })
            .populate({
                path: 'assignedEngineer',
                select: 'firstName lastName email phoneNumber countryCode profileImage role parentCompany'
            })
            .populate({
                path: 'assignedBy',
                select: 'firstName lastName email phoneNumber role'
            })
            .sort({ updatedAt: -1 })
            .lean();

        const summary = existingClientUpdates.reduce((acc, update) => {
            acc.total += 1;
            if (update.status === ClientUpdateStatus.PENDING) {
                acc.pending += 1;
            }
            if (update.status === ClientUpdateStatus.VISITED_SITE) {
                acc.visitedSite += 1;
            }
            return acc;
        }, {
            total: 0,
            pending: 0,
            visitedSite: 0
        });

        return sendSuccess(res, {
            summary,
            updates: existingClientUpdates
        }, "Existing client updates retrieved successfully");
    } catch (error) {
        console.error("Get all assigned existing client updates error:", error);
        return sendError(res, "Internal server error", 500, error);
    }
}

export const updateExistingClientUpdate = async (req: Request, res: Response): Promise<any> => {
    try {
        const engineerId = (req as any).userId;
        const role = (req as any).role;

        if (!engineerId) {
            return sendError(res, "Engineer authentication required", 401);
        }

        if (role !== Role.ENGINEER) {
            return sendError(res, "Only engineers can update client assignments", 403);
        }

        const {
            existingClientUpdateId: bodyUpdateId,
            userId,
            lat,
            long,
            email,
            firstName,
            lastName,
            phoneNumber,
            countryCode,
            companyPreference,
            permanentAddress,
            residentialAddress,
            billingAddress,
            landlineNumber,
            modemName,
            ontType,
            modelNumber,
            serialNumber,
            ontMac,
            username,
            password,
            mtceFranchise,
            bbUserId,
            bbPassword,
            ruralUrban,
            acquisitionType,
            category,
            ftthExchangePlan,
            llInstallDate,
            bbPlan,
            workingStatus,
            isInstalled,
            fdbId,
            oltId,
            portNumber,
            internetProviderId,
            billConnect,
            disconnectReason,
            disconnectDate,
            remarks,
            fatherName,
            companyService,
            lastOfflineTime,
            onlineTime,
            msPonNumber,
            customerVlan,
            portStatus,
            ontDistance,
            ontTxPower,
            ontRxPower,
            billingOutstandingAmount,
            paymentCollectDate,
            paymentCollectMonth,
            modemRecover,
            billCollect,
            unnamedField22,
            clientUpdateStatus,
            updateStatus,
            updateRemarks,
            updateAttachments,
            visitDate,
            completedAt
        } = req.body;

        const updateId = req.params.updateId || bodyUpdateId;

        if (!userId) {
            return sendError(res, "userId is required", 400);
        }

        if (!updateId) {
            return sendError(res, "existingClientUpdateId is required", 400);
        }

        if (!mongoose.Types.ObjectId.isValid(updateId)) {
            return sendError(res, "Invalid existing client update id", 400);
        }

        const assignment = await ExistingClientUpdateModel.findOne({
            _id: updateId,
            assignedEngineer: engineerId
        });

        if (!assignment) {
            return sendError(res, "Existing client update not found or not assigned to you", 404);
        }

        if (assignment.user.toString() !== userId) {
            return sendError(res, "Provided userId does not match the assignment", 400);
        }

        const existingUser = await UserModel.findById(userId);
        if (!existingUser) {
            return sendError(res, "User not found", 404);
        }

        // Email uniqueness
        if (email && email !== existingUser.email) {
            const emailExists = await UserModel.findOne({ email, _id: { $ne: userId } });
            if (emailExists) {
                return sendError(res, "Email already exists for another user", 400);
            }
        }

        // Landline uniqueness
        if (landlineNumber && landlineNumber !== existingUser.landlineNumber) {
            const landlineExists = await UserModel.findOne({ landlineNumber, _id: { $ne: userId } });
            if (landlineExists) {
                return sendError(res, "Landline number already exists for another user", 400);
            }
        }

        const parseBoolean = (value: any): boolean | undefined => {
            if (value === undefined || value === null) return undefined;
            if (typeof value === "boolean") return value;
            if (typeof value === "string") {
                const normalized = value.trim().toLowerCase();
                if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
                if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
            }
            return undefined;
        };

        const parseNumber = (value: any): number | undefined => {
            if (value === undefined || value === null || value === "") return undefined;
            const num = Number(value);
            return Number.isNaN(num) ? undefined : num;
        };

        const parseDate = (value: any): Date | undefined => {
            if (value === undefined || value === null || value === "") return undefined;
            const date = new Date(value);
            return isNaN(date.getTime()) ? undefined : date;
        };

        const modemRecoverBool = parseBoolean(modemRecover);
        const billCollectBool = parseBoolean(billCollect);
        const billConnectBool = parseBoolean(billConnect);
        const isInstalledBool = parseBoolean(isInstalled);

        const visitDateValue = parseDate(visitDate);
        const completedAtValue = parseDate(completedAt);

        const latNumber = parseNumber(lat);
        const longNumber = parseNumber(long);
        const ontDistanceNumber = parseNumber(ontDistance);
        const ontTxPowerNumber = parseNumber(ontTxPower);
        const ontRxPowerNumber = parseNumber(ontRxPower);
        const billingOutstandingAmountNumber = parseNumber(billingOutstandingAmount);

        const llInstallDateValue = parseDate(llInstallDate);
        const disconnectDateValue = parseDate(disconnectDate);
        const paymentCollectDateValue = parseDate(paymentCollectDate);
        const lastOfflineTimeValue = parseDate(lastOfflineTime);
        const onlineTimeValue = parseDate(onlineTime);

        const normalizedStatusInput = clientUpdateStatus || updateStatus;
        let normalizedStatus: ClientUpdateStatus | undefined;
        if (normalizedStatusInput) {
            if (!Object.values(ClientUpdateStatus).includes(normalizedStatusInput)) {
                return sendError(res, "Invalid status value", 400);
            }
            normalizedStatus = normalizedStatusInput as ClientUpdateStatus;
        }

        type ExistingClientUpdateResult = {
            updatedUser: any;
            updatedModem: any;
            updatedCustomer: any;
            fdbConnection: any;
            assignmentId: mongoose.Types.ObjectId | string;
        };

        const session = await mongoose.startSession();
        let transactionResult: ExistingClientUpdateResult | null = null;

        try {
            transactionResult = await session.withTransaction<ExistingClientUpdateResult>(async () => {
                const userUpdateData: Record<string, any> = {};
                const setField = (container: Record<string, any>, key: string, value: any) => {
                    if (value !== undefined) {
                        container[key] = value;
                    }
                };

                setField(userUpdateData, "email", email);
                setField(userUpdateData, "firstName", firstName);
                setField(userUpdateData, "lastName", lastName);
                setField(userUpdateData, "phoneNumber", phoneNumber);
                setField(userUpdateData, "countryCode", countryCode);
                setField(userUpdateData, "companyPreference", companyPreference);
                setField(userUpdateData, "permanentAddress", permanentAddress);
                setField(userUpdateData, "residentialAddress", residentialAddress);
                setField(userUpdateData, "billingAddress", billingAddress);
                setField(userUpdateData, "landlineNumber", landlineNumber);
                setField(userUpdateData, "mtceFranchise", mtceFranchise);
                setField(userUpdateData, "bbUserId", bbUserId);
                setField(userUpdateData, "bbPassword", bbPassword);
                setField(userUpdateData, "ruralUrban", ruralUrban);
                setField(userUpdateData, "acquisitionType", acquisitionType);
                setField(userUpdateData, "category", category);
                setField(userUpdateData, "ftthExchangePlan", ftthExchangePlan);
                setField(userUpdateData, "bbPlan", bbPlan);
                setField(userUpdateData, "workingStatus", workingStatus);
                setField(userUpdateData, "internetProviderId", internetProviderId);
                setField(userUpdateData, "disconnectReason", disconnectReason);
                setField(userUpdateData, "remarks", remarks);
                setField(userUpdateData, "fatherName", fatherName);
                setField(userUpdateData, "companyService", companyService);
                setField(userUpdateData, "msPonNumber", msPonNumber);
                setField(userUpdateData, "customerVlan", customerVlan);
                setField(userUpdateData, "portStatus", portStatus);
                setField(userUpdateData, "paymentCollectMonth", paymentCollectMonth);
                setField(userUpdateData, "unnamedField22", unnamedField22);

                if (latNumber !== undefined) setField(userUpdateData, "lat", latNumber);
                if (longNumber !== undefined) setField(userUpdateData, "long", longNumber);
                if (llInstallDateValue) setField(userUpdateData, "llInstallDate", llInstallDateValue);
                if (disconnectDateValue) setField(userUpdateData, "disconnectDate", disconnectDateValue);
                if (lastOfflineTimeValue) setField(userUpdateData, "lastOfflineTime", lastOfflineTimeValue);
                if (onlineTimeValue) setField(userUpdateData, "onlineTime", onlineTimeValue);
                if (paymentCollectDateValue) setField(userUpdateData, "paymentCollectDate", paymentCollectDateValue);
                if (ontDistanceNumber !== undefined) setField(userUpdateData, "ontDistance", ontDistanceNumber);
                if (ontTxPowerNumber !== undefined) setField(userUpdateData, "ontTxPower", ontTxPowerNumber);
                if (ontRxPowerNumber !== undefined) setField(userUpdateData, "ontRxPower", ontRxPowerNumber);
                if (billingOutstandingAmountNumber !== undefined) setField(userUpdateData, "billingOutstandingAmount", billingOutstandingAmountNumber);
                if (billConnectBool !== undefined) setField(userUpdateData, "billConnect", billConnectBool);
                if (modemRecoverBool !== undefined) setField(userUpdateData, "modemRecover", modemRecoverBool);
                if (billCollectBool !== undefined) setField(userUpdateData, "billCollect", billCollectBool);

                if (latNumber !== undefined && longNumber !== undefined) {
                    setField(userUpdateData, "location", {
                        type: "Point",
                        coordinates: [longNumber, latNumber]
                    });
                }

                let updatedUser = existingUser;
                if (Object.keys(userUpdateData).length > 0) {
                    updatedUser = await UserModel.findByIdAndUpdate(
                        userId,
                        { $set: userUpdateData },
                        { new: true, session, runValidators: true }
                    ) as any;
                } else {
                    updatedUser = await UserModel.findById(userId).session(session) as any;
                }

                // Modem updates
                const modemFields = [modemName, ontType, modelNumber, serialNumber, ontMac, username, password];
                let updatedModem = null;
                if (modemFields.some(field => field !== undefined && field !== null && field !== "")) {
                    const modemUpdateData: Record<string, any> = {};
                    setField(modemUpdateData, "modemName", modemName);
                    setField(modemUpdateData, "ontType", ontType);
                    setField(modemUpdateData, "modelNumber", modelNumber);
                    setField(modemUpdateData, "serialNumber", serialNumber);
                    setField(modemUpdateData, "ontMac", ontMac);
                    setField(modemUpdateData, "username", username);
                    setField(modemUpdateData, "password", password);

                    updatedModem = await Modem.findOneAndUpdate(
                        { userId },
                        { $set: modemUpdateData },
                        { new: true, upsert: true, session }
                    );
                }

                const currentCustomer = await CustomerModel.findOne({ userId }, null, { session });

                let fdbConnectionResult: any = null;
                let fdbDoc: any = null;
                let oltDoc: any = null;

                if (fdbId && oltId && portNumber) {
                    const normalizedPortNumber = String(portNumber).toUpperCase();

                    fdbDoc = await FDBModel.findOne({ fdbId }).session(session);
                    if (!fdbDoc) {
                        throw new Error(`FDB with ID ${fdbId} not found`);
                    }

                    oltDoc = await OLTModel.findOne({ oltId }).session(session);
                    if (!oltDoc) {
                        throw new Error(`OLT with ID ${oltId} not found`);
                    }

                    if (!fdbDoc.ports || fdbDoc.ports.length === 0) {
                        fdbDoc.generatePorts();
                        fdbDoc.markModified("ports");
                        await fdbDoc.save({ session });
                    }

                    if (fdbDoc.outputs) {
                        const existingUserOutputs = fdbDoc.outputs.filter((output: any) => output.type === "user" && output.id === userId);
                        for (const output of existingUserOutputs) {
                            if (output.portNumber && fdbDoc.ports) {
                                const port = fdbDoc.ports.find((p: any) => p.portNumber === output.portNumber);
                                if (port) {
                                    port.status = PortStatus.AVAILABLE;
                                    port.connectedDevice = undefined;
                                    port.connectionDate = undefined;
                                }
                            }
                        }
                        fdbDoc.outputs = fdbDoc.outputs.filter((output: any) => !(output.type === "user" && output.id === userId));
                        fdbDoc.markModified("ports");
                        fdbDoc.markModified("outputs");
                    }

                    if (currentCustomer && currentCustomer.fdbId) {
                        const previousFdbId = currentCustomer.fdbId.toString();
                        const currentFdbId = fdbDoc._id.toString();
                        if (previousFdbId !== currentFdbId) {
                            const previousFdb = await FDBModel.findById(currentCustomer.fdbId, null, { session });
                            if (previousFdb && previousFdb.outputs) {
                                const userOutputIndex = previousFdb.outputs.findIndex((output: any) =>
                                    output.type === "user" && output.id === userId
                                );
                                if (userOutputIndex !== -1) {
                                    const previousPortNumber = previousFdb.outputs[userOutputIndex].portNumber;
                                    if (previousPortNumber && previousFdb.ports) {
                                        const previousPort = previousFdb.ports.find((p: any) => p.portNumber === previousPortNumber);
                                        if (previousPort) {
                                            previousPort.status = PortStatus.AVAILABLE;
                                            previousPort.connectedDevice = undefined;
                                            previousPort.connectionDate = undefined;
                                        }
                                        previousFdb.markModified("ports");
                                    }
                                    previousFdb.outputs.splice(userOutputIndex, 1);
                                    previousFdb.markModified("outputs");
                                    await previousFdb.save({ session });
                                }
                            }
                        }
                    }

                    if (!/^P\d+$/i.test(normalizedPortNumber)) {
                        throw new Error("Invalid port number format. Expected values like P1, P2, ...");
                    }

                    const portExists = fdbDoc.ports?.some((port: any) => port.portNumber === normalizedPortNumber);
                    if (!portExists) {
                        throw new Error(`Port ${portNumber} does not exist for FDB ${fdbDoc.fdbName}`);
                    }

                    const selectedPort = fdbDoc.getPort(normalizedPortNumber);
                    if (!selectedPort || selectedPort.status !== PortStatus.AVAILABLE) {
                        throw new Error(`Port ${normalizedPortNumber} is not available`);
                    }

                    const customerLabel = `${updatedUser?.firstName || existingUser.firstName || ""} ${updatedUser?.lastName || existingUser.lastName || ""}`.trim();

                    selectedPort.status = PortStatus.OCCUPIED;
                    selectedPort.connectedDevice = {
                        type: "user",
                        id: userId,
                        description: `User ${customerLabel}`
                    };
                    selectedPort.connectionDate = new Date();

                    const maxOutputs = fdbDoc.fdbPower || 2;
                    if (!fdbDoc.outputs) {
                        fdbDoc.outputs = [];
                    }
                    if (fdbDoc.outputs.length >= maxOutputs) {
                        throw new Error(`FDB ${fdbDoc.fdbName} already reached its maximum outputs (${maxOutputs})`);
                    }

                    fdbDoc.outputs.push({
                        type: "user",
                        id: userId,
                        portNumber: normalizedPortNumber,
                        description: `User ${customerLabel}`
                    });

                    fdbDoc.markModified("ports");
                    fdbDoc.markModified("outputs");
                    await fdbDoc.save({ session });

                    fdbConnectionResult = {
                        fdbId: fdbDoc.fdbId,
                        fdbName: fdbDoc.fdbName,
                        portNumber: normalizedPortNumber,
                        connected: true
                    };
                }

                let updatedCustomer = currentCustomer;
                const customerUpdateData: Record<string, any> = {};

                if (fdbDoc) customerUpdateData.fdbId = fdbDoc._id;
                if (oltDoc) customerUpdateData.oltId = oltDoc._id;
                if (isInstalledBool !== undefined) customerUpdateData.isInstalled = isInstalledBool;
                if (fdbId && oltId && portNumber) {
                    customerUpdateData.installationDate = new Date();
                    customerUpdateData.isInstalled = true;
                }

                if (Object.keys(customerUpdateData).length > 0) {
                    if (updatedCustomer) {
                        updatedCustomer = await CustomerModel.findOneAndUpdate(
                            { userId },
                            { $set: customerUpdateData },
                            { new: true, session }
                        );
                    } else {
                        const created = await CustomerModel.create([{
                            userId,
                            ...customerUpdateData
                        }], { session });
                        updatedCustomer = created[0];
                    }
                }

                const assignmentDoc = await ExistingClientUpdateModel.findById(assignment._id).session(session);
                if (assignmentDoc) {
                    if (normalizedStatus) {
                        assignmentDoc.status = normalizedStatus;
                        if (normalizedStatus === ClientUpdateStatus.VISITED_SITE && !assignmentDoc.visitDate) {
                            assignmentDoc.visitDate = visitDateValue || new Date();
                        }
                        if (normalizedStatus === ClientUpdateStatus.DONE && !assignmentDoc.completedAt) {
                            assignmentDoc.completedAt = completedAtValue || new Date();
                        }
                    }

                    if (visitDateValue) {
                        assignmentDoc.visitDate = visitDateValue;
                    }
                    if (completedAtValue) {
                        assignmentDoc.completedAt = completedAtValue;
                    }

                    const assignmentRemarks = updateRemarks ?? req.body.assignmentRemarks;
                    if (assignmentRemarks) {
                        assignmentDoc.remarks = assignmentRemarks;
                    }

                    const attachmentsToAdd = Array.isArray(updateAttachments)
                        ? updateAttachments.filter(Boolean)
                        : (updateAttachments ? [updateAttachments] : []);
                    if (attachmentsToAdd.length > 0) {
                        assignmentDoc.attachments = [
                            ...(assignmentDoc.attachments || []),
                            ...attachmentsToAdd
                        ];
                    }

                    await assignmentDoc.save({ session });
                }

                const transactionPayload: ExistingClientUpdateResult = {
                    updatedUser,
                    updatedModem,
                    updatedCustomer,
                    fdbConnection: fdbConnectionResult,
                    assignmentId: assignment._id as mongoose.Types.ObjectId
                };
                return transactionPayload;
            });

            if (!transactionResult) {
                return sendError(res, "Unable to update client data", 500);
            }

            const populatedAssignment = await ExistingClientUpdateModel.findById(transactionResult.assignmentId)
                .populate({
                    path: "user",
                    select: "firstName lastName email phoneNumber countryCode customerId billingAddress status"
                })
                .populate({
                    path: "assignedEngineer",
                    select: "firstName lastName email phoneNumber countryCode parentCompany profileImage"
                })
                .populate({
                    path: "assignedBy",
                    select: "firstName lastName email role"
                })
                .lean();

            return sendSuccess(res, {
                user: transactionResult.updatedUser,
                modem: transactionResult.updatedModem,
                customer: transactionResult.updatedCustomer,
                fdbConnection: transactionResult.fdbConnection,
                existingClientUpdate: populatedAssignment
            }, "Existing client data updated successfully");
        } catch (transactionError: any) {
            console.error("Update existing client transaction failed:", transactionError);
            return sendError(res, transactionError.message || "Unable to update existing client", 500);
        } finally {
            await session.endSession();
        }
    } catch (error: any) {
        console.error("Update existing client update error:", error);
        return sendError(res, error.message || "Internal server error", 500);
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
    createLeaveRequestByAdmin,
    getAllMyLeaves,
    updateAttendance,
    approveLeaveRequest,
    getAllPendingLeaveRequests,
    getEngineerCompanyDetails,
    getAllAssignedExistingClienttoUpdates,
    updateExistingClientUpdate
};