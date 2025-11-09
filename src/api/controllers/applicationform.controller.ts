import { Request, Response } from 'express';
import { ApplicationForm } from '../models/applicationform.model';
import { UserModel } from '../models/user.model';
import { OLTModel } from '../models/olt.model';
import { sendSuccess, sendError, calculateDistance } from '../../utils/helper';

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

        console.log("req.body", req.body);

        // Get userId from authenticated user (assuming it's set in auth middleware)
        const userId = (req as any).userId;
        if (!userId) {
            return sendError(res, 'User not authenticated', 401);
        }

        // Validate that at least one phone number is provided
        if (!phoneNumber && !alternatePhoneNumber) {
            return sendError(res, 'Either phone number or alternate phone number is required', 400);
        }

        // Handle case where phoneNumber is missing but alternatePhoneNumber exists
        // Use alternatePhoneNumber as phoneNumber if phoneNumber is not provided
        let finalPhoneNumber = phoneNumber;
        let finalCountryCode = countryCode;

        if (!phoneNumber && alternatePhoneNumber) {
            finalPhoneNumber = alternatePhoneNumber;
            finalCountryCode = alternateCountryCode;
        }

        // Handle case where alternatePhoneNumber is missing but phoneNumber exists
        // Use phoneNumber as alternatePhoneNumber if alternatePhoneNumber is not provided
        let finalAlternatePhoneNumber = alternatePhoneNumber;
        let finalAlternateCountryCode = alternateCountryCode;

        if (!alternatePhoneNumber && phoneNumber) {
            finalAlternatePhoneNumber = phoneNumber;
            finalAlternateCountryCode = countryCode;
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
            phoneNumber: finalPhoneNumber,
            countryCode: finalCountryCode,
            alternateCountryCode: finalAlternateCountryCode,
            alternatePhoneNumber: finalAlternatePhoneNumber,
            planId,
            pincode,
            name,
            village,
            address
        });

        await application.save();

        // Try to assign application to company, but don't let it interrupt the main flow
        try {
            await assignApplicationToCompany(userId, application._id);
            console.log('✅ Company assignment completed successfully');
        } catch (assignmentError) {
            console.error('⚠️ Company assignment failed, but application was saved:', assignmentError);
            // Continue with the response - don't let assignment failure affect application submission
        }

        return sendSuccess(res, application, 'Application submitted successfully', 201);
    } catch (error: any) {
        console.log("error", error);
        return sendError(res, 'Failed to submit application', 500, error.message || error);
    }
};

