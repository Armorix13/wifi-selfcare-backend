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
    getComplaintStats,
    getDashboardData,
    getComplaintStatusHistory,
    closeComplaint,
    verifyOTP
} from "../controllers/complaint.controller";

const router = Router();

router.post("/", authenticate, createComplaint);

router.get("/", authenticate, getAllComplaints);

router.get("/my", authenticate, getMyComplaints);

router.get("/stats", authenticate, getComplaintStats);

router.get("/complaint-dashboard", authenticate, getDashboardData);

router.get("/my/:id", authenticate, getComplaintById);

router.get("/:id", authenticate, getComplaintById);

router.put("/:id/assign", authenticate, assignEngineer);

router.put("/:id/status", authenticate, updateComplaintStatus);

router.put("/:id/close", authenticate, closeComplaint);

router.post("/:id/verify-otp", authenticate, verifyOTP);

router.get("/:id/status-history", authenticate, getComplaintStatusHistory);

router.delete("/:id", authenticate, deleteComplaint);

router.get("/assigned", authenticate, getAssignedComplaints);


export default router; 