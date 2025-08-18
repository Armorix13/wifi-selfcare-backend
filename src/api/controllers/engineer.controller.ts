import { Request, Response } from "express";
import { Role, UserModel } from "../models/user.model";
import { EngineerAttendanceModel, AttendanceStatus } from "../models/engineerAttendance.model";
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

        // Get attendance records for the month
        const attendanceRecords = await EngineerAttendanceModel.find({
            engineer: userId,
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 });

        // Get monthly statistics
        const monthlyStats = await EngineerAttendanceModel.getMonthlyStats(userId, year, month);

        // Create calendar data for all days in the month (1 to 31)
        const calendarData = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month - 1, day);
            const attendanceRecord = attendanceRecords.find(record => 
                record.date.getDate() === day
            );

            // If no attendance record exists, default to 'absent'
            const status = attendanceRecord ? attendanceRecord.status : 'absent';

            calendarData.push({
                date: currentDate,
                day: day,
                dayName: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
                status: status,
                checkInTime: attendanceRecord?.checkInTime || null,
                checkOutTime: attendanceRecord?.checkOutTime || null,
                totalHours: attendanceRecord?.totalHours || 0,
                location: attendanceRecord?.location || null,
                remark: attendanceRecord?.remark || null,
                isMarked: !!attendanceRecord // Whether attendance was manually marked
            });
        }

        // Calculate summary including absent days (unmarked days)
        const totalDays = daysInMonth;
        const presentDays = calendarData.filter(day => day.status === 'present').length;
        const absentDays = calendarData.filter(day => day.status === 'absent').length;
        const halfDayDays = calendarData.filter(day => day.status === 'half_day').length;
        const leaveDays = calendarData.filter(day => day.status === 'leave').length;
        const holidayDays = calendarData.filter(day => day.status === 'holiday').length;
        const workingDays = presentDays + halfDayDays;

        // Update monthly stats to include absent days
        const updatedStats = {
            ...monthlyStats,
            absent: absentDays // Include unmarked days as absent
        };

        const response = {
            month: month,
            year: year,
            monthName: startDate.toLocaleDateString('en-US', { month: 'long' }),
            summary: {
                totalDays,
                workingDays,
                presentDays,
                absentDays,
                halfDayDays,
                leaveDays,
                holidayDays,
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
            }))
        };

        return sendSuccess(res, response, "Monthly attendance retrieved successfully");
    } catch (error: any) {
        console.error("Get monthly attendance error:", error);
        return sendError(res, "Failed to get monthly attendance", 500, error);
    }
};

// Update attendance for a specific date (if needed)
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

export const engineerController = {
    engineerLogin,
    getEngineerProfile,
    updateEngineerProfile,
    engineerLogout,
    markAttendance,
    markAttendanceWithStatus,
    markCheckOut,
    getMonthlyAttendance,
    updateAttendance
};