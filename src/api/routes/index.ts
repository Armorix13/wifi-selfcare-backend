import { Router } from "express";
import userRouter from "./user.route";
import complaintRouter from "./complaint.route";
import { handleMulterUpload, multerUpload } from "../services/upload.service";
const parentRouter = Router();

parentRouter.post("/file-upload", multerUpload,handleMulterUpload);
parentRouter.use("/client", userRouter);
parentRouter.use("/complaints", complaintRouter);

export default parentRouter;



