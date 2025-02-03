import express from 'express';
import dogeRoutes from './dogeRoutes.js';
import scanRoutes from './scanRoutes.js';
const router = express.Router();
router.use('/doge', dogeRoutes);
router.use('/electrum', scanRoutes);

export default router;
