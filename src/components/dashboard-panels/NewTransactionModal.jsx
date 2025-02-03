import React, { useState, useEffect, useRef } from 'react';
import { useThemeContext } from '../../context/ThemeContext';
import { useWallet } from '../../context/WalletContext';

import {
  getUtxosWithRawTx,
  estimateDogeFee,
  sendDogeTransaction
} from '../../services/apiService';

import {
  createAndSignTx,
  createUnsignedTx
} from '../../services/walletService';

export default function NewTransactionModal({
  onClose,
  recipient,
  description,
  amountDoge,
  onTxSuccess,
  isMax = false
}) {
  const { theme } = useThemeContext();
  const { wallet, serverParam } = useWallet();
  const [feeRate, setFeeRate] = useState(200);
  const [feeTarget, setFeeTarget] = useState(5); // ползунок 1..10
  const [manualFees, setManualFees] = useState(false);
  const [showInputs, setShowInputs] = useState(false);
  const [lockTimeEnabled, setLockTimeEnabled] = useState(false);
  const [lockTimeType, setLockTimeType] = useState('blockheight');
  const [lockTimeValue, setLockTimeValue] = useState('');
  const [useChangeAddr, setUseChangeAddr] = useState(true);
  const [draftInputs, setDraftInputs] = useState([]);
  const [draftOutputs, setDraftOutputs] = useState([]);
  const [vbytes, setVbytes] = useState(0);
  const [feeDoge, setFeeDoge] = useState(0);
  const [feePct, setFeePct] = useState(0);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentTxid, setSentTxid] = useState(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const styles = getStyles(theme);


  useEffect(() => {
    handleEstimateFee(feeTarget);
  }, []);

  useEffect(() => {
    if (!isMax && !manualFees) {
      handleEstimateFee(feeTarget);
    }
  }, [feeTarget]);

  useEffect(() => {
    draftTxBuild();
  }, [
    isMax,
    manualFees,
    feeRate,
    lockTimeEnabled,
    lockTimeType,
    lockTimeValue,
    useChangeAddr,
    wallet
  ]);

  const settingsMenuRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(e) {
      if (!settingsMenuRef.current) return;
      if (!settingsMenuRef.current.contains(e.target)) {
        setShowSettingsMenu(false);
      }
    }
    if (showSettingsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettingsMenu]);

  async function handleEstimateFee(targetBlocks) {
    try {
      const feePerKb = await estimateDogeFee(targetBlocks, serverParam);
      if (feePerKb && feePerKb > 0) {
        let spb = Math.floor((feePerKb * 1e8) / 1000);
        if (spb < 50) spb = 50;
        if (spb > 100000) spb = 100000;
        setFeeRate(spb);
      }
    } catch (err) {
      setFeeRate(200);
    }
  }

  async function draftTxBuild() {
    setDraftInputs([]);
    setDraftOutputs([]);
    setVbytes(0);
    setFeeDoge(0);
    setFeePct(0);
    setErrorMsg('');
    setInfoMsg('');

    if (sentTxid) return;

    setDraftLoading(true);

    try {
      if (!wallet || !wallet.addresses) return;
      const amtNum = parseFloat(amountDoge) || 0;
      if (!recipient || amtNum <= 0) return;

      let utxos = await getUtxosWithRawTx(
        wallet.addresses.map(a => a.address),
        serverParam
      );
      if (!utxos.length) return;

      const recipients = [
        {
          address: recipient.trim(),
          valueSat: Math.floor(amtNum * 1e8)
        }
      ];

      const lockTime = lockTimeEnabled
        ? parseLockTime(lockTimeType, lockTimeValue)
        : null;

      const draft = await createUnsignedTx({
        recipients,
        feeRate,
        allUtxos: utxos,
        walletAddresses: wallet.addresses,
        lockTime,
        useChange: useChangeAddr
      });

      setDraftInputs(draft.inputs);
      setDraftOutputs(draft.outputs);

      setVbytes(draft.vbytes || 150);
      const feeDOGE = (draft.feeSat || 0) / 1e8;
      setFeeDoge(feeDOGE);

      const amtNumDoge = parseFloat(amountDoge) || 0;
      if (amtNumDoge > 0) {
        const pct = (feeDOGE / amtNumDoge) * 100;
        setFeePct(pct);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setDraftLoading(false);
    }
  }

  function parseLockTime(type, val) {
    const num = parseInt(val, 10) || 0;
    switch (type) {
      case 'raw':
        return num;
      case 'blockheight':
        return num;
      case 'date':
        return num; // здесь можно парсить дату
      default:
        return 0;
    }
  }

  async function handleClickOK() {
    if (sentTxid) {
      onClose();
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      setInfoMsg('');

      if (!wallet || !wallet.addresses) {
        throw new Error('No wallet loaded');
      }
      const amt = parseFloat(amountDoge) || 0;
      if (!recipient || amt <= 0) {
        throw new Error('Invalid transaction data. Check recipient/amount.');
      }

      let utxos = await getUtxosWithRawTx(
        wallet.addresses.map(a => a.address),
        serverParam
      );
      if (!utxos.length) {
        throw new Error('No available UTXOs.');
      }

      const recipients = [
        {
          address: recipient.trim(),
          valueSat: Math.floor(amt * 1e8)
        }
      ];

      const lockTime = lockTimeEnabled
        ? parseLockTime(lockTimeType, lockTimeValue)
        : null;

      const { txHex } = await createAndSignTx({
        recipients,
        feeRate,
        allUtxos: utxos,
        walletAddresses: wallet.addresses,
        lockTime,
        useChange: useChangeAddr
      });

      // Отправка
      const { txid } = await sendDogeTransaction(txHex, serverParam);
      if (!txid) {
        throw new Error('Broadcast failed (no txid).');
      }
      setSentTxid(txid);
      setInfoMsg(`Success! TXID: ${txid}`);

      // Вызываем колбэк, чтобы родитель знал
      onTxSuccess({ txid });

      // И отправляем IPC для уведомления об исходящем платеже
      window.electronAPI.notifyOutgoingTransaction({
        txid,
        amountDoge: amt,
        to: recipient
      });

    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to send transaction');
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    onClose();
  }

  function toggleSettingsMenu() {
    setShowSettingsMenu(!showSettingsMenu);
  }

  const isFeeTooHigh = feePct > 10;
  const canEditFee = !isMax; 

  return (
    <div style={styles.overlay}>
      <div style={showInputs ? styles.modalExpanded : styles.modal}>
        {/* HEADER */}
        <div style={styles.header}>
          <h3 style={styles.title}>New Transaction</h3>
          <div style={styles.headerRight}>
            {canEditFee && (
              <button style={styles.settingsBtn} onClick={toggleSettingsMenu}>
                <img
                  src="/images/settings.png"
                  alt="Settings"
                  style={{ width: 14, height: 14 }}
                />
              </button>
            )}
            <button style={styles.closeBtn} onClick={handleCancel}>
              ×
            </button>
          </div>
        </div>

        {/* SETTINGS MENU */}
        {canEditFee && showSettingsMenu && (
          <div style={styles.settingsMenu} ref={settingsMenuRef}>
            <label style={styles.settingsItem}>
              <input
                type="checkbox"
                checked={showInputs}
                onChange={() => setShowInputs(!showInputs)}
              />
              Show inputs and outputs
            </label>
            <label style={styles.settingsItem}>
              <input
                type="checkbox"
                checked={manualFees}
                onChange={() => setManualFees(!manualFees)}
              />
              Edit fees manually
            </label>
            <label style={styles.settingsItem}>
              <input
                type="checkbox"
                checked={lockTimeEnabled}
                onChange={() => setLockTimeEnabled(!lockTimeEnabled)}
              />
              Edit lockTime
            </label>
            <label style={styles.settingsItem}>
              <input
                type="checkbox"
                checked={useChangeAddr}
                onChange={() => setUseChangeAddr(!useChangeAddr)}
              />
              Use addresses for change
            </label>
          </div>
        )}

        {/* BODY */}
        {!sentTxid && (
          <>
            <div style={styles.body}>
              <div style={styles.formRow}>
                <label style={styles.label}>Amount:</label>
                <div style={styles.valueText}>{amountDoge} DOGE</div>
              </div>

              <div style={styles.formRow}>
                <label style={styles.label}>Mining Fee:</label>
                {!manualFees && (
                  <div style={styles.feeLine}>
                    <span>{feeRate} sat/byte</span>
                    <span style={styles.xBytes}>
                      ≈ {feeDoge.toFixed(8)} DOGE
                    </span>
                  </div>
                )}
                {manualFees && canEditFee && (
                  <div style={styles.feeLine}>
                    <input
                      type="number"
                      style={styles.inputField}
                      value={feeRate}
                      onChange={(e) => {
                        const val = parseInt(e.target.value || '0', 10);
                        setFeeRate(val);
                        draftTxBuild();
                      }}
                    />
                    <span style={styles.xBytes}>sat/byte</span>
                    <span style={{ marginLeft: '0.6rem' }}>
                      ~ {feeDoge.toFixed(8)} DOGE
                    </span>
                  </div>
                )}
                {manualFees && !canEditFee && (
                  <div>
                    <em>Fee editing disabled in MAX mode</em>
                  </div>
                )}
              </div>

              {!manualFees && canEditFee && (
                <div style={styles.formRow}>
                  <label style={styles.label}>Fee target:</label>
                  <div style={styles.sliderWrap}>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={feeTarget}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setFeeTarget(val);
                        handleEstimateFee(val);
                      }}
                    />
                    <span style={styles.sliderText}>{feeTarget} blocks</span>
                  </div>
                </div>
              )}

              {lockTimeEnabled && canEditFee && (
                <div style={styles.formRow}>
                  <label style={styles.label}>LockTime:</label>
                  <div style={styles.lockTimeWrap}>
                    <select
                      style={styles.selectField}
                      value={lockTimeType}
                      onChange={(e) => setLockTimeType(e.target.value)}
                    >
                      <option value="raw">Raw</option>
                      <option value="blockheight">Block height</option>
                      <option value="date">Date (timestamp)</option>
                    </select>
                    <input
                      type="number"
                      style={styles.inputField}
                      placeholder="value"
                      value={lockTimeValue}
                      onChange={(e) => setLockTimeValue(e.target.value)}
                    />
                    <span style={styles.lockTimeSuffix}>
                      {lockTimeType === 'blockheight' ? 'height' : ''}
                    </span>
                  </div>
                </div>
              )}

              {isFeeTooHigh && (
                <div style={styles.warningLine}>
                  This fee is unusually high: {feePct.toFixed(2)}% of amount.
                </div>
              )}

              {draftLoading && (
                <div style={styles.loadingDraft}>
                  <img
                    src="/images/spinner.gif"
                    alt="loading"
                    style={{ width: 20, height: 20, marginRight: 8 }}
                  />
                  Building transaction draft...
                </div>
              )}

              {!draftLoading && showInputs && (
                <div>
                  <div style={styles.ioBox}>
                    <h4 style={styles.ioTitle}>
                      Inputs ({draftInputs.length})
                    </h4>
                    {draftInputs.map((inp, idx) => (
                      <div key={idx} style={styles.ioRow}>
                        <div style={styles.ioLine}>
                          <strong>
                            {inp.txid}:{inp.vout}
                          </strong>
                          <span style={{ marginLeft: '0.5rem', opacity: 0.8 }}>
                            {inp.address}
                          </span>
                          <span style={{ marginLeft: '1rem', fontWeight: 'bold' }}>
                            {(inp.value / 1e8).toFixed(8)} DOGE
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={styles.ioBox}>
                    <h4 style={styles.ioTitle}>
                      Outputs ({draftOutputs.length})
                    </h4>
                    {draftOutputs.map((out, idx) => {
                      const valDoge = (out.value / 1e8).toFixed(8);
                      return (
                        <div key={idx} style={styles.ioRow}>
                          <div style={styles.ioLine}>
                            <span>{out.address}</span>
                            <span style={{ marginLeft: '1rem', fontWeight: 'bold' }}>
                              {valDoge} DOGE
                            </span>
                            {out.isChange && (
                              <span style={{ marginLeft: '0.5rem', color: '#ffd700' }}>
                                (change)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {sentTxid && (
          <div style={styles.successContainer}>
            <img
              src="/images/success.png"
              alt="success"
              style={{ width: 64, height: 64, marginBottom: '0.5rem' }}
            />
            <h4 style={{ margin: 0 }}>Transaction sent successfully!</h4>
            <p style={{ margin: '0.5rem 0' }}>TXID: {sentTxid}</p>
          </div>
        )}

        <div style={styles.msgArea}>
          {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}
          {infoMsg && <div style={styles.infoBox}>{infoMsg}</div>}
          {loading && (
            <div style={styles.loadingBox}>
              Sending transaction...
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={styles.footer}>
          <button
            style={styles.cancelBtn}
            onClick={handleCancel}
            disabled={loading && !sentTxid}
          >
            Cancel
          </button>
          <button
            style={styles.okBtn}
            onClick={handleClickOK}
            disabled={loading}
          >
            {sentTxid ? 'OK' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ styles ============

function getStyles(theme) {
  // Условно используем тёмную тему
  const textColor = '#fff';
  const modalBg = 'rgb(25,35,45)';
  const borderColor = 'rgba(255,255,255,0.3)';

  return {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    },
    modal: {
      backgroundColor: modalBg,
      color: textColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '6px',
      width: '520px',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.6rem',
      maxHeight: '80vh',
      overflowY: 'auto',
      position: 'relative'
    },
    modalExpanded: {
      backgroundColor: modalBg,
      color: textColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '6px',
      width: '520px',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.6rem',
      maxHeight: '90vh',
      overflowY: 'auto',
      position: 'relative'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    headerRight: {
      display: 'flex',
      gap: '0.5rem'
    },
    title: {
      margin: 0,
      fontSize: '1rem'
    },
    settingsBtn: {
      width: 22,
      height: 22,
      border: `1px solid ${borderColor}`,
      borderRadius: 4,
      background: 'none',
      color: textColor,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    closeBtn: {
      background: 'none',
      border: 'none',
      fontSize: '1.2rem',
      cursor: 'pointer',
      color: textColor
    },
    settingsMenu: {
      position: 'absolute',
      top: '38px',
      right: '2rem',
      background: 'rgb(50,50,50)',
      border: `1px solid ${borderColor}`,
      borderRadius: 4,
      padding: '6px 10px',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      width: '220px'
    },
    settingsItem: {
      fontSize: '0.85rem',
      color: textColor,
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem'
    },
    body: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    },
    formRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.6rem'
    },
    label: {
      width: '110px',
      textAlign: 'right',
      flexShrink: 0,
      fontSize: '0.85rem'
    },
    valueText: {
      fontWeight: 'bold',
      fontSize: '0.9rem'
    },
    feeLine: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    xBytes: {
      fontSize: '0.85rem',
      opacity: 0.8
    },
    sliderWrap: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
      flex: 1
    },
    sliderText: {
      fontSize: '0.85rem',
      opacity: 0.8
    },
    lockTimeWrap: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
      flex: 1
    },
    lockTimeSuffix: {
      fontSize: '0.8rem',
      opacity: 0.7
    },
    inputField: {
      width: '70px',
      height: 22,
      border: `1px solid ${borderColor}`,
      borderRadius: 4,
      background: 'rgba(255,255,255,0.1)',
      color: textColor,
      fontSize: '0.85rem',
      padding: '0 6px',
      textAlign: 'right'
    },
    selectField: {
      border: `1px solid ${borderColor}`,
      borderRadius: 4,
      background: 'rgba(255,255,255,0.1)',
      color: textColor,
      fontSize: '0.85rem',
      padding: '0 4px',
      height: 22
    },
    warningLine: {
      fontSize: '0.85rem',
      color: '#ffb'
    },
    loadingDraft: {
      display: 'flex',
      alignItems: 'center',
      fontSize: '0.85rem',
      marginTop: '0.5rem'
    },
    ioBox: {
      marginTop: '0.5rem',
      border: `1px solid ${borderColor}`,
      borderRadius: 4,
      padding: '0.3rem'
    },
    ioTitle: {
      margin: 0,
      fontSize: '0.85rem',
      borderBottom: `1px solid ${borderColor}`,
      paddingBottom: '0.2rem',
      marginBottom: '0.3rem'
    },
    ioRow: {
      fontSize: '0.8rem',
      marginBottom: '0.2rem'
    },
    ioLine: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
      flexWrap: 'wrap'
    },
    msgArea: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.3rem',
      marginTop: '0.5rem'
    },
    errorBox: {
      backgroundColor: 'rgba(255,60,60,0.2)',
      color: '#fbb',
      padding: '0.4rem',
      borderRadius: '4px',
      fontSize: '0.85rem'
    },
    infoBox: {
      backgroundColor: 'rgba(60,255,60,0.2)',
      color: '#bfb',
      padding: '0.4rem',
      borderRadius: '4px',
      fontSize: '0.85rem'
    },
    loadingBox: {
      fontStyle: 'italic',
      fontSize: '0.85rem'
    },
    footer: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '0.5rem',
      marginTop: '0.5rem'
    },
    cancelBtn: {
      height: 22,
      padding: '0 8px',
      border: `1px solid ${borderColor}`,
      borderRadius: 4,
      background: 'none',
      color: textColor,
      cursor: 'pointer',
      fontSize: '0.8rem'
    },
    okBtn: {
      height: 22,
      padding: '0 10px',
      border: `1px solid ${borderColor}`,
      borderRadius: 4,
      background: 'rgba(255,255,255,0.1)',
      color: textColor,
      cursor: 'pointer',
      fontWeight: 'bold',
      fontSize: '0.8rem'
    },
    successContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.4rem',
      marginTop: '1rem'
    }
  };
}
