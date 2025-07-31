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
import installationRequestRouter from './installationRequest.route';
import advertisementRouter from './advertisement.route';
import applicationFormRouter from './applicationform.route';
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
parentRouter.use('/installation-requests', installationRequestRouter);
parentRouter.use('/advertisements', advertisementRouter);
parentRouter.use('/applications', applicationFormRouter);

export default parentRouter;



