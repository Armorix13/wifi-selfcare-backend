import { Request, Response } from "express";
import { Role, UserModel } from "../models/user.model";
import { hashPassword, sendSuccess, sendError, generateOtp, sendMessage, generateAccessToken, generateRefreshToken, generateRandomJti, comparePassword } from '../../utils/helper';
import { Advertisement } from '../models/advertisement.model';
import { Plan } from '../models/plan.model';
import { ApplicationForm } from '../models/applicationform.model';
import { WifiInstallationRequest } from '../models/wifiInstallationRequest.model';
import { OttInstallationRequest } from "../models/ottInstallationRequest.model";
import { IptvInstallationRequest } from "../models/iptvInstallationRequest.model";
import { FibreInstallationRequest } from "../models/fibreInstallationRequest.model";
import { CctvRequestModel, CctvStatus } from "../models/cctvRequest.model";
import { RequestBill } from "../models/requestBill.model";

const signUp = async (req: Request, res: Response): Promise<any> => {
    console.log(req.body);

    try {
        const { email, password, firstName, lastName, countryCode, phoneNumber, lat, long, language, companyPreference, deviceType, deviceToken } = req.body;
        const existingUser = await UserModel.findOne({ $or: [{ email }] });

        if (existingUser) {
            if (existingUser.isAccountVerified) {
                return sendError(res, "User with this email or phone number already exists", 400);
            } else {
                const otp = generateOtp(4);
                await sendMessage.sendEmail({
                    userEmail: email,
                    subject: 'Your OTP Code',
                    text: `Your OTP code is: ${otp}`,
                    html: `<p>Your OTP code is: <b>${otp}</b></p>`
                });
                existingUser.otp = otp;
                existingUser.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
                existingUser.otpVerified = false;
                existingUser.otpPurpose = "signup";
                existingUser.deviceType = deviceType;
                existingUser.deviceToken = deviceToken;
                await existingUser.save();
                existingUser.otp = undefined;
                return sendSuccess(res, { user: existingUser }, "OTP resent to your email. Please verify your account.", 200);
            }
        }

        const hashedPassword = await hashPassword(password);
        const otp = generateOtp(4);
        await sendMessage.sendEmail({
            userEmail: email,
            subject: 'Your OTP Code',
            text: `Your OTP code is: ${otp}`,
            html: `<p>Your OTP code is: <b>${otp}</b></p>`
        });
        const newUser = await UserModel.create({
            email,
            password: hashedPassword,
            firstName,
            lastName,
            countryCode,
            phoneNumber,
            lat,
            long,
            language,
            companyPreference,
            otpExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
            otpVerified: false,
            otp,
            otpPurpose: "signup",
            deviceType,
            deviceToken
        });
        newUser.otp = undefined;
        return sendSuccess(res, { user: newUser }, "User registered successfully. OTP sent to email.", 201);
    } catch (error) {
        console.error(error);
        return sendError(res, "Internal server error", 500, error);
    }
}

const verifyOtp = async (req: Request, res: Response): Promise<any> => {
    try {
        const { email, otp, purpose } = req.body;
        // otp = Number(otp);
        console.log("body", req.body);
        console.log('otp', otp);

        if (!email || !otp || !purpose) {
            return sendError(res, "Email, OTP, and purpose are required", 400);
        }
        const user = await UserModel.findOne({ email });
        if (!user) return sendError(res, "User not found", 404);

        // console.log('=== OTP Verification Debug ===');
        // console.log('Request OTP:', otp, 'Type:', typeof otp);
        // console.log('Database OTP:', user.otp, 'Type:', typeof user.otp);
        // console.log('Request Purpose:', purpose, 'Type:', typeof purpose);
        // console.log('Database Purpose:', user.otpPurpose, 'Type:', typeof user.otpPurpose);
        // console.log('OTP Expiry:', user.otpExpiry);
        // console.log('Current Date:', new Date());
        // console.log('OTP Match:', user.otp === otp);
        // console.log('Purpose Match:', user.otpPurpose === purpose);
        // console.log('Expiry Check:', user.otpExpiry && user.otpExpiry < new Date());
        // console.log('================================');

        const requestOtp = String(otp);
        const databaseOtp = String(user.otp);


        if (
            databaseOtp !== requestOtp ||
            !user.otpExpiry ||
            user.otpExpiry < new Date() ||
            user.otpPurpose !== purpose
        ) {
            return sendError(res, "Invalid or expired OTP", 400);
        }
        // Mark as verified for the given purpose
        let responseData: any = user;
        if (purpose === "signup") {
            user.isAccountVerified = true;
            user.otpVerified = true;
            const jti = generateRandomJti();
            user.jti = jti;
            await user.save();
            // Generate tokens
            const accessToken = generateAccessToken({ userId: String(user._id), role: user.role, jti });
            const refreshToken = generateRefreshToken({ userId: String(user._id), role: user.role, jti });
            // Prepare basic user details
            responseData = {
                _id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumber,
                accessToken,
                refreshToken
            };
        } else if (purpose === "forgot_password") {
            user.otpVerified = true;
        } else if (purpose === "email_change") {
            user.otpVerified = true;
        } else {
            user.otpVerified = true;
        }

        // Clear OTP fields
        user.otp = undefined;
        user.otpExpiry = undefined;
        user.otpPurpose = undefined;
        await user.save();

        return sendSuccess(res, responseData, "OTP verified successfully");
    } catch (error) {
        console.error(error);
        return sendError(res, "Internal server error", 500, error);
    }
}

