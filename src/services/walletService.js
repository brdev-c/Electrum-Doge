// src/services/walletService.js

import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import wif from 'wif';
import { Psbt, payments } from 'bitcoinjs-lib';
import { dogecoinNetwork } from './networks';

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

const EXTERNAL_INITIAL = 20;
const CHANGE_INITIAL = 10;

export function generateNewWallet() {
  const mnemonic = bip39.generateMnemonic(128);
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, dogecoinNetwork);

  const addressesExternal = [];
  for (let i = 0; i < EXTERNAL_INITIAL; i++) {
    const child = root.derivePath(`m/44'/3'/0'/0/${i}`);
    const { address } = payments.p2pkh({
      pubkey: child.publicKey,
      network: dogecoinNetwork
    });
    addressesExternal.push({
      index: i,
      type: 'external',
      address,
      wif: child.toWIF(),
      pubkey: child.publicKey.toString('hex'),
      balance: 0,
      used: false,
      txCount: 0
    });
  }

  const addressesChange = [];
  for (let j = 0; j < CHANGE_INITIAL; j++) {
    const child = root.derivePath(`m/44'/3'/0'/1/${j}`);
    const { address } = payments.p2pkh({
      pubkey: child.publicKey,
      network: dogecoinNetwork
    });
    addressesChange.push({
      index: j,
      type: 'change',
      address,
      wif: child.toWIF(),
      pubkey: child.publicKey.toString('hex'),
      balance: 0,
      used: false,
      txCount: 0
    });
  }

  const addresses = [...addressesExternal, ...addressesChange];
  const main = addresses.find(a => a.type === 'external' && a.index === 0);

  return {
    mnemonic,
    address: main?.address || '',
    privateKeyWIF: main?.wif || '',
    addresses
  };
}

export function importWalletFromMnemonic(mnemonic) {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, dogecoinNetwork);

  const addressesExternal = [];
  for (let i = 0; i < EXTERNAL_INITIAL; i++) {
    const child = root.derivePath(`m/44'/3'/0'/0/${i}`);
    const { address } = payments.p2pkh({
      pubkey: child.publicKey,
      network: dogecoinNetwork
    });
    addressesExternal.push({
      index: i,
      type: 'external',
      address,
      wif: child.toWIF(),
      pubkey: child.publicKey.toString('hex'),
      balance: 0,
      used: false,
      txCount: 0
    });
  }

  const addressesChange = [];
  for (let j = 0; j < CHANGE_INITIAL; j++) {
    const child = root.derivePath(`m/44'/3'/0'/1/${j}`);
    const { address } = payments.p2pkh({
      pubkey: child.publicKey,
      network: dogecoinNetwork
    });
    addressesChange.push({
      index: j,
      type: 'change',
      address,
      wif: child.toWIF(),
      pubkey: child.publicKey.toString('hex'),
      balance: 0,
      used: false,
      txCount: 0
    });
  }

  const addresses = [...addressesExternal, ...addressesChange];
  const main = addresses.find(a => a.type === 'external' && a.index === 0);

  return {
    mnemonic,
    address: main?.address || '',
    privateKeyWIF: main?.wif || '',
    addresses
  };
}

export function importWalletFromWIF(wifKey) {
  const decoded = wif.decode(wifKey);
  if (decoded.version !== dogecoinNetwork.wif) {
    throw new Error('Invalid Dogecoin WIF prefix');
  }
  const keyPair = ECPair.fromPrivateKey(decoded.privateKey, {
    compressed: decoded.compressed,
    network: dogecoinNetwork
  });
  const { address } = payments.p2pkh({
    pubkey: keyPair.publicKey,
    network: dogecoinNetwork
  });

  return {
    mnemonic: null,
    address,
    privateKeyWIF: wifKey,
    addresses: [
      {
        index: 0,
        type: 'external',
        address,
        wif: wifKey,
        pubkey: keyPair.publicKey.toString('hex'),
        balance: 0,
        used: false,
        txCount: 0
      }
    ]
  };
}

