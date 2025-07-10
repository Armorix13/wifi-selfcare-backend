
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/helper";
import { UserModel } from "../api/models/user.model";

const authenticate = async (req: Request, res: Response, next: NextFunction):Promise<any> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Authorization header is missing" });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Token is missing" });
    }
    const decoded = verifyToken(token);
    if (!decoded || typeof decoded !== 'object' || !('userId' in decoded) || !('role' in decoded) || !('jti' in decoded)) {
      return res.status(401).json({ message: "Invalid token" });
    }
    const user = await UserModel.findById(decoded.userId);
    if (!user || user.jti !== decoded.jti) {
      return res.status(401).json({ message: "Invalid token, please authenticate" });
    }
    (req as any).userId = decoded.userId;
    (req as any).role = decoded.role;
    next();
  } catch (error) {
    next(error);
  }
};

export default authenticate;
