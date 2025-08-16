import { Request, Response } from 'express';
import { WifiConnection } from '../models/wifiConnection.model';
import { UserModel } from '../models/user.model';
import { sendError, sendSuccess } from '../../utils/helper';

// Create new WiFi connection
export const createWifiConnection = async (req: Request, res: Response): Promise<any> => {
    try {
        const {
            firstName,
            lastName,
            phoneNumber,
            countryCode,
            connectionType,
            package: packageName,
            installationAddress,
            remarks,
            // Additional comprehensive fields
            email,
            alternativePhone,
            pincode,
            state,
            district,
            city,
            landmark,
            houseNumber,
            street,
            area,
            // Technical specifications
            preferredSpeed,
            preferredPlan,
            installationDate,
            preferredTimeSlot,
            // Additional requirements
            specialRequirements,
            hasExistingConnection,
            existingProvider,
            reasonForChange,
            // Emergency contact
            emergencyContactName,
            emergencyContactPhone,
            emergencyContactRelation,
            // Business details (if applicable)
            isBusinessConnection,
            businessName,
            businessType,
            gstNumber,
            // Installation preferences
            installationType,
            routerRequired,
            additionalEquipment,
            // Payment preferences
            paymentMethod,
            billingCycle,
            autoRenewal
        } = req.body;

        const userId = (req as any).userId;


        // Validate required fields
        if (!firstName || !lastName || !phoneNumber || !countryCode || !installationAddress) {
            return sendError(res, "Missing required fields", 400);
        }

        // Validate additional required fields if business connection
        if (isBusinessConnection && (!businessName || !businessType)) {
            return sendError(res, "Business name and type are required for business connections", 400);
        }

        // Check if user exists
        const userExists = await UserModel.findById(userId);
        if (!userExists) {
            return sendError(res, "User not found", 404);
        }

        // Check if user already has a pending WiFi connection request
        // const existingPendingRequest = await WifiConnection.findOne({ 
        //     userId, 
        //     status: { $in: ['inreview', 'accepted'] } 
        // });
        // if (existingPendingRequest) {
        //     return sendError(res, "You already have a pending WiFi connection request. Please wait for the current request to be processed.", 400);
        // }

        const wifiConnection = new WifiConnection({
            userId,
            firstName,
            lastName,
            phoneNumber,
            countryCode,
            connectionType: connectionType || 'fiber',
            package: packageName,
            installationAddress,
            remarks,
            status: 'inreview',
            // Additional comprehensive fields
            email,
            alternativePhone,
            pincode,
            state,
            district,
            city,
            landmark,
            houseNumber,
            street,
            area,
            // Technical specifications
            preferredSpeed,
            preferredPlan,
            installationDate,
            preferredTimeSlot,
            // Additional requirements
            specialRequirements,
            hasExistingConnection,
            existingProvider,
            reasonForChange,
            // Emergency contact
            emergencyContactName,
            emergencyContactPhone,
            emergencyContactRelation,
            // Business details
            isBusinessConnection,
            businessName,
            businessType,
            gstNumber,
            // Installation preferences
            installationType,
            routerRequired,
            additionalEquipment,
            // Payment preferences
            paymentMethod,
            billingCycle,
            autoRenewal
        });

        const savedConnection = await wifiConnection.save();

        return sendSuccess(res, savedConnection, "WiFi connection request created successfully", 201);
    } catch (error) {
        console.error('Error creating WiFi connection:', error);
        return sendError(res, 'Internal server error', 500, error instanceof Error ? error.message : 'Unknown error');
    }
};

