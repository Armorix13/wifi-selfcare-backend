import { Router } from "express";
import authenticate from "../../middleware/auth.middleware";
import { userController } from "../controllers/user.controller";


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
userRouter.patch("/me", authenticate, userController.updateUser);
userRouter.post("/logout", authenticate, userController.logout);
userRouter.get("/dashboard", authenticate, userController.dashboard);
userRouter.get("/engineers", authenticate, userController.getAllEngineer);

export default userRouter;