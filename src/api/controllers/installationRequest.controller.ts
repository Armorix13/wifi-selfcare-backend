import { Request, Response } from 'express';
import { InstallationRequest } from '../models/installationRequest.model';
import { sendSuccess, sendError } from '../../utils/helper';

export const addInstallationRequest = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;
    
    const files = req.files as {
      [fieldname: string]: Express.Multer.File[];
    };
    if (!files || !files['passportPhoto'] || !files['aadhaarFront'] || !files['aadhaarBack']) {
      return sendError(res, 'All images (passportPhoto, aadhaarFront, aadhaarBack) are required.', 400);
    }
    // Extract file URLs/paths, always starting with /view/...
    function extractViewUrl(filePath: string): string {
      const normalized = filePath.replace(/\\/g, '/');
      const idx = normalized.indexOf('/view/');
      return idx !== -1 ? normalized.substring(idx) : normalized;
    }
    const passportPhotoUrl = extractViewUrl(files['passportPhoto'][0].path);
    const aadhaarFrontUrl = extractViewUrl(files['aadhaarFront'][0].path);
    const aadhaarBackUrl = extractViewUrl(files['aadhaarBack'][0].path);

    const lastRequest = await InstallationRequest.findOne({ userId }).sort({ createdAt: -1 });
    if (lastRequest) {
      if (lastRequest.status === 'approved') {
        return sendError(res, 'Your request is approved, an engineer will visit/contact you soon.', 400);
      }
      if (lastRequest.status === 'pending') {
        return sendError(res, 'You already have a pending request.', 400);
      }
    }
    const data = req.body;
    const newRequest = new InstallationRequest({
      ...data,
      userId,
      passportPhotoUrl,
      aadhaarFrontUrl,
      aadhaarBackUrl,
      status: 'pending',
      agreementAccepted: !!data.agreementAccepted
    });
    await newRequest.save();
    return sendSuccess(res, newRequest, 'Installation request submitted successfully.', 201);
  } catch (error: any) {
    return sendError(res, 'Failed to submit installation request.', 500, error.message || error);
  }
};

export const updateInstallationRequestStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    // const userRole = (req as any).role;
    // if (!['admin', 'superadmin', 'manager'].includes(userRole)) {
    //   return sendError(res, 'Forbidden: Admins only', 403);
    // }
    const { id } = req.params;
    const { status, remarks } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return sendError(res, 'Invalid status', 400);
    }
    const update: any = { status, remarks };
    if (status === 'approved') {
      update.approvedDate = new Date();
    } else {
      update.approvedDate = null;
    }
    const updated = await InstallationRequest.findByIdAndUpdate(id, update, { new: true });
    if (!updated) {
      return sendError(res, 'Installation request not found', 404);
    }
    return sendSuccess(res, updated, `Request ${status}`);
  } catch (error: any) {
    return sendError(res, 'Failed to update request status.', 500, error.message || error);
  }
};
