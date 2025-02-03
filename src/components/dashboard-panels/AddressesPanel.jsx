import React, { useState, useEffect } from 'react';
import { useWallet } from '../../context/WalletContext';
import { getBalancesBatch, getDogeTransactionsAll } from '../../services/apiService';
import { expandAddressesIfNeeded } from '../../services/walletService';

export default function AddressesPanel({ theme }) {
  const { wallet, serverParam, fiatCurrency, dogePriceFiat, setWallet, isLedgerWallet } = useWallet();
  const walletId = wallet?.mnemonic || wallet?.address || 'tempWallet';
  const [addresses, setAddresses] = useState([]);
  const [copiedMap, setCopiedMap] = useState({});
  const [btnHighlight, setBtnHighlight] = useState({
    receiving: false,
    change: false,
    refresh: false
  });
  const [error, setError] = useState('');
  const styles = getStyles(theme);

  useEffect(() => {
    if (!wallet || !wallet.addresses) {
      setAddresses([]);
      return;
    }
    const sorted = wallet.addresses.slice().sort(sortAddresses);
    setAddresses(sorted);
    loadBalancesFromCacheOrServer(sorted);
  }, [wallet, serverParam]);

  function loadBalancesFromCacheOrServer(addrList) {
    setError('');
    const cacheKey = 'addressesCache_' + walletId;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.timestamp && parsed.data) {
          const ageMs = Date.now() - parsed.timestamp;
          if (ageMs < 600000) {
            return applyCacheData(addrList, parsed.data);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to parse addresses cache:', err);
    }
    updateAddressesData(addrList);
  }

  function applyCacheData(addrList, cached) {
    const mapCache = {};
    cached.forEach(obj => {
      mapCache[obj.address] = { balance: obj.balance || 0, txCount: obj.txCount || 0 };
    });
    const updated = addrList.map(addr => {
      const c = mapCache[addr.address];
      if (c) {
        return { ...addr, balance: c.balance, txCount: c.txCount };
      }
      return addr;
    });
    setAddresses(updated);
  }

  function saveAddressesToCache(addrList) {
    const dataForCache = addrList.map(a => ({
      address: a.address,
      balance: a.balance || 0,
      txCount: a.txCount || 0
    }));
    const obj = {
      timestamp: Date.now(),
      data: dataForCache
    };
    const cacheKey = 'addressesCache_' + walletId;
    localStorage.setItem(cacheKey, JSON.stringify(obj));
  }

  async function updateAddressesData(currentList) {
    try {
      if (!currentList || currentList.length === 0) return;
      const allAddrs = currentList.map(a => a.address);
      const batchResp = await getBalancesBatch(allAddrs, serverParam);
      const txsResp = await getDogeTransactionsAll(allAddrs, serverParam);
      const balMap = {};
      if (batchResp && batchResp.addresses) {
        batchResp.addresses.forEach(obj => {
          balMap[obj.address] = obj.confirmed;
        });
      }
      const txCountMap = {};
      allAddrs.forEach(a => { txCountMap[a] = 0; });
      if (txsResp && txsResp.txs) {
        txsResp.txs.forEach(t => {
          const usedAddr = t.addressUsed;
          if (usedAddr && txCountMap[usedAddr] !== undefined) {
            txCountMap[usedAddr]++;
          }
        });
      }
      const updated = currentList.map(addr => {
        const newBal = balMap[addr.address] || 0;
        const newTxCount = txCountMap[addr.address] || 0;
        return { ...addr, balance: newBal, txCount: newTxCount };
      });
      setAddresses(updated);
      saveAddressesToCache(updated);
    } catch (err) {
      console.error('updateAddressesData error:', err);
      setError('Failed to load balances.');
    }
  }

  function handleRefresh() {
    highlightButton('refresh');
    if (!wallet || !wallet.addresses) return;
    const sorted = wallet.addresses.slice().sort(sortAddresses);
    setAddresses(sorted);
    updateAddressesData(sorted);
  }

  function handleCreateReceivingAddress() {
    highlightButton('receiving');
    if (isLedgerWallet) {
      alert('Cannot create addresses for Ledger wallet; only one address is used.');
      return;
    }
    expandAddressesIfNeeded(wallet, 'external', 1);
    const sorted = wallet.addresses.slice().sort(sortAddresses);
    setAddresses(sorted);
    setWallet({ ...wallet });
  }

  function handleCreateChangeAddress() {
    highlightButton('change');
    if (isLedgerWallet) {
      alert('Cannot create addresses for Ledger wallet; only one address is used.');
      return;
    }
    expandAddressesIfNeeded(wallet, 'change', 1);
    const sorted = wallet.addresses.slice().sort(sortAddresses);
    setAddresses(sorted);
    setWallet({ ...wallet });
  }

  function highlightButton(key) {
    setBtnHighlight(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setBtnHighlight(prev => ({ ...prev, [key]: false }));
    }, 1000);
  }

  function copyToClipboard(text) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedMap(prev => ({ ...prev, [text]: true }));
        setTimeout(() => {
          setCopiedMap(prev => ({ ...prev, [text]: false }));
        }, 1000);
      })
      .catch(() => alert('Failed to copy'));
  }

  return (
    <div style={styles.wrapper}>
      <style>{`
        .customScroll {
          overflow-y: auto;
          scrollbar-width: thin;
        }
        .customScroll::-webkit-scrollbar {
          width: 6px;
        }
        .customScroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .customScroll::-webkit-scrollbar-thumb {
          background-color: rgb(69,83,100);
        }
      `}</style>
      <div style={styles.headerRow}>
        <h3 style={styles.title}>All Addresses</h3>
        <div style={styles.buttonsRight}>
          <button
            style={{
              ...styles.createBtn,
              border: btnHighlight.receiving ? '1px solid green' : styles.createBtnBorder
            }}
            onClick={handleCreateReceivingAddress}
          >
            Create receiving address
          </button>
          <button
            style={{
              ...styles.createBtn,
              border: btnHighlight.change ? '1px solid green' : styles.createBtnBorder
            }}
            onClick={handleCreateChangeAddress}
          >
            Create change address
          </button>
          <button
            style={{
              ...styles.createBtn,
              marginLeft: '1rem',
              border: btnHighlight.refresh ? '1px solid green' : styles.createBtnBorder
            }}
            onClick={handleRefresh}
          >
            Refresh
          </button>
        </div>
      </div>
      {error && <div style={styles.errorMsg}>{error}</div>}
      <div style={styles.tableWrapper}>
        <table style={styles.tableHeader}>
          <colgroup>
            <col style={{ width: '4%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '300px' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: theme.tableHeaderBg }}>
              <th style={styles.th}>#</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Address</th>
              <th style={styles.th}>Public Key</th>
              <th style={{ ...styles.th, textAlign: 'center' }}>Balance</th>
              <th style={{ ...styles.th, textAlign: 'center' }}>{fiatCurrency}</th>
              <th style={{ ...styles.th, textAlign: 'center' }}>Txns</th>
            </tr>
          </thead>
        </table>
        <div className="customScroll" style={styles.scrollArea}>
          <table style={styles.tableBody}>
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '300px' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <tbody>
              {addresses.map((addr, idx) => {
                const key = `${addr.type}-${addr.index}`;
                const isCopiedAddr = copiedMap[addr.address];
                const isCopiedPubkey = copiedMap[addr.pubkey];
                const balDoge = addr.balance || 0;
                const balFiat = balDoge * dogePriceFiat;
                return (
                  <tr
                    key={key}
                    style={styles.tr}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = theme.tableRowHover)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ ...styles.td, textAlign: 'center' }}>{addr.index}</td>
                    <td style={styles.td}>
                      {addr.type === 'external'
                        ? <span style={styles.receivingBadge}>Receiving</span>
                        : <span style={styles.changeBadge}>Change</span>}
                    </td>
                    <td style={styles.addressCell}>
                      <div style={styles.addressInner}>
                        <span style={styles.addressText}>{addr.address}</span>
                        <button
                          style={{
                            ...styles.copyBtn,
                            backgroundColor: isCopiedAddr ? 'green' : 'transparent'
                          }}
                          onClick={() => copyToClipboard(addr.address)}
                        >
                          Copy
                        </button>
                      </div>
                    </td>
                    <td style={{ ...styles.td, wordWrap: 'break-word' }}>
                      <div style={styles.cellFlex}>
                        <span style={{ fontFamily: 'monospace' }}>
                          {addr.pubkey.slice(0, 12)}...
                        </span>
                        <button
                          style={{
                            ...styles.copyBtn,
                            backgroundColor: isCopiedPubkey ? 'green' : 'transparent'
                          }}
                          onClick={() => copyToClipboard(addr.pubkey)}
                        >
                          Copy
                        </button>
                      </div>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      {balDoge.toFixed(4)}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      {balFiat.toFixed(2)} {fiatCurrency}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      {addr.txCount || 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function sortAddresses(a, b) {
  if (a.type === b.type) return a.index - b.index;
  return a.type === 'external' ? -1 : 1;
}

function getStyles(theme) {
  const buttonBorderColor = theme.darkMode ? '#666' : (theme.borderColor || '#ccc');
  return {
    wrapper: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '1rem',
      color: theme.color
    },
    headerRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '1rem'
    },
    title: {
      margin: 0,
      fontSize: '1.1rem'
    },
    buttonsRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    createBtn: {
      padding: '0.3rem 0.6rem',
      backgroundColor: 'transparent',
      color: theme.color,
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '0.8rem'
    },
    createBtnBorder: `1px solid ${buttonBorderColor}`,
    errorMsg: {
      backgroundColor: theme.darkMode ? 'rgba(180,60,60,0.2)' : '#fbdada',
      color: theme.darkMode ? '#ff8080' : '#900',
      padding: '0.5rem',
      borderRadius: '6px',
      marginBottom: '0.5rem'
    },
    tableWrapper: {
      display: 'flex',
      flexDirection: 'column',
      border: `1px solid ${buttonBorderColor}`,
      borderRadius: '6px',
      width: '100%',
      minHeight: '200px',
      maxHeight: '67vh',
      overflow: 'hidden'
    },
    tableHeader: {
      width: '100%',
      borderCollapse: 'collapse',
      tableLayout: 'fixed',
      fontSize: '0.85rem'
    },
    tableBody: {
      width: '100%',
      borderCollapse: 'collapse',
      tableLayout: 'fixed',
      fontSize: '0.85rem'
    },
    scrollArea: {
      flex: 1,
      overflowY: 'auto'
    },
    th: {
      padding: '0.5rem',
      textAlign: 'left',
      borderBottom: `1px solid ${buttonBorderColor}`,
      fontWeight: 'normal',
      fontSize: '0.85rem'
    },
    tr: {
      transition: 'background-color 0.2s'
    },
    td: {
      padding: '0.5rem',
      borderBottom: `1px solid ${buttonBorderColor}`,
      verticalAlign: 'middle'
    },
    addressCell: {
      padding: '0.5rem',
      borderBottom: `1px solid ${buttonBorderColor}`,
      verticalAlign: 'middle',
      whiteSpace: 'nowrap',
      overflow: 'hidden'
    },
    addressInner: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: '0.5rem'
    },
    addressText: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      display: 'inline-block',
      maxWidth: '250px',
      whiteSpace: 'nowrap'
    },
    cellFlex: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.3rem'
    },
    copyBtn: {
      padding: '0.2rem 0.4rem',
      color: theme.color,
      border: `1px solid ${buttonBorderColor}`,
      borderRadius: '4px',
      fontSize: '0.7rem',
      cursor: 'pointer'
    },
    receivingBadge: {
      border: '1px solid green',
      padding: '0.2rem 0.4rem',
      borderRadius: '4px',
      color: 'green',
      fontSize: '0.75rem',
      fontWeight: 'bold',
      display: 'inline-block'
    },
    changeBadge: {
      border: '1px solid goldenrod',
      padding: '0.2rem 0.4rem',
      borderRadius: '4px',
      color: 'goldenrod',
      fontSize: '0.75rem',
      fontWeight: 'bold',
      display: 'inline-block'
    }
  };
}