const assignApplicationToCompany = async (userId: string, applicationId: string | any) => {
    try {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Check if user has location coordinates in GeoJSON format
        // GeoJSON Point format: { type: "Point", coordinates: [longitude, latitude] }
        if (!user.location || !user.location.coordinates || user.location.coordinates.length !== 2) {
            console.log('User does not have valid location coordinates in GeoJSON format, cannot assign to company');
            return;
        }

        const userLongitude = user.location.coordinates[0]; // First element is longitude
        const userLatitude = user.location.coordinates[1];  // Second element is latitude

        // Validate coordinate ranges
        if (userLatitude < -90 || userLatitude > 90 || userLongitude < -180 || userLongitude > 180) {
            console.log('User coordinates are out of valid range (lat: -90 to 90, lng: -180 to 180)');
            return;
        }

        console.log(`Processing application assignment for user at coordinates: ${userLatitude}, ${userLongitude}`);
        console.log(`User GeoJSON location: ${JSON.stringify(user.location)}`);

        // Use MongoDB geospatial query to find OLTs within 3km first
        // This is much more efficient than checking all OLTs
        const MAX_DISTANCE_METERS = 3000; // 3km in meters for MongoDB query

        let nearbyOlts;

        try {
            // Try geospatial query first (most efficient)
            // MongoDB automatically sorts by distance when using $near
            nearbyOlts = await OLTModel.find({
                status: 'active',
                location: {
                    $near: {
                        $geometry: {
                            type: "Point",
                            coordinates: [userLongitude, userLatitude] // MongoDB uses [longitude, latitude] order
                        },
                        $maxDistance: MAX_DISTANCE_METERS
                    }
                }
            })
                .select("_id latitude longitude ownedBy location");

            console.log(`Geospatial query found ${nearbyOlts.length} OLTs within 3km range`);
        } catch (geospatialError) {
            console.log('Geospatial query failed, falling back to manual distance calculation');

            // Fallback: Get all active OLTs and filter by distance manually
            const allOlts = await OLTModel.find({
                status: 'active',
                latitude: { $exists: true, $ne: null },
                longitude: { $exists: true, $ne: null }
            }).select("_id latitude longitude ownedBy");

            // Filter OLTs within 3km manually
            nearbyOlts = allOlts.filter(olt => {
                if (olt.latitude && olt.longitude) {
                    const distance = calculateDistance(userLatitude, userLongitude, olt.latitude, olt.longitude);
                    return distance <= 3; // 3km
                }
                return false;
            });

            console.log(`Manual filtering found ${nearbyOlts.length} OLTs within 3km range`);
        }

        if (nearbyOlts.length === 0) {
            console.log('No OLTs found within 3km range');
            return;
        }

        console.log(`Found ${nearbyOlts.length} OLTs within 3km range`);

        // Now calculate exact distances only for the nearby OLTs
        // This is much more efficient as we're only processing relevant candidates
        let nearestOlt = null;
        let shortestDistance = Infinity;

        for (const olt of nearbyOlts) {
            if (olt.latitude && olt.longitude) {
                const distance = calculateDistance(
                    userLatitude,
                    userLongitude,
                    olt.latitude,
                    olt.longitude
                );

                // Find the shortest distance among the nearby OLTs
                if (distance < shortestDistance) {
                    shortestDistance = distance;
                    nearestOlt = olt;
                }
            }
        }

        if (nearestOlt) {
            // Assign the application to the nearest company within 3km
            // Update both application and user in parallel for better performance
            // This is ~2x faster than sequential updates
            await Promise.all([
                ApplicationForm.findByIdAndUpdate(applicationId, {
                    assignedCompany: nearestOlt.ownedBy
                }),
                UserModel.findByIdAndUpdate(userId, {
                    assignedCompany: nearestOlt.ownedBy
                })
            ]);
            console.log(`✅ Application assigned to company ${nearestOlt.ownedBy} at distance ${shortestDistance.toFixed(2)}km`);
            console.log(`📊 Performance: Processed ${nearbyOlts.length} OLTs to find nearest within 3km`);
        } else {
            console.log('❌ No OLT found within 3km range, application not assigned to any company');
        }
    } catch (error: any) {
        console.error('Error assigning application to company:', error.message);
    }
};

export const getApplicationById = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const application = await ApplicationForm.findById(id)
            .populate('userId', 'firstName lastName email phoneNumber countryCode profileImage role status country userName permanentAddress billingAddress balanceDue activationDate expirationDate staticIp macIp type fatherName area mode provider providerId isAccountVerified lastLogin deviceType deviceToken')
            .populate('planId')
            .populate('assignedCompany', 'companyName companyAddress companyPhone companyEmail companyWebsite companyLogo companyDescription contactPerson industry companySize companyCity companyState companyCountry');

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
        const companyId = (req as any).userId;
        const applications = await ApplicationForm.find({ assignedCompany: companyId })
            .populate('userId', 'firstName lastName email phoneNumber countryCode profileImage role status country userName permanentAddress billingAddress balanceDue activationDate expirationDate staticIp macIp type fatherName area mode provider providerId isAccountVerified lastLogin deviceType deviceToken')
            .populate('planId')
            .populate('assignedCompany', 'companyName companyAddress companyPhone companyEmail companyWebsite companyLogo companyDescription contactPerson industry companySize companyCity companyState companyCountry')
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
        ).populate('userId', 'firstName lastName email phoneNumber countryCode profileImage role status country userName permanentAddress billingAddress balanceDue activationDate expirationDate staticIp macIp type fatherName area mode provider providerId isAccountVerified lastLogin deviceType deviceToken').populate('planId').populate('assignedCompany', 'companyName companyAddress companyPhone companyEmail companyWebsite companyLogo companyDescription contactPerson industry companySize companyCity companyState companyCountry');

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