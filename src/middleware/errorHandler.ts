import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export default (error: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error(error.message, error);
    res.status(500).json({
        message: 'Internal Server Error',
        error: error.message,
    });
};