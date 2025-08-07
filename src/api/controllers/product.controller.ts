import { Request, Response, NextFunction } from 'express';
import Product from '../models/product.model';
import { CategoryModel } from '../models/category.model';
import { sendSuccess, sendError } from '../../utils/helper';

export const addProduct = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { title, description, price, discount, category, stock, sku, brand, tags, attributes, productType } = req.body;
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
      productType: productType || 'user_sale',
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
    const { title, description, price, discount, category, stock, sku, brand, tags, attributes, productType } = req.body;
    let update: any = { title, description, price, discount, category, stock, sku, brand, tags, attributes, productType };
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


export const productDashboard = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { 
      category, 
      productType, 
      status, 
      page = 1, 
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter: any = {};
    
    if (category) {
      filter.category = category;
    }
    
    if (productType) {
      filter.productType = productType;
    }
    
    if (status !== undefined) {
      filter.isActive = status === 'active';
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }

    // Get all products for analytics (no pagination)
    const allProducts = await Product.find(filter)
      .populate('category', '_id name image description')
      .sort({ [sortBy as string]: sortOrder === 'desc' ? -1 : 1 });

    // Get paginated products for table display
    const skip = (Number(page) - 1) * Number(limit);
    const products = await Product.find(filter)
      .populate('category', '_id name image description')
      .sort({ [sortBy as string]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments(filter);

    // Calculate analytics metrics
    const totalProducts = allProducts.length;
    const activeProducts = allProducts.filter(p => p.isActive).length;
    const inactiveProducts = totalProducts - activeProducts;
    
    // Calculate inventory value
    const inventoryValue = allProducts.reduce((sum, product) => {
      return sum + (product.price * product.stock);
    }, 0);

    // Calculate average rating
    const productsWithRating = allProducts.filter(p => p.averageRating && p.averageRating > 0);
    const averageRating = productsWithRating.length > 0 
      ? productsWithRating.reduce((sum, p) => sum + (p.averageRating || 0), 0) / productsWithRating.length 
      : 0;

    // Low stock alerts (products with stock < 10)
    const lowStockProducts = allProducts.filter(p => p.stock < 10).length;

    // Category distribution
    const categoryDistribution = await Product.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryData'
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          categoryName: { $first: { $arrayElemAt: ['$categoryData.name', 0] } }
        }
      },
      {
        $project: {
          category: '$categoryName',
          count: 1,
          percentage: {
            $multiply: [
              { $divide: ['$count', totalProducts] },
              100
            ]
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Product type distribution
    const productTypeDistribution = await Product.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$productType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Stock level analysis
    const stockAnalysis = {
      outOfStock: allProducts.filter(p => p.stock === 0).length,
      lowStock: allProducts.filter(p => p.stock > 0 && p.stock < 10).length,
      inStock: allProducts.filter(p => p.stock >= 10).length
    };

    // Price range analysis
    const priceRanges = {
      low: allProducts.filter(p => p.price < 1000).length,
      medium: allProducts.filter(p => p.price >= 1000 && p.price < 5000).length,
      high: allProducts.filter(p => p.price >= 5000 && p.price < 15000).length,
      premium: allProducts.filter(p => p.price >= 15000).length
    };

    // Recent products (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentProducts = allProducts.filter(p => p.createdAt >= thirtyDaysAgo).length;

    // Format products for table display
    const formattedProducts = products.map(product => {
      const finalPrice = product.discount 
        ? Math.round((product.price * (1 - product.discount / 100)) * 100) / 100
        : product.price;
      
      return {
        _id: product._id,
        title: product.title,
        brand: product.brand,
        sku: product.sku,
        category: product.category,
        productType: product.productType,
        stock: product.stock,
        price: product.price,
        finalPrice,
        isActive: product.isActive,
        averageRating: product.averageRating,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      };
    });

    // Get all categories for filter dropdown
    const categories = await CategoryModel.find().select('_id name image description');

    const response = {
      // Analytics Overview
      analytics: {
        totalProducts,
        activeProducts,
        inactiveProducts,
        inventoryValue,
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        lowStockAlerts: lowStockProducts,
        recentProducts,
        stockAnalysis,
        priceRanges
      },
      
      // Category Distribution
      categoryDistribution,
      
      // Product Type Distribution
      productTypeDistribution,
      
      // Products Table Data
      products: {
        data: formattedProducts,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      },
      
      // Filter Options
      filters: {
        categories,
        productTypes: [
          { value: 'user_sale', label: 'User Sale' },
          { value: 'engineer_only', label: 'Engineer Only' }
        ],
        statusOptions: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' }
        ]
      }
    };

    return sendSuccess(res, response, 'Product analytics data fetched successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to fetch product analytics', 500, error);
  }
};