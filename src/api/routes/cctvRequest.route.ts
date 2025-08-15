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

const cctvRequestRouter = Router();

// Add new CCTV request
cctvRequestRouter.post("/add", addRequest);

// Get all requests with pagination and filters
cctvRequestRouter.get("/all", getAllRequests);

// Get request by ID
cctvRequestRouter.get("/:id", getById);

// Edit request (basic fields only)
cctvRequestRouter.put("/:id/edit", editRequest);

// Assign engineer to request
cctvRequestRouter.put("/:id/assign-engineer", assignEngineer);

// Admin update status
cctvRequestRouter.put("/:id/status", updateStatus);

// Get requests by user ID
cctvRequestRouter.get("/user/:userId", getRequestsByUser);

// Get requests by engineer
cctvRequestRouter.get("/engineer/:engineerId", getRequestsByEngineer);

export default cctvRequestRouter;
