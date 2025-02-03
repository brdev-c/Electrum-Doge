import net from 'net';
import tls from 'tls';
import crypto from 'crypto';
import * as bitcoin from 'bitcoinjs-lib';
import { dogecoinNetwork } from '../services/networks.js';

const DEFAULT_HOST = 'electrum1.cipig.net';
const DEFAULT_PORT = 20060;
const DEFAULT_PROTO = 'ssl';

let electrumSocket = null;
let isConnected = false;
let currentHost = DEFAULT_HOST;
let currentPort = DEFAULT_PORT;
let currentProto = DEFAULT_PROTO;

let globalRequestId = 1; 
const pendingRequests = new Map(); 

const subscriptions = new Map();  
const scripthashMap = new Map(); 


function addressToScriptHash(dogeAddress) {
  const scriptPubKey = bitcoin.address.toOutputScript(dogeAddress, dogecoinNetwork);
  const hash = bitcoin.crypto.sha256(scriptPubKey);
  return Buffer.from(hash.reverse()).toString('hex');
}


async function initElectrumConnectionIfNeeded(host, port, proto) {
  if (
    electrumSocket &&
    isConnected &&
    host === currentHost &&
    parseInt(port, 10) === currentPort &&
    proto === currentProto
  ) {
    console.log('[initElectrumConnectionIfNeeded] Уже подключены к', currentHost, currentPort, currentProto);
    return;
  }
  if (electrumSocket) {
    try {
      electrumSocket.end();
    } catch (_) {}
    electrumSocket = null;
  }
  isConnected = false;
  currentHost = host;
  currentPort = parseInt(port, 10);
  currentProto = proto;
  console.log(`[initElectrumConnectionIfNeeded] Подключаемся к ${currentHost}:${currentPort} (${currentProto})`);

  if (proto === 'ssl') {
    electrumSocket = tls.connect(currentPort, currentHost, { rejectUnauthorized: false }, () => {
      isConnected = true;
      console.log(`[Electrum] SSL connected: ${currentHost}:${currentPort}`);
      electrumRequest('server.version', ['MyDogeClient', '1.4']).catch(err => {
        console.error('server.version error:', err);
      });
    });
    electrumSocket.on('error', (err) => {
      console.error('Electrum SSL socket error:', err);
      isConnected = false;
    });
  } else {
    electrumSocket = net.connect(currentPort, currentHost, () => {
      isConnected = true;
      console.log(`[Electrum] TCP connected: ${currentHost}:${currentPort}`);
      electrumRequest('server.version', ['MyDogeClient', '1.4']).catch(err => {
        console.error('server.version error:', err);
      });
    });
    electrumSocket.on('error', (err) => {
      console.error('Electrum TCP socket error:', err);
      isConnected = false;
    });
  }

  let buffer = '';
  electrumSocket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const parts = buffer.split('\n');
    buffer = parts.pop() || '';
    for (const line of parts) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        console.log('[Electrum DATA] Получено сообщение:', msg);
        handleElectrumMessage(msg);
      } catch (err) {
        console.warn('Failed to parse line:', line, err);
      }
    }
  });
}


function handleElectrumMessage(msg) {
  if (typeof msg.id !== 'undefined') {
    const pend = pendingRequests.get(msg.id);
    if (!pend) return;
    pendingRequests.delete(msg.id);
    if (msg.error) {
      console.error('[handleElectrumMessage] RPC-ответ с ошибкой:', msg.error);
      pend.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
    } else {
      console.log('[handleElectrumMessage] Получен RPC-ответ:', msg.result);
      pend.resolve(msg.result);
    }
    return;
  }
  if (msg.method === 'blockchain.scripthash.subscribe') {
    const [scripthash, status] = msg.params;
    const channelIds = scripthashMap.get(scripthash);
    if (!channelIds) return;
    for (const cid of channelIds) {
      const sub = subscriptions.get(cid);
      if (!sub || !sub.res) continue;
      const theAddress = sub.addresses.find(a => addressToScriptHash(a) === scripthash);
      const payload = {
        address: theAddress,
        scripthash,
        status,
        time: Date.now(),
      };
      console.log('[handleElectrumMessage] Отправляем push-сообщение SSE для канала', cid, payload);
      pushSseMessage(sub.res, payload);
    }
  }
}


