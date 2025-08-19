import express from 'express';
import { startChat } from '../controllers/chatbot.controller';

const router = express.Router();

// Single endpoint to start chat and handle all interactions
router.post('/start', startChat);

export default router;
