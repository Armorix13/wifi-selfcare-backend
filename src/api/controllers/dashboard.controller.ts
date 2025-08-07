import { Request, Response, NextFunction } from 'express';
import Product from '../models/product.model';
import Order from '../models/order.model';
import { CategoryModel } from '../models/category.model';
import { UserModel } from '../models/user.model';
import { sendSuccess, sendError } from '../../utils/helper';

// Get comprehensive dashboard analytics
export const getProductDashboardAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { 
      dateRange,
      category,
      productType,
      userType,
      status
    } = req.query;

    // Build date filter
    let dateFilter = {};
    if (dateRange) {
      const [startDate, endDate] = (dateRange as string).split(',');
      if (startDate && endDate) {
        dateFilter = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        };
      }
    }

    // Get all products
    const allProducts = await Product.find()
      .populate('category', '_id name image description');

    // Get all orders
    const allOrders = await Order.find(dateFilter)
      .populate('products.product')
      .populate('user', 'firstName lastName role');

    // Calculate product analytics
    const totalProducts = allProducts.length;
    const activeProducts = allProducts.filter(p => p.isActive).length;
    const inactiveProducts = totalProducts - activeProducts;
    const inventoryValue = allProducts.reduce((sum, product) => sum + (product.price * product.stock), 0);
    const lowStockAlerts = allProducts.filter(p => p.stock < 10).length;

    // Calculate average rating
    const productsWithRating = allProducts.filter(p => p.averageRating && p.averageRating > 0);
    const averageRating = productsWithRating.length > 0 
      ? productsWithRating.reduce((sum, p) => sum + (p.averageRating || 0), 0) / productsWithRating.length 
      : 0;

    // Calculate order analytics
    const totalOrders = allOrders.length;
    const completedOrders = allOrders.filter(o => o.orderStatus === 'delivered').length;
    const pendingOrders = allOrders.filter(o => o.orderStatus === 'pending').length;
    const totalRevenue = allOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const completedRevenue = allOrders
      .filter(o => o.orderStatus === 'delivered')
      .reduce((sum, order) => sum + order.totalAmount, 0);

    // Calculate positive reviews (assuming 4+ stars is positive)
    const positiveReviews = productsWithRating.filter(p => (p.averageRating || 0) >= 4).length;
    const positiveReviewPercentage = productsWithRating.length > 0 
      ? (positiveReviews / productsWithRating.length) * 100 
      : 0;

    // Category distribution
    const categoryDistribution = await Product.aggregate([
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
      {
        $group: {
          _id: '$productType',
          count: { $sum: 1 }
        }
      }
    ]);

    // User type distribution in orders
    const userTypeDistribution = await Order.aggregate([
      { $match: dateFilter },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userData'
        }
      },
      {
        $group: {
          _id: { $arrayElemAt: ['$userData.role', 0] },
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentProducts = allProducts.filter(p => p.createdAt >= thirtyDaysAgo).length;
    const recentOrders = allOrders.filter(o => o.createdAt >= thirtyDaysAgo).length;

    // Top selling products
    const topSellingProducts = await Order.aggregate([
      { $match: dateFilter },
      { $unwind: '$products' },
      {
        $lookup: {
          from: 'products',
          localField: 'products.product',
          foreignField: '_id',
          as: 'productData'
        }
      },
      {
        $group: {
          _id: '$products.product',
          totalQuantity: { $sum: '$products.quantity' },
          totalRevenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } },
          productName: { $first: { $arrayElemAt: ['$productData.title', 0] } },
          productType: { $first: { $arrayElemAt: ['$productData.productType', 0] } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 }
    ]);

    // Order status distribution
    const orderStatusDistribution = [
      { status: 'pending', count: pendingOrders, percentage: totalOrders > 0 ? (pendingOrders / totalOrders) * 100 : 0 },
      { status: 'confirmed', count: allOrders.filter(o => o.orderStatus === 'confirmed').length, percentage: totalOrders > 0 ? (allOrders.filter(o => o.orderStatus === 'confirmed').length / totalOrders) * 100 : 0 },
      { status: 'shipped', count: allOrders.filter(o => o.orderStatus === 'shipped').length, percentage: totalOrders > 0 ? (allOrders.filter(o => o.orderStatus === 'shipped').length / totalOrders) * 100 : 0 },
      { status: 'delivered', count: completedOrders, percentage: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0 },
      { status: 'cancelled', count: allOrders.filter(o => o.orderStatus === 'cancelled').length, percentage: totalOrders > 0 ? (allOrders.filter(o => o.orderStatus === 'cancelled').length / totalOrders) * 100 : 0 }
    ];

    // Get all categories for filter dropdown
    const categories = await CategoryModel.find().select('_id name image description');

    const response = {
      // Key Metrics (Dashboard Cards)
      metrics: {
        // Product Metrics
        totalProducts,
        activeProducts,
        inactiveProducts,
        inventoryValue,
        averageRating: Math.round(averageRating * 10) / 10,
        lowStockAlerts,
        positiveReviews: Math.round(positiveReviewPercentage),
        
        // Order Metrics
        totalOrders,
        completedOrders,
        pendingOrders,
        totalRevenue,
        completedRevenue,
        averageOrderValue: totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
        
        // Recent Activity
        recentProducts,
        recentOrders
      },
      
      // Distributions
      categoryDistribution,
      productTypeDistribution,
      userTypeDistribution,
      orderStatusDistribution,
      
      // Top Performers
      topSellingProducts,
      
      // Filter Options
      filters: {
        categories,
        productTypes: [
          { value: 'user_sale', label: 'User Sale' },
          { value: 'engineer_only', label: 'Engineer Only' }
        ],
        userTypes: [
          { value: 'user', label: 'Customer' },
          { value: 'engineer', label: 'Engineer' }
        ],
        statusOptions: [
          { value: 'pending', label: 'Pending' },
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'shipped', label: 'Shipped' },
          { value: 'delivered', label: 'Delivered' },
          { value: 'cancelled', label: 'Cancelled' }
        ]
      }
    };

    return sendSuccess(res, response, 'Dashboard analytics data fetched successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to fetch dashboard analytics', 500, error);
  }
}; 