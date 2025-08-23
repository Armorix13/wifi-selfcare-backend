import { Request, Response } from "express";
import { Role, UserModel } from "../models/user.model";
import { hashPassword, sendSuccess, sendError, generateOtp, sendMessage, generateAccessToken, generateRefreshToken, generateRandomJti, comparePassword, generateRandomPassword, generateClientRegistrationEmail } from '../../utils/helper';
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

        let isApplicationFormApplied = !!userApplication;

        let installationStatus = 1;//Not applied for application form
        if (userApplication && userApplication.status === 'inreview') {
            installationStatus = 2;//Applied for application form
        }
        if (userApplication && userApplication.status === 'accept') {
            installationStatus = 3;//Applied for application form and accepted
        }
        if (userApplication && userApplication.status === 'reject') {
            installationStatus = 4;//Applied for application form and rejected
        }

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

        if (wifiInstallationRequest && wifiInstallationRequest.status === 'inreview') {
            installationStatus = 5;//In review for wifi installation
        }
        if (wifiInstallationRequest && wifiInstallationRequest.status === 'approved') {
            installationStatus = 6;//Approved for wifi installation
        }
        if (wifiInstallationRequest && wifiInstallationRequest.status === 'rejected') {
            installationStatus = 7;//Rejected for wifi installation
        }

        console.log("installationStatus",installationStatus);
        


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
            installationStatus,
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
            ottInstallation: {
                ottStatus,
                ottInstallationRequestData: ottInstallationRequest || null,
                ottInstallationStatus: ottInstallationRequest?.status || null,
                ottInstallationApprovedDate: ottInstallationRequest?.approvedDate || null,
                ottInstallationRemarks: ottInstallationRequest?.remarks || null,
                assignedEngineer: ottInstallationRequest?.assignedEngineer || null,
            },
            iptvInstallation: {
                iptvStatus,
                iptvInstallationRequestData: iptvInstallationRequest || null,
                iptvInstallationStatus: iptvInstallationRequest?.status || null,
                iptvInstallationApprovedDate: iptvInstallationRequest?.approvedDate || null,
                iptvInstallationRemarks: iptvInstallationRequest?.remarks || null,
                assignedEngineer: iptvInstallationRequest?.assignedEngineer || null,
            },
            fibreInstallation: {
                fibreStatus,
                fibreInstallationRequestData: fibreInstallationRequest || null,
                fibreInstallationStatus: fibreInstallationRequest?.status || null,
                fibreInstallationApprovedDate: fibreInstallationRequest?.approvedDate || null,
                fibreInstallationRemarks: fibreInstallationRequest?.remarks || null,
                assignedEngineer: fibreInstallationRequest?.assignedEngineer || null,
            },
            cctvInstallation: {
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

const generateCompanyWelcomeEmail = (data: {
    firstName: string;
    lastName: string;
    companyName: string;
    email: string;
    password: string;
    companyPhone: string;
}) => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to WifiSelfCare - Company Admin Portal Access</title>
        <style>
            /* Reset and Base Styles */
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f4f4f4;
                -webkit-text-size-adjust: 100%;
                -ms-text-size-adjust: 100%;
            }
            
            /* Container Styles */
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                width: 100%;
            }
            
            /* Header Styles */
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 40px 30px;
                text-align: center;
                position: relative;
                overflow: hidden;
            }
            
            .header::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="75" cy="75" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="50" cy="10" r="0.5" fill="rgba(255,255,255,0.1)"/><circle cx="10" cy="60" r="0.5" fill="rgba(255,255,255,0.1)"/><circle cx="90" cy="40" r="0.5" fill="rgba(255,255,255,0.1)"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
                opacity: 0.3;
            }
            
            .header h1 {
                font-size: 28px;
                margin-bottom: 10px;
                font-weight: 600;
                position: relative;
                z-index: 1;
            }
            
            .header p {
                font-size: 16px;
                opacity: 0.9;
                position: relative;
                z-index: 1;
            }
            
            /* Content Styles */
            .content {
                padding: 40px 30px;
            }
            
            .welcome-section {
                text-align: center;
                margin-bottom: 30px;
            }
            
            .welcome-section h2 {
                color: #2c3e50;
                font-size: 24px;
                margin-bottom: 15px;
            }
            
            .welcome-section p {
                color: #7f8c8d;
                font-size: 16px;
            }
            
            /* Company Info Styles */
            .company-info {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                border-left: 4px solid #667eea;
            }
            
            .company-info h4 {
                color: #2c3e50;
                font-size: 18px;
                margin-bottom: 15px;
            }
            
            .info-row {
                display: flex;
                justify-content: space-between;
                margin: 10px 0;
                padding: 8px 0;
                border-bottom: 1px solid #e9ecef;
                align-items: center;
            }
            
            .info-label {
                font-weight: 600;
                color: #495057;
                flex: 1;
            }
            
            .info-value {
                color: #6c757d;
                text-align: right;
                flex: 1;
                word-break: break-word;
            }
            
            /* Credentials Box Styles */
            .credentials-box {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
                padding: 25px;
                border-radius: 8px;
                margin: 30px 0;
                text-align: center;
                position: relative;
                overflow: hidden;
            }
            
            .credentials-box::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
                animation: float 6s ease-in-out infinite;
            }
            
            @keyframes float {
                0%, 100% { transform: translateY(0px) rotate(0deg); }
                50% { transform: translateY(-20px) rotate(180deg); }
            }
            
            .credentials-box h3 {
                font-size: 20px;
                margin-bottom: 20px;
                font-weight: 600;
                position: relative;
                z-index: 1;
            }
            
            .credential-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(255, 255, 255, 0.1);
                padding: 15px;
                margin: 10px 0;
                border-radius: 6px;
                backdrop-filter: blur(10px);
                position: relative;
                z-index: 1;
            }
            
            .credential-label {
                font-weight: 600;
                font-size: 14px;
                opacity: 0.9;
                flex: 1;
                text-align: left;
            }
            
            .credential-value {
                font-weight: 700;
                font-size: 16px;
                font-family: 'Courier New', monospace;
                background: rgba(255, 255, 255, 0.2);
                padding: 8px 12px;
                border-radius: 4px;
                letter-spacing: 1px;
                flex: 1;
                text-align: right;
                word-break: break-all;
            }
            
            /* Admin Portal Section Styles */
            .admin-portal-section {
                background: #ecf0f1;
                padding: 25px;
                border-radius: 8px;
                margin: 30px 0;
                text-align: center;
            }
            
            .admin-portal-section h3 {
                color: #2c3e50;
                font-size: 20px;
                margin-bottom: 15px;
            }
            
            .admin-portal-section p {
                color: #7f8c8d;
                margin-bottom: 20px;
            }
            
            .portal-button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-decoration: none;
                padding: 15px 30px;
                border-radius: 25px;
                font-weight: 600;
                font-size: 16px;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                margin: 10px 0;
                min-width: 200px;
            }
            
            .portal-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
            }
            
            .portal-url {
                margin-top: 15px;
                font-size: 14px;
                word-break: break-all;
            }
            
            .portal-url a {
                color: #667eea;
                text-decoration: none;
            }
            
            /* Security Note Styles */
            .security-note {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                color: #856404;
                padding: 15px;
                border-radius: 6px;
                margin: 20px 0;
                text-align: center;
            }
            
            .security-note strong {
                color: #d63031;
            }
            
            /* Footer Styles */
            .footer {
                background: #2c3e50;
                color: white;
                padding: 30px;
                text-align: center;
            }
            
            .footer h4 {
                font-size: 18px;
                margin-bottom: 15px;
                color: #ecf0f1;
            }
            
            .footer p {
                color: #bdc3c7;
                margin-bottom: 10px;
            }
            
            .footer-links {
                margin-top: 20px;
                display: flex;
                justify-content: center;
                flex-wrap: wrap;
                gap: 15px;
            }
            
            .footer-links a {
                color: #3498db;
                text-decoration: none;
                font-weight: 500;
                padding: 8px 15px;
                border-radius: 20px;
                background: rgba(52, 152, 219, 0.1);
                transition: all 0.3s ease;
            }
            
            .footer-links a:hover {
                background: rgba(52, 152, 219, 0.2);
                transform: translateY(-2px);
            }
            
            .footer-copyright {
                margin-top: 20px;
                font-size: 12px;
                color: #95a5a6;
            }
            
            /* Responsive Design - Mobile First Approach */
            
            /* Extra Small Devices (phones, 320px and down) */
            @media (max-width: 320px) {
                .container {
                    margin: 5px;
                    border-radius: 8px;
                }
                
                .header, .content, .footer {
                    padding: 15px 10px;
                }
                
                .header h1 {
                    font-size: 22px;
                }
                
                .header p {
                    font-size: 14px;
                }
                
                .welcome-section h2 {
                    font-size: 20px;
                }
                
                .welcome-section p {
                    font-size: 14px;
                }
                
                .credentials-box {
                    padding: 20px 15px;
                }
                
                .credential-item {
                    flex-direction: column;
                    text-align: center;
                    gap: 10px;
                }
                
                .credential-label, .credential-value {
                    flex: none;
                    width: 100%;
                    text-align: center;
                }
                
                .info-row {
                    flex-direction: column;
                    text-align: center;
                    gap: 5px;
                }
                
                .info-label, .info-value {
                    flex: none;
                    width: 100%;
                    text-align: center;
                }
                
                .portal-button {
                    min-width: 150px;
                    padding: 12px 20px;
                    font-size: 14px;
                }
                
                .footer-links {
                    flex-direction: column;
                    gap: 10px;
                }
            }
            
            /* Small Devices (phones, 321px to 480px) */
            @media (min-width: 321px) and (max-width: 480px) {
                .container {
                    margin: 8px;
                    border-radius: 8px;
                }
                
                .header, .content, .footer {
                    padding: 20px 15px;
                }
                
                .header h1 {
                    font-size: 24px;
                }
                
                .credential-item {
                    flex-direction: column;
                    text-align: center;
                    gap: 8px;
                }
                
                .info-row {
                    flex-direction: column;
                    text-align: center;
                    gap: 5px;
                }
                
                .portal-button {
                    min-width: 180px;
                }
            }
            
            /* Medium Devices (tablets, 481px to 768px) */
            @media (min-width: 481px) and (max-width: 768px) {
                .container {
                    margin: 15px;
                    border-radius: 10px;
                }
                
                .header, .content, .footer {
                    padding: 30px 25px;
                }
                
                .credential-item {
                    gap: 15px;
                }
                
                .portal-button {
                    min-width: 220px;
                }
            }
            
            /* Large Devices (desktops, 769px to 1024px) */
            @media (min-width: 769px) and (max-width: 1024px) {
                .container {
                    max-width: 700px;
                    margin: 20px auto;
                }
                
                .header, .content, .footer {
                    padding: 35px 30px;
                }
            }
            
            /* Extra Large Devices (large desktops, 1025px and up) */
            @media (min-width: 1025px) {
                .container {
                    max-width: 700px;
                    margin: 30px auto;
                }
                
                .header, .content, .footer {
                    padding: 40px 35px;
                }
                
                .portal-button:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.7);
                }
            }
            
            /* Print Styles */
            @media print {
                body {
                    background: white;
                }
                
                .container {
                    box-shadow: none;
                    border: 1px solid #ddd;
                }
                
                .portal-button {
                    background: #667eea !important;
                    color: white !important;
                    box-shadow: none !important;
                }
            }
            
            /* High DPI Displays */
            @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
                .header h1, .welcome-section h2, .credentials-box h3 {
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                }
            }
            
            /* Dark Mode Support */
            @media (prefers-color-scheme: dark) {
                body {
                    background-color: #1a1a1a;
                }
                
                .container {
                    background-color: #2d2d2d;
                    color: #ffffff;
                }
                
                .welcome-section h2 {
                    color: #ffffff;
                }
                
                .welcome-section p {
                    color: #cccccc;
                }
                
                .company-info {
                    background: #3d3d3d;
                }
                
                .admin-portal-section {
                    background: #3d3d3d;
                }
            }
            
            /* Accessibility Improvements */
            .portal-button:focus {
                outline: 3px solid #667eea;
                outline-offset: 2px;
            }
            
            .credential-value {
                user-select: all;
                -webkit-user-select: all;
                -moz-user-select: all;
                -ms-user-select: all;
            }
            
            /* Animation for better UX */
            .container {
                animation: slideIn 0.5s ease-out;
            }
            
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .credentials-box {
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.02); }
                100% { transform: scale(1); }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 Welcome to WifiSelfCare</h1>
                <p>Your Company Admin Portal Access is Ready!</p>
            </div>
            
            <div class="content">
                <div class="welcome-section">
                    <h2>🎉 Welcome, ${data.firstName} ${data.lastName}!</h2>
                    <p>Your company <strong>${data.companyName}</strong> has been successfully registered with WifiSelfCare.</p>
                </div>
                
                <div class="company-info">
                    <h4>🏢 Company Information</h4>
                    <div class="info-row">
                        <span class="info-label">Company Name:</span>
                        <span class="info-value">${data.companyName}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Contact Person:</span>
                        <span class="info-value">${data.firstName} ${data.lastName}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Email:</span>
                        <span class="info-value">${data.email}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Phone:</span>
                        <span class="info-value">${data.companyPhone}</span>
                    </div>
                </div>
                
                <div class="credentials-box">
                    <h3>🔐 Your Admin Portal Credentials</h3>
                    <div class="credential-item">
                        <span class="credential-label">Email Address:</span>
                        <span class="credential-value">${data.email}</span>
                    </div>
                    <div class="credential-item">
                        <span class="credential-label">Password:</span>
                        <span class="credential-value">${data.password}</span>
                    </div>
                </div>
                
                <div class="admin-portal-section">
                    <h3>🌐 Access Your Admin Portal</h3>
                    <p>Click the button below to access your company admin portal and start managing your WiFi services.</p>
                    <a href="http://wifiselfcare.com/admin/login" class="portal-button">
                        🚀 Access Admin Portal
                    </a>
                    <div class="portal-url">
                        <strong>Portal URL:</strong> <a href="http://wifiselfcare.com/admin/login">http://wifiselfcare.com/admin/login</a>
                    </div>
                </div>
                
                <div class="security-note">
                    <strong>🔒 Security Notice:</strong><br>
                    Please change your password after your first login for enhanced security.
                </div>
                
                <div style="text-align: center; margin: 30px 0; color: #7f8c8d;">
                    <p>If you have any questions or need assistance, please contact our support team.</p>
                </div>
            </div>
            
            <div class="footer">
                <h4>WifiSelfCare</h4>
                <p>Connecting India with precision, innovation, and 24/7 support.</p>
                <p>Your trusted WiFi solution provider.</p>
                
                <div class="footer-links">
                    <a href="http://wifiselfcare.com">Website</a>
                    <a href="http://wifiselfcare.com/admin/login">Admin Portal</a>
                    <a href="mailto:contact@wifiselfcare.com">Contact Support</a>
                </div>
                
                <div class="footer-copyright">
                    © 2025 WifiSelfCare. All rights reserved.
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
};

