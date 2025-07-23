import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware';
import { placeOrder, getOrder, getUserOrders, updateOrderStatus, cancelOrder } from '../controllers/order.controller';

const router = Router();

router.post('/place', authenticate, placeOrder);
router.get('/:id', authenticate, getOrder);
router.get('/', authenticate, getUserOrders);
router.put('/:id/status', authenticate, updateOrderStatus); // Add admin middleware if available
router.post('/:id/cancel', authenticate, cancelOrder);

export default router; 