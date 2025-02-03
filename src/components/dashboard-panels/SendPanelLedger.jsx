import React, { useState, useEffect, useRef } from 'react';
import { useThemeContext } from '../../context/ThemeContext';
import { useWallet } from '../../context/WalletContext';
import { getUtxosWithRawTx, sendDogeTransaction } from '../../services/apiService';
import { createPaymentTxLargestFirst } from '../../services/ledgerLocalBuilder';

function SettingsMenu({ onClose }) {
  const { theme } = useThemeContext();
  const styles = getStyles(theme);

  return (
    <div style={styles.settingsMenu}>
      <div
        style={styles.menuItem}
        onClick={() => {
          onClose();
          alert('Reading QR from camera is not implemented in Ledger panel.');
        }}
      >
        Read QR code with camera
      </div>
      <div style={styles.menuSeparator} />
      <div
        style={styles.menuItem}
        onClick={() => {
          onClose();
          alert('Reading QR from screen is not implemented in Ledger panel.');
        }}
      >
        Read QR code from screen
      </div>
      <div style={styles.menuSeparator} />
      <div
        style={styles.menuItem}
        onClick={() => {
          onClose();
          alert('Reading invoice file is not implemented in Ledger panel.');
        }}
      >
        Read invoice from file
      </div>
    </div>
  );
}

