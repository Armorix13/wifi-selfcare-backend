import { Request, Response } from 'express';
import { Advertisement } from '../models/advertisement.model';
import { sendSuccess, sendError } from '../../utils/helper';

function extractViewUrl(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const idx = normalized.indexOf('/view/');
    return idx !== -1 ? normalized.substring(idx) : normalized;
}

export const addAdvertisement = async (req: Request, res: Response): Promise<any> => {
    try {
        if (!req.file) {
            return sendError(res, 'Image is required', 400);
        }
        const imageUrl = extractViewUrl(req.file.path);
        const { title, description } = req.body;
        const ad = new Advertisement({ imageUrl, title, description });
        await ad.save();
        return sendSuccess(res, ad, 'Advertisement added successfully', 201);
    } catch (error: any) {
        return sendError(res, 'Failed to add advertisement', 500, error.message || error);
    }
};

export const updateAdvertisement = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const update: any = { ...req.body };
        if (req.file) {
            update.imageUrl = extractViewUrl(req.file.path);
        }
        const ad = await Advertisement.findByIdAndUpdate(id, update, { new: true });
        if (!ad) return sendError(res, 'Advertisement not found', 404);
        return sendSuccess(res, ad, 'Advertisement updated successfully');
    } catch (error: any) {
        return sendError(res, 'Failed to update advertisement', 500, error.message || error);
    }
};

export const deleteAdvertisement = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const ad = await Advertisement.findByIdAndDelete(id);
        if (!ad) return sendError(res, 'Advertisement not found', 404);
        return sendSuccess(res, ad, 'Advertisement deleted successfully');
    } catch (error: any) {
        return sendError(res, 'Failed to delete advertisement', 500, error.message || error);
    }
};

export const getAllAdvertisements = async (req: Request, res: Response): Promise<any> => {
  try {
    const ads = await Advertisement.find({}, '_id imageUrl title description').sort({ createdAt: -1 });
    return sendSuccess(res, ads, 'All advertisements fetched');
  } catch (error: any) {
    return sendError(res, 'Failed to fetch advertisements', 500, error.message || error);
  }
}; 