import express, { Application } from 'express';
import 'express-async-errors';
import dotenv from 'dotenv';
import cors from 'cors';
import errorHandler from './middleware/errorHandler';
import { connectDB } from './config/database';
import logger from './utils/logger';
import parentRouter from './api/routes';

dotenv.config();

const app: Application = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the /view directory
app.use('/view', express.static('view'));

// Routes
app.use("/api/v1", parentRouter);

app.use(errorHandler);

const startServer = async () => {
    try {
        await connectDB();
        app.listen(port, () => {
            logger.info(`Server running on port ${port}`);
        });
    } catch (error) {
        logger.error('Server startup error:', error);
        process.exit(1);
    }
};

startServer();

export default app;