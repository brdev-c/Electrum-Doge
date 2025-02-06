import net from 'net'
import tls from 'tls'
import crypto from 'crypto'
import * as bitcoin from 'bitcoinjs-lib'
import { dogecoinNetwork } from '../services/networks.js'

const DEFAULT_HOST = 'electrum1.cipig.net'
const DEFAULT_PORT = 20060
const DEFAULT_PROTO = 'ssl'

let electrumSocket = null
let isConnected = false
let currentHost = DEFAULT_HOST
let currentPort = DEFAULT_PORT
let currentProto = DEFAULT_PROTO

let globalRequestId = 1
const pendingRequests = new Map()
const subscriptions = new Map()
const scripthashMap = new Map()

function addressToScriptHash(dogeAddress) {
  const scriptPubKey = bitcoin.address.toOutputScript(dogeAddress, dogecoinNetwork)
  const hash = bitcoin.crypto.sha256(scriptPubKey)
  return Buffer.from(hash.reverse()).toString('hex')
}

async function initElectrumConnectionIfNeeded(host, port, proto) {
  if (
    electrumSocket &&
    isConnected &&
    host === currentHost &&
    parseInt(port, 10) === currentPort &&
    proto === currentProto
  ) {
    return
  }
  if (electrumSocket) {
    try {
      electrumSocket.end()
    } catch (_) {}
    electrumSocket = null
  }
  isConnected = false
  currentHost = host
  currentPort = parseInt(port, 10)
  currentProto = proto
  if (proto === 'ssl') {
    electrumSocket = tls.connect(currentPort, currentHost, { rejectUnauthorized: false }, () => {
      isConnected = true
      electrumRequest('server.version', ['MyDogeClient', '1.4']).catch(() => {})
    })
    electrumSocket.on('error', () => {
      isConnected = false
    })
  } else {
    electrumSocket = net.connect(currentPort, currentHost, () => {
      isConnected = true
      electrumRequest('server.version', ['MyDogeClient', '1.4']).catch(() => {})
    })
    electrumSocket.on('error', () => {
      isConnected = false
    })
  }
  let buffer = ''
  electrumSocket.on('data', (chunk) => {
    buffer += chunk.toString('utf8')
    const parts = buffer.split('\n')
    buffer = parts.pop() || ''
    for (const line of parts) {
      if (!line.trim()) continue
      try {
        const msg = JSON.parse(line)
        handleElectrumMessage(msg)
      } catch (_) {}
    }
  })
}

function handleElectrumMessage(msg) {
  if (typeof msg.id !== 'undefined') {
    const pend = pendingRequests.get(msg.id)
    if (!pend) return
    pendingRequests.delete(msg.id)
    if (msg.error) {
      pend.reject(new Error(msg.error.message || JSON.stringify(msg.error)))
    } else {
      pend.resolve(msg.result)
    }
    return
  }
  if (msg.method === 'blockchain.scripthash.subscribe') {
    const [scripthash, status] = msg.params
    const channelIds = scripthashMap.get(scripthash)
    if (!channelIds) return
    for (const cid of channelIds) {
      const sub = subscriptions.get(cid)
      if (!sub || !sub.res) continue
      const theAddress = sub.addresses.find(a => addressToScriptHash(a) === scripthash)
      const payload = {
        address: theAddress,
        scripthash,
        status,
        time: Date.now()
      }
      pushSseMessage(sub.res, payload)
    }
  }
}

function electrumRequest(method, params) {
  return new Promise((resolve, reject) => {
    if (!electrumSocket || !isConnected) {
      return reject(new Error('Electrum socket not connected'))
    }
    const msgId = globalRequestId++
    const body = JSON.stringify({ id: msgId, method, params }) + '\n'
    pendingRequests.set(msgId, { resolve, reject })
    electrumSocket.write(body)
  })
}

async function electrumCall(host, port, proto, method, params) {
  await initElectrumConnectionIfNeeded(host, port, proto)
  return electrumRequest(method, params)
}