const login = async (req: Request, res: Response): Promise<any> => {
    try {
        const { email, password, deviceType, deviceToken } = req.body;

        const user = await UserModel.findOne({ email });
        if (!user) {
            return sendError(res, "User not found", 404);
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

        // Check if password exists (social login)
        if (!user.password) {
            return sendError(res, "Password not set. Please login using your social account.", 400);
        }
        // Check password
        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
            return sendError(res, "Invalid credentials", 400);
        }
        // Generate new jti and tokens
        const jti = generateRandomJti();
        user.jti = jti;
        user.lastLogin = new Date();
        user.deviceType = deviceType;
        user.deviceToken = deviceToken;
        await user.save();
        const accessToken = generateAccessToken({ userId: String(user._id), role: user.role, jti });
        const refreshToken = generateRefreshToken({ userId: String(user._id), role: user.role, jti });
        const userInfo = {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            role: user.role,
            accessToken,
            refreshToken
        };
        return sendSuccess(res, userInfo, "Login successful");
    } catch (error) {
        console.error(error);
        return sendError(res, "Internal server error", 500, error);
    }
}

const adminLogin = async (req: Request, res: Response): Promise<any> => {
    try {
        const { email, password, deviceType, deviceToken } = req.body;

        const user = await UserModel.findOne({ email });
        if (!user) {
            return sendError(res, "User not found", 404);
        }

        if (user.role !== Role.ADMIN && user.role !== Role.SUPERADMIN && user.role !== Role.MANAGER && user.role !== Role.AGENT) {
            return sendError(res, "Access denied. Admin privileges required.", 403);
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

        // Check if password exists (social login)
        if (!user.password) {
            return sendError(res, "Password not set. Please login using your social account.", 400);
        }
        // Check password
        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
            return sendError(res, "Invalid credentials", 400);
        }
        // Generate new jti and tokens
        const jti = generateRandomJti();
        user.jti = jti;
        user.lastLogin = new Date();
        user.deviceType = deviceType;
        user.deviceToken = deviceToken;
        await user.save();
        const accessToken = generateAccessToken({ userId: String(user._id), role: user.role, jti });
        const refreshToken = generateRefreshToken({ userId: String(user._id), role: user.role, jti });
        const userInfo = {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            role: user.role,
            accessToken,
            refreshToken
        };
        return sendSuccess(res, userInfo, "Login successful");
    } catch (error) {
        console.error(error);
        return sendError(res, "Internal server error", 500, error);
    }
}

