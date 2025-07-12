import { Router } from "express";
import authenticate from "../../middleware/auth.middleware";
import {
  createComplaint,
  getAllComplaints,
  getMyComplaints,
  getComplaintById,
  assignEngineer,
  updateComplaintStatus,
  deleteComplaint,
  getAssignedComplaints,
  getComplaintStats
} from "../controllers/complaint.controller";

const router = Router();

// 1. Create Complaint (User)
router.post("/", authenticate, createComplaint);

// 2. Get All Complaints (Admin / Manager)
router.get("/", authenticate, getAllComplaints);

// 3. Get Complaints of Logged-in User (with detailed info)
router.get("/my", authenticate, getMyComplaints);

// 4. Get User's Complaint Details by ID
router.get("/my/:id", authenticate, getComplaintById);

// 5. Get Complaint by ID (Admin/Engineer access)
router.get("/:id", authenticate, getComplaintById);

// 5. Assign Engineer to Complaint (Admin only)
router.put("/:id/assign", authenticate, assignEngineer);

// 6. Update Complaint Status (Engineer)
router.put("/:id/status", authenticate, updateComplaintStatus);

// 7. Delete Complaint (Admin or User)
router.delete("/:id", authenticate, deleteComplaint);

// 8. Get Complaints Assigned to Engineer
router.get("/assigned", authenticate, getAssignedComplaints);

// 9. Get Complaint Stats by Status
router.get("/stats", authenticate, getComplaintStats);

export default router; 