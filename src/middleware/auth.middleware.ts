import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/helper";
import { Role, UserModel } from "../api/models/user.model";

const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header is missing"
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token is missing"
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: "Token expired, please login again"
        });
      }
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: "Invalid token"
        });
      }
      return res.status(401).json({
        success: false,
        message: "Authentication failed",
        error: err.message || err
      });
    }

    if (
      !decoded ||
      typeof decoded !== 'object' ||
      !('userId' in decoded) ||
      !('role' in decoded) ||
      !('jti' in decoded)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid token"
      });
    }

    const user = await UserModel.findById(decoded.userId);
    if (!user || user.jti !== decoded.jti) {
      return res.status(401).json({
        success: false,
        message: "Invalid token, please authenticate"
      });
    }

    // Check if user has a company and if it's suspended or inactive
    if (user.assignedCompany) {
      const myCompany = await UserModel.findById(user.assignedCompany);
      if (myCompany) {
        if (myCompany.adminStatus === "inactive" || myCompany.adminStatus === "suspended") {
          return res.status(403).json({
            success: false,
            message: `Your ISP has been ${myCompany.adminStatus}`,
          });
        }
      }
    }
    // If user doesn't have a company (assignedCompany is null/undefined), continue normally

    (req as any).userId = decoded.userId;
    (req as any).role = decoded.role;

    next();
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Internal server error during authentication",
      error: error.message || error
    });
  }
};

export default authenticate;
