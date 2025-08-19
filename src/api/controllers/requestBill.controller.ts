import { Request, Response } from 'express';
import { RequestBill } from '../models/requestBill.model';
import { UserModel } from '../models/user.model';
import path from 'path';

// User requests a bill from admin
export const requestBill = async (req: Request, res: Response): Promise<any> => {
  try {
    // const { 
    //   billType, 
    //   planId, 
    //   planName, 
    //   userRemarks 
    // } = req.body;
    
    const userId = (req as any).userId;

    // Get user details
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user already has a pending bill request of the same type
    const existingRequest = await RequestBill.findOne({
      userId,
      status: { $in: ['pending', 'bill_uploaded', 'payment_pending'] }
    });
    
    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'User already has a pending bill request for this service type'
      });
    }

    const newBillRequest = new RequestBill({
      userId,
      name: user.name || `${user.firstName} ${user.lastName}`,
      email: user.email,
      phoneNumber: user.phoneNumber,
      countryCode: user.countryCode,
      status: 'pending'
    });

    const savedRequest = await newBillRequest.save();

    res.status(201).json({
      success: true,
      message: 'Bill request submitted successfully',
      data: savedRequest
    });
  } catch (error) {
    console.error('Error creating bill request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Admin uploads bill for user
export const uploadBill = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { 
      billAmount, 
      billPeriod, 
      adminRemarks 
    } = req.body;
    const adminId = (req as any).userId;

    // Validate admin exists and has admin role
    const admin = await UserModel.findById(adminId);
    if (!admin || !['admin', 'superadmin', 'manager'].includes(admin.role)) {
      return res.status(400).json({
        success: false,
        message: 'Unauthorized: Only admins can upload bills'
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Bill file is required'
      });
    }

    // Get the proper file URL from the uploaded file path
    const absolutePath = req.file.path.replace(/\\/g, "/");
    const viewIndex = absolutePath.lastIndexOf("/view/");
    let billFileUrl = absolutePath;
    
    if (viewIndex !== -1) {
      billFileUrl = absolutePath.substring(viewIndex);
    }
    
    // Ensure it always starts with /view/
    if (!billFileUrl.startsWith("/view/")) {
      billFileUrl = `/view/${billFileUrl.split("/view/")[1]}`;
    }

    const billRequest = await RequestBill.findByIdAndUpdate(
      id,
      {
        billAmount,
        billPeriod,
        adminRemarks,
        billFileUrl,
        billUploadDate: new Date(),
        status: 'payment_pending',
        assignedAdmin: adminId
      },
      { new: true }
    ).populate('userId', 'name email phoneNumber')
     .populate('assignedAdmin', 'name email');

    if (!billRequest) {
      return res.status(404).json({
        success: false,
        message: 'Bill request not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Bill uploaded successfully',
      data: billRequest
    });
  } catch (error) {
    console.error('Error uploading bill:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// User uploads payment proof
export const uploadPaymentProof = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { userRemarks } = req.body;
    const userId = (req as any).userId;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Payment proof file is required'
      });
    }

    // Get the proper file URL from the uploaded file path
    const absolutePath = req.file.path.replace(/\\/g, "/");
    const viewIndex = absolutePath.lastIndexOf("/view/");
    let paymentProofUrl = absolutePath;
    
    if (viewIndex !== -1) {
      paymentProofUrl = absolutePath.substring(viewIndex);
    }
    
    // Ensure it always starts with /view/
    if (!paymentProofUrl.startsWith("/view/")) {
      paymentProofUrl = `/view/${paymentProofUrl.split("/view/")[1]}`;
    }

    const billRequest = await RequestBill.findById(id);
    if (!billRequest) {
      return res.status(404).json({
        success: false,
        message: 'Bill request not found'
      });
    }

    // Verify user owns this request
    if (billRequest.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only upload payment proof for your own requests'
      });
    }

    // Check if bill is ready for payment
    if (billRequest.status !== 'payment_pending') {
      return res.status(400).json({
        success: false,
        message: 'Bill is not ready for payment or payment proof already uploaded'
      });
    }

    const updatedRequest = await RequestBill.findByIdAndUpdate(
      id,
      {
        paymentProofUrl,
        paymentUploadDate: new Date(),
        status: 'payment_uploaded',
        userRemarks
      },
      { new: true }
    ).populate('userId', 'name email phoneNumber')
     .populate('assignedAdmin', 'name email');

    res.status(200).json({
      success: true,
      message: 'Payment proof uploaded successfully',
      data: updatedRequest
    });
  } catch (error) {
    console.error('Error uploading payment proof:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Admin marks payment as completed
export const markPaymentCompleted = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { adminRemarks } = req.body;
    const adminId = (req as any).userId;

    // Validate admin exists and has admin role
    const admin = await UserModel.findById(adminId);
    if (!admin || !['admin', 'superadmin', 'manager'].includes(admin.role)) {
      return res.status(400).json({
        success: false,
        message: 'Unauthorized: Only admins can mark payments as completed'
      });
    }

    const billRequest = await RequestBill.findByIdAndUpdate(
      id,
      {
        status: 'completed',
        adminRemarks: adminRemarks || 'Payment verified and completed'
      },
      { new: true }
    ).populate('userId', 'name email phoneNumber')
     .populate('assignedAdmin', 'name email');

    if (!billRequest) {
      return res.status(404).json({
        success: false,
        message: 'Bill request not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment marked as completed successfully',
      data: billRequest
    });
  } catch (error) {
    console.error('Error marking payment completed:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get all bill requests (admin view)
export const getAllBillRequests = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, billType, page = 1, limit = 10 } = req.query;
    
    const filter: any = {};
    if (status) {
      filter.status = status;
    }
    if (billType) {
      filter.billType = billType;
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const requests = await RequestBill.find(filter)
      .populate('userId', 'name email phoneNumber')
      .populate('assignedAdmin', 'name email')
      .populate('planId', 'name price description')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await RequestBill.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: 'Bill requests retrieved successfully',
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
    console.error('Error fetching bill requests:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get bill request by ID
export const getBillRequestById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const request = await RequestBill.findById(id)
      .populate('userId', 'name email phoneNumber countryCode')
      .populate('assignedAdmin', 'name email')
      .populate('planId', 'name price description features');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Bill request not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Bill request retrieved successfully',
      data: request
    });
  } catch (error) {
    console.error('Error fetching bill request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get user's bill requests
export const getUserBillRequests = async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;
    const { status, billType } = req.query;

    const filter: any = { userId };
    if (status) {
      filter.status = status;
    }
    if (billType) {
      filter.billType = billType;
    }

    const requests = await RequestBill.find(filter)
      .populate('assignedAdmin', 'name email')
      .populate('planId', 'name price description')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'User bill requests retrieved successfully',
      data: requests
    });
  } catch (error) {
    console.error('Error fetching user bill requests:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Admin rejects bill request
export const rejectBillRequest = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { adminRemarks } = req.body;
    const adminId = (req as any).userId;

    // Validate admin exists and has admin role
    const admin = await UserModel.findById(adminId);
    if (!admin || !['admin', 'superadmin', 'manager'].includes(admin.role)) {
      return res.status(400).json({
        success: false,
        message: 'Unauthorized: Only admins can reject bill requests'
      });
    }

    const billRequest = await RequestBill.findByIdAndUpdate(
      id,
      {
        status: 'rejected',
        adminRemarks: adminRemarks || 'Request rejected',
        assignedAdmin: adminId
      },
      { new: true }
    ).populate('userId', 'name email phoneNumber')
     .populate('assignedAdmin', 'name email');

    if (!billRequest) {
      return res.status(404).json({
        success: false,
        message: 'Bill request not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Bill request rejected successfully',
      data: billRequest
    });
  } catch (error) {
    console.error('Error rejecting bill request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