export function importWallet(input) {
  try {
    wif.decode(input);
    return importWalletFromWIF(input);
  } catch (e) {
  }

  try {
    const maybeJson = JSON.parse(input);
    if (maybeJson.mnemonic) {
      return importWalletFromMnemonic(maybeJson.mnemonic);
    } else if (maybeJson.privateKeyWIF) {
      return importWalletFromWIF(maybeJson.privateKeyWIF);
    }
  } catch (e) {
  }

  return importWalletFromMnemonic(input.trim());
}

export function getNextReceivingAddress(wallet) {
  const extList = wallet.addresses.filter(a => a.type === 'external');
  let found = extList.find(a => !a.used);
  if (!found) {
    found = extList[extList.length - 1];
  }
  found.used = true;
  return found;
}

export function getNextChangeAddress(wallet) {
  const chList = wallet.addresses.filter(a => a.type === 'change');
  let found = chList.find(a => !a.used);
  if (!found) {
    found = chList[chList.length - 1];
  }
  found.used = true;
  return found;
}

export function expandAddressesIfNeeded(wallet, addressType = 'external', howMany = 5) {
  if (!wallet.mnemonic) {
    console.warn('Cannot expand addresses: no mnemonic in wallet.');
    return;
  }
  const seed = bip39.mnemonicToSeedSync(wallet.mnemonic);
  const root = bip32.fromSeed(seed, dogecoinNetwork);

  const list = wallet.addresses.filter(a => a.type === addressType);
  const maxIdx = list.reduce((acc, item) => Math.max(acc, item.index), 0);

  let startIndex = maxIdx + 1;
  for (let i = 0; i < howMany; i++) {
    const realIndex = startIndex + i;
    const path = `m/44'/3'/0'/${addressType === 'external' ? 0 : 1}/${realIndex}`;
    const child = root.derivePath(path);
    const { address } = payments.p2pkh({
      pubkey: child.publicKey,
      network: dogecoinNetwork
    });
    wallet.addresses.push({
      index: realIndex,
      type: addressType,
      address,
      wif: child.toWIF(),
      pubkey: child.publicKey.toString('hex'),
      balance: 0,
      used: false,
      txCount: 0
    });
  }
}

function estimateTxSize(inCount, outCount) {
  return inCount * 180 + outCount * 34 + 10 + inCount;
}

function selectCoins(utxos, recipients, feeRate) {
  const sumRecipients = recipients.reduce((acc, r) => acc + r.valueSat, 0);
  const sorted = utxos.slice().sort((a, b) => b.value - a.value);

  let selected = [];
  let totalSelected = 0;
  let fee = 0;

  for (let i = 0; i < sorted.length; i++) {
    selected.push(sorted[i]);
    totalSelected += sorted[i].value;

    const inCount = selected.length;
    const outCount = recipients.length + 1;
    const size = estimateTxSize(inCount, outCount);
    fee = Math.ceil(size * feeRate);

    if (totalSelected >= sumRecipients + fee) {
      return { inputs: selected, totalIn: totalSelected, fee };
    }
  }
  throw new Error('Not enough funds (including fee).');
}

