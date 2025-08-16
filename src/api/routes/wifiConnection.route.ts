import express from 'express';
import {
    createWifiConnection,
    getWifiConnectionById,
    getAllWifiConnections,
    updateWifiConnection,
    assignEngineer,
    updateStatus,
    updateRemarks,
    deleteWifiConnection
} from '../controllers/wifiConnection.controller';
import authenticate from '../../middleware/auth.middleware';

const wifiConnectionRouter = express.Router();

// Create new WiFi connection
wifiConnectionRouter.post('/',authenticate, createWifiConnection);

// Get WiFi connection by ID
wifiConnectionRouter.get('/:id',authenticate, getWifiConnectionById);

// Get all WiFi connections with pagination and filters
wifiConnectionRouter.get('/',authenticate, getAllWifiConnections);

// Update WiFi connection
wifiConnectionRouter.put('/:id',authenticate, updateWifiConnection);

// Assign engineer to WiFi connection
wifiConnectionRouter.patch('/:id/assign-engineer',authenticate, assignEngineer);

// Update status of WiFi connection
wifiConnectionRouter.patch('/:id/status',authenticate, updateStatus);

// Update remarks for WiFi connection
wifiConnectionRouter.patch('/:id/remarks',authenticate, updateRemarks);

// Delete WiFi connection
wifiConnectionRouter.delete('/:id',authenticate, deleteWifiConnection);

export default wifiConnectionRouter;
