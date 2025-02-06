import React, { useState, useEffect } from 'react';
import { useWallet } from '../../context/WalletContext';
import { useThemeContext } from '../../context/ThemeContext';
import {
  getElectrumServersFromMonitorPage,
  forceElectrumReconnect
} from '../../services/apiService';

export default function SettingsPanel() {
  const {
    locked,
    unlockWallet,
    masterPassword,
    setMasterPassword,
    serverParam,
    setServerParam,
    fiatCurrency,
    setFiatCurrency,
    cameraDeviceId,
    setCameraDeviceId,
    autoConnectEnabled,
    setAutoConnectEnabled,
    notificationsEnabled,
    setNotificationsEnabled,
    autoLockEnabled,
    setAutoLockEnabled,
    autoLockTimeout,
    setAutoLockTimeout,
    explorerURL,
    setExplorerURL,
    isLedgerWallet,
    autoConnectElectrum,
    autoConnectIfNeeded
  } = useWallet();

  const { theme, setTheme } = useThemeContext();
  const s = getStyles(theme);

  const [monitorServers, setMonitorServers] = useState([]);
  const [localServer, setLocalServer] = useState('');
  const [serverError, setServerError] = useState('');
  const [serverMsg, setServerMsg] = useState('');

  useEffect(() => {
    if (serverParam && serverParam.type === 'electrum') {
      const sslFlag = serverParam.ssl ? 'ssl' : 'tcp';
      const val = `electrum|${serverParam.host}|${serverParam.port}|${sslFlag}`;
      setLocalServer(val);
    } else {
      setLocalServer('');
    }
  }, [serverParam]);

  useEffect(() => {
    if (serverMsg) {
      const t = setTimeout(() => setServerMsg(''), 3000);
      return () => clearTimeout(t);
    }
  }, [serverMsg]);

  useEffect(() => {
    if (serverError) {
      const t = setTimeout(() => setServerError(''), 3000);
      return () => clearTimeout(t);
    }
  }, [serverError]);

  async function handleRescan() {
    setServerError('');
    setServerMsg('Scanning for servers...');
    try {
      const list = await getElectrumServersFromMonitorPage();
      setMonitorServers(list);
      setServerMsg(`Found ${list.length} servers.`);
    } catch (err) {
      setServerError('Failed to load server list from monitor.');
      setServerMsg('');
    }
  }

  const dynamicServers = monitorServers.map((srv) => {
    const label = `${srv.host}:${srv.port} (${srv.proto})`;
    const val = `electrum|${srv.host}|${srv.port}|${srv.proto}`;
    return { label, value: val };
  });

  let finalServers = [...dynamicServers];
  if (finalServers.length === 0 && serverParam && serverParam.host) {
    const sslFlag = serverParam.ssl ? 'ssl' : 'tcp';
    const label = `${serverParam.host}:${serverParam.port} (${sslFlag})`;
    const val = `electrum|${serverParam.host}|${serverParam.port}|${sslFlag}`;
    finalServers.push({ label, value: val });
  }

  async function handleServerChange(e) {
    const val = e.target.value;
    setLocalServer(val);
    const parts = val.split('|');
    const newHost = parts[1] || '';
    const newPort = parseInt(parts[2], 10) || 50002;
    const newSsl = parts[3] === 'ssl';
    setServerParam({
      type: 'electrum',
      host: newHost,
      port: newPort,
      ssl: newSsl
    });
    try {
      await forceElectrumReconnect();
      await autoConnectIfNeeded();
      setServerMsg('Server changed and reconnected.');
    } catch (err) {
      console.error('handleServerChange error:', err);
      setServerError('Failed to force reconnect.');
    }
  }

  const [fiatMsg, setFiatMsg] = useState('');
  const [fiatError, setFiatError] = useState('');
  useEffect(() => {
    if (fiatMsg) {
      const t = setTimeout(() => setFiatMsg(''), 3000);
      return () => clearTimeout(t);
    }
  }, [fiatMsg]);
  useEffect(() => {
    if (fiatError) {
      const t = setTimeout(() => setFiatError(''), 3000);
      return () => clearTimeout(t);
    }
  }, [fiatError]);

  function handleFiatChange(e) {
    const newFiat = e.target.value;
    setFiatCurrency(newFiat);
    setFiatMsg(`Fiat changed to ${newFiat}`);
    setFiatError('');
  }

  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  useEffect(() => {
    if (pwdMsg) {
      const t = setTimeout(() => setPwdMsg(''), 3000);
      return () => clearTimeout(t);
    }
  }, [pwdMsg]);
  useEffect(() => {
    if (pwdError) {
      const t = setTimeout(() => setPwdError(''), 3000);
      return () => clearTimeout(t);
    }
  }, [pwdError]);

  function handleChangePassword() {
    if (isLedgerWallet) {
      return;
    }
    setPwdError('');
    setPwdMsg('');
    if (!oldPwd || !newPwd) {
      setPwdError('Please enter both old and new passwords.');
      return;
    }
    if (locked) {
      const ok = unlockWallet(oldPwd);
      if (!ok) {
        setPwdError('Wrong old password.');
        return;
      }
    } else {
      if (oldPwd !== masterPassword) {
        setPwdError('Old password is incorrect.');
        return;
      }
    }
    setMasterPassword(newPwd);
    setPwdMsg('Password changed successfully.');
    setOldPwd('');
    setNewPwd('');
  }

  function handleThemeChange(e) {
    setTheme(e.target.value);
  }

  const [cameraList, setCameraList] = useState([]);
  const [cameraError, setCameraError] = useState('');
  const [cameraMsg, setCameraMsg] = useState('');
  useEffect(() => {
    if (cameraMsg) {
      const t = setTimeout(() => setCameraMsg(''), 3000);
      return () => clearTimeout(t);
    }
  }, [cameraMsg]);
  useEffect(() => {
    if (cameraError) {
      const t = setTimeout(() => setCameraError(''), 3000);
      return () => clearTimeout(t);
    }
  }, [cameraError]);

  async function handleScanCameras() {
    try {
      setCameraError('');
      setCameraMsg('Scanning cameras...');
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videos = devices.filter((d) => d.kind === 'videoinput');
      setCameraList(videos);
      setCameraMsg(`Found ${videos.length} cameras.`);
    } catch (err) {
      setCameraError('Failed to enumerate cameras.');
      setCameraMsg('');
    }
  }

  function handleCameraChange(e) {
    const devId = e.target.value;
    setCameraDeviceId(devId);
  }

  const [secMsg, setSecMsg] = useState('');
  const [secError, setSecError] = useState('');
  useEffect(() => {
    if (secMsg) {
      const t = setTimeout(() => setSecMsg(''), 3000);
      return () => clearTimeout(t);
    }
  }, [secMsg]);
  useEffect(() => {
    if (secError) {
      const t = setTimeout(() => setSecError(''), 3000);
      return () => clearTimeout(t);
    }
  }, [secError]);

  function handleAutoLockEnabledChange(e) {
    if (isLedgerWallet) return;
    setAutoLockEnabled(e.target.checked);
    setSecMsg(`Auto-lock ${e.target.checked ? 'enabled' : 'disabled'}.`);
  }

  function handleAutoLockTimeoutChange(e) {
    if (isLedgerWallet) return;
    const val = parseInt(e.target.value, 10);
    if (isNaN(val) || val <= 0) {
      setSecError('Timeout must be a positive number.');
      return;
    }
    setAutoLockTimeout(val);
    setSecMsg(`Auto-lock timeout set to ${val} minute(s).`);
  }

  const [explorerMsg, setExplorerMsg] = useState('');
  const [explorerError, setExplorerError] = useState('');
  useEffect(() => {
    if (explorerMsg) {
      const t = setTimeout(() => setExplorerMsg(''), 3000);
      return () => clearTimeout(t);
    }
  }, [explorerMsg]);
  useEffect(() => {
    if (explorerError) {
      const t = setTimeout(() => setExplorerError(''), 3000);
      return () => clearTimeout(t);
    }
  }, [explorerError]);

  function handleExplorerURLChange(e) {
    const val = e.target.value;
    if (!val) {
      setExplorerError('Explorer URL cannot be empty.');
      return;
    }
    setExplorerURL(val);
    setExplorerMsg('Explorer URL updated.');
  }

  const [forceMsg, setForceMsg] = useState('');
  const [forceError, setForceError] = useState('');
  useEffect(() => {
    if (forceMsg) {
      const t = setTimeout(() => setForceMsg(''), 3000);
      return () => clearTimeout(t);
    }
  }, [forceMsg]);
  useEffect(() => {
    if (forceError) {
      const t = setTimeout(() => setForceError(''), 3000);
      return () => clearTimeout(t);
    }
  }, [forceError]);

  async function handleForceReconnect() {
    setForceMsg('');
    setForceError('');
    try {
      await forceElectrumReconnect();
      await autoConnectIfNeeded();
      setForceMsg('Force reconnect done. SSE should re-subscribe automatically.');
    } catch (err) {
      setForceError('Force reconnect failed.');
    }
  }

  return (
    <div style={s.wrapper}>
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
          border-radius: 0;
        }

        .settingsSelect {
          background-color: transparent !important;
          appearance: none;
          -webkit-appearance: none;
        }
        .settingsSelect option {
          background-color: ${theme.inputBg || '#fff'} !important;
          color: ${theme.color || '#333'} !important;
        }
      `}</style>
      <div className="customScroll" style={s.scrollArea}>
        <div style={s.card}>
          <h3 style={s.cardTitle}>Server Settings</h3>
          {serverError && <div style={s.errorMsg}>{serverError}</div>}
          {serverMsg && <div style={s.successMsg}>{serverMsg}</div>}
          {forceError && <div style={s.errorMsg}>{forceError}</div>}
          {forceMsg && <div style={s.successMsg}>{forceMsg}</div>}
          <div style={s.formRow}>
            <label style={s.label}>Active Server:</label>
            <select
              className="settingsSelect"
              style={s.input}
              value={localServer}
              onChange={handleServerChange}
            >
              {finalServers.length === 0 && <option value="">No servers found yet</option>}
              {finalServers.map((srv, idx) => (
                <option key={idx} value={srv.value}>
                  {srv.label}
                </option>
              ))}
            </select>
          </div>
          <div style={s.formRow}>
            <label style={s.label} />
            <button style={s.outlineBtn} onClick={handleRescan}>
              Re-Scan
            </button>
            <button style={{ ...s.outlineBtn, marginLeft: '0.5rem' }} onClick={handleForceReconnect}>
              Force Reconnect
            </button>
          </div>
          <div style={s.formRow}>
            <label style={s.label}>Auto-Connect:</label>
            <input
              type="checkbox"
              checked={autoConnectEnabled}
              onChange={(e) => setAutoConnectEnabled(e.target.checked)}
              style={{ transform: 'scale(1.2)' }}
            />
            <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
              Automatically connect on startup
            </span>
          </div>
          <div style={s.infoText}>
            Current server: {serverParam.host
              ? `${serverParam.host}:${serverParam.port} (ssl=${String(serverParam.ssl)})`
              : 'No host selected'}
          </div>
        </div>
        <div style={s.card}>
          <h3 style={s.cardTitle}>Fiat Currency</h3>
          {fiatError && <div style={s.errorMsg}>{fiatError}</div>}
          {fiatMsg && <div style={s.successMsg}>{fiatMsg}</div>}
          <div style={s.formRow}>
            <label style={s.label}>Select fiat:</label>
            <select
              className="settingsSelect"
              style={s.input}
              value={fiatCurrency}
              onChange={handleFiatChange}
            >
              {[
                'USD','EUR','VND','AED','AFN','ALL','AMD','ANG','AOA','ARS','AUD','AZN','BAM','BDT','BGN','BHD','BIF','BND','BOB','BRL','BWP','BYN','CAD','CDF','CHF','CLP','CNY','COP','CRC','CZK','DKK','DOP','DZD','EGP','GBP','GEL','GHS','HKD','HRK','HUF','IDR','ILS','INR','IQD','IRR','ISK','JMD','JOD','JPY','KES','KGS','KHR','KRW','KWD','KZT','LAK','LBP','LKR','MAD','MDL','MGA','MKD','MMK','MNT','MUR','MXN','MYR','NAD','NGN','NOK','NPR','NZD','OMR','PEN','PHP','PKR','PLN','QAR','RON','RSD','RUB','RWF','SAR','SEK','SGD','THB','TND','TRY','TWD','TZS','UAH','UGX','UYU','UZS','ZAR','ZMW'
              ].map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>
          <div style={s.infoText}>
            Current fiat: <b>{fiatCurrency}</b>
          </div>
        </div>
        <div style={s.card}>
          <h3 style={s.cardTitle}>Change Password</h3>
          {pwdError && <div style={s.errorMsg}>{pwdError}</div>}
          {pwdMsg && <div style={s.successMsg}>{pwdMsg}</div>}
          <div style={s.formRowSmallGap}>
            <label style={s.label}>Old Password:</label>
            <input
              type="password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              style={{
                ...s.input,
                ...(isLedgerWallet ? disabledStyle : {})
              }}
              disabled={isLedgerWallet}
              title={isLedgerWallet ? 'Disabled because you are using a Ledger wallet.' : ''}
            />
          </div>
          <div style={s.formRowSmallGap}>
            <label style={s.label}>New Password:</label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              style={{
                ...s.input,
                ...(isLedgerWallet ? disabledStyle : {})
              }}
              disabled={isLedgerWallet}
              title={isLedgerWallet ? 'Disabled because you are using a Ledger wallet.' : ''}
            />
          </div>
          <div style={s.formRow}>
            <label style={s.label} />
            <button
              style={{
                ...s.outlineBtn,
                ...(isLedgerWallet ? disabledStyle : {})
              }}
              disabled={isLedgerWallet}
              title={isLedgerWallet ? 'Disabled because you are using a Ledger wallet.' : ''}
              onClick={handleChangePassword}
            >
              Update Password
            </button>
          </div>
        </div>
        <div style={s.card}>
          <h3 style={s.cardTitle}>Theme Settings</h3>
          <div style={s.formRow}>
            <label style={s.label}>Select Theme:</label>
            <select
              className="settingsSelect"
              style={s.input}
              value={theme.name}
              onChange={handleThemeChange}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div style={s.infoText}>
            Current theme: <b>{theme.name}</b>
          </div>
        </div>
        <div style={s.card}>
          <h3 style={s.cardTitle}>Camera Settings</h3>
          {cameraError && <div style={s.errorMsg}>{cameraError}</div>}
          {cameraMsg && <div style={s.successMsg}>{cameraMsg}</div>}
          <div style={s.formRow}>
            <label style={s.label}>Active Camera:</label>
            <select
              className="settingsSelect"
              style={s.input}
              value={cameraDeviceId || ''}
              onChange={handleCameraChange}
            >
              <option value="">No camera</option>
              {cameraList.map((cam, idx) => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label || `Camera #${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
          <div style={s.formRow}>
            <label style={s.label} />
            <button style={s.outlineBtn} onClick={handleScanCameras}>
              Scan Cameras
            </button>
          </div>
          <div style={s.infoText}>
            Current camera: <b>{cameraDeviceId || 'none'}</b>
          </div>
        </div>
        <div style={s.card}>
          <h3 style={s.cardTitle}>Security Settings</h3>
          <div style={s.formRow}>
            <label style={s.label}>Auto-Lock:</label>
            <input
              type="checkbox"
              checked={autoLockEnabled}
              onChange={handleAutoLockEnabledChange}
              style={{ transform: 'scale(1.2)' }}
              disabled={isLedgerWallet}
              title={isLedgerWallet ? 'Disabled because you are using a Ledger wallet.' : ''}
            />
            <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
              Lock wallet after inactivity
            </span>
          </div>
          <div style={s.formRow}>
            <label style={s.label}>Timeout (min):</label>
            <input
              type="number"
              value={autoLockTimeout}
              onChange={handleAutoLockTimeoutChange}
              style={{
                ...s.input,
                ...(isLedgerWallet ? disabledStyle : {})
              }}
              disabled={isLedgerWallet}
              title={isLedgerWallet ? 'Disabled because you are using a Ledger wallet.' : ''}
            />
          </div>
        </div>
        <div style={s.card}>
          <h3 style={s.cardTitle}>Explorer Settings</h3>
          {explorerError && <div style={s.errorMsg}>{explorerError}</div>}
          {explorerMsg && <div style={s.successMsg}>{explorerMsg}</div>}
          <div style={s.formRow}>
            <label style={s.label}>Explorer URL:</label>
            <input
              type="text"
              value={explorerURL}
              onChange={handleExplorerURLChange}
              style={s.input}
            />
          </div>
          <div style={s.infoText}>
            Current explorer: <b>{explorerURL}</b>
          </div>
        </div>
      </div>
    </div>
  );
}