const forgotPassword = async (req: Request, res: Response): Promise<any> => {
    try {
        const { email } = req.body;
        console.log("body", req.body);


        const user = await UserModel.findOne({ email });
        if (!user) {
            return sendSuccess(res, {}, "If the email exists, an OTP has been sent.");
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
        const otp = generateOtp(4);
        await sendMessage.sendEmail({
            userEmail: email,
            subject: 'Your Password Reset OTP',
            text: `Your OTP code for password reset is: ${otp}`,
            html: `<p>Your OTP code for password reset is: <b>${otp}</b></p>`
        });
        user.otp = otp;
        console.log('otp', otp);
        user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry
        user.otpPurpose = "forgot_password";
        user.otpVerified = false;
        await user.save();
        console.log('user', user);
        return sendSuccess(res, {}, "If the email exists, an OTP has been sent.");
    } catch (error) {
        console.error(error);
        return sendError(res, "Internal server error", 500, error);
    }
}

const resetPassword = async (req: Request, res: Response): Promise<any> => {
    try {
        const { email, newPassword } = req.body;
        console.log("body", req.body);


        const user = await UserModel.findOne({ email });
        if (!user) {
            return sendError(res, "User not found", 404);
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
        // Check if new password is same as old password
        if (user.password && await comparePassword(newPassword, user.password)) {
            return sendError(res, "New password cannot be the same as the old password", 400);
        }
        user.password = await hashPassword(newPassword);
        await user.save();
        return sendSuccess(res, {}, "Password reset successfully. You can now log in with your new password.");
    } catch (error) {
        console.error(error);
        return sendError(res, "Internal server error", 500, error);
    }
}

const socialLogin = async (req: Request, res: Response): Promise<any> => {
    try {
        const { email, provider, providerId, firstName, lastName, profileImage, deviceType, deviceToken, lat, long } = req.body;

        if (!['google', 'apple'].includes(provider)) {
            return sendError(res, "Unsupported provider", 400);
        }
        let user = await UserModel.findOne({ email });
        if (user) {
            // If user exists, check if they have provider info
            if (user.provider && user.providerId) {
                // User has provider info, check if it matches
                if (user.provider !== provider || user.providerId !== providerId) {
                    // Instead of error, update the provider info to allow linking
                    user.provider = provider;
                    user.providerId = providerId;
                }
            } else {
                // User exists but doesn't have provider info, update it
                user.provider = provider;
                user.providerId = providerId;
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
            // Update profile info if provided
            if (profileImage) user.profileImage = profileImage;
            if (firstName) user.firstName = firstName;
            if (lastName) user.lastName = lastName;
            if (lat !== undefined) user.lat = lat;
            if (long !== undefined) user.long = long;
            user.lastLogin = new Date();
            user.deviceType = deviceType;
            user.deviceToken = deviceToken;
            user.isAccountVerified = true;
            user.role = Role.USER;
            await user.save();
        } else {
            // Create new user
            user = await UserModel.create({
                email,
                provider,
                providerId,
                firstName,
                lastName,
                profileImage,
                deviceType,
                deviceToken,
                lat,
                long,
                isAccountVerified: true,
                role: Role.USER,
                lastLogin: new Date()
            });
        }
        // Generate tokens
        const jti = generateRandomJti();
        user.jti = jti;
        await user.save();
        const accessToken = generateAccessToken({ userId: String(user._id), role: user.role, jti });
        const refreshToken = generateRefreshToken({ userId: String(user._id), role: user.role, jti });
        // Prepare user info
        const userInfo = {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImage: user.profileImage,
            provider: user.provider,
            providerId: user.providerId,
            role: user.role,
            accessToken,
            refreshToken
        };
        return sendSuccess(res, userInfo, "Social login successful");
    } catch (error) {
        console.error(error);
        return sendError(res, "Internal server error", 500, error);
    }
}

const updateUser = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId;
        if (!userId) {
            return sendError(res, "User ID is required", 400);
        }
        // Exclude fields that should not be updated via this endpoint
        const forbiddenFields = ["email", "role", "password", "_id", "__v"]; // add more if needed
        const updateData: any = {};
        for (const key in req.body) {
            if (!forbiddenFields.includes(key)) {
                updateData[key] = req.body[key];
            }
        }
        if (Object.keys(updateData).length === 0) {
            return sendError(res, "No valid fields to update", 400);
        }
        const updatedUser = await UserModel.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('-password -otp -otpExpiry -otpPurpose -__v');
        if (!updatedUser) {
            return sendError(res, "User not found", 404);
        }
        return sendSuccess(res, updatedUser, "User updated successfully");
    } catch (error) {
        console.error(error);
        return sendError(res, "Internal server error", 500, error);
    }
}

const getUserDetails = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId;


        const user = await UserModel.findById(userId).select('-password -otp -otpExpiry -otpPurpose -__v');
        if (!user) {
            return sendError(res, "User not found", 404);
        }
        return sendSuccess(res, user, "User details fetched successfully");
    } catch (error) {
        console.error(error);
        return sendError(res, "Internal server error", 500, error);
    }
}

const logout = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId;
        if (!userId) {
            return sendError(res, "User ID is required", 400);
        }
        const user = await UserModel.findById(userId);
        if (!user) {
            return sendError(res, "User not found", 404);
        }
        user.deviceToken = undefined;
        user.jti = undefined;
        user.lastLogin = new Date();
        await user.save();
        return sendSuccess(res, {}, "Logged out successfully");
    } catch (error) {
        console.error(error);
        return sendError(res, "Internal server error", 500, error);
    }
}