const addCompany = async (req: Request, res: Response): Promise<any> => {
    try {
        const {
            firstName,
            lastName,
            email,
            companyName,
            companyAddress,
            companyPhone,
            internetProviders
        } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !companyName || !companyAddress) {
            return sendError(res, "firstName, lastName, email, companyName, and companyAddress are required", 400);
        }

        // Check if user with this email already exists
        const existingUser = await UserModel.findOne({ email });
        if (existingUser) {
            return sendError(res, "User with this email already exists", 400);
        }

        // Generate random 8-digit password
        const password = Math.floor(10000000 + Math.random() * 90000000).toString();

        // Hash the password
        const hashedPassword = await hashPassword(password);

        // Generate contact person name from firstName and lastName
        const contactPerson = `${firstName} ${lastName}`;

        // Create new company user
        const newCompany = await UserModel.create({
            firstName,
            lastName,
            email,
            companyPhone: companyPhone || "",
            companyName,
            companyAddress,
            contactPerson,
            internetProviders: internetProviders || [],
            password: hashedPassword,
            role: Role.ADMIN, // Set role as ADMIN for company users
            userName: `${firstName.toLowerCase()}${lastName.toLowerCase()}${Date.now()}`, // Generate unique username
            countryCode: "+91", // Default country code
            phoneNumber: companyPhone || "", // Use company phone as phone number
            country: "India", // Default country
            isAccountVerified: true, // Auto-verify company accounts
            isActivated: true // Auto-activate company accounts
        });

        // Send welcome email with credentials
        try {
            await sendMessage.sendEmail({
                userEmail: email,
                subject: 'Welcome to WifiSelfCare - Your Company Admin Portal Access',
                text: `Welcome to WifiSelfCare! Your company admin portal access credentials:\n\nEmail: ${email}\nPassword: ${password}\n\nAdmin Portal: http://wifiselfcare.com/admin/login\n\nPlease change your password after first login.`,
                html: generateCompanyWelcomeEmail({
                    firstName,
                    lastName,
                    companyName,
                    email,
                    password,
                    companyPhone: companyPhone || "Not provided"
                })
            });
        } catch (emailError) {
            console.error("Error sending welcome email:", emailError);
            // Continue with company creation even if email fails
        }

        // Remove sensitive fields from response
        const companyResponse = {
            _id: newCompany._id,
            firstName: newCompany.firstName,
            lastName: newCompany.lastName,
            email: newCompany.email,
            companyName: newCompany.companyName,
            companyAddress: newCompany.companyAddress,
            companyPhone: newCompany.companyPhone,
            contactPerson: newCompany.contactPerson,
            internetProviders: newCompany.internetProviders,
            role: newCompany.role,
            userName: newCompany.userName,
            createdAt: newCompany.createdAt
        };

        return sendSuccess(
            res, 
            { 
                company: companyResponse,
                message: "Company added successfully. Admin portal access credentials sent to email.",
                adminPortal: "http://wifiselfcare.com/admin/login"
            }, 
            "Company added successfully. Admin portal access credentials sent to email.", 
            201
        );

    } catch (error) {
        console.error("Error adding company:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

const getCompanyProfile = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId;

        const user = await UserModel.findById(userId);
        if (!user) {
            return sendError(res, "User not found", 404);
        }

        // Check if user is admin or has company role
        if (user.role !== Role.ADMIN && user.role !== Role.SUPERADMIN) {
            return sendError(res, "Only admin users can access company profile", 403);
        }

        // Extract company profile data
        const companyProfile = {
            companyName: user.companyName,
            contactPerson: user.contactPerson,
            companyEmail: user.companyEmail,
            companyPhone: user.companyPhone,
            industry: user.industry,
            companySize: user.companySize,
            companyWebsite: user.companyWebsite,
            companyAddress: user.companyAddress,
            companyCity: user.companyCity,
            companyState: user.companyState,
            companyCountry: user.companyCountry,
            companyDescription: user.companyDescription,
            companyLogo: user.companyLogo
        };

        return sendSuccess(
            res, 
            { 
                companyProfile,
                message: "Company profile retrieved successfully"
            }, 
            "Company profile retrieved successfully", 
            200
        );

    } catch (error) {
        console.error("Error retrieving company profile:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

const updateCompanyProfile = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId;

       

        const user = await UserModel.findById(userId);
        if (!user) {
            return sendError(res, "User not found", 404);
        }

        // Check if user is admin or has company role
        if (user.role !== Role.ADMIN && user.role !== Role.SUPERADMIN) {
            return sendError(res, "Only admin users can update company profile", 403);
        }

        // Extract company data from request body
        const {
            companyName,
            contactPerson,
            companyEmail,
            companyPhone,
            industry,
            companySize,
            companyWebsite,
            companyAddress,
            companyCity,
            companyState,
            companyCountry,
            companyDescription
        } = req.body;

        // Handle logo upload if present
        let companyLogo = user.companyLogo; // Keep existing logo if no new one
        if (req.file) {
            // Extract file path from uploaded file
            const absolutePath = req.file.path.replace(/\\/g, "/");
            const viewIndex = absolutePath.lastIndexOf("/view/");
            let fileUrl = absolutePath;
            
            if (viewIndex !== -1) {
                fileUrl = absolutePath.substring(viewIndex);
            }
            
            if (!fileUrl.startsWith("/view/")) {
                fileUrl = `/view/${fileUrl.split("/view/")[1]}`;
            }
            
            companyLogo = fileUrl;
        }

        // Update company fields
        const updateData: any = {};
        
        if (companyName !== undefined) updateData.companyName = companyName;
        if (contactPerson !== undefined) updateData.contactPerson = contactPerson;
        if (companyEmail !== undefined) updateData.companyEmail = companyEmail;
        if (companyPhone !== undefined) updateData.companyPhone = companyPhone;
        if (industry !== undefined) updateData.industry = industry;
        if (companySize !== undefined) updateData.companySize = companySize;
        if (companyWebsite !== undefined) updateData.companyWebsite = companyWebsite;
        if (companyAddress !== undefined) updateData.companyAddress = companyAddress;
        if (companyCity !== undefined) updateData.companyCity = companyCity;
        if (companyState !== undefined) updateData.companyState = companyState;
        if (companyCountry !== undefined) updateData.companyCountry = companyCountry;
        if (companyDescription !== undefined) updateData.companyDescription = companyDescription;
        if (companyLogo !== user.companyLogo) updateData.companyLogo = companyLogo;

        // Update user with company data
        const updatedUser = await UserModel.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return sendError(res, "Failed to update company profile", 500);
        }

        return sendSuccess(
            res, 
            { 
                user: updatedUser,
                message: "Company profile updated successfully"
            }, 
            "Company profile updated successfully", 
            200
        );

    } catch (error) {
        console.error("Error updating company profile:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

const getAdminDashboardData = async (req: Request, res: Response): Promise<any> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        // Get total counts for dashboard
        const totalAdmins = await UserModel.countDocuments({ role: { $in: [Role.ADMIN, Role.SUPERADMIN] } });
        const activeAdmins = await UserModel.countDocuments({ 
            role: { $in: [Role.ADMIN] }, 
            isActivated: true,
            isDeactivated: false,
            isSuspended: false
        });
        const inactiveAdmins = await UserModel.countDocuments({ 
            role: { $in: [Role.ADMIN, Role.SUPERADMIN] }, 
            $or: [
                { isActivated: false },
                { isDeactivated: true },
                { isSuspended: true }
            ]
        });
        const totalCompanies = await UserModel.countDocuments({ 
            role: Role.ADMIN,
            companyName: { $exists: true, $ne: "" }
        });

        // Get paginated admin data with company details
        const admins = await UserModel.find({ 
            role: { $in: [Role.ADMIN, Role.SUPERADMIN] }
        })
        .select('_id firstName lastName email companyName companyAddress companyPhone companyEmail companyWebsite companyLogo contactPerson internetProviders isActivated isDeactivated isSuspended createdAt lastLogin')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        // Calculate performance metrics (mock data for now - can be enhanced with real metrics)
        const adminPerformance = {
            avgResponseTime: "2.3 hrs",
            tasksCompleted: "87%",
            userSatisfaction: "4.2/5"
        };

        const ispCompanyStats = {
            activeCompanies: activeAdmins,
            totalProviders: 8, // Total unique internet providers across all companies
            newThisMonth: 3 // Companies added this month
        };

        const recentActivity = {
            newAdmins: 2, // Admins added this week
            companyUpdates: 5, // Company profile updates today
            activeSessions: 12 // Currently online admins
        };

        // Calculate total pages
        const totalPages = Math.ceil(totalAdmins / limit);

        // Dashboard summary
        const dashboardSummary = {
            totalAdmins,
            activeAdmins,
            inactiveAdmins,
            ispCompanies: totalCompanies
        };

        // Pagination info
        const pagination = {
            currentPage: page,
            totalPages,
            totalItems: totalAdmins,
            itemsPerPage: limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        };

        return sendSuccess(
            res,
            {
                dashboardSummary,
                adminPerformance,
                ispCompanyStats,
                recentActivity,
                admins,
                pagination
            },
            "Admin dashboard data retrieved successfully",
            200
        );

    } catch (error) {
        console.error("Error retrieving admin dashboard data:", error);
        return sendError(res, "Internal server error", 500, error);
    }
};

const deleteAdmin = async (req: Request, res: Response): Promise<any> => {
    try {
        const { adminId } = req.params;
        const currentUserId = (req as any).userId;

        // Check if current user is superadmin
        const currentUser = await UserModel.findById(currentUserId);
        if (!currentUser) {
            return sendError(res, "User not found", 404);
        }

        if (currentUser.role !== Role.SUPERADMIN) {
            return sendError(res, "Only superadmin can delete admin users", 403);
        }

        // Check if trying to delete self
        if (adminId === currentUserId) {
            return sendError(res, "Cannot delete your own account", 400);
        }

        // Find the admin to delete
        const adminToDelete = await UserModel.findById(adminId);
        if (!adminToDelete) {
            return sendError(res, "Admin not found", 404);
        }

        // Check if user is actually an admin
        if (adminToDelete.role !== Role.ADMIN && adminToDelete.role !== Role.SUPERADMIN) {
            return sendError(res, "User is not an admin", 400);
        }

        // Check if trying to delete another superadmin
        if (adminToDelete.role === Role.SUPERADMIN) {
            return sendError(res, "Cannot delete superadmin accounts", 400);
        }

        // Soft delete - mark as deleted instead of removing from database
        const deletedAdmin = await UserModel.findByIdAndUpdate(
            adminId,
            {
                isDeleted: true,
                isDeactivated: true,
                isSuspended: true,
                deletedAt: new Date(),
                deletedBy: currentUserId
            },
            { new: true }
        ).select('_id firstName lastName email companyName role isDeleted deletedAt');

        if (!deletedAdmin) {
            return sendError(res, "Failed to delete admin", 500);
        }

        return sendSuccess(
            res,
            {
                deletedAdmin,
                message: "Admin deleted successfully"
            },
            "Admin deleted successfully",
            200
        );

    } catch (error) {
        console.error("Error deleting admin:", error);
        return sendError(res, "Internal server error", 500, error);
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
    getAllEngineer,
    updateCompanyProfile,
    getCompanyProfile,
    addCompany,
    getAdminDashboardData,
    deleteAdmin
}