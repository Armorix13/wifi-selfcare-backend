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

export default router;
