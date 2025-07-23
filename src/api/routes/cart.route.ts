import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware';
import { addToCart, removeFromCart, getCart, clearCart, decreaseQuantity } from '../controllers/cart.controller';

const router = Router();

router.post('/add', authenticate, addToCart);
router.post('/remove', authenticate, removeFromCart);
router.post('/decrease', authenticate, decreaseQuantity);
router.get('/', authenticate, getCart);
router.post('/clear', authenticate, clearCart);

export default router; 