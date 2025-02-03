import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

function parseServerParam(serverParam) {
  if (typeof serverParam === 'object' && serverParam.host) {
    return {
      host: serverParam.host,
      port: serverParam.port,
      proto: serverParam.ssl ? 'ssl' : 'tcp',
    };
  }
  if (!serverParam || serverParam === 'blockchair') {
    return { host: '', port: '', proto: '' };
  }
  const parts = serverParam.split('|');
  if (parts[0] === 'electrum' && parts.length === 4) {
    return {
      host: parts[1],
      port: parts[2],
      proto: parts[3],
    };
  }
  return { host: '', port: '', proto: '' };
}

export async function getElectrumServersFromMonitorPage() {
  const url = `${BASE_URL}/api/electrum/scanServers`;
  const resp = await axios.get(url);
  const allServers = resp.data;
  const filtered = allServers.filter((s) => s.proto === 'tcp');
  return filtered;
}

export async function getDogeBalance(address, serverParam) {
  try {
    const { host, port, proto } = parseServerParam(serverParam);
    const url =
      `${BASE_URL}/api/doge/balance?address=${address}` +
      `&host=${encodeURIComponent(host)}` +
      `&port=${encodeURIComponent(port)}` +
      `&proto=${encodeURIComponent(proto)}`;
    const resp = await axios.get(url);
    return resp.data;
  } catch (err) {
    console.error('getDogeBalance error:', err);
    throw err;
  }
}

export async function getDogeUtxos(address, serverParam) {
  try {
    const { host, port, proto } = parseServerParam(serverParam);
    const url =
      `${BASE_URL}/api/doge/utxos?address=${address}` +
      `&host=${encodeURIComponent(host)}` +
      `&port=${encodeURIComponent(port)}` +
      `&proto=${encodeURIComponent(proto)}`;
    const resp = await axios.get(url);
    return resp.data;
  } catch (err) {
    console.error('getDogeUtxos error:', err);
    throw err;
  }
}

export async function getDogeBalanceAll(addrArray, serverParam) {
  try {
    const joined = addrArray.join(',');
    const { host, port, proto } = parseServerParam(serverParam);
    const url =
      `${BASE_URL}/api/doge/balanceAll?addresses=${joined}` +
      `&host=${encodeURIComponent(host)}` +
      `&port=${encodeURIComponent(port)}` +
      `&proto=${encodeURIComponent(proto)}`;
    const resp = await axios.get(url);
    return resp.data;
  } catch (err) {
    console.error('getDogeBalanceAll error:', err);
    throw err;
  }
}

export async function getDogeTransactions(address, serverParam) {
  try {
    const { host, port, proto } = parseServerParam(serverParam);
    const url =
      `${BASE_URL}/api/doge/txs?address=${address}` +
      `&host=${encodeURIComponent(host)}` +
      `&port=${encodeURIComponent(port)}` +
      `&proto=${encodeURIComponent(proto)}`;
    const resp = await axios.get(url);
    return resp.data;
  } catch (err) {
    console.error('getDogeTransactions error:', err);
    throw err;
  }
}

export async function getDogeTransactionsAll(addrArray, serverParam) {
  try {
    const joined = addrArray.join(',');
    const { host, port, proto } = parseServerParam(serverParam);
    const url =
      `${BASE_URL}/api/doge/txs-all?addresses=${joined}` +
      `&host=${encodeURIComponent(host)}` +
      `&port=${encodeURIComponent(port)}` +
      `&proto=${encodeURIComponent(proto)}`;
    const resp = await axios.get(url);
    return resp.data;
  } catch (err) {
    console.error('getDogeTransactionsAll error:', err);
    throw err;
  }
}

export async function sendDogeTransaction(txHex, serverParam) {
  try {
    const { host, port, proto } = parseServerParam(serverParam);
    const url =
      `${BASE_URL}/api/doge/send` +
      `?host=${encodeURIComponent(host)}` +
      `&port=${encodeURIComponent(port)}` +
      `&proto=${encodeURIComponent(proto)}`;
    const resp = await axios.post(url, { txHex });
    return resp.data;
  } catch (err) {
    console.error('sendDogeTransaction error:', err);
    throw err;
  }
}

export async function pingNetwork() {
  try {
    const url = `${BASE_URL}/ping`;
    await axios.get(url);
    return true;
  } catch (err) {
    console.error('pingNetwork error:', err);
    return false;
  }
}