export async function createUnsignedTx({
  recipients,
  feeRate,
  allUtxos,
  walletAddresses,
  lockTime,
  useChange
}) {
  const { inputs, totalIn, fee } = selectCoins(allUtxos, recipients, feeRate);
  const sumRecipients = recipients.reduce((acc, r) => acc + r.valueSat, 0);
  const changeValue = totalIn - sumRecipients - fee;

  const outputs = recipients.map(r => ({
    address: r.address,
    value: r.valueSat,
    isChange: false
  }));

  if (changeValue > 0) {
    if (useChange) {
      let chObj = walletAddresses.find(a => a.type === 'change' && !a.used);
      if (!chObj) {
        chObj = walletAddresses.find(a => a.type === 'change');
      }
      if (!chObj) throw new Error('No change address in wallet');

      outputs.push({
        address: chObj.address,
        value: changeValue,
        isChange: true
      });
    } else {
      const largestInput = inputs.reduce((acc, cur) => {
        if (!acc) return cur;
        return cur.value > acc.value ? cur : acc;
      }, null);

      if (!largestInput) {
        if (outputs.length) {
          outputs[0].value += changeValue;
        }
      } else {
        outputs.push({
          address: largestInput.address,
          value: changeValue,
          isChange: false
        });
      }
    }
  }

  const inCount = inputs.length;
  const outCount = outputs.length ? outputs.length : 1;
  const size = estimateTxSize(inCount, outCount);

  return {
    inputs: inputs.map(i => ({
      txid: i.txid,
      vout: i.vout,
      address: i.address,
      value: i.value,
      confirmations: i.confirmations || 0
    })),
    outputs,
    feeSat: fee,
    vbytes: size
  };
}

export function createAndSignTx({
  recipients,
  feeRate,
  allUtxos,
  walletAddresses,
  lockTime = null,
  useChange = true
}) {
  const { inputs, totalIn, fee } = selectCoins(allUtxos, recipients, feeRate);
  const sumRecipients = recipients.reduce((acc, r) => acc + r.valueSat, 0);
  const changeValue = totalIn - sumRecipients - fee;
  if (changeValue < 0) {
    throw new Error('Negative change; fee calculation error?');
  }

  const psbt = new Psbt({
    network: dogecoinNetwork,
    maximumFeeRate: 1e8
  });

  if (lockTime) {
    psbt.setLocktime(lockTime);
  }

  inputs.forEach((u) => {
    if (!u.rawTxHex) {
      throw new Error(`UTXO missing rawTxHex for txid=${u.txid}`);
    }
    psbt.addInput({
      hash: u.txid,
      index: u.vout || 0,
      nonWitnessUtxo: Buffer.from(u.rawTxHex, 'hex')
    });
  });

  recipients.forEach(r => {
    psbt.addOutput({
      address: r.address,
      value: r.valueSat
    });
  });

  if (changeValue > 0) {
    if (useChange) {
      let chObj = walletAddresses.find(a => a.type === 'change' && !a.used);
      if (!chObj) {
        chObj = walletAddresses.find(a => a.type === 'change');
      }
      if (!chObj) {
        throw new Error('No change address found for useChange');
      }
      chObj.used = true;

      psbt.addOutput({
        address: chObj.address,
        value: changeValue
      });
    } else {
      const largestInput = inputs.reduce((acc, cur) => {
        if (!acc) return cur;
        return cur.value > acc.value ? cur : acc;
      }, null);

      if (!largestInput) {
        if (recipients.length > 0) {
          psbt.addOutput({
            address: recipients[0].address,
            value: changeValue
          });
        }
      } else {
        psbt.addOutput({
          address: largestInput.address,
          value: changeValue
        });
      }
    }
  }

  inputs.forEach((inp, idx) => {
    const wobj = walletAddresses.find(a => a.address === inp.address);
    if (!wobj) {
      throw new Error(`No WIF for input address ${inp.address}`);
    }
    const keyPair = ECPair.fromWIF(wobj.wif, dogecoinNetwork);
    psbt.signInput(idx, keyPair);

    const sigOk = psbt.validateSignaturesOfInput(idx, (pubKey, msgHash, signature) => {
      const kp = ECPair.fromPublicKey(pubKey, { network: dogecoinNetwork });
      return kp.verify(msgHash, signature);
    });
    if (!sigOk) {
      throw new Error(`Signature invalid on input #${idx}`);
    }
  });

  psbt.finalizeAllInputs();
  const txHex = psbt.extractTransaction().toHex();
  return { txHex, fee };
}