// Get user's WiFi connection history
export const getUserWifiConnections = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).userId;
        
        if (!userId) {
            return sendError(res, 'User ID is required', 400);
        }

        const wifiConnections = await WifiConnection.find({ 
            userId, 
            isDeleted: { $ne: true } 
        })
        .populate('assignedEngineer', 'firstName lastName email phoneNumber')
        .sort({ createdAt: -1 });

        // Group connections by status for better organization
        const connectionsByStatus = {
            active: wifiConnections.filter(conn => conn.status === 'accepted' && conn.isActive),
            pending: wifiConnections.filter(conn => conn.status === 'inreview'),
            rejected: wifiConnections.filter(conn => conn.status === 'rejected'),
            completed: wifiConnections.filter(conn => conn.status === 'accepted' && !conn.isActive)
        };

        const result = {
            totalConnections: wifiConnections.length,
            connectionsByStatus,
            allConnections: wifiConnections
        };

        return sendSuccess(res, result, 'User WiFi connections retrieved successfully');
    } catch (error) {
        console.error('Error getting user WiFi connections:', error);
        return sendError(res, 'Internal server error', 500, error instanceof Error ? error.message : 'Unknown error');
    }
};

// Get WiFi connection by ID
export const getWifiConnectionById = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;

        if (!id) {
            return sendError(res, 'Connection ID is required', 400);
        }

        const wifiConnection = await WifiConnection.findOne({ _id: id, isDeleted: { $ne: true } })
            .populate('userId', 'firstName lastName email phoneNumber')
            .populate('assignedEngineer', 'firstName lastName email phoneNumber');

        if (!wifiConnection) {
            return sendError(res, 'WiFi connection not found', 404);
        }

        return sendSuccess(res, wifiConnection, 'WiFi connection retrieved successfully');
    } catch (error) {
        console.error('Error getting WiFi connection by ID:', error);
        return sendError(res, 'Internal server error', 500, error instanceof Error ? error.message : 'Unknown error');
    }
};

// Get all WiFi connections with pagination and filters
export const getAllWifiConnections = async (req: Request, res: Response): Promise<any> => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            connectionType,
            assignedEngineer,
            search
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        // Build filter object
        const filter: any = { isDeleted: { $ne: true } };

        if (status) filter.status = status;
        if (connectionType) filter.connectionType = connectionType;
        if (assignedEngineer) filter.assignedEngineer = assignedEngineer;

        if (search) {
            filter.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { phoneNumber: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { installationAddress: { $regex: search, $options: 'i' } },
                { city: { $regex: search, $options: 'i' } },
                { area: { $regex: search, $options: 'i' } },
                { businessName: { $regex: search, $options: 'i' } }
            ];
        }

        const wifiConnections = await WifiConnection.find(filter)
            .populate('userId', 'firstName lastName email phoneNumber')
            .populate('assignedEngineer', 'firstName lastName email phoneNumber')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        const total = await WifiConnection.countDocuments(filter);

        const pagination = {
            currentPage: pageNum,
            totalPages: Math.ceil(total / limitNum),
            totalItems: total,
            itemsPerPage: limitNum
        };

        return sendSuccess(res, wifiConnections, 'WiFi connections retrieved successfully', 200, pagination);
    } catch (error) {
        console.error('Error getting all WiFi connections:', error);
        return sendError(res, 'Internal server error', 500, error instanceof Error ? error.message : 'Unknown error');
    }
};

// Update WiFi connection
export const updateWifiConnection = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (!id) {
            return sendError(res, 'Connection ID is required', 400);
        }

        // Remove fields that shouldn't be updated directly
        delete updateData.userId;
        delete updateData.createdAt;
        delete updateData.updatedAt;

        const wifiConnection = await WifiConnection.findOneAndUpdate(
            { _id: id, isDeleted: { $ne: true } },
            updateData,
            { new: true, runValidators: true }
        ).populate('userId', 'firstName lastName email phoneNumber')
            .populate('assignedEngineer', 'firstName lastName email phoneNumber');

        if (!wifiConnection) {
            return sendError(res, 'WiFi connection not found', 404);
        }

        return sendSuccess(res, wifiConnection, 'WiFi connection updated successfully');
    } catch (error) {
        console.error('Error updating WiFi connection:', error);
        return sendError(res, 'Internal server error', 500, error instanceof Error ? error.message : 'Unknown error');
    }
};

