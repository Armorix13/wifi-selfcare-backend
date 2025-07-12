import { Router } from "express";
import userRouter from "./user.route";
import complaintRouter from "./complaint.route";

const parentRouter = Router();

parentRouter.use("/client", userRouter);
parentRouter.use("/complaints", complaintRouter);

export default parentRouter;



