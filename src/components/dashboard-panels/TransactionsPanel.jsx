import React, { useEffect, useState } from 'react';
import { useWallet } from '../../context/WalletContext';
import { getDogeTransactionsAll } from '../../services/apiService';

export default function TransactionsPanel({ theme }) {
  const {
    wallet,
    serverParam,
    fiatCurrency,
    dogePriceFiat
  } = useWallet();

  const walletId = wallet?.mnemonic || wallet?.address || 'tempWallet';
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 7;
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState('time');
  const [sortDir, setSortDir] = useState('desc');
  const [copiedMap, setCopiedMap] = useState({});
  const [explorerClickedMap, setExplorerClickedMap] = useState({});

  const styles = getStyles(theme);

  useEffect(() => {
    if (!wallet || !wallet.addresses) return;
    loadTxsFromCacheOrServer();
  }, [wallet]);

  function loadTxsFromCacheOrServer() {
    setError('');
    setLoading(true);
    const cacheKey = 'txsCache_' + walletId;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.timestamp && parsed.data) {
          const ageMs = Date.now() - parsed.timestamp;
          if (ageMs < 600000) {
            setTransactions(parsed.data);
            setLoading(false);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Failed to parse cache, will reload from server:', err);
    }
    loadTxsFromServer();
  }

  function loadTxsFromServer() {
    setError('');
    setLoading(true);
    const allAddrs = wallet.addresses.map(a => a.address);
    getDogeTransactionsAll(allAddrs, serverParam)
      .then((data) => {
        if (data && data.txs) {
          setTransactions(data.txs);
          saveTxsToCache(data.txs);
        } else {
          setTransactions([]);
        }
      })
      .catch((e) => {
        console.error(e);
        setError('Failed to load transactions.');
      })
      .finally(() => setLoading(false));
  }

  function saveTxsToCache(txs) {
    const cacheKey = 'txsCache_' + walletId;
    const obj = {
      timestamp: Date.now(),
      data: txs
    };
    localStorage.setItem(cacheKey, JSON.stringify(obj));
  }

  function handleRefresh() {
    setPage(1);
    loadTxsFromServer();
  }

  function copyToClipboard(text, rowKey) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedMap(prev => ({ ...prev, [rowKey]: true }));
        setTimeout(() => {
          setCopiedMap(prev => ({ ...prev, [rowKey]: false }));
        }, 1000);
      })
      .catch(() => alert('Failed to copy'));
  }

  function handleExplorerClick(txid, rowKey) {
    setExplorerClickedMap(prev => ({ ...prev, [rowKey]: true }));
    setTimeout(() => {
      setExplorerClickedMap(prev => ({ ...prev, [rowKey]: false }));
    }, 1000);
    const url = `https://dogechain.info/tx/${txid}`;
    window.open(url, '_blank');
  }

  function handleSort(field) {
    if (field === sortField) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  function handleChangePage(delta) {
    setPage(prev => {
      const newPage = prev + delta;
      return newPage < 1 ? 1 : newPage;
    });
  }

  const sortedTxs = transactions.slice().sort((a, b) => {
    let vA, vB;
    switch (sortField) {
      case 'time':
        vA = a.time;
        vB = b.time;
        break;
      case 'amount':
        vA = a.amount;
        vB = b.amount;
        break;
      default:
        vA = a.time;
        vB = b.time;
    }
    if (sortDir === 'asc') return vA - vB;
    return vB - vA;
  });

  const totalTxs = sortedTxs.length;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageItems = sortedTxs.slice(startIndex, endIndex);

  function sortIndicator(field) {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? '▲' : '▼';
  }

  function isChangeTx(tx) {
    if (tx.direction !== 'in') return false;
    return transactions.some(t2 => t2.txid === tx.txid && t2.direction === 'out');
  }

return (
  <div style={styles.wrapper}>
    {error && <div style={styles.errorMsg}>{error}</div>}
    {loading && (
      <div style={styles.loadingMsg}>
        <p style={{ margin: 0 }}>
          Loading transactions...
        </p>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#666' }}>
          If this loading takes more than 5-10 seconds,
          please go to <strong>Settings &gt; Server Settings</strong>,
          click <strong>Force Reconnect</strong>, and try again.
        </p>
      </div>
    )}
    {!loading && !error && transactions.length === 0 && (
      <div style={styles.noDataMsg}>No transactions found.</div>
    )}
      {!loading && transactions.length > 0 && (
        <div style={styles.mainBlock}>
          <div style={styles.sortAndRefreshRow}>
            <div style={styles.sortRow}>
              <span style={styles.sortLabel}>Sort by:</span>
              <button style={styles.sortBtn} onClick={() => handleSort('time')}>
                Time {sortIndicator('time')}
              </button>
              <button style={styles.sortBtn} onClick={() => handleSort('amount')}>
                Amount {sortIndicator('amount')}
              </button>
            </div>
            <button style={styles.refreshBtn} onClick={handleRefresh}>
              Refresh
            </button>
          </div>
          <div style={styles.tableContainer}>
            <table style={styles.tableBase}>
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={styles.th}>Address</th>
                  <th style={styles.th}>Date/Time</th>
                  <th style={styles.th}>TxID</th>
                  <th style={styles.th}>Dir</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
            </table>
            <div style={styles.tableScroll}>
              <table style={styles.tableBase}>
                <colgroup>
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <tbody>
                  {pageItems.map((tx, idx) => {
                    const addressUsed = tx.addressUsed || '';
                    const dateStr = tx.time > 0
                      ? new Date(tx.time * 1000).toLocaleString()
                      : '—';
                    const shortTxid = tx.txid.slice(0, 8) + '...' + tx.txid.slice(-8);
                    let dirFinal = tx.direction;
                    if (dirFinal === 'in' && isChangeTx(tx)) {
                      dirFinal = 'change';
                    }
                    let dirLabel = '';
                    let dirColor = '#999';
                    if (dirFinal === 'in') {
                      dirLabel = '← In';
                      dirColor = '#0bff0b';
                    } else if (dirFinal === 'out') {
                      dirLabel = '→ Out';
                      dirColor = '#ff6666';
                    } else if (dirFinal === 'change') {
                      dirLabel = 'Change';
                      dirColor = 'goldenrod';
                    } else {
                      dirLabel = (dirFinal || '').toUpperCase();
                      dirColor = '#ccc';
                    }
                    const dogeAmt = tx.amount || 0;
                    const fiatAmt = dogeAmt * dogePriceFiat;
                    const rowKey = `row-${startIndex + idx}`;
                    const isCopied = copiedMap[rowKey] === true;
                    const copyBtnBorder = isCopied ? '1px solid green' : styles.buttonBorder;
                    const isExplorerClicked = explorerClickedMap[rowKey] === true;
                    const explorerBtnBorder = isExplorerClicked ? '1px solid green' : styles.buttonBorder;
                    return (
                      <tr
                        key={rowKey}
                        style={styles.tableRow}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = theme.tableRowHover)
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = 'transparent')
                        }
                      >
                        <td style={styles.td}>{addressUsed}</td>
                        <td style={styles.td}>{dateStr}</td>
                        <td style={{ ...styles.td, fontFamily: 'monospace' }}>
                          <div style={styles.txidCell}>
                            <span>{shortTxid}</span>
                            <button
                              style={{
                                ...styles.copyBtn,
                                border: copyBtnBorder
                              }}
                              onClick={() => copyToClipboard(tx.txid, rowKey)}
                            >
                              Copy
                            </button>
                          </div>
                        </td>
                        <td style={styles.td}>
                          {dirFinal === 'change' ? (
                            <span style={styles.changeBadge}>Change</span>
                          ) : (
                            <span style={{ color: dirColor, fontWeight: 'bold' }}>
                              {dirLabel}
                            </span>
                          )}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          <div>{dogeAmt.toFixed(4)}</div>
                          <div style={styles.fiatLine}>
                            {fiatAmt.toFixed(2)} {fiatCurrency}
                          </div>
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          <button
                            style={{
                              ...styles.explorerBtn,
                              border: explorerBtnBorder
                            }}
                            onClick={() => handleExplorerClick(tx.txid, rowKey)}
                          >
                            Explorer
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div style={styles.paginationRow}>
            <button
              style={styles.pageBtn}
              onClick={() => handleChangePage(-1)}
              disabled={page === 1}
            >
              Prev
            </button>
            <span style={styles.pageInfo}>
              Page {page} of {Math.ceil(totalTxs / pageSize)}
            </span>
            <button
              style={styles.pageBtn}
              onClick={() => handleChangePage(1)}
              disabled={endIndex >= totalTxs}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getStyles(theme) {
  const buttonBorderColor = theme.name === 'dark'
    ? '#666'
    : (theme.borderColor || '#ccc');

  return {
    wrapper: {
      width: '100%',
      boxSizing: 'border-box',
      fontFamily: 'sans-serif',
      color: theme.color,
      backgroundColor: 'transparent',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.8rem',
      position: 'relative'
    },
    errorMsg: {
      backgroundColor: theme.darkMode ? 'rgba(180,60,60,0.2)' : '#fbdada',
      color: theme.darkMode ? '#ff8080' : '#900',
      padding: '0.5rem',
      borderRadius: '6px',
      marginBottom: '0.5rem'
    },
    loadingMsg: {
      color: '#999',
      fontStyle: 'italic'
    },
    noDataMsg: {
      color: '#999',
      marginTop: '1rem'
    },
    mainBlock: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.8rem'
    },
    sortAndRefreshRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '10px'
    },
    sortRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    sortLabel: {
      fontSize: '0.9rem',
      opacity: 0.8
    },
    sortBtn: {
      padding: '0.3rem 0.6rem',
      border: `1px solid ${buttonBorderColor}`,
      backgroundColor: 'transparent',
      color: theme.color,
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '0.8rem'
    },
    refreshBtn: {
      padding: '0.3rem 0.6rem',
      border: `1px solid ${buttonBorderColor}`,
      backgroundColor: 'transparent',
      color: theme.color,
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '0.8rem'
    },
    tableContainer: {
      marginTop: '0.3rem'
    },
    tableBase: {
      width: '100%',
      borderCollapse: 'collapse',
      tableLayout: 'fixed',
      fontSize: '0.85rem'
    },
    tableHeaderRow: {
      backgroundColor: theme.tableHeaderBg
    },
    th: {
      padding: '0.5rem',
      textAlign: 'left',
      borderBottom: `1px solid ${buttonBorderColor}`,
      fontWeight: 'normal',
      fontSize: '0.85rem'
    },
    tableScroll: {
      maxHeight: '300px',
      overflowY: 'auto'
    },
    tableRow: {
      transition: 'background-color 0.15s'
    },
    td: {
      padding: '0.5rem',
      borderBottom: `1px solid ${buttonBorderColor}`,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      verticalAlign: 'middle'
    },
    txidCell: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem'
    },
    copyBtn: {
      padding: '0.2rem 0.4rem',
      color: theme.color,
      borderRadius: '4px',
      fontSize: '0.7rem',
      cursor: 'pointer',
      backgroundColor: 'transparent'
    },
    explorerBtn: {
      padding: '0.3rem 0.6rem',
      backgroundColor: 'transparent',
      color: theme.color,
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '0.75rem'
    },
    fiatLine: {
      fontSize: '0.75rem',
      color: theme.darkMode ? '#bbb' : '#666',
      marginTop: '2px'
    },
    paginationRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      justifyContent: 'center',
      marginTop: '0.5rem'
    },
    pageBtn: {
      padding: '0.3rem 0.6rem',
      border: `1px solid ${buttonBorderColor}`,
      backgroundColor: 'transparent',
      color: theme.color,
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '0.8rem'
    },
    pageInfo: {
      color: theme.color,
      fontSize: '0.9rem'
    },
    buttonBorder: `1px solid ${buttonBorderColor}`,
    changeBadge: {
      display: 'inline-block',
      border: '1px solid goldenrod',
      padding: '0.2rem 0.4rem',
      borderRadius: '4px',
      color: 'goldenrod',
      fontSize: '0.75rem',
      fontWeight: 'bold'
    }
  };
}
