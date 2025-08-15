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

const router = express.Router();

// User requests a bill from admin
router.post('/', requestBill);

// Get all bill requests (admin view with pagination and filtering)
router.get('/', getAllBillRequests);

// Get bill request by ID
router.get('/:id', getBillRequestById);

// Get user's bill requests
router.get('/user/:userId', getUserBillRequests);

// Admin uploads bill for user (with file upload)
router.patch('/:id/upload-bill', billUpload.single('billFile'), uploadBill);

// User uploads payment proof (with file upload)
router.patch('/:id/upload-payment-proof', paymentProofUpload.single('paymentProof'), uploadPaymentProof);

// Admin marks payment as completed
router.patch('/:id/mark-completed', markPaymentCompleted);

// Admin rejects bill request
router.patch('/:id/reject', rejectBillRequest);

export default router;
