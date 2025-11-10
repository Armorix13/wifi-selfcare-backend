import express from "express";
import { 
  createLead,
  createLeadByAdmin,
  getAllLeads,
  getLeadById,
  updateLead,
  updateLeadStatus,
  updateLeadTracking,
  deleteLead,
  getLeadsByUserId,
  getLeadsByEngineerId,
  getLeadStatistics,
  getComprehensiveLeadData
} from "../controllers/leads.controller";
import { addLeadUsingWhatsapp } from "../controllers/whatsapp.controller";
import authMiddleware from "../../middleware/auth.middleware";

const router = express.Router();

// Create a new lead - NO AUTHENTICATION REQUIRED
router.post("/", createLead);

// Create lead from WhatsApp - NO AUTHENTICATION REQUIRED
router.post("/whatsapp", addLeadUsingWhatsapp);

// Apply authentication middleware to all other routes
router.use(authMiddleware);

// Create lead by admin - REQUIRES AUTHENTICATION
router.post("/admin", createLeadByAdmin);

// Get all leads with pagination, filters, and statistics (6 per page)
router.get("/", getAllLeads);

// Get comprehensive lead data (same as getAllLeads, kept for backward compatibility)
router.get("/comprehensive", getComprehensiveLeadData);

// Get lead statistics (separate endpoint for statistics only)
router.get("/statistics", getLeadStatistics);

// Get leads by user ID
router.get("/user/:userId", getLeadsByUserId);

// Get leads by engineer ID
router.get("/engineer/:engineerId", getLeadsByEngineerId);

// Get lead by ID
router.get("/:id", getLeadById);

// Update lead
router.put("/:id", updateLead);

// Update lead status
router.patch("/:id/status", updateLeadStatus);

// Update lead tracking
router.patch("/:id/tracking", updateLeadTracking);

// Delete lead
router.delete("/:id", deleteLead);

export default router;
