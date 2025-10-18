import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware';
import { 
  addInternetProvider, 
  getActiveInternetProviders, 
  getAllInternetProviders,
  updateInternetProvider,
  deleteInternetProvider,
  toggleProviderStatus
} from '../controllers/internetProvider.controller';

const internetProviderRoute = Router();

// Add Internet Provider
internetProviderRoute.post('/add', addInternetProvider);

// Get Active Internet Providers
internetProviderRoute.get('/active', getActiveInternetProviders);

// Get All Internet Providers
internetProviderRoute.get('/all', getAllInternetProviders);

// Update Internet Provider
internetProviderRoute.put('/:providerId', updateInternetProvider);

// Delete Internet Provider
internetProviderRoute.delete('/:providerId', deleteInternetProvider);

// Toggle Provider Status
internetProviderRoute.patch('/:providerId/toggle-status', toggleProviderStatus);

export default internetProviderRoute;
