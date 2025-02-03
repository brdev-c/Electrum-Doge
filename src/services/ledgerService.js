import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { payments, Psbt } from 'bitcoinjs-lib';

export const dogecoinNetwork = {
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

const bip32 = BIP32Factory(ecc);

function compressPubKey(pubkeyHex) {
  if (pubkeyHex.startsWith('02') || pubkeyHex.startsWith('03')) {
    return pubkeyHex;
  }
  if (!pubkeyHex.startsWith('04') || pubkeyHex.length !== 130) {
    throw new Error(`Invalid pubkey format: ${pubkeyHex}`);
  }
  const xHex = pubkeyHex.slice(2, 66);
  const yHex = pubkeyHex.slice(66);
  const yBigInt = BigInt('0x' + yHex);
  const isOdd = (yBigInt & 1n) === 1n;
  return (isOdd ? '03' : '02') + xHex;
}

export function makeXpub(pubHex, chainHex) {
  const c = compressPubKey(pubHex);
  const pubBuf = Buffer.from(c, 'hex');
  const chainBuf = Buffer.from(chainHex, 'hex');
  const node = bip32.fromPublicKey(pubBuf, chainBuf, dogecoinNetwork);
  return node.toBase58();
}

export function deriveLedgerAddressesFromXpub(xpub, externalCount = 1, changeCount = 0) {
  const node = bip32.fromBase58(xpub, dogecoinNetwork);
  const addresses = [];
  for (let i = 0; i < externalCount; i++) {
    const child = node.derive(0).derive(i);
    const { address } = payments.p2pkh({
      pubkey: child.publicKey,
      network: dogecoinNetwork
    });
    addresses.push({
      index: i,
      type: 'external',
      address,
      pubkey: child.publicKey.toString('hex'),
      used: false,
      balance: 0,
      txCount: 0
    });
  }
  for (let j = 0; j < changeCount; j++) {
    const child = node.derive(1).derive(j);
    const { address } = payments.p2pkh({
      pubkey: child.publicKey,
      network: dogecoinNetwork
    });
    addresses.push({
      index: j,
      type: 'change',
      address,
      pubkey: child.publicKey.toString('hex'),
      used: false,
      balance: 0,
      txCount: 0
    });
  }
  return addresses;
}

export function buildPsbtFromDraft(draft, walletAddresses) {
  const psbt = new Psbt({
    network: dogecoinNetwork,
    maximumFeeRate: 1e8
  });
  const MASTER_FINGERPRINT = Buffer.from([0x00, 0x00, 0x00, 0x00]);

  console.log('[LedgerService] draft inputs:', draft.inputs);
  console.log('[LedgerService] draft outputs:', draft.outputs);

  draft.inputs.forEach((inp, idx) => {
    if (!inp.rawTxHex) {
      throw new Error(`UTXO missing rawTxHex for txid=${inp.txid}`);
    }
    const wobj = walletAddresses.find(a => a.address === inp.address);
    if (!wobj) {
      throw new Error(`No matching address for input ${inp.address}`);
    }
    const compressed = compressPubKey(wobj.pubkey);
    const pubBuf = Buffer.from(compressed, 'hex');

    let path = wobj.path;
    if (!path) {
      const chain = wobj.type === 'change' ? 1 : 0;
      path = `m/44'/3'/0'/${chain}/${wobj.index}`;
    }

    psbt.addInput({
      hash: inp.txid,
      index: inp.vout || 0,
      nonWitnessUtxo: Buffer.from(inp.rawTxHex, 'hex'),
      publicKeys: [pubBuf],
      bip32Derivation: [{
        masterFingerprint: MASTER_FINGERPRINT,
        path,
        pubkey: pubBuf
      }]
    });
  });

  draft.outputs.forEach((o, idx) => {
    if (!o.address || typeof o.value === 'undefined') {
      throw new Error(`Output #${idx} missing address or value`);
    }
    if (o.value <= 0) {
      throw new Error(`Output #${idx} invalid value: ${o.value}`);
    }
    psbt.addOutput({
      address: o.address,
      value: o.value
    });
  });

  if (draft.changeAddress && draft.changeValue > 0) {
    psbt.addOutput({
      address: draft.changeAddress,
      value: draft.changeValue
    });
  }

  console.log('[LedgerService] final PSBT:', psbt.toHex());
  return psbt.toHex();
}
