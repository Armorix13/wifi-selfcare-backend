import { Router } from 'express';
import multer from 'multer';
import { addProduct, getAllProducts, getProductById, deleteProduct, editProduct, productDashboard } from '../controllers/product.controller';
import { upload } from '../services/upload.service';
import authenticate from '../../middleware/auth.middleware';


const router = Router();

router.post('/single',authenticate, upload.single('image'), addProduct);
router.post('/',authenticate, upload.array('images', 10), addProduct);
router.get('/',authenticate, getAllProducts);
router.get('/analytics',authenticate, productDashboard);
router.get('/:id',authenticate, getProductById);
router.delete('/:id',authenticate, deleteProduct);
router.put('/:id',authenticate, upload.array('images', 10), editProduct);

export default router; 