const disabledStyle = {
  opacity: 0.5,
  cursor: 'not-allowed'
};

function getStyles(theme) {
  const dividerColor = theme.inputBorder || '#ccc';
  return {
    wrapper: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '1rem',
      backgroundColor: 'transparent' 
    },
    scrollArea: {
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.8rem',
      padding: '0.8rem',
      boxSizing: 'border-box'
    },
    card: {
      backgroundColor: 'transparent',
      color: theme.color,
      border: 'none',
      boxShadow: 'none',
      padding: '0.7rem 0',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      borderBottom: `1px solid ${dividerColor}`,
      marginBottom: '0.5rem'
    },
    cardTitle: {
      margin: 0,
      fontSize: '1rem'
    },
    formRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      marginBottom: '0.5rem'
    },
    formRowSmallGap: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      marginBottom: '0.3rem'
    },
    label: {
      width: '120px',
      textAlign: 'right',
      fontWeight: 'bold',
      fontSize: '0.85rem',
      flexShrink: 0
    },
    input: {
      flex: 1,
      height: 22,
      padding: '0 6px',
      fontSize: '0.85rem',
      borderRadius: '4px',
      border: `1px solid ${dividerColor}`,
      backgroundColor: 'transparent',
      color: theme.color || '#333',
      outline: 'none',
      boxSizing: 'border-box'
    },
    outlineBtn: {
      height: 22,
      padding: '0 8px',
      background: 'none',
      color: theme.color,
      border: `1px solid ${dividerColor}`,
      borderRadius: 4,
      cursor: 'pointer',
      fontSize: '0.8rem',
      fontWeight: 'normal'
    },
    errorMsg: {
      backgroundColor: theme.name === 'dark' ? 'rgba(180,60,60,0.2)' : '#fbdada',
      color: theme.name === 'dark' ? '#ff8080' : '#970000',
      padding: '0.4rem',
      borderRadius: '4px',
      fontSize: '0.85rem'
    },
    successMsg: {
      backgroundColor: theme.name === 'dark' ? 'rgba(60,180,60,0.2)' : '#d4f8d4',
      color: theme.name === 'dark' ? '#afffaf' : '#027a02',
      padding: '0.4rem',
      borderRadius: '4px',
      fontSize: '0.85rem'
    },
    infoText: {
      fontSize: '0.85rem',
      color: theme.color
    }
  };
}
