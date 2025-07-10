import { Router } from "express";
import userRouter from "./user.route";

const parentRouter= Router();

parentRouter.use("/client",userRouter);


export default parentRouter;