const dashboard = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId;
        // 1. Get all advertisements
        const allAds = await Advertisement.find({}, '_id imageUrl title description type').sort({ createdAt: -1 });

        // Filter advertisements by type
        const cctvAds = allAds.filter(ad => ad.type === 'CCTV');
        const wifiAds = allAds.filter(ad => ad.type === 'WIFI');

        // 2. Check if user has applied for application form
        const userApplication = await ApplicationForm.findOne({
            userId,
            status: { $in: ['inreview', 'accept'] }
        }).populate('planId');

        const isApplicationFormApplied = !!userApplication;

        // 3. Check for recently rejected application
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentRejectedApplication = await ApplicationForm.findOne({
            userId,
            status: 'reject',
            rejectedAt: { $gte: oneWeekAgo }
        });

        let rejectionMessage = null;
        let isRejected = false;
        if (recentRejectedApplication) {
            isRejected = true;
            const rejectionDate = recentRejectedApplication.rejectedAt!;
            const oneWeekAfterRejection = new Date(rejectionDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            const now = new Date();
            const timeDiff = oneWeekAfterRejection.getTime() - now.getTime();
            const daysRemaining = Math.ceil(timeDiff / (24 * 60 * 60 * 1000));
            rejectionMessage = `You can apply again after ${daysRemaining} days`;
        }

        // 4. Check for WiFi installation request
        const wifiInstallationRequest = await WifiInstallationRequest.findOne({
            userId
        }).populate('userId', 'firstName lastName email phoneNumber')
            .populate('applicationId')
            .populate('assignedEngineer', 'firstName lastName email phoneNumber countryCode profileImage role')
            .sort({ createdAt: -1 });

        const isWifiInstallationRequest = !!wifiInstallationRequest;


        //Ott Installation Request
        let ottStatus = 1; //Not requested for ott installation
        const ottInstallationRequest = await OttInstallationRequest.findOne({ userId })
        .populate('assignedEngineer', 'firstName lastName email phoneNumber countryCode profileImage role')
        .populate('ottPlanId', 'name price description')
        .sort({ createdAt: -1 });
        ;
        if (ottInstallationRequest && ottInstallationRequest.status === 'approved') {

            ottStatus = 3; //Approved for ott installation
        } else if (ottInstallationRequest && ottInstallationRequest.status === 'inreview') {
            ottStatus = 2; //In review for ott installation
        } else if (ottInstallationRequest && ottInstallationRequest.status === 'rejected') {
            ottStatus = 4; //Rejected for ott installation
        }

        //Iptv installation request
        let iptvStatus = 1; //Not requested for iptv installation
        const iptvInstallationRequest = await IptvInstallationRequest.findOne({ userId })
        .populate('assignedEngineer', 'firstName lastName email phoneNumber countryCode profileImage role')
        .populate('iptvPlanId', 'name price description')
        .sort({ createdAt: -1 });
        ;
        if (iptvInstallationRequest && iptvInstallationRequest.status === 'approved') {
            iptvStatus = 3; //Approved for iptv installation
        } else if (iptvInstallationRequest && iptvInstallationRequest.status === 'inreview') {
            iptvStatus = 2; //In review for iptv installation
        } else if (iptvInstallationRequest && iptvInstallationRequest.status === 'rejected') {
            iptvStatus = 4; //Rejected for iptv installation
        }

        //Fibre installation request
        let fibreStatus = 1; //Not requested for fibre installation
        const fibreInstallationRequest = await FibreInstallationRequest.findOne({ userId })
        .populate('assignedEngineer', 'firstName lastName email phoneNumber countryCode profileImage role')
        .populate('fibrePlanId', 'name price description')
        .sort({ createdAt: -1 });
        ;
        if (fibreInstallationRequest && fibreInstallationRequest.status === 'approved') {
            fibreStatus = 3; //Approved for fibre installation
        } else if (fibreInstallationRequest && fibreInstallationRequest.status === 'inreview') {
            fibreStatus = 2; //In review for fibre installation
        } else if (fibreInstallationRequest && fibreInstallationRequest.status === 'rejected') {
            fibreStatus = 4; //Rejected for fibre installation
        }

        //Cctv request releted info
        let cctvInsttalationRequestStatus = 1; //Not requested for cctv installation
        const cctvRequest = await CctvRequestModel.findOne({ userId })
        .populate('assignedEngineer', 'firstName lastName email phoneNumber countryCode profileImage role')
        .sort({ createdAt: -1 });
        ;
        if (cctvRequest && cctvRequest.status === CctvStatus.APPLICATION_ACCEPTED) {
            cctvInsttalationRequestStatus = 3; //Approved for cctv installation
        } else if (cctvRequest && cctvRequest.status === CctvStatus.APPLICATION_SUBMITTED) {
            cctvInsttalationRequestStatus = 2; //In review for cctv installation
        } else if (cctvRequest && cctvRequest.status === CctvStatus.APPLICATION_REJECTED) {
            cctvInsttalationRequestStatus = 4; //Rejected for cctv installation
        }

        //Is bill request send or not
        let isBillRequestSend = false;
        const billRequest = await RequestBill.findOne({ userId })
        .sort({ createdAt: -1 });
        if (billRequest) {
            isBillRequestSend = true;
        }


        const result = {
            cctv: cctvAds,
            wifi: wifiAds,
            isApplicationFormApplied,
            applicationData: userApplication || null,
            rejectionMessage,
            isRejected,
            isWifiInstallationRequest,
            wifiInstallationRequestData: wifiInstallationRequest || null,
            // Additional WiFi installation request info
            wifiInstallationStatus: wifiInstallationRequest?.status || null,
            wifiInstallationApprovedDate: wifiInstallationRequest?.approvedDate || null,
            wifiInstallationRemarks: wifiInstallationRequest?.remarks || null,
            assignedEngineer: wifiInstallationRequest?.assignedEngineer || null,
            ottInstallation:{
                ottStatus,
                ottInstallationRequestData: ottInstallationRequest || null,
                ottInstallationStatus: ottInstallationRequest?.status || null,
                ottInstallationApprovedDate: ottInstallationRequest?.approvedDate || null,
                ottInstallationRemarks: ottInstallationRequest?.remarks || null,
                assignedEngineer: ottInstallationRequest?.assignedEngineer || null,
            },
            iptvInstallation:{
                iptvStatus,
                iptvInstallationRequestData: iptvInstallationRequest || null,
                iptvInstallationStatus: iptvInstallationRequest?.status || null,
                iptvInstallationApprovedDate: iptvInstallationRequest?.approvedDate || null,
                iptvInstallationRemarks: iptvInstallationRequest?.remarks || null,
                assignedEngineer: iptvInstallationRequest?.assignedEngineer || null,
            },
            fibreInstallation:{
                fibreStatus,
                fibreInstallationRequestData: fibreInstallationRequest || null,
                fibreInstallationStatus: fibreInstallationRequest?.status || null,
                fibreInstallationApprovedDate: fibreInstallationRequest?.approvedDate || null,
                fibreInstallationRemarks: fibreInstallationRequest?.remarks || null,
                assignedEngineer: fibreInstallationRequest?.assignedEngineer || null,
            },
            cctvInstallation:{
                cctvInsttalationRequestStatus,
                cctvInstallationRequestData: cctvRequest || null,
                cctvInstallationStatus: cctvRequest?.status || null,
                cctvInstallationApprovedDate: cctvRequest?.approvedDate || null,
                cctvInstallationRemarks: cctvRequest?.remarks || null,
                assignedEngineer: cctvRequest?.assignedEngineer || null,
            },
            isBillRequestSend
        };

        return sendSuccess(res, {
            result,
        }, 'Dashboard data fetched');
    } catch (error) {
        return sendError(res, 'Internal server error', 500, error);
    }
};

const getAllEngineer = async (req: Request, res: Response): Promise<any> => {
    try {
        // Get all engineers with specified filters
        const engineers = await UserModel.find({
            role: 'engineer',
            isDeactivated: false,
            isSuspended: false,
            isAccountVerified: true
        }).select('_id firstName lastName email phoneNumber countryCode profileImage role createdAt')
            .sort({ createdAt: -1 });

        const total = engineers.length;

        return sendSuccess(res, {
            engineers,
            total,
            message: 'All active engineers fetched successfully'
        }, 'Engineers fetched successfully');
    } catch (error: any) {
        return sendError(res, 'Failed to fetch engineers', 500, error.message || error);
    }
};

export const userController = {
    signUp,
    verifyOtp,
    login,
    adminLogin,
    logout,
    forgotPassword,
    resetPassword,
    socialLogin,
    getUserDetails,
    updateUser,
    dashboard,
    getAllEngineer
}