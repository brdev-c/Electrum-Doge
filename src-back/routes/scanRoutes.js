import express from 'express';
import { scanDogeElectrumServers } from '../controllers/scanElectrumController.js';

const router = express.Router();
router.get('/scanServers', scanDogeElectrumServers);

export default router;
