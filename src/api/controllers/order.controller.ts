import { Request, Response, NextFunction } from 'express';
import Order from '../models/order.model';
import Cart from '../models/cart.model';
import Product from '../models/product.model';
import { UserModel } from '../models/user.model';
import { sendSuccess, sendError } from '../../utils/helper';
import { Types } from 'mongoose';

// Place a new order from cart
export const placeOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const { deliveryAddress, paymentMethod, name, phoneNumber, countryCode, state, district, pincode } = req.body;
    if (!name || !phoneNumber || !countryCode || !state || !district || !pincode) {
      return sendError(res, 'All delivery details are required', 400);
    }
    const cart = await Cart.findOne({ user: userId }).populate('products.product');
    if (!cart || cart.products.length === 0) return sendError(res, 'Cart is empty', 400);
    let totalAmount = 0;
    const orderProducts = [];
    for (const item of cart.products) {
      const product: any = item.product;
      if (!product || !product.isActive) return sendError(res, `Product not available: ${item.product}`, 400);
      if (product.stock < item.quantity) return sendError(res, `Insufficient stock for ${product.title}`, 400);
      totalAmount += product.price * item.quantity;
      orderProducts.push({ product: product._id, quantity: item.quantity, price: product.price });
    }
    // Deduct stock
    for (const item of cart.products) {
      const product: any = item.product;
      await Product.findByIdAndUpdate(product._id, { $inc: { stock: -item.quantity } });
    }
    // Create order
    const order = await Order.create({
      user: userId,
      products: orderProducts,
      deliveryAddress,
      name,
      phoneNumber,
      countryCode,
      state,
      district,
      pincode,
      paymentMethod: paymentMethod || 'cash_on_delivery',
      orderStatus: 'pending',
      totalAmount,
    });
    // Clear cart
    cart.products = [];
    await cart.save();
    return sendSuccess(res, order, 'Order placed successfully', 201);
  } catch (err) {
    return sendError(res, 'Failed to place order', 500, err);
  }
};

// Get order by ID
export const getOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    // Try to find by orderId first, then by _id
    let order = await Order.findOne({ orderId: id, user: userId }).populate('products.product');
    if (!order) {
      order = await Order.findOne({ _id: id, user: userId }).populate('products.product');
    }
    if (!order) return sendError(res, 'Order not found', 404);
    return sendSuccess(res, order, 'Order fetched successfully');
  } catch (err) {
    return sendError(res, 'Failed to fetch order', 500, err);
  }
};

// Get all orders for user
export const getUserOrders = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 }).populate('products.product');
    return sendSuccess(res, orders, 'Orders fetched successfully');
  } catch (err) {
    return sendError(res, 'Failed to fetch orders', 500, err);
  }
};

export const cancelOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    // Try to find by orderId first, then by _id
    let order = await Order.findOne({ orderId: id, user: userId });
    if (!order) {
      order = await Order.findOne({ _id: id, user: userId });
    }
    if (!order) return sendError(res, 'Order not found', 404);
    if (order.orderStatus === 'delivered') return sendError(res, 'Cannot cancel a delivered order', 400);
    if (order.orderStatus === 'cancelled') return sendError(res, 'Order already cancelled', 400);
    // Restore stock
    for (const item of order.products) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
    }
    order.orderStatus = 'cancelled';
    await order.save();
    return sendSuccess(res, order, 'Order cancelled successfully');
  } catch (err) {
    return sendError(res, 'Failed to cancel order', 500, err);
  }
};

// Update order status (admin only)
export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    // Assume req.isAdmin is set by middleware
    if (!(req as any).isAdmin) return sendError(res, 'Unauthorized', 403);
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'];
    if (!validStatuses.includes(status)) return sendError(res, 'Invalid status', 400);
    
    // Try to find by orderId first, then by _id
    let order = await Order.findOne({ orderId: id });
    if (!order) {
      order = await Order.findById(id);
    }
    if (!order) return sendError(res, 'Order not found', 404);
    if (order.orderStatus === 'delivered') return sendError(res, 'Cannot update a delivered order', 400);
    if (order.orderStatus === 'cancelled' && status === 'cancelled') return sendError(res, 'Order already cancelled', 400);
    // If cancelling, restore stock
    if (status === 'cancelled' && order.orderStatus !== 'cancelled') {
      for (const item of order.products) {
        await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
      }
    }
    order.orderStatus = status;
    await order.save();
    return sendSuccess(res, order, `Order status updated to ${status}`);
  } catch (err) {
    return sendError(res, 'Failed to update order status', 500, err);
  }
};

