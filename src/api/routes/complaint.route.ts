import { Router } from "express";
import authenticate from "../../middleware/auth.middleware";
import { resolutionAttachmentUpload } from "../services/upload.service";
import multer from "multer";
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

router.put("/:id/close", authenticate, resolutionAttachmentUpload.array("resolutionAttachments", 4), closeComplaint);

// Error handling middleware for file uploads
router.use((error: any, req: any, res: any, next: any) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Maximum 4 files allowed for resolution attachments'
            });
        }
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size too large. Maximum 5MB per file'
            });
        }
        return res.status(400).json({
            success: false,
            message: 'File upload error: ' + error.message
        });
    }
    
    if (error.message && error.message.includes('Invalid file type for resolution attachment')) {
        return res.status(400).json({
            success: false,
            message: 'Only image files are allowed for resolution attachments'
        });
    }
    
    next(error);
});

router.post("/:id/verify-otp", authenticate, verifyOTP);

router.get("/:id/status-history", authenticate, getComplaintStatusHistory);

router.delete("/:id", authenticate, deleteComplaint);

router.get("/assigned", authenticate, getAssignedComplaints);


export default router; 