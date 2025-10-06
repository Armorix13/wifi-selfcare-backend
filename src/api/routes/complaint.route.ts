import { Router } from "express";
import authenticate from "../../middleware/auth.middleware";
import { upload } from "../services/upload.service";
import multer from "multer";

import {
    createComplaint,
    getAllComplaints,
    getMyComplaints,
    getComplaintById,
    assignEngineer,
    reassignComplaint,
    updateComplaintStatus,
    deleteComplaint,
    getAssignedComplaints,
    getComplaintStats,
    getDashboardData,
    getComplaintStatusHistory,
    closeComplaint,
    verifyOTP,
    addComplaintByAdmin
} from "../controllers/complaint.controller";

// Custom multer configuration for optional file uploads
const optionalFileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'view/image');
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
    }
  }),
  fileFilter: (req, file, cb) => {
    const mimeType = file.mimetype;
    const originalName = file.originalname.toLowerCase();
    const allowedImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.ico', '.svg'];
    
    if (mimeType.startsWith("image/") || 
        mimeType === "application/pdf" ||
        mimeType.startsWith("video/") ||
        mimeType.startsWith("audio/") ||
        (mimeType === "application/octet-stream" && allowedImageExtensions.some(ext => originalName.endsWith(ext)))) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 4 // Maximum 4 files
  }
});

const router = Router();

router.post("/", authenticate, createComplaint);


router.post("/admin", authenticate, optionalFileUpload.array('images', 4), addComplaintByAdmin);

router.post("/admin/json", authenticate, addComplaintByAdmin);

router.get("/", authenticate, getAllComplaints);

router.get("/my", authenticate, getMyComplaints);

router.get("/stats", authenticate, getComplaintStats);

router.get("/complaint-dashboard", authenticate, getDashboardData);

router.get("/my/:id", authenticate, getComplaintById);

router.get("/:id", authenticate, getComplaintById);

router.put("/:id/assign", authenticate, assignEngineer);

router.put("/reassign", authenticate, reassignComplaint);

router.put("/:id/status", authenticate, updateComplaintStatus);

router.put("/:id/close", authenticate, closeComplaint);

router.post("/:id/verify-otp", authenticate, verifyOTP);

router.get("/:id/status-history", authenticate, getComplaintStatusHistory);

router.delete("/:id", authenticate, deleteComplaint);

router.get("/assigned", authenticate, getAssignedComplaints);


export default router; 