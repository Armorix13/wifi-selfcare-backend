import { Request, Response } from 'express';
import { CategoryModel } from '../models/category.model';
import { sendSuccess, sendError } from '../../utils/helper';

function extractImagePath(filePath?: string): string | undefined {
  if (!filePath) return undefined;
  const normalized = filePath.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/view/');
  return idx !== -1 ? normalized.substring(idx) : undefined;
}

// Add a new category
export const addCategory = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, description } = req.body;
    const image = extractImagePath(req.file?.path);
    if (!image) {
      return sendError(res, 'Image is required', 400);
    }
    const category = new CategoryModel({ name, description, image });
    await category.save();
    return sendSuccess(res, category, 'Category added successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to add category', 400, error);
  }
};

// Update a category by ID
export const updateCategory = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, description } = req.body;
    let updateData: any = { name, description };
    if (req.file) {
      updateData.image = extractImagePath(req.file.path);
    }
    const category = await CategoryModel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!category) {
      return sendError(res, 'Category not found', 404);
    }
    return sendSuccess(res, category, 'Category updated successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to update category', 400, error);
  }
};

// Delete a category by ID
export const deleteCategory = async (req: Request, res: Response): Promise<any> => {
  try {
    const category = await CategoryModel.findByIdAndDelete(req.params.id);
    if (!category) {
      return sendError(res, 'Category not found', 404);
    }
    return sendSuccess(res, { message: 'Category deleted successfully' });
  } catch (error: any) {
    return sendError(res, 'Failed to delete category', 400, error);
  }
};

// Get all categories
export const getAllCategories = async (_req: Request, res: Response): Promise<any> => {
  try {
    const categories = await CategoryModel.find({}, '_id name description image').sort({ name: 1 });
    return sendSuccess(res, categories, 'Categories retrieved successfully');
  } catch (error: any) {
    return sendError(res, 'Internal server error', 500, error);
  }
}; 