function pushSseMessage(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

function onSseClose(res, cb) {
  res.on('close', cb)
}

function cleanupChannel(channelId) {
  const sub = subscriptions.get(channelId)
  if (!sub) return
  for (const adr of sub.addresses) {
    const sh = addressToScriptHash(adr)
    const cidSet = scripthashMap.get(sh)
    if (cidSet) {
      cidSet.delete(channelId)
      if (cidSet.size === 0) {
        scripthashMap.delete(sh)
      }
    }
  }
  subscriptions.delete(channelId)
}

function fixRawTransaction(rawHex) {
  if (typeof rawHex !== 'string' || rawHex.length < 10) {
    return rawHex
  }
  const version = rawHex.slice(0, 8)
  const varintByte = rawHex.slice(8, 10)
  if (varintByte !== '01') {
    const fixedRaw = version + '01' + rawHex.slice(8)
    return fixedRaw
  }
  return rawHex
}

export async function getDogeBalance(req, res) {
  try {
    let { address, host, port, proto } = req.query
    if (!address) {
      return res.status(400).json({ error: 'address is required' })
    }
    host = host || DEFAULT_HOST
    port = port || DEFAULT_PORT
    proto = proto || DEFAULT_PROTO
    const scripthash = addressToScriptHash(address)
    const balanceObj = await electrumCall(host, port, proto, 'blockchain.scripthash.get_balance', [scripthash])
    const confirmed = (balanceObj.confirmed || 0) / 1e8
    const unconfirmed = (balanceObj.unconfirmed || 0) / 1e8
    return res.json({ address, confirmed, unconfirmed })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

export async function getDogeUtxos(req, res) {
  try {
    let { address, host, port, proto } = req.query
    if (!address) {
      return res.status(400).json({ error: 'address is required' })
    }
    host = host || DEFAULT_HOST
    port = port || DEFAULT_PORT
    proto = proto || DEFAULT_PROTO
    const scripthash = addressToScriptHash(address)
    const utxos = await electrumCall(host, port, proto, 'blockchain.scripthash.listunspent', [scripthash])
    const mapped = utxos.map(u => ({
      txid: u.tx_hash,
      vout: u.tx_pos,
      value: u.value
    }))
    return res.json({ address, utxos: mapped })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

export async function getDogeTransactions(req, res) {
  try {
    let { address, host, port, proto } = req.query
    if (!address) {
      return res.status(400).json({ error: 'address is required' })
    }
    host = host || DEFAULT_HOST
    port = port || DEFAULT_PORT
    proto = proto || DEFAULT_PROTO
    const scripthash = addressToScriptHash(address)
    const history = await electrumCall(host, port, proto, 'blockchain.scripthash.get_history', [scripthash])
    if (!Array.isArray(history)) {
      return res.json({ address, txs: [] })
    }
    const txs = history.map(h => ({
      txid: h.tx_hash,
      height: h.height,
      time: 0,
      direction: 'unknown',
      amount: 0
    }))
    return res.json({ address, txs })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

export async function getDogeTransactionsAll(req, res) {
  try {
    let { addresses, host, port, proto } = req.query
    if (!addresses) {
      return res.status(400).json({ error: 'addresses is required' })
    }
    host = host || DEFAULT_HOST
    port = port || DEFAULT_PORT
    proto = proto || DEFAULT_PROTO
    const addrList = addresses.split(',').map(a => a.trim()).filter(Boolean)
    if (!addrList.length) {
      return res.status(400).json({ error: 'No valid addresses' })
    }
    const headerSub = await electrumCall(host, port, proto, 'blockchain.headers.subscribe', [])
    const currentHeight = headerSub.height || 0
    let allRecords = []
    for (const adr of addrList) {
      const scripthash = addressToScriptHash(adr)
      const hist = await electrumCall(host, port, proto, 'blockchain.scripthash.get_history', [scripthash])
      if (Array.isArray(hist)) {
        for (const h of hist) {
          allRecords.push({
            address: adr,
            txid: h.tx_hash,
            height: h.height
          })
        }
      }
    }
    const rawTxCache = new Map()
    async function getRawTxCached(txid) {
      if (rawTxCache.has(txid)) return rawTxCache.get(txid)
      const raw = await electrumCall(host, port, proto, 'blockchain.transaction.get', [txid])
      rawTxCache.set(txid, raw || '')
      return raw || ''
    }
    async function getVinAddress(vin) {
      try {
        const prevTxHex = await getRawTxCached(vin.txid)
        if (!prevTxHex) return null
        const buf = Buffer.from(prevTxHex, 'hex')
        const decoded = bitcoin.Transaction.fromBuffer(buf)
        if (!decoded.outs[vin.vout]) return null
        const out = decoded.outs[vin.vout]
        const outAddr = bitcoin.address.fromOutputScript(out.script, dogecoinNetwork)
        return { address: outAddr, value: out.value }
      } catch (_) {
        return null
      }
    }
    let finalTxs = []
    for (const rec of allRecords) {
      const { address, txid, height } = rec
      let rawtx = await getRawTxCached(txid)
      if (!rawtx) continue
      rawtx = fixRawTransaction(rawtx)
      let decoded
      try {
        decoded = bitcoin.Transaction.fromBuffer(Buffer.from(rawtx, 'hex'))
      } catch (_) {
        continue
      }
      let sumSpent = 0
      let sumReceived = 0
      const vinList = decoded.ins
      const tasks = []
      for (const vin of vinList) {
        const vinObj = {
          txid: Buffer.from(vin.hash).reverse().toString('hex'),
          vout: vin.index
        }
        tasks.push(getVinAddress(vinObj))
      }
      const resultsVin = await Promise.all(tasks)
      for (const rVin of resultsVin) {
        if (rVin && rVin.address === address) {
          sumSpent += rVin.value
        }
      }
      for (const out of decoded.outs) {
        try {
          const outAddr = bitcoin.address.fromOutputScript(out.script, dogecoinNetwork)
          if (outAddr === address) {
            sumReceived += out.value
          }
        } catch (_) {}
      }
      const net = sumReceived - sumSpent
      if (net === 0) continue
      const direction = net > 0 ? 'in' : 'out'
      const amount = Math.abs(net / 1e8)
      let blocktime = 0
      if (height > 0) {
        const headerHex = await electrumCall(host, port, proto, 'blockchain.block.header', [height])
        if (typeof headerHex === 'string' && headerHex.length >= 160) {
          const headerBuf = Buffer.from(headerHex, 'hex')
          const timestampLe = headerBuf.readUInt32LE(68)
          blocktime = timestampLe
        }
      }
      const confirmations = height > 0 ? currentHeight - height + 1 : 0
      finalTxs.push({
        txid,
        time: blocktime,
        direction,
        amount,
        addressUsed: address,
        confirmations
      })
    }
    return res.json({ addresses: addrList, txs: finalTxs })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

export async function sendDogeTransaction(req, res) {
  try {
    const { txHex } = req.body
    if (!txHex) {
      return res.status(400).json({ error: 'txHex is required' })
    }
    let { host, port, proto } = req.query
    host = host || DEFAULT_HOST
    port = port || DEFAULT_PORT
    proto = proto || DEFAULT_PROTO
    const txid = await electrumCall(host, port, proto, 'blockchain.transaction.broadcast', [txHex])
    if (!txid || txid.length < 64) {
      return res.status(500).json({ error: 'Broadcast failed or invalid txid' })
    }
    return res.json({ txid })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

export async function getDogeBalancesBatch(req, res) {
  try {
    let { addresses, host, port, proto } = req.query
    if (!addresses) {
      return res.status(400).json({ error: 'addresses is required' })
    }
    host = host || DEFAULT_HOST
    port = port || DEFAULT_PORT
    proto = proto || DEFAULT_PROTO
    const addrList = addresses.split(',').map(a => a.trim()).filter(Boolean)
    if (!addrList.length) {
      return res.status(400).json({ error: 'No valid addresses' })
    }
    const results = []
    for (const adr of addrList) {
      const scripthash = addressToScriptHash(adr)
      const balanceObj = await electrumCall(host, port, proto, 'blockchain.scripthash.get_balance', [scripthash])
      const confirmed = (balanceObj.confirmed || 0) / 1e8
      const unconfirmed = (balanceObj.unconfirmed || 0) / 1e8
      results.push({ address: adr, confirmed, unconfirmed })
    }
    return res.json({ addresses: results })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

export async function getDogeBalanceAll(req, res) {
  try {
    let { addresses, host, port, proto } = req.query
    if (!addresses) {
      return res.status(400).json({ error: 'addresses is required' })
    }
    host = host || DEFAULT_HOST
    port = port || DEFAULT_PORT
    proto = proto || DEFAULT_PROTO
    const addrList = addresses.split(',').map(a => a.trim()).filter(Boolean)
    if (!addrList.length) {
      return res.status(400).json({ error: 'No valid addresses' })
    }
    let totalSat = 0
    for (const adr of addrList) {
      const scripthash = addressToScriptHash(adr)
      const bal = await electrumCall(host, port, proto, 'blockchain.scripthash.get_balance', [scripthash])
      totalSat += bal.confirmed || 0
    }
    const totalConfirmed = totalSat / 1e8
    return res.json({ totalConfirmed })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

export async function getCurrentHeight(req, res) {
  try {
    let { host, port, proto } = req.query
    host = host || DEFAULT_HOST
    port = port || DEFAULT_PORT
    proto = proto || DEFAULT_PROTO
    const result = await electrumCall(host, port, proto, 'blockchain.headers.subscribe', [])
    const height = result.height || 0
    return res.json({ height })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

export async function estimateDogeFee(req, res) {
  try {
    let { blocks, host, port, proto } = req.query
    host = host || DEFAULT_HOST
    port = port || DEFAULT_PORT
    proto = proto || DEFAULT_PROTO
    const blockCount = parseInt(blocks || '6', 10)
    const fee = await electrumCall(host, port, proto, 'blockchain.estimatefee', [blockCount])
    return res.json({ feePerKb: fee })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

export async function getRawTx(req, res) {
  try {
    let { txid, host, port, proto } = req.query
    if (!txid) {
      return res.status(400).json({ error: 'txid is required' })
    }
    host = host || DEFAULT_HOST
    port = port || DEFAULT_PORT
    proto = proto || DEFAULT_PROTO
    let rawtx = await electrumCall(host, port, proto, 'blockchain.transaction.get', [txid])
    if (!rawtx) {
      return res.status(404).json({ error: 'Tx not found or empty.' })
    }
    rawtx = fixRawTransaction(rawtx)
    try {
      bitcoin.Transaction.fromBuffer(Buffer.from(rawtx, 'hex'))
    } catch (_) {}
    return res.json({ rawTx: rawtx })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

export async function subscribeAddressesHandler(req, res) {
  try {
    let { addresses, host, port, proto } = req.body
    if (!addresses || !Array.isArray(addresses) || !addresses.length) {
      return res.status(400).json({ error: 'addresses (array) is required' })
    }
    host = host || DEFAULT_HOST
    port = port || DEFAULT_PORT
    proto = proto || DEFAULT_PROTO
    await initElectrumConnectionIfNeeded(host, port, proto)
    const channelId = crypto.randomBytes(8).toString('hex')
    subscriptions.set(channelId, { addresses, res: null })
    for (const adr of addresses) {
      const sh = addressToScriptHash(adr)
      try {
        await electrumRequest('blockchain.scripthash.subscribe', [sh])
      } catch (_) {}
      if (!scripthashMap.has(sh)) {
        scripthashMap.set(sh, new Set())
      }
      scripthashMap.get(sh).add(channelId)
    }
    return res.json({ channelId })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

export function subscribeEventsHandler(req, res) {
  try {
    const { channelId } = req.query
    if (!channelId) {
      return res.status(400).send('channelId is required')
    }
    const sub = subscriptions.get(channelId)
    if (!sub) {
      return res.status(404).send('Channel not found')
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    })
    sub.res = res
    onSseClose(res, () => {
      cleanupChannel(channelId)
    })
    pushSseMessage(res, {
      hello: 'Subscribed!',
      addresses: sub.addresses
    })
  } catch (err) {
    res.status(500).send(err.message)
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
  subscribeEventsHandler
}
