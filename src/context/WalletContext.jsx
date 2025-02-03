import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import {
  getDogePriceInFiat,
  getDogeHeight,
  getElectrumServersFromMonitorPage,
  pingNetwork,
  getDogeTransactionsAll,
  subscribeAddresses
} from '../services/apiService';

const WalletContext = createContext(null);

export function useWallet() {
  return useContext(WalletContext);
}

export function WalletProvider({ children }) {
  const [wallet, setWallet] = useState(null);
  const [masterPassword, setMasterPassword] = useState('');
  const [locked, setLocked] = useState(false);
  const [walletFileName, setWalletFileName] = useState('');
  const isLedgerWallet = !!(wallet?.xpub && !wallet?.mnemonic);

  function lockWallet() {
    setLocked(true);
  }
  function unlockWallet(pwd) {
    if (pwd === masterPassword) {
      setLocked(false);
      return true;
    }
    return false;
  }

  const [serverParam, setServerParam] = useState(() => {
    try {
      const saved = localStorage.getItem('app_serverParam');
      if (saved) {
        const parts = saved.split('|');
        return {
          type: parts[0] || 'electrum',
          host: parts[1] || '',
          port: parts[2] ? parseInt(parts[2], 10) : 50001,
          ssl: parts[3] === 'ssl',
        };
      }
      return { type: 'electrum', host: '', port: 50001, ssl: false };
    } catch {
      return { type: 'electrum', host: '', port: 50001, ssl: false };
    }
  });

  useEffect(() => {
    if (!serverParam) return;
    try {
      const { type, host, port, ssl } = serverParam;
      const s = `${type}|${host || ''}|${port || ''}|${ssl ? 'ssl' : 'tcp'}`;
      localStorage.setItem('app_serverParam', s);
    } catch {}
  }, [serverParam]);

  const [autoConnectEnabled, setAutoConnectEnabled] = useState(() => {
    const saved = localStorage.getItem('app_autoConnectEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  useEffect(() => {
    localStorage.setItem('app_autoConnectEnabled', JSON.stringify(autoConnectEnabled));
  }, [autoConnectEnabled]);

  async function autoConnectElectrum() {
    console.log('[WalletContext] autoConnectElectrum...');
    try {
      const servers = await getElectrumServersFromMonitorPage();
      if (servers && servers.length) {
        let preferred = servers.find(s => s.host === 'doge.aftrek.org' && s.proto === 'tcp');
        if (!preferred) {
          preferred = servers.find(s => s.proto === 'tcp');
        }
        if (!preferred) {
          preferred = servers[0];
        }
        if (preferred) {
          setServerParam({
            type: 'electrum',
            host: preferred.host,
            port: preferred.port,
            ssl: (preferred.proto === 'ssl'),
          });
        }
      }
    } catch (err) {
      console.error('autoConnectElectrum error:', err);
    }
  }

  async function autoConnectIfNeeded() {
    if (!autoConnectEnabled) return;
    if (!serverParam.host) {
      await autoConnectElectrum();
      return;
    }
    try {
      const ok = await pingNetwork();
      if (!ok) {
        await autoConnectElectrum();
      }
    } catch {
      await autoConnectElectrum();
    }
  }

  useEffect(() => {
    if (autoConnectEnabled && serverParam.type === 'electrum' && !serverParam.host) {
      autoConnectElectrum();
    }
  }, [serverParam, autoConnectEnabled]);

  const [fiatCurrency, setFiatCurrency] = useState(() => {
    return localStorage.getItem('app_fiatCurrency') || 'USD';
  });
  const [dogePriceFiat, setDogePriceFiat] = useState(0);
  useEffect(() => {
    localStorage.setItem('app_fiatCurrency', fiatCurrency);
    getDogePriceInFiat(fiatCurrency)
      .then(p => setDogePriceFiat(p))
      .catch(err => {
        console.error('Failed to load doge price:', err);
        setDogePriceFiat(0);
      });
  }, [fiatCurrency]);

  const [cameraDeviceId, setCameraDeviceId] = useState(() => {
    return localStorage.getItem('app_cameraDeviceId') || '';
  });
  useEffect(() => {
    if (cameraDeviceId) localStorage.setItem('app_cameraDeviceId', cameraDeviceId);
    else localStorage.removeItem('app_cameraDeviceId');
  }, [cameraDeviceId]);

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const s = localStorage.getItem('app_notificationsEnabled');
    return s !== null ? JSON.parse(s) : true;
  });
  useEffect(() => {
    localStorage.setItem('app_notificationsEnabled', JSON.stringify(notificationsEnabled));
  }, [notificationsEnabled]);

  const [autoLockEnabled, setAutoLockEnabled] = useState(() => {
    const s = localStorage.getItem('app_autoLockEnabled');
    return s !== null ? JSON.parse(s) : true;
  });
  useEffect(() => {
    localStorage.setItem('app_autoLockEnabled', JSON.stringify(autoLockEnabled));
  }, [autoLockEnabled]);

  const [autoLockTimeout, setAutoLockTimeout] = useState(() => {
    const s = localStorage.getItem('app_autoLockTimeout');
    return s !== null ? parseInt(s, 10) : 10;
  });
  useEffect(() => {
    localStorage.setItem('app_autoLockTimeout', String(autoLockTimeout));
  }, [autoLockTimeout]);

  const [explorerURL, setExplorerURL] = useState(() => {
    return localStorage.getItem('app_explorerURL') || 'https://dogechain.info/tx/';
  });
  useEffect(() => {
    localStorage.setItem('app_explorerURL', explorerURL);
  }, [explorerURL]);

  const [blockPollingInterval, setBlockPollingInterval] = useState(() => {
    const s = localStorage.getItem('app_blockPollingInterval');
    return s !== null ? parseInt(s, 10) : 30000;
  });
  useEffect(() => {
    localStorage.setItem('app_blockPollingInterval', String(blockPollingInterval));
  }, [blockPollingInterval]);

  const [txPollingInterval, setTxPollingInterval] = useState(() => {
    const s = localStorage.getItem('app_txPollingInterval');
    return s !== null ? parseInt(s, 10) : 10000;
  });
  useEffect(() => {
    localStorage.setItem('app_txPollingInterval', String(txPollingInterval));
  }, [txPollingInterval]);

  const [recentWallets, setRecentWallets] = useState(() => {
    try {
      const raw = localStorage.getItem('app_recentWallets');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
  useEffect(() => {
    localStorage.setItem('app_recentWallets', JSON.stringify(recentWallets));
  }, [recentWallets]);

  function addRecentWallet(filePath) {
    if (!filePath) return;
    setRecentWallets(prev => {
      const filtered = prev.filter(it => it.filePath !== filePath);
      const newItem = { filePath, timestamp: Date.now() };
      return [newItem, ...filtered];
    });
  }
  function removeRecentWallet(filePath) {
    setRecentWallets(prev => prev.filter(it => it.filePath !== filePath));
  }

  function setWalletWithPath(walletObj, filePath) {
    if (!walletObj) {
      setWallet(null);
      return;
    }
    if (walletObj.xpub && !walletObj.mnemonic) {
      console.log('[WalletContext] This is Ledger => removing addressesCache_...');
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('addressesCache_')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      if (walletObj.addresses && walletObj.addresses.length > 1) {
        walletObj.addresses = walletObj.addresses.slice(0, 1);
      }
    }
    const wCopy = { ...walletObj, filePath: filePath || '' };
    setWallet(wCopy);
    if (filePath) addRecentWallet(filePath);
  }

  const subscriptionRef = useRef(null);
  const lastNotifiedTxsRef = useRef(new Set());

  useEffect(() => {
    if (!wallet || !wallet.addresses || !wallet.addresses.length) {
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
        subscriptionRef.current = null;
      }
      return;
    }
    const addresses = wallet.addresses.map(a => a.address);
    const sub = subscribeAddresses(serverParam, addresses, onNewAddressTx);
    subscriptionRef.current = sub;
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
        subscriptionRef.current = null;
      }
    };
  }, [wallet, serverParam]);

  async function onNewAddressTx(sseData) {
    try {
      if (!sseData || !sseData.txid || !sseData.direction) return;
      if (sseData.direction === 'incoming') {
        if (lastNotifiedTxsRef.current.has(sseData.txid)) {
          return;
        }
        lastNotifiedTxsRef.current.add(sseData.txid);
        if (notificationsEnabled && window.electronAPI?.notifyIncomingTransaction) {
          await window.electronAPI.notifyIncomingTransaction({
            address: sseData.address,
            txid: sseData.txid,
            amount: sseData.value,
          });
        }
      }
    } catch (err) {
      console.error('[WalletContext] onNewAddressTx error:', err);
    }
  }

  useEffect(() => {
    if (!wallet || !wallet.addresses || !wallet.addresses.length) return;
    const timer = setInterval(() => {
      checkIncomingTxs();
    }, txPollingInterval);
    return () => clearInterval(timer);
  }, [wallet, txPollingInterval, serverParam]);

  async function checkIncomingTxs() {
    try {
      if (!wallet || !wallet.addresses) return;
      const addresses = wallet.addresses.map(a => a.address);
      const resp = await getDogeTransactionsAll(addresses, serverParam);
      const allTxs = resp.txs || [];
      for (const tx of allTxs) {
        if (!tx.txid) continue;
        if (tx.category === 'receive' || tx.incoming) {
          if (!lastNotifiedTxsRef.current.has(tx.txid)) {
            lastNotifiedTxsRef.current.add(tx.txid);
            if (notificationsEnabled && window.electronAPI?.notifyIncomingTransaction) {
              await window.electronAPI.notifyIncomingTransaction({
                address: tx.address || '',
                txid: tx.txid,
                amount: tx.amount || 0,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('[WalletContext] checkIncomingTxs error:', err);
    }
  }

  const [blockHeight, setBlockHeight] = useState(0);
  useEffect(() => {
    if (serverParam.type !== 'electrum' || !serverParam.host) return;
    const timer = setInterval(() => {
      getDogeHeight(serverParam)
        .then(h => {
          if (typeof h === 'number') setBlockHeight(h);
        })
        .catch(err => console.warn('getDogeHeight error:', err));
    }, blockPollingInterval);
    return () => clearInterval(timer);
  }, [serverParam, blockPollingInterval]);

  const value = {
    wallet,
    setWallet,
    masterPassword,
    setMasterPassword,
    locked,
    lockWallet,
    unlockWallet,
    walletFileName,
    setWalletFileName,
    isLedgerWallet,
    serverParam,
    setServerParam,
    autoConnectEnabled,
    setAutoConnectEnabled,
    autoConnectIfNeeded,
    autoConnectElectrum,
    fiatCurrency,
    setFiatCurrency,
    dogePriceFiat,
    setDogePriceFiat,
    cameraDeviceId,
    setCameraDeviceId,
    notificationsEnabled,
    setNotificationsEnabled,
    autoLockEnabled,
    setAutoLockEnabled,
    autoLockTimeout,
    setAutoLockTimeout,
    explorerURL,
    setExplorerURL,
    blockPollingInterval,
    setBlockPollingInterval,
    txPollingInterval,
    setTxPollingInterval,
    recentWallets,
    addRecentWallet,
    removeRecentWallet,
    setWalletWithPath,
    blockHeight,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}
