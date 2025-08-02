import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  addIptvPlan,
  getIptvPlanById,
  updateIptvPlan,
  deleteIptvPlan,
  getAllIptvPlans,
  getIptvPlanStats
} from '../controllers/iptvPlan.controller';

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/iptv-plans/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Routes
router.post('/add', upload.single('logo'), addIptvPlan);
router.get('/all', getAllIptvPlans);
router.get('/stats', getIptvPlanStats);
router.get('/:id', getIptvPlanById);
router.put('/:id', upload.single('logo'), updateIptvPlan);
router.delete('/:id', deleteIptvPlan);

export default router; 