import { Request, Response, NextFunction } from 'express';
import Cart from '../models/cart.model';
import Product from '../models/product.model';
import { sendSuccess, sendError } from '../../utils/helper';
import { Types } from 'mongoose';

export const addToCart = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const { productId, quantity } = req.body;
    if (!productId || !quantity || quantity < 1) {
      return sendError(res, 'Product and valid quantity required', 400);
    }
    const product = await Product.findById(productId);
    if (!product) return sendError(res, 'Product not found', 404);
    if (!product.isActive) return sendError(res, 'Product is not active', 400);
    if (product.stock < quantity) {
      return sendError(res, `Only ${product.stock} items in stock`, 400);
    }
    let cart = await Cart.findOne({ user: userId });
    const productObjectId = new Types.ObjectId(productId);
    if (!cart) {
      cart = await Cart.create({ user: userId, products: [{ product: productObjectId, quantity }] });
    } else {
      const prodIndex = cart.products.findIndex(p => p.product.toString() === productId);
      if (prodIndex > -1) {
        const newQuantity = cart.products[prodIndex].quantity + quantity;
        if (newQuantity > product.stock) {
          return sendError(res, `Cannot add more than ${product.stock} items to cart`, 400);
        }
        cart.products[prodIndex].quantity = newQuantity;
      } else {
        cart.products.push({ product: productObjectId, quantity });
      }
      await cart.save();
    }
    return sendSuccess(res, cart, 'Product added to cart', 201);
  } catch (err) {
    return sendError(res, 'Failed to add to cart', 500, err);
  }
};

export const decreaseQuantity = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const { productId } = req.body;
    if (!productId) return sendError(res, 'Product required', 400);
    const cart = await Cart.findOne({ user: userId });
    if (!cart) return sendError(res, 'Cart not found', 404);
    const prodIndex = cart.products.findIndex(p => p.product.toString() === productId);
    if (prodIndex === -1) return sendError(res, 'Product not in cart', 404);
    if (cart.products[prodIndex].quantity <= 1) {
      cart.products.splice(prodIndex, 1);
    } else {
      cart.products[prodIndex].quantity -= 1;
    }
    await cart.save();
    return sendSuccess(res, cart, 'Product quantity decreased');
  } catch (err) {
    return sendError(res, 'Failed to decrease product quantity', 500, err);
  }
};

export const removeFromCart = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const { productId } = req.body;
    if (!productId) return sendError(res, 'Product required', 400);
    const cart = await Cart.findOne({ user: userId });
    if (!cart) return sendError(res, 'Cart not found', 404);
    cart.products = cart.products.filter(p => p.product.toString() !== productId);
    await cart.save();
    return sendSuccess(res, cart, 'Product removed from cart');
  } catch (err) {
    return sendError(res, 'Failed to remove from cart', 500, err);
  }
};

export const getCart = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const cart = await Cart.findOne({ user: userId }).populate({
      path: 'products.product',
      model: 'Product',
      select: '-__v',
    });
    if (!cart) return sendSuccess(res, { products: [] }, 'Cart is empty');
    return sendSuccess(res, cart, 'Cart fetched successfully');
  } catch (err) {
    return sendError(res, 'Failed to fetch cart', 500, err);
  }
};

export const clearCart = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const cart = await Cart.findOne({ user: userId });
    if (!cart) return sendError(res, 'Cart not found', 404);
    cart.products = [];
    await cart.save();
    return sendSuccess(res, cart, 'Cart cleared');
  } catch (err) {
    return sendError(res, 'Failed to clear cart', 500, err);
  }
}; 