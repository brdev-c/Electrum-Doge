import React, { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useThemeContext } from '../../context/ThemeContext';
import { useWallet } from '../../context/WalletContext';
import { buildNextOfferAddress } from '../../services/walletService';
import { getDogeBalance } from '../../services/apiService';

export default function ReceivePanel() {
  const { theme } = useThemeContext();
  const { wallet, setWallet, fiatCurrency, dogePriceFiat, serverParam } = useWallet();
  const styles = getStyles(theme);
  const isDark = theme.darkMode || theme.name === 'dark';

  const [description, setDescription] = useState('');
  const [amountDoge, setAmountDoge] = useState('');
  const [amountFiat, setAmountFiat] = useState('');
  const [expiry, setExpiry] = useState('1 day');
  const [showQr, setShowQr] = useState(false);
  const [isDogeUri, setIsDogeUri] = useState(true);
  const [requestText, setRequestText] = useState('');
  const [requests, setRequests] = useState([]);
  const walletId = wallet?.mnemonic || wallet?.address || 'temp';
  const [tableMaxHeight, setTableMaxHeight] = useState('200px');
  const initialWindowHeightRef = useRef(window.innerHeight);

  useEffect(() => {
    const saved = localStorage.getItem('app_receiveRequests_' + walletId);
    if (saved) {
      try {
        const arr = JSON.parse(saved);
        setRequests(arr);
      } catch {}
    }
  }, [walletId]);

  useEffect(() => {
    localStorage.setItem('app_receiveRequests_' + walletId, JSON.stringify(requests));
  }, [requests, walletId]);

  useEffect(() => {
    const timer = setInterval(() => {
      checkRequestsStatus();
    }, 10000);
    return () => clearInterval(timer);
  }, [requests]);

  async function checkRequestsStatus() {
    const updated = [...requests];
    for (const req of updated) {
      if (req.status === 'active') {
        const elapsedMs = Date.now() - req.createdAt;
        if (elapsedMs >= req.expirySec * 1000) {
          req.status = 'overdue';
          continue;
        }
        try {
          const bal = await getDogeBalance(req.address, serverParam);
          const netReceived = (bal.confirmed || 0) - (req.initialBalance || 0);
          if (req.amountDoge > 0) {
            if (netReceived >= req.amountDoge) {
              req.status = 'paid';
              req.paidAt = Date.now();
              req.paidAmount = netReceived;
            }
          } else {
            if (netReceived > 0) {
              req.status = 'paid';
              req.paidAt = Date.now();
              req.paidAmount = netReceived;
            }
          }
        } catch {}
      }
    }
    setRequests(updated);
  }

  async function handleCreate() {
    try {
      let expSec = 86400;
      if (expiry === '3 days') expSec = 3 * 86400;
      else if (expiry === '1 week') expSec = 7 * 86400;
      const nextAddrInfo = buildNextOfferAddress(wallet);
      if (!nextAddrInfo.ok) {
        alert('Failed to create new receiving address');
        return;
      }
      const dogeNum = parseFloat(amountDoge) || 0;
      const now = Date.now();
      const address = nextAddrInfo.address;
      const bal = await getDogeBalance(address, serverParam);
      const initialBal = bal.confirmed || 0;
      const newReq = {
        id: now.toString(),
        address,
        createdAt: now,
        description: description.trim(),
        amountDoge: dogeNum,
        expirySec: expSec,
        status: 'active',
        paidAt: null,
        paidAmount: 0,
        initialBalance: initialBal
      };
      setRequests(prev => [newReq, ...prev]);
      const dogeUri = buildDogeUri(address, dogeNum, description);
      setRequestText(dogeUri);
      setShowQr(true);
      setWallet(nextAddrInfo.updatedWallet);
    } catch (err) {}
  }

  function buildDogeUri(address, dogeAmount, desc) {
    const labelEnc = encodeURIComponent((desc || '').trim());
    let dogeUri = `dogecoin:${address}`;
    if (dogeAmount > 0) {
      dogeUri += `?amount=${dogeAmount}`;
      if (labelEnc) {
        dogeUri += `&label=${labelEnc}`;
      }
    } else if (labelEnc) {
      dogeUri += `?label=${labelEnc}`;
    }
    return dogeUri;
  }

  function handleClear() {
    setDescription('');
    setAmountDoge('');
    setAmountFiat('');
    setRequestText('');
    setShowQr(false);
  }

  function toggleExpiry() {
    if (expiry === '1 day') setExpiry('3 days');
    else if (expiry === '3 days') setExpiry('1 week');
    else setExpiry('1 day');
  }

  function toggleUriType() {
    setIsDogeUri(!isDogeUri);
    setShowQr(false);
  }

  function onChangeDoge(e) {
    const val = e.target.value;
    setAmountDoge(val);
    if (!val) {
      setAmountFiat('');
      return;
    }
    const dogeNum = parseFloat(val);
    if (!isNaN(dogeNum) && dogeNum > 0 && dogePriceFiat > 0) {
      setAmountFiat((dogeNum * dogePriceFiat).toFixed(2));
    } else {
      setAmountFiat('');
    }
  }

  function onChangeFiat(e) {
    const val = e.target.value;
    setAmountFiat(val);
    if (!val) {
      setAmountDoge('');
      return;
    }
    const fiatNum = parseFloat(val);
    if (!isNaN(fiatNum) && fiatNum > 0 && dogePriceFiat > 0) {
      setAmountDoge((fiatNum / dogePriceFiat).toFixed(4));
    } else {
      setAmountDoge('');
    }
  }

  const displayedText = requestText
    ? isDogeUri
      ? requestText
      : requestText.replace(/^dogecoin:/, '').split('?')[0]
    : '';

  function handleQrButton() {
    if (!requestText) return;
    setShowQr(!showQr);
  }

  function handleRequestRowClick(req) {
    const dogeUri = buildDogeUri(req.address, req.amountDoge, req.description);
    setRequestText(dogeUri);
    setShowQr(false);
  }

  function renderTableRows() {
    return requests.map(req => {
      const dateStr = new Date(req.createdAt).toLocaleString();
      let amtStr = '';
      if (req.amountDoge > 0) {
        amtStr = req.amountDoge.toFixed(6) + ' DOGE';
      } else {
        if (req.status === 'paid' && req.paidAmount) {
          amtStr = req.paidAmount.toFixed(6) + ' DOGE';
        }
      }
      let statusCell;
      if (req.status === 'overdue') {
        statusCell = (
          <>
            <img src="./images/icon-overdue.png" alt="overdue" style={styles.statusIcon} />
            Overdue
          </>
        );
      } else if (req.status === 'paid') {
        statusCell = (
          <>
            <img src="./images/success.png" alt="paid" style={styles.statusIcon} />
            Paid {req.paidAmount > 0 && `(${req.paidAmount.toFixed(6)} DOGE)`}
          </>
        );
      } else if (req.status === 'active') {
        const elapsedMs = Date.now() - req.createdAt;
        const remainSec = req.expirySec - Math.floor(elapsedMs / 1000);
        if (remainSec <= 0) {
          statusCell = (
            <>
              <img src="./images/icon-overdue.png" alt="overdue" style={styles.statusIcon} />
              Overdue
            </>
          );
        } else {
          const remainH = Math.ceil(remainSec / 3600);
          statusCell = (
            <>
              <img src="./images/icon-expires.png" alt="active" style={styles.statusIcon} />
              Expires in {remainH}h
            </>
          );
        }
      } else {
        statusCell = (
          <>
            <img src="./images/icon-overdue.png" alt="?" style={styles.statusIcon} />
            Overdue
          </>
        );
      }
      return (
        <tr key={req.id} style={{ cursor: 'pointer' }} onClick={() => handleRequestRowClick(req)}>
          <td style={{ ...styles.td, ...styles.tdFirstBottom }}>{dateStr}</td>
          <td style={styles.td}>{req.description}</td>
          <td style={styles.td}>{amtStr}</td>
          <td style={styles.td}>{req.address}</td>
          <td style={styles.td}>{statusCell}</td>
        </tr>
      );
    });
  }

  useEffect(() => {
    function updateTableHeight() {
      const rowHeight = 40;
      const minHeight = 3.3 * rowHeight;
      const headerOffset = 250;
      const available = window.innerHeight - headerOffset;
      if (window.innerHeight > initialWindowHeightRef.current) {
        setTableMaxHeight(`${available > minHeight ? available : minHeight}px`);
      } else {
        setTableMaxHeight(`${minHeight}px`);
      }
    }
    updateTableHeight();
    window.addEventListener('resize', updateTableHeight);
    return () => window.removeEventListener('resize', updateTableHeight);
  }, []);

  return (
    <div style={styles.wrapper}>
      <style>{`
        .table-scroll {
          overflow-y: auto;
          scrollbar-width: thin;
        }
        .table-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .table-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .table-scroll::-webkit-scrollbar-thumb {
          background-color: rgb(69,83,100);
        }
      `}</style>
      <div style={styles.topSection}>
        <div style={styles.formLeft}>
          <div style={styles.formRow}>
            <label style={styles.formLabel}>Description</label>
            <input
              style={styles.formInputFull}
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div style={styles.formRow}>
            <label style={styles.formLabel}>Requested amount</label>
            <div style={styles.formInputLine}>
              <div style={styles.suffixContainer}>
                <input
                  style={styles.inputWithSuffix}
                  type="text"
                  value={amountDoge}
                  onChange={onChangeDoge}
                  placeholder="0.0"
                />
                <div style={styles.suffixLabel}>DOGE</div>
              </div>
              <div style={styles.suffixContainer}>
                <input
                  style={styles.inputWithSuffix}
                  type="text"
                  value={amountFiat}
                  onChange={onChangeFiat}
                  placeholder={fiatCurrency}
                />
                <div style={styles.suffixLabel}>{fiatCurrency}</div>
              </div>
            </div>
          </div>
          <div style={styles.formRow}>
            <label style={styles.formLabel}>Expires</label>
            <button style={styles.expiryButton} onClick={toggleExpiry}>
              {expiry}
            </button>
          </div>
          <div style={styles.buttonRow}>
            <button style={styles.clearBtn} onClick={handleClear}>
              Clear
            </button>
            <button
              style={styles.createBtn}
              onClick={handleCreate}
            >
              Create Offer
            </button>
          </div>
        </div>
        <div style={styles.formRight}>
          <div style={styles.rightButtonsRow}>
            <button style={styles.uriToggleBtn} onClick={toggleUriType}>
              <img
                src={isDogeUri ? './images/link-icon.png' : './images/dogecoin.png'}
                alt="switch"
                style={{ width: 16, height: 16, marginRight: 3 }}
              />
              {isDogeUri ? 'Doge URI' : 'Address'}
            </button>
            <button style={styles.uriQrBtn} onClick={handleQrButton}>
              <img src="./images/qr-icon.png" alt="QR" style={{ width: 16, height: 16 }} />
            </button>
          </div>
          <div style={styles.uriBorder}>
            {requestText && !showQr && (
              <textarea style={styles.uriTextarea} readOnly value={displayedText} />
            )}
            {requestText && showQr && (
              <div style={styles.qrContainer}>
                <QRCodeCanvas value={displayedText} size={120} includeMargin />
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={styles.bottomSection}>
        <h4 style={styles.tableTitle}>Requests</h4>
        <div style={styles.tableWrapper}>
          <table style={styles.requestsTable}>
            <colgroup>
              <col style={{ width: '16%' }} />
              <col style={{ width: '23%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Description</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Address</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
          </table>
          <div className="table-scroll" style={{ maxHeight: tableMaxHeight }}>
            <table style={{ ...styles.requestsTable, marginTop: 0 }}>
              <colgroup>
                <col style={{ width: '16%' }} />
                <col style={{ width: '23%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <tbody>{renderTableRows()}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStyles(theme) {
  const isDark = theme.darkMode || theme.name === 'dark';
  const lineColor = theme.inputBorder || (isDark ? '#777' : '#ccc');
  const textColor = theme.color;
  const inputBg = theme.inputBg || (isDark ? 'rgb(25,35,45)' : '#fff');
  const tableHeaderBackground = theme.tableHeaderBg || (isDark ? 'rgb(69,83,100)' : '#f1f1f1');
  const tableHeaderColor = isDark ? '#fff' : '#333';
  return {
    wrapper: {
        width: '100%',
  boxSizing: 'border-box',
  padding: '1rem',
  color: textColor,
  backgroundColor: 'transparent',
},
    topSection: {
      display: 'flex',
      gap: '1rem',
      marginTop: '2rem',
      marginBottom: '1rem',
      alignItems: 'flex-start'
    },
    formLeft: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem'
    },
    formRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    formLabel: {
      width: '120px',
      textAlign: 'left',
      fontSize: '0.85rem',
      fontWeight: 'normal'
    },
    formInputFull: {
      flex: 1,
      padding: '3px 5px',
      backgroundColor: inputBg,
      color: textColor,
      border: `1px solid ${lineColor}`,
      borderRadius: 4,
      outline: 'none',
      fontSize: '0.85rem',
      height: 24
    },
    formInputLine: {
      display: 'flex',
      gap: '0.5rem'
    },
    suffixContainer: {
      position: 'relative',
      width: '120px'
    },
    inputWithSuffix: {
      width: '100%',
      padding: '3px 28px 3px 5px',
      border: `1px solid ${lineColor}`,
      borderRadius: 4,
      outline: 'none',
      backgroundColor: inputBg,
      color: textColor,
      boxSizing: 'border-box',
      height: 24,
      fontSize: '0.85rem'
    },
    suffixLabel: {
      position: 'absolute',
      right: 4,
      top: '50%',
      transform: 'translateY(-50%)',
      pointerEvents: 'none',
      fontSize: '0.8rem',
      color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'
    },
    expiryButton: {
      padding: '2px 8px',
      border: `1px solid ${lineColor}`,
      borderRadius: 4,
      backgroundColor: isDark ? 'rgb(69,83,100)' : 'none',
      color: isDark ? '#fff' : textColor,
      cursor: 'pointer',
      height: 24,
      fontSize: '0.85rem'
    },
    buttonRow: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '0.5rem',
      marginTop: '0.5rem'
    },
    clearBtn: {
      padding: '2px 10px',
      border: `1px solid ${lineColor}`,
      borderRadius: 4,
      backgroundColor: isDark ? 'rgb(69,83,100)' : 'none',
      color: isDark ? '#fff' : textColor,
      cursor: 'pointer',
      fontSize: '0.85rem',
      height: 24
    },
    createBtn: {
      padding: '2px 10px',
      border: `1px solid ${lineColor}`,
      borderRadius: 4,
      backgroundColor: isDark ? 'rgb(69,83,100)' : 'none',
      color: isDark ? '#fff' : textColor,
      cursor: 'pointer',
      fontSize: '0.85rem',
      height: 24
    },
    formRight: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '0.5rem',
      alignSelf: 'flex-start',
      marginTop: '-2.1rem'
    },
    rightButtonsRow: {
      display: 'flex',
      gap: '0.5rem'
    },
    uriToggleBtn: {
      display: 'flex',
      alignItems: 'center',
      padding: '2px 8px',
      backgroundColor: isDark ? 'rgb(69,83,100)' : 'none',
      color: isDark ? '#fff' : textColor,
      border: `1px solid ${lineColor}`,
      borderRadius: 4,
      cursor: 'pointer',
      fontSize: '0.8rem',
      height: 24
    },
    uriQrBtn: {
      width: 36,
      height: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgb(69,83,100)' : 'none',
      color: isDark ? '#fff' : textColor,
      border: `1px solid ${lineColor}`,
      borderRadius: 4,
      cursor: 'pointer'
    },
    uriBorder: {
      width: '160px',
      height: '160px',
      border: `1px solid ${lineColor}`,
      borderRadius: 6,
      padding: 4,
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    uriTextarea: {
      width: '98%',
      height: '90%',
      resize: 'none',
      backgroundColor: 'transparent',
      border: 'none',
      outline: 'none',
      color: textColor,
      fontSize: '0.85rem'
    },
    qrContainer: {
      backgroundColor: '#fff',
      borderRadius: 4,
      padding: 4
    },
    bottomSection: {
      flex: 1,
      marginTop: '-1rem'
    },
    tableTitle: {
      margin: '0 0 0.5rem',
      fontSize: '1rem'
    },
    tableWrapper: {
      border: `1px solid ${lineColor}`,
      borderRadius: 6
    },
    requestsTable: {
      width: '100%',
      borderCollapse: 'separate',
      borderSpacing: 0,
      fontSize: '0.85rem',
      tableLayout: 'fixed'
    },
    tableHeaderRow: {
      backgroundColor: tableHeaderBackground,
      color: tableHeaderColor
    },
    th: {
      textAlign: 'left',
      fontSize: '0.85rem',
      padding: '0.4rem',
      lineHeight: 1.2,
      borderBottom: `1px solid ${lineColor}`
    },
    td: {
      padding: '0.5rem',
      borderBottom: `1px solid ${lineColor}`,
      fontSize: '0.85rem',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    },
    tdFirstBottom: {
      borderBottomLeftRadius: 6
    },
    statusIcon: {
      width: 14,
      height: 14,
      marginRight: 4,
      verticalAlign: 'middle'
    }
  };
}
