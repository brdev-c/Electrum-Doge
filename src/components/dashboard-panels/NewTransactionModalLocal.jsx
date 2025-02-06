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

export default function NewTransactionModalLocal({
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
  const [feeTarget, setFeeTarget] = useState(5);
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
    } catch {
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

      const utxos = await getUtxosWithRawTx(
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

      if (amtNum > 0) {
        const pct = (feeDOGE / amtNum) * 100;
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
      case 'blockheight':
      case 'date':
        return num;
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

      const utxos = await getUtxosWithRawTx(
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

      const { txHex } = createAndSignTx({
        recipients,
        feeRate,
        allUtxos: utxos,
        walletAddresses: wallet.addresses,
        lockTime,
        useChange: useChangeAddr
      });

      const { txid } = await sendDogeTransaction(txHex, serverParam);
      if (!txid) {
        throw new Error('Broadcast failed (no txid).');
      }
      setSentTxid(txid);
      setInfoMsg(`Success! TXID: ${txid}`);

      if (onTxSuccess) {
        onTxSuccess({ txid });
      }
      if (window.electronAPI) {
        window.electronAPI.notifyOutgoingTransaction({
          txid,
          amountDoge: amt,
          to: recipient
        });
      }
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
        <div style={styles.header}>
          <h3 style={styles.title}>New Transaction</h3>
          <div style={styles.headerRight}>
            {canEditFee && (
              <div style={styles.settingsWrapper}>
                <button style={styles.settingsBtn} onClick={toggleSettingsMenu}>
                  <img
                    src="./images/settings.png"
                    alt="Settings"
                    style={{ width: 14, height: 14 }}
                  />
                </button>
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
              </div>
            )}
            <button style={styles.closeBtn} onClick={handleCancel}>
              ×
            </button>
          </div>
        </div>

        {!sentTxid && (
          <>
            <div style={styles.body}>
              <div style={styles.mainInfoRow}>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>Amount</div>
                  <div style={styles.infoValue}>{amountDoge} DOGE</div>
                </div>

                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>Mining Fee</div>
                  {!manualFees && (
                    <>
                      <div style={styles.infoValue}>{feeRate} sat/byte</div>
                      <div style={styles.infoSubValue}>
                        ≈ {feeDoge.toFixed(8)} DOGE
                      </div>
                    </>
                  )}
                  {manualFees && canEditFee && (
                    <>
                      <div style={styles.flexRow}>
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
                      </div>
                      <div style={styles.infoSubValue}>
                        ~ {feeDoge.toFixed(8)} DOGE
                      </div>
                    </>
                  )}
                  {manualFees && !canEditFee && (
                    <div style={styles.infoSubValue}>
                      <em>Fee editing disabled in MAX mode</em>
                    </div>
                  )}
                </div>

                <div style={styles.infoItem}>
                  {!manualFees && canEditFee ? (
                    <>
                      <div style={styles.infoLabel}>Fee Target</div>
                      <div style={styles.flexRow}>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          step={1}
                          style={styles.slider}
                          value={feeTarget}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setFeeTarget(val);
                            handleEstimateFee(val);
                          }}
                        />
                        <span style={styles.xBytes}>{feeTarget} blocks</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={styles.infoLabel}>Fee Target</div>
                      <div style={styles.infoSubValue}>N/A</div>
                    </>
                  )}
                </div>
              </div>

              {lockTimeEnabled && canEditFee && (
                <div style={styles.lockTimeRow}>
                  <div style={styles.infoLabel}>LockTime:</div>
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
                    {lockTimeType === 'blockheight' && (
                      <span style={styles.lockTimeSuffix}>height</span>
                    )}
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
                    src="./images/spinner.gif"
                    alt="loading"
                    style={{ width: 20, height: 20, marginRight: 8 }}
                  />
                  Building transaction draft...
                </div>
              )}

              {!draftLoading && showInputs && (
                <div style={styles.draftSection}>
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
                          <span
                            style={{ marginLeft: '1rem', fontWeight: 'bold' }}
                          >
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
                            <span
                              style={{
                                marginLeft: '1rem',
                                fontWeight: 'bold'
                              }}
                            >
                              {valDoge} DOGE
                            </span>
                            {out.isChange && (
                              <span
                                style={{ marginLeft: '0.5rem', color: '#ffd700' }}
                              >
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
              src="./images/success.png"
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


function getStyles(theme) {

  const resolvedBorderColor =
    theme.darkMode && theme.borderColor === 'transparent'
      ? 'rgba(255,255,255,0.25)'
      : theme.borderColor;

  return {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: theme.darkMode ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    },
    modal: {
      backgroundColor: theme.panelBg,
      color: theme.color,
      border: `1px solid ${resolvedBorderColor}`,
      borderRadius: '6px',
      width: '520px',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.6rem',
      maxHeight: '80vh',
      overflowY: 'auto',
      position: 'relative',
      boxShadow: theme.darkMode
        ? '0 0 12px rgba(255,255,255,0.1)'
        : '0 0 12px rgba(0,0,0,0.15)'
    },
    modalExpanded: {
      backgroundColor: theme.panelBg,
      color: theme.color,
      border: `1px solid ${resolvedBorderColor}`,
      borderRadius: '6px',
      width: '520px',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.6rem',
      maxHeight: '90vh',
      overflowY: 'auto',
      position: 'relative',
      boxShadow: theme.darkMode
        ? '0 0 12px rgba(255,255,255,0.1)'
        : '0 0 12px rgba(0,0,0,0.15)'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    headerRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.8rem',
      position: 'relative'
    },
    settingsWrapper: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    },
    settingsBtn: {
      width: 22,
      height: 22,
      border: `1px solid ${resolvedBorderColor}`,
      borderRadius: 4,
      background: 'none',
      color: theme.color,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    settingsMenu: {
      position: 'absolute',
      top: 'calc(100% + 5px)',
      right: 0,
      background: theme.panelBg,
      border: `1px solid ${resolvedBorderColor}`,
      borderRadius: 4,
      padding: '6px 10px',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      width: '220px',
      color: theme.color,
      boxShadow: theme.darkMode
        ? '0 2px 6px rgba(255,255,255,0.1)'
        : '0 2px 6px rgba(0,0,0,0.1)'
    },
    settingsItem: {
      fontSize: '0.85rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem'
    },
    closeBtn: {
      background: 'none',
      border: 'none',
      fontSize: '1.2rem',
      cursor: 'pointer',
      color: theme.color
    },
    body: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    },
    mainInfoRow: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: '1rem',
      flexWrap: 'wrap'
    },
    infoItem: {
      flex: '1 1 auto',
      minWidth: '130px',
      display: 'flex',
      flexDirection: 'column',
      border: `1px solid ${resolvedBorderColor}`,
      borderRadius: '4px',
      padding: '0.6rem',
      gap: '0.3rem',
      background: theme.darkMode ? 'rgba(255,255,255,0.05)' : '#fafafa'
    },
    infoLabel: {
      fontSize: '0.8rem',
      opacity: 0.8,
      fontWeight: 'bold'
    },
    infoValue: {
      fontSize: '0.9rem',
      fontWeight: 'bold'
    },
    infoSubValue: {
      fontSize: '0.8rem',
      opacity: 0.8
    },
    flexRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem'
    },
    lockTimeRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.6rem'
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
    slider: {
      flex: '0 1 100px'
    },
    xBytes: {
      fontSize: '0.85rem',
      opacity: 0.8
    },
    inputField: {
      width: '70px',
      height: 22,
      border: `1px solid ${theme.inputBorder}`,
      borderRadius: 4,
      background: theme.inputBg,
      color: theme.color,
      fontSize: '0.85rem',
      padding: '0 6px',
      textAlign: 'right'
    },
    selectField: {
      border: `1px solid ${theme.inputBorder}`,
      borderRadius: 4,
      background: theme.inputBg,
      color: theme.color,
      fontSize: '0.85rem',
      padding: '0 4px',
      height: 22
    },
    warningLine: {
      fontSize: '0.85rem',
      color: theme.darkMode ? '#ffb' : '#990'
    },
    loadingDraft: {
      display: 'flex',
      alignItems: 'center',
      fontSize: '0.85rem'
    },
    draftSection: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.8rem'
    },
    ioBox: {
      border: `1px solid ${resolvedBorderColor}`,
      borderRadius: 4,
      padding: '0.5rem'
    },
    ioTitle: {
      margin: 0,
      fontSize: '0.85rem',
      borderBottom: `1px solid ${resolvedBorderColor}`,
      paddingBottom: '0.3rem',
      marginBottom: '0.5rem'
    },
    ioRow: {
      fontSize: '0.8rem',
      marginBottom: '0.3rem'
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
      gap: '0.3rem'
    },
    errorBox: {
      backgroundColor: theme.darkMode
        ? 'rgba(255,60,60,0.2)'
        : 'rgba(255,0,0,0.1)',
      color: theme.darkMode ? '#fbb' : '#900',
      padding: '0.4rem',
      borderRadius: '4px',
      fontSize: '0.85rem',
      border: theme.darkMode
        ? '1px solid rgba(255,60,60,0.3)'
        : '1px solid rgba(255,0,0,0.2)'
    },
    infoBox: {
      backgroundColor: theme.darkMode
        ? 'rgba(60,255,60,0.2)'
        : 'rgba(0,200,0,0.1)',
      color: theme.darkMode ? '#bfb' : '#060',
      padding: '0.4rem',
      borderRadius: '4px',
      fontSize: '0.85rem',
      border: theme.darkMode
        ? '1px solid rgba(60,255,60,0.3)'
        : '1px solid rgba(0,200,0,0.2)'
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
      border: `1px solid ${resolvedBorderColor}`,
      borderRadius: 4,
      background: theme.darkMode ? 'rgba(255,255,255,0.05)' : '#f4f4f4',
      color: theme.color,
      cursor: 'pointer',
      fontSize: '0.8rem'
    },
    okBtn: {
      height: 22,
      padding: '0 10px',
      border: `1px solid ${resolvedBorderColor}`,
      borderRadius: 4,
      background: theme.darkMode ? 'rgba(255,255,255,0.1)' : '#eee',
      color: theme.color,
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
