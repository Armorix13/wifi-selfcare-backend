import express from "express";
import { 
  createLead,
  getAllLeads,
  getLeadById,
  updateLead,
  updateLeadStatus,
  deleteLead,
  getLeadsByUserId,
  getLeadsByEngineerId,
  getLeadStatistics
} from "../controllers/leads.controller";
import authMiddleware from "../../middleware/auth.middleware";

const router = express.Router();

// Create a new lead
router.post("/", createLead);

// Get all leads with pagination and filters
router.get("/", getAllLeads);

// Get lead statistics
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

// Delete lead
router.delete("/:id", deleteLead);

export default router;
