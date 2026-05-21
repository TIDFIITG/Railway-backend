import express from 'express';
import { 
      addTrainDetails, 
      getTrainDetails, 
      getAvailableCoaches,
      getActiveChainPulls,
      getChainStatusStats,
      getRecentChainStatus
} from '../controller/TrainController.js';

const trainRouter = express.Router();

// Existing Routes

// Add train/coach data (POST request)
trainRouter.post('/add-coach-data', addTrainDetails);

// Fetch train details dynamically
trainRouter.get('/get-coach-data', getTrainDetails);

// Fetch available coaches for a train
trainRouter.post('/get-coach', getAvailableCoaches);

// New Routes for Chain Alert System

// Alternative endpoint to get active chain pulls (unique per train-coach combination)
trainRouter.get('/active-chain-pulls', getActiveChainPulls);

// Get recent chain status for all trains/coaches (for dashboard)
trainRouter.get('/recent-chain-status', getRecentChainStatus);

// Get chain status statistics for dashboard
trainRouter.get('/chain-stats', getChainStatusStats);

export default trainRouter;
