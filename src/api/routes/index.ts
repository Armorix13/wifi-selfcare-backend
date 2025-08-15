import { Router } from "express";
import userRouter from "./user.route";
import complaintRouter from "./complaint.route";
import issueTypeRouter from "./isseType.route";
import planRouter from "./plan.route";
import categoryRouter from "./category.route";
import { handleMulterUpload, multerUpload } from "../services/upload.service";
import productRouter from "./product.route";
import cartRouter from "./cart.route";
import orderRouter from "./order.route";
import wifiInstallationRequestRouter from './wifiInstallationRequest.route';
import iptvInstallationRequestRouter from './iptvInstallationRequest.route';
import ottInstallationRequestRouter from './ottInstallationRequest.route';
import fibreInstallationRequestRouter from './fibreInstallationRequest.route';
import advertisementRouter from './advertisement.route';
import applicationFormRouter from './applicationform.route';
import ottPlanRouter from './ottPlan.route';
import iptvPlanRoutes from "./iptvPlan.route";
import dashboardRoute from "./dashboard.route";
import cctvRequestRouter from "./cctvRequest.route";
import wifiConnectionRouter from "./wifiConnection.route";
import faqRouter from "./faq.route";
const parentRouter = Router();

parentRouter.post("/file-upload", multerUpload,handleMulterUpload);
parentRouter.use("/client", userRouter);
parentRouter.use("/complaints", complaintRouter);
parentRouter.use("/issue-types",issueTypeRouter);
parentRouter.use("/plans", planRouter);
parentRouter.use("/categories", categoryRouter);
parentRouter.use("/products", productRouter);
parentRouter.use("/cart", cartRouter);
parentRouter.use("/orders", orderRouter);
parentRouter.use('/installation-requests', wifiInstallationRequestRouter);
parentRouter.use('/iptv-installation-requests', iptvInstallationRequestRouter);
parentRouter.use('/ott-installation-requests', ottInstallationRequestRouter);
parentRouter.use('/fibre-installation-requests', fibreInstallationRequestRouter);
parentRouter.use('/advertisements', advertisementRouter);
parentRouter.use('/ottplans',ottPlanRouter);
parentRouter.use('/applications', applicationFormRouter);
parentRouter.use('/iptvplan', iptvPlanRoutes);
parentRouter.use('/dashboard', dashboardRoute);
parentRouter.use('/cctv-requests', cctvRequestRouter);
parentRouter.use('/wifi-connections', wifiConnectionRouter);
parentRouter.use('/faqs', faqRouter);

export default parentRouter;



