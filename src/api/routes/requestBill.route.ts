import express from 'express';
import {
  requestBill,
  uploadBill,
  uploadPaymentProof,
  markPaymentCompleted,
  getAllBillRequests,
  getBillRequestById,
  getUserBillRequests,
  rejectBillRequest
} from '../controllers/requestBill.controller';
import { billUpload, paymentProofUpload } from '../services/upload.service';
import authenticate from '../../middleware/auth.middleware';

const router = express.Router();

// User requests a bill from admin
router.post('/',authenticate, requestBill);

// Get all bill requests (admin view with pagination and filtering)
router.get('/',authenticate, getAllBillRequests);

// Get bill request by ID
router.get('/:id',authenticate, getBillRequestById);

// Get user's bill requests
router.get('/user/:userId',authenticate, getUserBillRequests);

// Admin uploads bill for user (with file upload)
router.patch('/:id/upload-bill',authenticate, billUpload.single('billFile'), uploadBill);

// User uploads payment proof (with file upload)
router.patch('/:id/upload-payment-proof',authenticate, paymentProofUpload.single('paymentProof'), uploadPaymentProof);

// Admin marks payment as completed
router.patch('/:id/mark-completed',authenticate, markPaymentCompleted);

// Admin rejects bill request
router.patch('/:id/reject',authenticate, rejectBillRequest);

export default router;