export default function SendPanelLedger() {
  const { theme } = useThemeContext();
  const { wallet, serverParam, isLedgerWallet } = useWallet();
  const styles = getStyles(theme);
  const isDark = theme.darkMode || theme.name === 'dark';

  const [recipient, setRecipient] = useState('');
  const [description, setDescription] = useState('');
  const [amountDoge, setAmountDoge] = useState('');
  const [amountFiat, setAmountFiat] = useState('');
  const [allUtxos, setAllUtxos] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const menuRef = useRef(null);

  function toggleSettings() {
    setShowSettings(!showSettings);
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowSettings(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!wallet || !wallet.addresses) return;
    let addresses = wallet.addresses.map(a => a.address);
    if (isLedgerWallet && wallet.addresses[0]) {
      addresses = [wallet.addresses[0].address];
    }
    getUtxosWithRawTx(addresses, serverParam)
      .then(res => {
        setAllUtxos(res);
      })
      .catch(err => {
        console.error('[SendPanelLedger] getUtxosWithRawTx error:', err);
        setAllUtxos([]);
      });
  }, [wallet, serverParam, isLedgerWallet]);

  async function handleSend() {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const amt = parseFloat(amountDoge) || 0;
      if (!recipient || amt <= 0) {
        throw new Error('Invalid recipient or amount');
      }
      if (!allUtxos.length) {
        throw new Error('No UTXOs available');
      }
      if (!wallet || !wallet.addresses) {
        throw new Error('No addresses in wallet');
      }
      const txData = createPaymentTxLargestFirst({
        utxos: allUtxos,
        addressObjects: wallet.addresses,
        recipientAddr: recipient.trim(),
        amountDoge: amt,
      });
      const ledgerResp = await window.electronAPI.ledgerSignTransaction(txData);
      if (!ledgerResp.success) {
        throw new Error('Ledger sign error: ' + ledgerResp.error);
      }
      const signedTxHex = ledgerResp.signedTxHex;
      const sendResp = await sendDogeTransaction(signedTxHex, serverParam);
      if (!sendResp.txid) {
        throw new Error('No txid from broadcast');
      }
      setSuccessMsg(`Transaction sent! TXID: ${sendResp.txid}`);
    } catch (err) {
      console.error('[SendPanelLedger] handleSend error:', err);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handlePaste() {
    navigator.clipboard.readText().then(
      txt => setRecipient(txt),
      () => alert('Failed to read from clipboard.')
    );
  }
  function handleMax() {
    alert('Max button not implemented in Ledger mode.');
  }
  function handleClear() {
    setRecipient('');
    setDescription('');
    setAmountDoge('');
    setAmountFiat('');
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(false);
  }

  return (
    <div style={styles.container}>
      <div style={styles.formRow}>
        <label style={styles.formLabel}>Recipient</label>
        <div style={styles.recipientContainer}>
          <input
            style={styles.wideInput}
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
          <div style={styles.pasteAndSettings} ref={menuRef}>
            <button style={styles.settingsBtn} onClick={toggleSettings}>
              <img src="/images/settings.png" alt="Settings" style={styles.iconImg} />
            </button>
            {showSettings && (
              <SettingsMenu onClose={() => setShowSettings(false)} />
            )}
            <button style={styles.pasteBtn} onClick={handlePaste}>
              <img src="/images/paste-icon.png" alt="Paste" style={styles.iconImg} />
            </button>
          </div>
        </div>
      </div>

      <div style={styles.formRow}>
        <label style={styles.formLabel}>Description</label>
        <input
          style={styles.wideInput}
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="(not used in Ledger mode)"
        />
      </div>

      <div style={styles.formRow}>
        <label style={styles.formLabel}>Amount</label>
        <div style={styles.amountLine}>
          <div style={styles.suffixContainer}>
            <input
              style={styles.suffixInput}
              value={amountDoge}
              onChange={(e) => setAmountDoge(e.target.value)}
              placeholder="0.0"
            />
            <div style={styles.suffixLabel}>DOGE</div>
          </div>
          <div style={styles.suffixContainer}>
            <input
              style={styles.suffixInput}
              value={amountFiat}
              onChange={(e) => setAmountFiat(e.target.value)}
              placeholder="USD"
            />
            <div style={styles.suffixLabel}>USD</div>
          </div>
          <div style={styles.maxLink} onClick={handleMax}>
            Max
          </div>
        </div>
      </div>

      <div style={styles.buttonsContainer}>
        <button style={styles.clearBtn} onClick={handleClear}>
          Clear
        </button>
        <button style={styles.payBtn} onClick={handleSend} disabled={loading}>
          {loading ? 'Sending...' : 'Send (Ledger)'}
        </button>
      </div>

      {errorMsg && (
        <div style={styles.errorBox}>
          Error: {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={styles.successBox}>
          {successMsg}
        </div>
      )}

      {loading && (
        <div style={styles.loadingInfo}>
          Please confirm the transaction on your Ledger device...
        </div>
      )}
    </div>
  );
}

function getStyles(theme) {
  const isDark = theme.darkMode || theme.name === 'dark';
  const textColor = theme.color || '#333';
  const inputBorderColor = theme.inputBorder || (isDark ? '#777' : '#ccc');
  const borderColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)';
  const inputBg = theme.inputBg || (isDark ? '#2f2f2f' : '#fff');

  return {
    container: {
      position: 'relative',
      padding: '2rem 1rem',
      fontSize: '0.85rem',
      color: textColor,
    },
    formRow: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: '0.6rem',
      gap: '0.5rem',
    },
    formLabel: {
      width: '80px',
      textAlign: 'left',
      fontWeight: 'bold',
      flexShrink: 0,
    },
    wideInput: {
      width: '500px',
      height: 22,
      border: `1px solid ${inputBorderColor}`,
      borderRadius: 4,
      background: inputBg,
      color: textColor,
      outline: 'none',
      fontSize: '0.85rem',
      padding: '0 6px',
    },
    recipientContainer: {
      position: 'relative',
    },
    pasteAndSettings: {
      position: 'absolute',
      top: '-24px',
      left: '505px',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      alignItems: 'flex-end',
    },
    settingsBtn: {
      width: 30,
      height: 22,
      border: `1px solid ${inputBorderColor}`,
      borderRadius: 4,
      background: isDark ? 'rgb(69,83,100)' : 'none',
      color: textColor,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pasteBtn: {
      width: 30,
      height: 22,
      border: `1px solid ${inputBorderColor}`,
      borderRadius: 4,
      background: isDark ? 'rgb(69,83,100)' : 'none',
      color: textColor,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconImg: {
      width: 14,
      height: 14,
    },
    settingsMenu: {
      position: 'absolute',
      top: 22,
      right: 0,
      background: isDark ? 'rgb(69,83,100)' : '#fff',
      border: `1px solid ${borderColor}`,
      borderRadius: 4,
      padding: '4px 0',
      minWidth: 170,
      zIndex: 999,
    },
    menuSeparator: {
      height: 1,
      backgroundColor: isDark ? '#666' : '#ccc',
      margin: '2px 0',
    },
    menuItem: {
      padding: '6px 12px',
      color: textColor,
      fontSize: '0.85rem',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    },
    amountLine: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.8rem',
    },
    suffixContainer: {
      position: 'relative',
      width: 110,
    },
    suffixInput: {
      width: '100%',
      height: 22,
      border: `1px solid ${inputBorderColor}`,
      borderRadius: 4,
      background: inputBg,
      color: textColor,
      outline: 'none',
      fontSize: '0.85rem',
      padding: '0 28px 0 6px',
      boxSizing: 'border-box',
    },
    suffixLabel: {
      position: 'absolute',
      right: 6,
      top: '50%',
      transform: 'translateY(-50%)',
      color: textColor,
      opacity: 0.6,
      fontSize: '0.75rem',
      pointerEvents: 'none',
    },
    maxLink: {
      fontSize: '0.85rem',
      opacity: 0.7,
      color: textColor,
      cursor: 'pointer',
      textDecoration: 'underline',
    },
    buttonsContainer: {
      marginTop: '1.2rem',
      marginLeft: '450px',
      display: 'flex',
      gap: '0.5rem',
    },
    clearBtn: {
      height: 22,
      padding: '0 8px',
      border: `1px solid ${inputBorderColor}`,
      borderRadius: 4,
      background: 'none',
      color: textColor,
      cursor: 'pointer',
      fontSize: '0.8rem',
    },
    payBtn: {
      height: 22,
      padding: '0 10px',
      border: `1px solid ${inputBorderColor}`,
      borderRadius: 4,
      background: isDark ? 'rgb(69,83,100)' : 'none',
      color: textColor,
      cursor: 'pointer',
      fontWeight: 'bold',
      fontSize: '0.8rem',
    },
    errorBox: {
      marginTop: '0.5rem',
      backgroundColor: isDark ? 'rgba(255,60,60,0.2)' : '#fdd',
      color: isDark ? '#fbb' : '#900',
      padding: '0.4rem',
      borderRadius: '4px',
      fontSize: '0.85rem',
    },
    successBox: {
      marginTop: '0.5rem',
      backgroundColor: isDark ? 'rgba(60,255,60,0.2)' : '#dfd',
      color: isDark ? '#bfffbf' : '#090',
      padding: '0.4rem',
      borderRadius: '4px',
      fontSize: '0.85rem',
    },
    loadingInfo: {
      marginTop: '1rem',
      color: isDark ? '#ccc' : '#666',
      fontSize: '0.85rem',
    },
  };
}