// Get comprehensive order analytics
export const getOrderAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { 
      status, 
      productType, 
      userType, 
      dateRange,
      page = 1, 
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter: any = {};
    
    if (status) {
      filter.orderStatus = status;
    }
    
    if (dateRange) {
      const [startDate, endDate] = (dateRange as string).split(',');
      if (startDate && endDate) {
        filter.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
    }

    // Get all orders for analytics
    const allOrders = await Order.find(filter)
      .populate('products.product')
      .populate('user', 'firstName lastName role')
      .sort({ [sortBy as string]: sortOrder === 'desc' ? -1 : 1 });

    // Filter by product type if specified
    let filteredOrders = allOrders;
    if (productType) {
      filteredOrders = allOrders.filter(order => 
        order.products.some(item => 
          (item.product as any).productType === productType
        )
      );
    }

    // Filter by user type if specified
    if (userType) {
      filteredOrders = filteredOrders.filter(order => 
        (order.user as any).role === userType
      );
    }

    // Get paginated orders for table display
    const skip = (Number(page) - 1) * Number(limit);
    const orders = filteredOrders.slice(skip, skip + Number(limit));

    const total = filteredOrders.length;

    // Calculate analytics metrics
    const totalOrders = filteredOrders.length;
    const completedOrders = filteredOrders.filter(o => o.orderStatus === 'delivered').length;
    const pendingOrders = filteredOrders.filter(o => o.orderStatus === 'pending').length;
    const confirmedOrders = filteredOrders.filter(o => o.orderStatus === 'confirmed').length;
    const shippedOrders = filteredOrders.filter(o => o.orderStatus === 'shipped').length;
    const cancelledOrders = filteredOrders.filter(o => o.orderStatus === 'cancelled').length;

    // Calculate total revenue
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const completedRevenue = filteredOrders
      .filter(o => o.orderStatus === 'delivered')
      .reduce((sum, order) => sum + order.totalAmount, 0);

    // Calculate average order value
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Status distribution
    const statusDistribution = [
      { status: 'pending', count: pendingOrders, percentage: totalOrders > 0 ? (pendingOrders / totalOrders) * 100 : 0 },
      { status: 'confirmed', count: confirmedOrders, percentage: totalOrders > 0 ? (confirmedOrders / totalOrders) * 100 : 0 },
      { status: 'shipped', count: shippedOrders, percentage: totalOrders > 0 ? (shippedOrders / totalOrders) * 100 : 0 },
      { status: 'delivered', count: completedOrders, percentage: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0 },
      { status: 'cancelled', count: cancelledOrders, percentage: totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0 }
    ];

    // User type distribution
    const userTypeDistribution = await Order.aggregate([
      { $match: filter },
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

    // Product type distribution in orders
    const productTypeDistribution = await Order.aggregate([
      { $match: filter },
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
          _id: { $arrayElemAt: ['$productData.productType', 0] },
          count: { $sum: 1 },
          totalQuantity: { $sum: '$products.quantity' },
          totalAmount: { $sum: { $multiply: ['$products.price', '$products.quantity'] } }
        }
      }
    ]);

    // Recent orders (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentOrders = filteredOrders.filter(o => o.createdAt >= thirtyDaysAgo).length;

    // Format orders for table display
    const formattedOrders = orders.map((order:any) => {
      const user = order.user as any;
      const isEngineer = user?.role === 'engineer';
      
      return {
        _id: order._id,
        orderId: order.orderId || `ORD-${order._id.toString().slice(-6).toUpperCase()}`, // Use orderId if exists, fallback to generated
        orderNumber: order.orderId || `ORD-${order._id.toString().slice(-6).toUpperCase()}`, // Use orderId if exists, fallback to generated
        products: order.products.map((item:any) => ({
          product: item.product,
          quantity: item.quantity,
          amount: item.price * item.quantity
        })),
        customer: {
          name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          role: user?.role || 'user',
          isEngineer
        },
        totalAmount: order.totalAmount,
        orderStatus: order.orderStatus,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      };
    });

    // Priority analysis (based on order value)
    const priorityAnalysis = {
      low: filteredOrders.filter(o => o.totalAmount < 1000).length,
      medium: filteredOrders.filter(o => o.totalAmount >= 1000 && o.totalAmount < 5000).length,
      high: filteredOrders.filter(o => o.totalAmount >= 5000 && o.totalAmount < 15000).length,
      urgent: filteredOrders.filter(o => o.totalAmount >= 15000).length
    };

    const response = {
      // Analytics Overview
      analytics: {
        totalOrders,
        completedOrders,
        pendingOrders,
        totalRevenue,
        completedRevenue,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        recentOrders,
        priorityAnalysis
      },
      
      // Status Distribution
      statusDistribution,
      
      // User Type Distribution
      userTypeDistribution,
      
      // Product Type Distribution
      productTypeDistribution,
      
      // Orders Table Data
      orders: {
        data: formattedOrders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      },
      
      // Filter Options
      filters: {
        statusOptions: [
          { value: 'pending', label: 'Pending' },
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'shipped', label: 'Shipped' },
          { value: 'delivered', label: 'Delivered' },
          { value: 'cancelled', label: 'Cancelled' }
        ],
        productTypes: [
          { value: 'user_sale', label: 'User Sale' },
          { value: 'engineer_only', label: 'Engineer Only' }
        ],
        userTypes: [
          { value: 'user', label: 'Customer' },
          { value: 'engineer', label: 'Engineer' }
        ]
      }
    };

    return sendSuccess(res, response, 'Order analytics data fetched successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to fetch order analytics', 500, error);
  }
}; 