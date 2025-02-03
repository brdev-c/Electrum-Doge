import express from 'express';
import dogeController from '../controllers/dogeController.js';

const router = express.Router();

router.get('/balance', dogeController.getDogeBalance);
router.get('/balanceAll', dogeController.getDogeBalanceAll);
router.get('/utxos', dogeController.getDogeUtxos);
router.get('/txs', dogeController.getDogeTransactions);
router.get('/txs-all', dogeController.getDogeTransactionsAll);
router.post('/send', dogeController.sendDogeTransaction);
router.get('/rawtx', dogeController.getRawTx);
router.get('/balancesBatch', dogeController.getDogeBalancesBatch);
router.get('/height', dogeController.getCurrentHeight);
router.get('/estimatefee', dogeController.estimateDogeFee);
router.post('/subscribeAddresses', dogeController.subscribeAddressesHandler);
router.get('/events', dogeController.subscribeEventsHandler);

export default router;