function electrumRequest(method, params) {
  return new Promise((resolve, reject) => {
    if (!electrumSocket || !isConnected) {
      return reject(new Error('Electrum socket not connected'));
    }
    const msgId = globalRequestId++;
    const body = JSON.stringify({ id: msgId, method, params }) + '\n';
    console.log(`[electrumRequest] Отправляем: ${body.trim()}`);
    pendingRequests.set(msgId, { resolve, reject });
    electrumSocket.write(body);
  });
}


async function electrumCall(host, port, proto, method, params) {
  await initElectrumConnectionIfNeeded(host, port, proto);
  console.log(`[electrumCall] Метод "${method}" с параметрами:`, params);
  return electrumRequest(method, params);
}


function pushSseMessage(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
function onSseClose(res, cb) {
  res.on('close', cb);
}
function cleanupChannel(channelId) {
  const sub = subscriptions.get(channelId);
  if (!sub) return;
  for (const adr of sub.addresses) {
    const sh = addressToScriptHash(adr);
    const cidSet = scripthashMap.get(sh);
    if (cidSet) {
      cidSet.delete(channelId);
      if (cidSet.size === 0) {
        scripthashMap.delete(sh);
      }
    }
  }
  subscriptions.delete(channelId);
  console.log('[cleanupChannel] Канал удалён:', channelId);
}


function fixRawTransaction(rawHex) {
  console.log('[fixRawTransaction] Исходная rawHex:', rawHex);
  if (typeof rawHex !== 'string' || rawHex.length < 10) {
    console.warn('[fixRawTransaction] Строка слишком короткая или не строка.');
    return rawHex;
  }
  const version = rawHex.slice(0, 8);
  const varintByte = rawHex.slice(8, 10);
  console.log('[fixRawTransaction] Версия:', version, 'Следующий байт (varint):', varintByte);
  if (varintByte !== "01") {
    console.warn('[fixRawTransaction] Varint отсутствует или некорректен. Вставляем "01" после версии.');
    const fixedRaw = version + "01" + rawHex.slice(8);
    console.log('[fixRawTransaction] Исправленная rawHex:', fixedRaw);
    return fixedRaw;
  }
  console.log('[fixRawTransaction] Raw-транзакция корректна.');
  return rawHex;
}



export async function getDogeBalance(req, res) {
  try {
    let { address, host, port, proto } = req.query;
    if (!address) {
      return res.status(400).json({ error: 'address is required' });
    }
    host = host || DEFAULT_HOST;
    port = port || DEFAULT_PORT;
    proto = proto || DEFAULT_PROTO;

    const scripthash = addressToScriptHash(address);
    const balanceObj = await electrumCall(host, port, proto, 'blockchain.scripthash.get_balance', [scripthash]);
    const confirmed = (balanceObj.confirmed || 0) / 1e8;
    const unconfirmed = (balanceObj.unconfirmed || 0) / 1e8;
    console.log('[getDogeBalance] Баланс для', address, ':', { confirmed, unconfirmed });
    return res.json({ address, confirmed, unconfirmed });
  } catch (err) {
    console.error('Error getDogeBalance:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

export async function getDogeUtxos(req, res) {
  try {
    let { address, host, port, proto } = req.query;
    if (!address) {
      return res.status(400).json({ error: 'address is required' });
    }
    host = host || DEFAULT_HOST;
    port = port || DEFAULT_PORT;
    proto = proto || DEFAULT_PROTO;

    const scripthash = addressToScriptHash(address);
    const utxos = await electrumCall(host, port, proto, 'blockchain.scripthash.listunspent', [scripthash]);
    const mapped = utxos.map(u => ({
      txid: u.tx_hash,
      vout: u.tx_pos,
      value: u.value
    }));
    console.log('[getDogeUtxos] UTXOs для', address, ':', mapped);
    return res.json({ address, utxos: mapped });
  } catch (err) {
    console.error('Error getDogeUtxos:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

export async function getDogeTransactions(req, res) {
  try {
    let { address, host, port, proto } = req.query;
    if (!address) {
      return res.status(400).json({ error: 'address is required' });
    }
    host = host || DEFAULT_HOST;
    port = port || DEFAULT_PORT;
    proto = proto || DEFAULT_PROTO;

    const scripthash = addressToScriptHash(address);
    const history = await electrumCall(host, port, proto, 'blockchain.scripthash.get_history', [scripthash]);
    if (!Array.isArray(history)) {
      console.error('getDogeTransactions: history is not array', history);
      return res.json({ address, txs: [] });
    }
    const txs = history.map(h => ({
      txid: h.tx_hash,
      height: h.height,
      time: 0,
      direction: 'unknown',
      amount: 0
    }));
    console.log('[getDogeTransactions] История транзакций для', address, txs);
    return res.json({ address, txs });
  } catch (err) {
    console.error('Error getDogeTransactions:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

export async function getDogeTransactionsAll(req, res) {
  try {
    let { addresses, host, port, proto } = req.query;
    if (!addresses) {
      return res.status(400).json({ error: 'addresses is required' });
    }
    host = host || DEFAULT_HOST;
    port = port || DEFAULT_PORT;
    proto = proto || DEFAULT_PROTO;

    const addrList = addresses.split(',').map(a => a.trim()).filter(Boolean);
    if (!addrList.length) {
      return res.status(400).json({ error: 'No valid addresses' });
    }

    const headerSub = await electrumCall(host, port, proto, 'blockchain.headers.subscribe', []);
    const currentHeight = headerSub.height || 0;
    console.log('[getDogeTransactionsAll] Текущая высота:', currentHeight);

    let allRecords = [];
    for (const adr of addrList) {
      const scripthash = addressToScriptHash(adr);
      const hist = await electrumCall(host, port, proto, 'blockchain.scripthash.get_history', [scripthash]);
      if (Array.isArray(hist)) {
        for (const h of hist) {
          allRecords.push({
            address: adr,
            txid: h.tx_hash,
            height: h.height
          });
        }
      }
    }

    const rawTxCache = new Map();
    async function getRawTxCached(txid) {
      if (rawTxCache.has(txid)) return rawTxCache.get(txid);
      const raw = await electrumCall(host, port, proto, 'blockchain.transaction.get', [txid]);
      rawTxCache.set(txid, raw || '');
      return raw || '';
    }

    async function getVinAddress(vin) {
      try {
        const prevTxHex = await getRawTxCached(vin.txid);
        if (!prevTxHex) return null;
        const buf = Buffer.from(prevTxHex, 'hex');
        const decoded = bitcoin.Transaction.fromBuffer(buf);
        if (!decoded.outs[vin.vout]) return null;
        const out = decoded.outs[vin.vout];
        const outAddr = bitcoin.address.fromOutputScript(out.script, dogecoinNetwork);
        return { address: outAddr, value: out.value };
      } catch (err) {
        return null;
      }
    }

    let finalTxs = [];
    for (const rec of allRecords) {
      const { address, txid, height } = rec;
      let rawtx = await getRawTxCached(txid);
      if (!rawtx) continue;
      console.log('[getDogeTransactionsAll] До исправления rawtx для', txid, ':', rawtx);
      rawtx = fixRawTransaction(rawtx);
      console.log('[getDogeTransactionsAll] После исправления rawtx для', txid, ':', rawtx);
      let decoded;
      try {
        decoded = bitcoin.Transaction.fromBuffer(Buffer.from(rawtx, 'hex'));
      } catch (parseErr) {
        console.error('[getDogeTransactionsAll] Ошибка парсинга транзакции', txid, parseErr);
        continue;
      }
      let sumSpent = 0;
      let sumReceived = 0;

      const vinList = decoded.ins;
      const tasks = [];
      for (const vin of vinList) {
        const vinObj = {
          txid: Buffer.from(vin.hash).reverse().toString('hex'),
          vout: vin.index
        };
        tasks.push(getVinAddress(vinObj));
      }
      const resultsVin = await Promise.all(tasks);
      for (const rVin of resultsVin) {
        if (rVin && rVin.address === address) {
          sumSpent += rVin.value;
        }
      }

      for (const out of decoded.outs) {
        try {
          const outAddr = bitcoin.address.fromOutputScript(out.script, dogecoinNetwork);
          if (outAddr === address) {
            sumReceived += out.value;
          }
        } catch (e) {
        }
      }

      const net = sumReceived - sumSpent;
      if (net === 0) continue;
      const direction = net > 0 ? 'in' : 'out';
      const amount = Math.abs(net / 1e8);

      let blocktime = 0;
      if (height > 0) {
        const headerHex = await electrumCall(host, port, proto, 'blockchain.block.header', [height]);
        if (typeof headerHex === 'string' && headerHex.length >= 160) {
          const headerBuf = Buffer.from(headerHex, 'hex');
          const timestampLe = headerBuf.readUInt32LE(68);
          blocktime = timestampLe;
        }
      }
      const confirmations = height > 0 ? (currentHeight - height + 1) : 0;

      finalTxs.push({
        txid,
        time: blocktime,
        direction,
        amount,
        addressUsed: address,
        confirmations
      });
    }

    console.log('[getDogeTransactionsAll] Итоговое количество транзакций:', finalTxs.length);
    return res.json({ addresses: addrList, txs: finalTxs });
  } catch (err) {
    console.error('Error getDogeTransactionsAll:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

export async function sendDogeTransaction(req, res) {
  try {
    const { txHex } = req.body;
    if (!txHex) {
      return res.status(400).json({ error: 'txHex is required' });
    }
    let { host, port, proto } = req.query;
    host = host || DEFAULT_HOST;
    port = port || DEFAULT_PORT;
    proto = proto || DEFAULT_PROTO;

    console.log('[sendDogeTransaction] Отправка транзакции:', txHex);
    const txid = await electrumCall(host, port, proto, 'blockchain.transaction.broadcast', [txHex]);
    if (!txid || txid.length < 64) {
      console.error('[sendDogeTransaction] Ошибка при трансляции, получен неверный txid:', txid);
      return res.status(500).json({ error: 'Broadcast failed or invalid txid' });
    }
    console.log('[sendDogeTransaction] Транзакция отправлена, txid:', txid);
    return res.json({ txid });
  } catch (err) {
    console.error('Error sendDogeTransaction:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

export async function getDogeBalancesBatch(req, res) {
  try {
    let { addresses, host, port, proto } = req.query;
    if (!addresses) {
      return res.status(400).json({ error: 'addresses is required' });
    }
    host = host || DEFAULT_HOST;
    port = port || DEFAULT_PORT;
    proto = proto || DEFAULT_PROTO;

    const addrList = addresses.split(',').map(a => a.trim()).filter(Boolean);
    if (!addrList.length) {
      return res.status(400).json({ error: 'No valid addresses' });
    }

    const results = [];
    for (const adr of addrList) {
      const scripthash = addressToScriptHash(adr);
      const balanceObj = await electrumCall(host, port, proto, 'blockchain.scripthash.get_balance', [scripthash]);
      const confirmed = (balanceObj.confirmed || 0) / 1e8;
      const unconfirmed = (balanceObj.unconfirmed || 0) / 1e8;
      results.push({ address: adr, confirmed, unconfirmed });
    }
    console.log('[getDogeBalancesBatch] Балансы:', results);
    return res.json({ addresses: results });
  } catch (err) {
    console.error('Error getDogeBalancesBatch:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

export async function getDogeBalanceAll(req, res) {
  try {
    let { addresses, host, port, proto } = req.query;
    if (!addresses) {
      return res.status(400).json({ error: 'addresses is required' });
    }
    host = host || DEFAULT_HOST;
    port = port || DEFAULT_PORT;
    proto = proto || DEFAULT_PROTO;

    const addrList = addresses.split(',').map(a => a.trim()).filter(Boolean);
    if (!addrList.length) {
      return res.status(400).json({ error: 'No valid addresses' });
    }

    let totalSat = 0;
    for (const adr of addrList) {
      const scripthash = addressToScriptHash(adr);
      const bal = await electrumCall(host, port, proto, 'blockchain.scripthash.get_balance', [scripthash]);
      totalSat += (bal.confirmed || 0);
    }
    const totalConfirmed = totalSat / 1e8;
    console.log('[getDogeBalanceAll] Общий подтверждённый баланс:', totalConfirmed);
    return res.json({ totalConfirmed });
  } catch (err) {
    console.error('Error getDogeBalanceAll:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

export async function getCurrentHeight(req, res) {
  try {
    let { host, port, proto } = req.query;
    host = host || DEFAULT_HOST;
    port = port || DEFAULT_PORT;
    proto = proto || DEFAULT_PROTO;

    const result = await electrumCall(host, port, proto, 'blockchain.headers.subscribe', []);
    const height = result.height || 0;
    console.log('[getCurrentHeight] Высота блока:', height);
    return res.json({ height });
  } catch (err) {
    console.error('Error getCurrentHeight:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

export async function estimateDogeFee(req, res) {
  try {
    let { blocks, host, port, proto } = req.query;
    host = host || DEFAULT_HOST;
    port = port || DEFAULT_PORT;
    proto = proto || DEFAULT_PROTO;

    const blockCount = parseInt(blocks || '6', 10);
    const fee = await electrumCall(host, port, proto, 'blockchain.estimatefee', [blockCount]);
    console.log('[estimateDogeFee] Оценённая комиссия (feePerKb):', fee);
    return res.json({ feePerKb: fee });
  } catch (err) {
    console.error('Error estimateDogeFee:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}


export async function getRawTx(req, res) {
  try {
    let { txid, host, port, proto } = req.query;
    if (!txid) {
      return res.status(400).json({ error: 'txid is required' });
    }
    host = host || DEFAULT_HOST;
    port = port || DEFAULT_PORT;
    proto = proto || DEFAULT_PROTO;

    console.log(`[getRawTx] Запрос raw-транзакции для txid: ${txid}`);
    let rawtx = await electrumCall(host, port, proto, 'blockchain.transaction.get', [txid]);
    if (!rawtx) {
      console.error('[getRawTx] Raw-транзакция не найдена или пуста.');
      return res.status(404).json({ error: 'Tx not found or empty.' });
    }
    console.log('[getRawTx] Получена raw-транзакция до исправления:', rawtx);

    rawtx = fixRawTransaction(rawtx);

    try {
      const buf = Buffer.from(rawtx, 'hex');
      const tx = bitcoin.Transaction.fromBuffer(buf);
      console.log('[getRawTx] Транзакция успешно распарсена. Количество входов:', tx.ins.length);
    } catch (parseErr) {
      console.error('[getRawTx] Ошибка парсинга исправленной транзакции:', parseErr);
    }

    return res.json({ rawTx: rawtx });
  } catch (err) {
    console.error('Error getRawTx:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

export async function subscribeAddressesHandler(req, res) {
  try {
    let { addresses, host, port, proto } = req.body;
    if (!addresses || !Array.isArray(addresses) || !addresses.length) {
      return res.status(400).json({ error: 'addresses (array) is required' });
    }
    host = host || DEFAULT_HOST;
    port = port || DEFAULT_PORT;
    proto = proto || DEFAULT_PROTO;

    await initElectrumConnectionIfNeeded(host, port, proto);

    const channelId = crypto.randomBytes(8).toString('hex');
    subscriptions.set(channelId, { addresses, res: null });
    console.log('[subscribeAddressesHandler] Новый канал подписки создан:', channelId);

    for (const adr of addresses) {
      const sh = addressToScriptHash(adr);
      try {
        await electrumRequest('blockchain.scripthash.subscribe', [sh]);
        console.log(`[subscribeAddressesHandler] Подписка на scripthash для ${adr} (${sh}) выполнена.`);
      } catch (err) {
        console.error('Error on scripthash.subscribe for', adr, err);
      }
      if (!scripthashMap.has(sh)) {
        scripthashMap.set(sh, new Set());
      }
      scripthashMap.get(sh).add(channelId);
    }
    return res.json({ channelId });
  } catch (err) {
    console.error('subscribeAddressesHandler error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export function subscribeEventsHandler(req, res) {
  try {
    const { channelId } = req.query;
    if (!channelId) {
      return res.status(400).send('channelId is required');
    }
    const sub = subscriptions.get(channelId);
    if (!sub) {
      return res.status(404).send('Channel not found');
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    sub.res = res;
    console.log('[subscribeEventsHandler] SSE подключение установлено для канала:', channelId);

    onSseClose(res, () => {
      cleanupChannel(channelId);
    });

    pushSseMessage(res, {
      hello: 'Subscribed!',
      addresses: sub.addresses,
    });
  } catch (err) {
    console.error('subscribeEventsHandler error:', err);
    res.status(500).send(err.message);
  }
}

export default {
  getDogeBalance,
  getDogeUtxos,
  getDogeTransactions,
  getDogeTransactionsAll,
  sendDogeTransaction,
  getDogeBalancesBatch,
  getDogeBalanceAll,
  getCurrentHeight,
  estimateDogeFee,
  getRawTx,
  subscribeAddressesHandler,
  subscribeEventsHandler,
};
