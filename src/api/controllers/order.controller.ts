import { Request, Response, NextFunction } from 'express';
import Order from '../models/order.model';
import Cart from '../models/cart.model';
import Product from '../models/product.model';
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
    const order = await Order.findOne({ _id: id, user: userId }).populate('products.product');
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
    const order = await Order.findOne({ _id: id, user: userId });
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
    const order = await Order.findById(id);
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