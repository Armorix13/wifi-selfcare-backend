import { Router } from 'express';
import {
  addCategory,
  updateCategory,
  deleteCategory,
  getAllCategories
} from '../controllers/category.controller';
import { multerUpload } from '../services/upload.service';

const router = Router();

// Add a new category (with image upload)
router.post('/', multerUpload, addCategory);

// Update a category by ID (with image upload)
router.put('/:id', multerUpload, updateCategory);

// Delete a category by ID
router.delete('/:id', deleteCategory);

// Get all categories
router.get('/', getAllCategories);

export default router; 