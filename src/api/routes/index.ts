import express from 'express';
import userRoutes from './user.route';
import productRoutes from './product.route';
import categoryRoutes from './category.route';
import cartRoutes from './cart.route';
import orderRoutes from './order.route';
import advertisementRoutes from './advertisement.route';
import complaintRoutes from './complaint.route';
import issueTypeRoutes from './isseType.route';
import applicationFormRoutes from './applicationform.route';
import wifiInstallationRequestRoutes from './wifiInstallationRequest.route';
import planRoutes from './plan.route';
import ottPlanRoutes from './ottPlan.route';
import iptvPlanRoutes from './iptvPlan.route';

const router = express.Router();

// User routes
router.use('/user', userRoutes);

// Product routes
router.use('/product', productRoutes);

// Category routes
router.use('/category', categoryRoutes);

// Cart routes
router.use('/cart', cartRoutes);

// Order routes
router.use('/order', orderRoutes);

// Advertisement routes
router.use('/advertisement', advertisementRoutes);

// Complaint routes
router.use('/complaint', complaintRoutes);

// Issue Type routes
router.use('/issue-type', issueTypeRoutes);

// Application Form routes
router.use('/application-form', applicationFormRoutes);

// WiFi Installation Request routes
router.use('/wifi-installation-request', wifiInstallationRequestRoutes);

// Plan routes
router.use('/plan', planRoutes);

// OTT Plan routes
router.use('/ott-plan', ottPlanRoutes);

// IPTV Plan routes
router.use('/iptv-plan', iptvPlanRoutes);

export default router;



