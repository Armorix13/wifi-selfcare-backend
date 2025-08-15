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

const wifiConnectionRouter = express.Router();

// Create new WiFi connection
wifiConnectionRouter.post('/', createWifiConnection);

// Get WiFi connection by ID
wifiConnectionRouter.get('/:id', getWifiConnectionById);

// Get all WiFi connections with pagination and filters
wifiConnectionRouter.get('/', getAllWifiConnections);

// Update WiFi connection
wifiConnectionRouter.put('/:id', updateWifiConnection);

// Assign engineer to WiFi connection
wifiConnectionRouter.patch('/:id/assign-engineer', assignEngineer);

// Update status of WiFi connection
wifiConnectionRouter.patch('/:id/status', updateStatus);

// Update remarks for WiFi connection
wifiConnectionRouter.patch('/:id/remarks', updateRemarks);

// Delete WiFi connection
wifiConnectionRouter.delete('/:id', deleteWifiConnection);

export default wifiConnectionRouter;
