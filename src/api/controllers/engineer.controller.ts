import { Request, Response } from "express";
import { Role, UserModel } from "../models/user.model";
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

export const engineerController = {
    engineerLogin,
    getEngineerProfile,
    updateEngineerProfile,
    engineerLogout
};