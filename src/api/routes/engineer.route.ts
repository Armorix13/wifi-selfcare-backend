import { Router } from "express";
import { engineerController } from "../controllers/engineer.controller";
import authenticate from "../../middleware/auth.middleware";

const router = Router();

// Public routes (no authentication required)
router.post("/login", engineerController.engineerLogin);

// Protected routes (authentication required)
router.get("/profile", authenticate, engineerController.getEngineerProfile);
router.put("/profile", authenticate, engineerController.updateEngineerProfile);
router.post("/logout", authenticate, engineerController.engineerLogout);

// Attendance routes
router.post("/attendance/mark", authenticate, engineerController.markAttendance);
router.post("/attendance/mark-status", authenticate, engineerController.markAttendanceWithStatus);
router.post("/attendance/checkout", authenticate, engineerController.markCheckOut);
router.get("/attendance/monthly", authenticate, engineerController.getMonthlyAttendance);
router.put("/attendance/update", authenticate, engineerController.updateAttendance);

// Leave Request routes
router.post("/leave/apply", authenticate, engineerController.applyLeave);
router.get("/leave/all", authenticate, engineerController.getAllMyLeaves);

// Leave Approval routes (for managers, agents, admins)
router.post("/leave/approve", authenticate, engineerController.approveLeaveRequest);
router.get("/leave/pending", authenticate, engineerController.getAllPendingLeaveRequests);

export default router;
