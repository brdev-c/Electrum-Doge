import { payments } from 'bitcoinjs-lib';

const dogecoinNetwork = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bech32: 'doge',
  bip32: {
    public: 0x02facafd,
    private: 0x02fac398,
  },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
};

const FEE_RATE = 200;

export function createPaymentTxLargestFirst({
  utxos,
  addressObjects,
  recipientAddr,
  amountDoge
}) {
  console.log('[createPaymentTxLargestFirst] Start building TX for Ledger...');
  console.log('[createPaymentTxLargestFirst] Recipient:', recipientAddr, 'amountDoge:', amountDoge);

  const amountSat = Math.floor(amountDoge * 1e8);
  console.log(`[createPaymentTxLargestFirst] amountSat=${amountSat} sats`);

  const sorted = utxos.slice().sort((a, b) => b.value - a.value);
  console.log('[createPaymentTxLargestFirst] UTXOs sorted by value(desc):', sorted);

  let selected = [];
  let total = 0;
  let fee = 0;

  for (const u of sorted) {
    selected.push(u);
    total += u.value;

    const inCount = selected.length;
    const outCount = 2;
    const sizeBytes = estimateTxSize(inCount, outCount);
    fee = sizeBytes * FEE_RATE;

    console.log(`[createPaymentTxLargestFirst] After adding utxo(txid=${u.txid}, vout=${u.vout}, value=${u.value}):`);
    console.log(`... total so far = ${total}, estimated fee=${fee}`);

    if (total >= (amountSat + fee)) {
      console.log('[createPaymentTxLargestFirst] Enough UTXOs selected!');
      break;
    }
  }
  if (total < (amountSat + fee)) {
    throw new Error('Not enough funds (including fee)');
  }

  const changeValue = total - amountSat - fee;
  console.log(`[createPaymentTxLargestFirst] total=${total}, fee=${fee}, changeValue=${changeValue}`);

  const outputs = [];
  outputs.push({ address: recipientAddr, value: amountSat });

  if (changeValue > 0) {
    let chObj = addressObjects.find(a => a.type === 'change');
    if (!chObj) {
      console.warn('[createPaymentTxLargestFirst] No explicit change-address found. Fallback to first address.');
      chObj = addressObjects[0];
    }
    outputs.push({
      address: chObj.address,
      value: changeValue
    });
  }

  console.log('[createPaymentTxLargestFirst] outputs:', outputs);

  const ledgerInputs = [];
  const ledgerKeysets = [];

  for (const inp of selected) {
    const adObj = addressObjects.find(a => a.address === inp.address);
    if (!adObj) {
      throw new Error(`No matching addressObj for UTXO address=${inp.address}`);
    }
    if (!adObj.path) {
      const chain = (adObj.type === 'change') ? 1 : 0;
      adObj.path = `44'/3'/0'/${chain}/${adObj.index || 0}`;
      console.log('[createPaymentTxLargestFirst] fallback path assigned:', adObj.path, 'for address=', inp.address);
    }

    ledgerInputs.push([
      inp.rawTxHex,
      inp.vout,
      null,
      0xffffffff
    ]);

    ledgerKeysets.push(adObj.path);
  }

  console.log('[createPaymentTxLargestFirst] ledgerInputs:', ledgerInputs);
  console.log('[createPaymentTxLargestFirst] ledgerKeysets:', ledgerKeysets);

  const outputScriptHex = buildOutputScript(outputs);
  console.log('[createPaymentTxLargestFirst] outputScriptHex:', outputScriptHex);

  const txData = {
    inputs: ledgerInputs,
    associatedKeysets: ledgerKeysets,
    outputScriptHex,
    lockTime: 0
  };
  console.log('[createPaymentTxLargestFirst] Final txData for ledgerSignTransaction:', txData);
  return txData;
}

function buildOutputScript(outputs) {
  const allBufs = [];

  for (const out of outputs) {
    const valBuf = Buffer.alloc(8);
    valBuf.writeBigUInt64LE(BigInt(out.value), 0);

    const { output: scriptPubKey } = payments.p2pkh({
      address: out.address,
      network: dogecoinNetwork
    });

    const scriptLen = varint(scriptPubKey.length);
    const outBuf = Buffer.concat([valBuf, scriptLen, scriptPubKey]);
    allBufs.push(outBuf);
  }

  return Buffer.concat(allBufs).toString('hex');
}

function varint(n) {
  if (n < 0xfd) {
    return Buffer.from([n]);
  }
  throw new Error('varint only for small script');
}

function estimateTxSize(inCount, outCount) {
  return inCount * 180 + outCount * 34 + 10 + inCount;
}
