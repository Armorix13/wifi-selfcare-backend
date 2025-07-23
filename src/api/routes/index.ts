import { Router } from "express";
import userRouter from "./user.route";
import complaintRouter from "./complaint.route";
import issueTypeRouter from "./isseType.route";
import planRouter from "./plan.route";
import categoryRouter from "./category.route";
import { handleMulterUpload, multerUpload } from "../services/upload.service";
const parentRouter = Router();

parentRouter.post("/file-upload", multerUpload,handleMulterUpload);
parentRouter.use("/client", userRouter);
parentRouter.use("/complaints", complaintRouter);
parentRouter.use("/issue-types",issueTypeRouter);
parentRouter.use("/plans", planRouter);
parentRouter.use("/categories", categoryRouter);

export default parentRouter;



