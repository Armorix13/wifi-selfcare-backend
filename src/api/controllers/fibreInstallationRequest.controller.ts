import { Request, Response } from 'express';
import { FibreInstallationRequest } from '../models/fibreInstallationRequest.model';
import { UserModel } from '../models/user.model';

// Add new fibre installation request
export const addFibreInstallationRequest = async (req: Request, res: Response): Promise<any> => {
  try {
    const { 
      name, 
      email, 
      phoneNumber, 
      countryCode, 
      fibrePlanId,
      installationAddress,
      preferredInstallationDate,
      existingInternetProvider,
      internetSpeed,
      fibreType,
      buildingType,
      floorNumber,
      roomNumber
    } = req.body;
    const userId = (req as any).userId;

    // Check if user already has a pending request
    const existingRequest = await FibreInstallationRequest.findOne({
      userId,
      status: { $in: ['inreview', 'approved'] }
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'User already has a pending or approved fibre installation request'
      });
    }

    const newRequest = new FibreInstallationRequest({
      userId,
      name,
      email,
      phoneNumber,
      countryCode,
      fibrePlanId,
      installationAddress,
      preferredInstallationDate,
      existingInternetProvider,
      internetSpeed,
      fibreType,
      buildingType,
      floorNumber,
      roomNumber,
      status: 'inreview'
    });

    const savedRequest = await newRequest.save();

    res.status(201).json({
      success: true,
      message: 'Fibre installation request created successfully',
      data: savedRequest
    });
  } catch (error) {
    console.error('Error creating fibre installation request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get all fibre installation requests
export const getAllFibreInstallationRequests = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const filter: any = {};
    if (status) {
      filter.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const requests = await FibreInstallationRequest.find(filter)
      .populate('userId', 'name email phoneNumber')
      .populate('assignedEngineer', 'name email phoneNumber')
      .populate('fibrePlanId', 'name price description')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await FibreInstallationRequest.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: 'Fibre installation requests retrieved successfully',
      data: {
        requests,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching fibre installation requests:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get fibre installation request by ID
export const getInstallRequestById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const request = await FibreInstallationRequest.findById(id)
      .populate('userId', 'name email phoneNumber countryCode')
      .populate('assignedEngineer', 'name email phoneNumber')
      .populate('fibrePlanId', 'name price description features');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Fibre installation request not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Fibre installation request retrieved successfully',
      data: request
    });
  } catch (error) {
    console.error('Error fetching fibre installation request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Assign engineer to fibre installation request
export const assignEngineer = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { engineerId } = req.body;

    // Validate engineer exists and has engineer role
    const engineer = await UserModel.findById(engineerId);
    if (!engineer || engineer.role !== 'engineer') {
      return res.status(400).json({
        success: false,
        message: 'Invalid engineer ID or user is not an engineer'
      });
    }

    const request = await FibreInstallationRequest.findByIdAndUpdate(
      id,
      { assignedEngineer: engineerId },
      { new: true }
    ).populate('assignedEngineer', 'name email phoneNumber');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Fibre installation request not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Engineer assigned successfully',
      data: request
    });
  } catch (error) {
    console.error('Error assigning engineer:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update status and remarks
export const updateStatusAndRemarks = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!['inreview', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be inreview, approved, or rejected'
      });
    }

    const updateData: any = { status, remarks };
    
    if (status === 'approved') {
      updateData.approvedDate = new Date();
    }

    const request = await FibreInstallationRequest.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('userId', 'name email phoneNumber')
     .populate('assignedEngineer', 'name email phoneNumber')
     .populate('fibrePlanId', 'name price description');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Fibre installation request not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Status and remarks updated successfully',
      data: request
    });
  } catch (error) {
    console.error('Error updating status and remarks:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Decline request and allow user to create new one
export const declineRequest = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const request = await FibreInstallationRequest.findById(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Fibre installation request not found'
      });
    }

    // Update request to declined status
    const updatedRequest = await FibreInstallationRequest.findByIdAndUpdate(
      id,
      {
        status: 'rejected',
        remarks: remarks || 'Request declined',
        approvedDate: new Date() // Using approvedDate field for decline date
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Request declined successfully. User can now create a new request.',
      data: updatedRequest
    });
  } catch (error) {
    console.error('Error declining request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get requests by user ID
export const getRequestsByUserId = async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    const filter: any = { userId };
    if (status) {
      filter.status = status;
    }

    const requests = await FibreInstallationRequest.find(filter)
      .populate('assignedEngineer', 'name email phoneNumber')
      .populate('fibrePlanId', 'name price description')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'User fibre installation requests retrieved successfully',
      data: requests
    });
  } catch (error) {
    console.error('Error fetching user requests:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update installation details
export const updateInstallationDetails = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { 
      installationAddress, 
      preferredInstallationDate, 
      existingInternetProvider, 
      internetSpeed,
      fibreType,
      buildingType,
      floorNumber,
      roomNumber
    } = req.body;

    const request = await FibreInstallationRequest.findByIdAndUpdate(
      id,
      {
        installationAddress,
        preferredInstallationDate,
        existingInternetProvider,
        internetSpeed,
        fibreType,
        buildingType,
        floorNumber,
        roomNumber
      },
      { new: true }
    ).populate('userId', 'name email phoneNumber')
     .populate('assignedEngineer', 'name email phoneNumber')
     .populate('fibrePlanId', 'name price description');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Fibre installation request not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Installation details updated successfully',
      data: request
    });
  } catch (error) {
    console.error('Error updating installation details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
