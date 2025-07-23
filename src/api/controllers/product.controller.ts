import { Request, Response, NextFunction } from 'express';
import Product from '../models/product.model';
import { sendSuccess, sendError } from '../../utils/helper';

export const addProduct = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { title, description, price, discount, category, stock, sku, brand, tags, attributes } = req.body;
    const images = req.files ? (req.files as Express.Multer.File[]).map(f => `/view/image/${f.filename}`) : [];
    const product = await Product.create({
      title,
      description,
      price,
      discount,
      category,
      images,
      isActive: true,
      stock,
      sku,
      brand,
      tags,
      attributes,
    });
    return sendSuccess(res, product, 'Product created successfully', 201);
  } catch (err: any) {
    return sendError(res, 'Failed to create product', 500, err);
  }
};

export const getAllProducts = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const [products, total] = await Promise.all([
      Product.find({isActive: true})
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate('category', '_id name image description'),
      Product.countDocuments({isActive: true}),
    ]);
    return sendSuccess(res, {
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    }, 'Products fetched successfully');
  } catch (err: any) {
    return sendError(res, 'Failed to fetch products', 500, err);
  }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', '_id name image description');
    if (!product) return sendError(res, 'Product not found', 404);
    return sendSuccess(res, product, 'Product fetched successfully');
  } catch (err: any) {
    return sendError(res, 'Failed to fetch product', 500, err);
  }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return sendError(res, 'Product not found', 404);
    return sendSuccess(res, {}, 'Product deleted successfully');
  } catch (err: any) {
    return sendError(res, 'Failed to delete product', 500, err);
  }
};

export const editProduct = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { title, description, price, discount, category, stock, sku, brand, tags, attributes } = req.body;
    let update: any = { title, description, price, discount, category, stock, sku, brand, tags, attributes };
    if (req.files && (req.files as Express.Multer.File[]).length > 0) {
      update.images = (req.files as Express.Multer.File[]).map(f => `/view/image/${f.filename}`);
    }
    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!product) return sendError(res, 'Product not found', 404);
    return sendSuccess(res, product, 'Product updated successfully');
  } catch (err: any) {
    return sendError(res, 'Failed to update product', 500, err);
  }
}; 