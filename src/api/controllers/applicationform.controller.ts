import { Request, Response } from 'express';
import { ApplicationForm } from '../models/applicationform.model';
import { sendSuccess, sendError } from '../../utils/helper';

export const applyApplication = async (req: Request, res: Response): Promise<any> => {
    try {
        const {
            phoneNumber,
            countryCode,
            alternateCountryCode,
            alternatePhoneNumber,
            planId,
            pincode,
            name,
            village,
            address
        } = req.body;

        // Get userId from authenticated user (assuming it's set in auth middleware)
        const userId = (req as any).userId;
        if (!userId) {
            return sendError(res, 'User not authenticated', 401);
        }

        // Check if user already has a pending application
        const existingApplication = await ApplicationForm.findOne({
            userId,
            status: { $in: ['inreview', 'accept'] }
        });

        if (existingApplication) {
            return sendError(res, 'You already have a pending or accepted application', 400);
        }

        // Check if user has a recently rejected application (within 1 week)
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentRejectedApplication = await ApplicationForm.findOne({
            userId,
            status: 'reject',
            rejectedAt: { $gte: oneWeekAgo }
        });

        if (recentRejectedApplication && recentRejectedApplication.rejectedAt) {
            const rejectionDate = recentRejectedApplication.rejectedAt;
            const oneWeekAfterRejection = new Date(rejectionDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            const now = new Date();
            const timeDiff = oneWeekAfterRejection.getTime() - now.getTime();
            const daysRemaining = Math.ceil(timeDiff / (24 * 60 * 60 * 1000));
            
            return sendError(res, `You can apply again after ${daysRemaining} days`, 400);
        }

        const application = new ApplicationForm({
            userId,
            phoneNumber,
            countryCode,
            alternateCountryCode,
            alternatePhoneNumber,
            planId,
            pincode,
            name,
            village,
            address
        });

        await application.save();
        return sendSuccess(res, application, 'Application submitted successfully', 201);
    } catch (error: any) {
        return sendError(res, 'Failed to submit application', 500, error.message || error);
    }
};

export const getApplicationById = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const application = await ApplicationForm.findById(id)
            .populate('userId', 'firstName lastName email phoneNumber countryCode profileImage role status country userName permanentAddress billingAddress balanceDue activationDate expirationDate staticIp macIp type fatherName area mode provider providerId isAccountVerified lastLogin deviceType deviceToken')
            .populate('planId');

        if (!application) {
            return sendError(res, 'Application not found', 404);
        }

        return sendSuccess(res, application, 'Application fetched successfully');
    } catch (error: any) {
        return sendError(res, 'Failed to fetch application', 500, error.message || error);
    }
};

export const getUserApplications = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId;
        if (!userId) {
            return sendError(res, 'User not authenticated', 401);
        }

        const applications = await ApplicationForm.find({ userId })
            .populate('planId')
            .sort({ createdAt: -1 });

        return sendSuccess(res, applications, 'User applications fetched successfully');
    } catch (error: any) {
        return sendError(res, 'Failed to fetch user applications', 500, error.message || error);
    }
};

export const getAllApplications = async (req: Request, res: Response): Promise<any> => {
    try {
        const applications = await ApplicationForm.find({})
            .populate('userId', 'firstName lastName email phoneNumber countryCode profileImage role status country userName permanentAddress billingAddress balanceDue activationDate expirationDate staticIp macIp type fatherName area mode provider providerId isAccountVerified lastLogin deviceType deviceToken')
            .populate('planId')
            .sort({ createdAt: -1 });

        return sendSuccess(res, applications, 'All applications fetched successfully');
    } catch (error: any) {
        return sendError(res, 'Failed to fetch applications', 500, error.message || error);
    }
};

export const updateApplicationStatus = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['inreview', 'accept', 'reject'].includes(status)) {
            return sendError(res, 'Invalid status value', 400);
        }

        const updateData: any = { status };
        
        // Set rejectedAt timestamp when status is changed to reject
        if (status === 'reject') {
            updateData.rejectedAt = new Date();
        }

        const application = await ApplicationForm.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        ).populate('userId', 'firstName lastName email phoneNumber countryCode profileImage role status country userName permanentAddress billingAddress balanceDue activationDate expirationDate staticIp macIp type fatherName area mode provider providerId isAccountVerified lastLogin deviceType deviceToken').populate('planId');

        if (!application) {
            return sendError(res, 'Application not found', 404);
        }

        return sendSuccess(res, application, 'Application status updated successfully');
    } catch (error: any) {
        return sendError(res, 'Failed to update application status', 500, error.message || error);
    }
};

export const deleteApplication = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const application = await ApplicationForm.findByIdAndDelete(id);

        if (!application) {
            return sendError(res, 'Application not found', 404);
        }

        return sendSuccess(res, application, 'Application deleted successfully');
    } catch (error: any) {
        return sendError(res, 'Failed to delete application', 500, error.message || error);
    }
}; 