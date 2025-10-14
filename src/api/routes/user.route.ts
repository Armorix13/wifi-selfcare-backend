import { Router } from "express";
import authenticate from "../../middleware/auth.middleware";
import { userController } from "../controllers/user.controller";
import { upload, multerUpload } from "../services/upload.service";


const userRouter = Router();

// Public routes
userRouter.post("/signup", userController.signUp);
userRouter.post("/login", userController.login);
userRouter.post("/admin-login", userController.adminLogin);
userRouter.post("/social-login", userController.socialLogin);
userRouter.post("/verify-otp", userController.verifyOtp);
userRouter.post("/forgot-password", userController.forgotPassword);
userRouter.post("/reset-password", userController.resetPassword);

// Protected routes
userRouter.get("/me", authenticate, userController.getUserDetails);
userRouter.get("/details", authenticate, userController.giveUserCompanyDetails);
userRouter.patch("/me", authenticate, userController.updateUser);
userRouter.post("/logout", authenticate, userController.logout);
userRouter.get("/dashboard", authenticate, userController.dashboard);
userRouter.get("/engineers", authenticate, userController.getAllEngineer);

// Admin management routes
userRouter.get("/admin-dashboard", authenticate, userController.getAdminDashboardData);
userRouter.delete("/admin/:adminId", authenticate, userController.deleteAdmin);

// Company routes
userRouter.post("/add-company", multerUpload, userController.addCompany);
userRouter.put("/update-company/:id", multerUpload, userController.updateCompany);

// Company profile routes
userRouter.get("/company-profile", authenticate, userController.getCompanyProfile);
userRouter.patch("/company-profile", authenticate, upload.single("companyLogo"), userController.updateCompanyProfile);

export default userRouter;