// Assign engineer to WiFi connection
export const assignEngineer = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const { assignedEngineer } = req.body;

        if (!id) {
            return sendError(res, 'Connection ID is required', 400);
        }

        if (!assignedEngineer) {
            return sendError(res, 'Engineer ID is required', 400);
        }

        // Check if engineer exists and has appropriate role
        const engineer = await UserModel.findById(assignedEngineer);
        if (!engineer) {
            return sendError(res, 'Engineer not found', 404);
        }

        if (!['engineer', 'admin', 'manager'].includes(engineer.role)) {
            return sendError(res, 'User is not authorized to be assigned as engineer', 400);
        }

        const wifiConnection = await WifiConnection.findOneAndUpdate(
            { _id: id, isDeleted: { $ne: true } },
            { assignedEngineer },
            { new: true, runValidators: true }
        ).populate('userId', 'firstName lastName email phoneNumber')
            .populate('assignedEngineer', 'firstName lastName email phoneNumber');

        if (!wifiConnection) {
            return sendError(res, 'WiFi connection not found', 404);
        }

        return sendSuccess(res, wifiConnection, 'Engineer assigned successfully');
    } catch (error) {
        console.error('Error assigning engineer:', error);
        return sendError(res, 'Internal server error', 500, error instanceof Error ? error.message : 'Unknown error');
    }
};

// Update status of WiFi connection
export const updateStatus = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body;

        if (!id) {
            return sendError(res, 'Connection ID is required', 400);
        }

        if (!status || !['inreview', 'accepted', 'rejected'].includes(status)) {
            return sendError(res, 'Valid status is required: inreview, accepted, or rejected', 400);
        }

        const updateData: any = { status };

        if (remarks) {
            updateData.remarks = remarks;
        }

        // Set activation date if status is accepted
        if (status === 'accepted') {
            updateData.activationDate = new Date();
            updateData.isActive = true;
        }

        const wifiConnection = await WifiConnection.findOneAndUpdate(
            { _id: id, isDeleted: { $ne: true } },
            updateData,
            { new: true, runValidators: true }
        ).populate('userId', 'firstName lastName email phoneNumber')
            .populate('assignedEngineer', 'firstName lastName email phoneNumber');

        if (!wifiConnection) {
            return sendError(res, 'WiFi connection not found', 404);
        }

        return sendSuccess(res, wifiConnection, `Status updated to ${status} successfully`);
    } catch (error) {
        console.error('Error updating status:', error);
        return sendError(res, 'Internal server error', 500, error instanceof Error ? error.message : 'Unknown error');
    }
};

// Update remarks for WiFi connection
export const updateRemarks = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;

        if (!id) {
            return sendError(res, 'Connection ID is required', 400);
        }

        if (!remarks) {
            return sendError(res, 'Remarks are required', 400);
        }

        const wifiConnection = await WifiConnection.findOneAndUpdate(
            { _id: id, isDeleted: { $ne: true } },
            { remarks },
            { new: true, runValidators: true }
        ).populate('userId', 'firstName lastName email phoneNumber')
            .populate('assignedEngineer', 'firstName lastName email phoneNumber');

        if (!wifiConnection) {
            return sendError(res, 'WiFi connection not found', 404);
        }

        return sendSuccess(res, wifiConnection, 'Remarks updated successfully');
    } catch (error) {
        console.error('Error updating remarks:', error);
        return sendError(res, 'Internal server error', 500, error instanceof Error ? error.message : 'Unknown error');
    }
};

// Delete WiFi connection
export const deleteWifiConnection = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;

        if (!id) {
            return sendError(res, 'Connection ID is required', 400);
        }

        const wifiConnection = await WifiConnection.findOneAndUpdate(
            { _id: id, isDeleted: { $ne: true } },
            { isDeleted: true },
            { new: true, runValidators: true }
        );

        if (!wifiConnection) {
            return sendError(res, 'WiFi connection not found', 404);
        }

        return sendSuccess(res, null, 'WiFi connection deleted successfully');
    } catch (error) {
        console.error('Error deleting WiFi connection:', error);
        return sendError(res, 'Internal server error', 500, error instanceof Error ? error.message : 'Unknown error');
    }
};
