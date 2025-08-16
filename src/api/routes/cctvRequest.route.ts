import { Router } from "express";
import { 
  addRequest,
  getAllRequests,
  getById,
  editRequest,
  assignEngineer,
  updateStatus,
  getRequestsByUser,
  getRequestsByEngineer
} from "../controllers/cctvRequest.controller";
import authenticate from "../../middleware/auth.middleware";

const cctvRequestRouter = Router();

// Add new CCTV request
cctvRequestRouter.post("/add",authenticate, addRequest);

// Get all requests with pagination and filters
cctvRequestRouter.get("/all",authenticate, getAllRequests);

// Get request by ID
cctvRequestRouter.get("/:id",authenticate, getById);

// Edit request (basic fields only)
cctvRequestRouter.put("/:id/edit",authenticate, editRequest);

// Assign engineer to request
cctvRequestRouter.put("/:id/assign-engineer",authenticate, assignEngineer);

// Admin update status
cctvRequestRouter.put("/:id/status",authenticate, updateStatus);

// Get requests by user ID
cctvRequestRouter.get("/user/:userId",authenticate, getRequestsByUser);

// Get requests by engineer
cctvRequestRouter.get("/engineer/:engineerId",authenticate, getRequestsByEngineer);

export default cctvRequestRouter;
