import { Router } from "express";
import userRouter from "./user.route";
import complaintRouter from "./complaint.route";
import complaintTypeRouter from "./complaintType.route";
import planRouter from "./plan.route";
import { handleMulterUpload, multerUpload } from "../services/upload.service";
const parentRouter = Router();

parentRouter.post("/file-upload", multerUpload,handleMulterUpload);
parentRouter.use("/client", userRouter);
parentRouter.use("/complaints", complaintRouter);
parentRouter.use("/complaint-types", complaintTypeRouter);
parentRouter.use("/plans", planRouter);

export default parentRouter;