export async function getBalancesBatch(addrArray, serverParam) {
  try {
    const joined = addrArray.join(',');
    const { host, port, proto } = parseServerParam(serverParam);
    const url =
      `${BASE_URL}/api/doge/balancesBatch?addresses=${joined}` +
      `&host=${encodeURIComponent(host)}` +
      `&port=${encodeURIComponent(port)}` +
      `&proto=${encodeURIComponent(proto)}`;
    const resp = await axios.get(url);
    return resp.data;
  } catch (err) {
    console.error('getBalancesBatch error:', err);
    throw err;
  }
}

export async function getDogePriceInFiat(fiatSym) {
  try {
    const symLower = fiatSym.toLowerCase();
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=dogecoin&vs_currencies=${symLower}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Coingecko error. Status=${resp.status}`);
    }
    const data = await resp.json();
    return data?.dogecoin?.[symLower] || 0;
  } catch (err) {
    console.error('getDogePriceInFiat error:', err);
    return 0;
  }
}

export async function fetchDogeMarketChart(days, fiatSym = 'usd') {
  try {
    const symLower = fiatSym.toLowerCase();
    const url = `https://api.coingecko.com/api/v3/coins/dogecoin/market_chart?vs_currency=${symLower}&days=${days}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Coingecko chart fetch failed, status=${resp.status}`);
    }
    const data = await resp.json();
    if (!Array.isArray(data.prices)) {
      return [];
    }
    return data.prices;
  } catch (err) {
    console.error('fetchDogeMarketChart error:', err);
    return [];
  }
}

export async function getDogeHeight(serverParam) {
  try {
    const { host, port, proto } = parseServerParam(serverParam);
    const url =
      `${BASE_URL}/api/doge/height` +
      `?host=${encodeURIComponent(host)}` +
      `&port=${encodeURIComponent(port)}` +
      `&proto=${encodeURIComponent(proto)}`;
    const resp = await axios.get(url);
    return resp.data.height;
  } catch (err) {
    console.error('getDogeHeight error:', err);
    throw err;
  }
}

export async function estimateDogeFee(blocks, serverParam) {
  try {
    const { host, port, proto } = parseServerParam(serverParam);
    const url =
      `${BASE_URL}/api/doge/estimatefee` +
      `?blocks=${encodeURIComponent(blocks)}` +
      `&host=${encodeURIComponent(host)}` +
      `&port=${encodeURIComponent(port)}` +
      `&proto=${encodeURIComponent(proto)}`;
    const resp = await axios.get(url);
    return resp.data.feePerKb;
  } catch (err) {
    console.error('estimateDogeFee error:', err);
    throw err;
  }
}

export async function getRawTx(txid, serverParam) {
  try {
    const { host, port, proto } = parseServerParam(serverParam);
    const url =
      `${BASE_URL}/api/doge/rawtx?txid=${encodeURIComponent(txid)}` +
      `&host=${encodeURIComponent(host)}` +
      `&port=${encodeURIComponent(port)}` +
      `&proto=${encodeURIComponent(proto)}`;
    const resp = await axios.get(url);
    return resp.data.rawTx;
  } catch (err) {
    console.error('getRawTx error:', err);
    throw err;
  }
}

export async function getUtxosWithRawTx(addresses, serverParam) {
  const all = [];
  for (let addr of addresses) {
    const { utxos } = await getDogeUtxos(addr, serverParam);
    if (utxos && utxos.length) {
      utxos.forEach(u => {
        all.push({
          txid: u.txid,
          vout: u.vout,
          value: u.value,
          address: addr
        });
      });
    }
  }

  for (let i = 0; i < all.length; i++) {
    const rawTxString = await getRawTx(all[i].txid, serverParam);
    all[i].rawTxHex = rawTxString;
  }

  return all;
}

export function subscribeAddresses(serverParam, addressArray, onUpdate) {
  let eventSource = null;
  let isStopped = false;

  (async () => {
    try {
      const { host, port, proto } = parseServerParam(serverParam);
      const url = `${BASE_URL}/api/doge/subscribeAddresses`;
      const resp = await axios.post(url, {
        addresses: addressArray,
        host,
        port,
        proto,
      });
      const { channelId } = resp.data;
      if (!channelId) {
        console.error('No channelId returned from subscribeAddresses');
        return;
      }
      if (isStopped) return;
      const eventsUrl = `${BASE_URL}/api/doge/events?channelId=${encodeURIComponent(channelId)}`;
      eventSource = new EventSource(eventsUrl);
      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (onUpdate) onUpdate(data);
        } catch (err) {
          console.warn('Error parsing SSE event data:', err);
        }
      };
      eventSource.onerror = (err) => {
        console.error('EventSource error:', err);
      };
    } catch (err) {
      console.error('subscribeAddresses error:', err);
    }
  })();

  return {
    stop() {
      isStopped = true;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    },
  };
}
