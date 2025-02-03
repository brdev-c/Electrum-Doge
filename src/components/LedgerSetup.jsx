import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useThemeContext } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { makeXpub, deriveLedgerAddressesFromXpub } from '../services/ledgerService';

function LedgerSetup({ onSubStepChanged }, ref) {
  const { theme } = useThemeContext();
  const { walletFileName, setMasterPassword, setWalletWithPath } = useWallet();

  const [subStep, setSubStep] = useState(0);
  const [deviceFound, setDeviceFound] = useState(false);
  const [scanError, setScanError] = useState('');
  const [deviceCount, setDeviceCount] = useState(0);
  const [deviceModel, setDeviceModel] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [derivationPath, setDerivationPath] = useState("44'/3'/0'");
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (onSubStepChanged) {
      onSubStepChanged(subStep);
    }
  }, [subStep, onSubStepChanged]);

  useImperativeHandle(ref, () => ({
    getSubStep: () => subStep,
    handleBack: () => {
      setLocalError('');
      if (subStep === 0) {
        return 'go-previous-step';
      }
      if (subStep === 1) {
        setSubStep(0);
        return null;
      }
      setSubStep(1);
      return null;
    },
    handleNext: async () => {
      setLocalError('');
      if (subStep === 0) {
        setSubStep(1);
        return null;
      }
      if (subStep === 1) {
        if (!deviceFound) {
          setLocalError('No Ledger device found. Please reconnect and click Rescan.');
          return null;
        }
        setSubStep(2);
        return null;
      }
      if (subStep === 2) {
        if (!derivationPath.trim()) {
          setLocalError('Please specify a derivation path (e.g. 44\'/3\'/0\').');
          return null;
        }
        if (pwd !== pwd2) {
          setLocalError('Passwords do not match.');
          return null;
        }
        if (!walletFileName) {
          setLocalError('No wallet file selected.');
          return null;
        }
        let resp;
        try {
          resp = await window.electronAPI.readLedgerXpub(derivationPath);
        } catch (err) {
          setLocalError('IPC error: ' + err.message);
          return null;
        }
        if (!resp || !resp.success) {
          setLocalError('Ledger error: ' + (resp?.error || 'Unknown'));
          return null;
        }
        let xpub;
        try {
          xpub = makeXpub(resp.publicKeyHex, resp.chainCodeHex);
        } catch (e) {
          setLocalError('Failed to form xpub: ' + e.message);
          return null;
        }
        let addresses;
        try {
          addresses = deriveLedgerAddressesFromXpub(xpub, 1, 0);
        } catch (e) {
          setLocalError('Failed to derive addresses: ' + e.message);
          return null;
        }
        const ledgerWalletObj = {
          mnemonic: null,
          xpub,
          addresses
        };
        try {
          const saveResp = await window.electronAPI.saveWalletFile(
            ledgerWalletObj,
            pwd,
            walletFileName
          );
          if (!saveResp.success) {
            throw new Error(saveResp.error || 'Unknown save error');
          }
        } catch (e) {
          setLocalError('Failed to save wallet: ' + e.message);
          return null;
        }
        setMasterPassword(pwd);
        setWalletWithPath(ledgerWalletObj, walletFileName);
        return 'finish';
      }
      return null;
    }
  }));

  useEffect(() => {
    if (subStep === 1) {
      doScanLedger();
    }
  }, [subStep]);

  async function doScanLedger() {
    setScanError('');
    setDeviceFound(false);
    setDeviceCount(0);
    setDeviceModel('');
    setAppVersion('');
    try {
      const result = await window.electronAPI.scanLedger();
      if (!result.success) {
        setScanError('Ledger scan error: ' + (result.error || 'Unknown'));
        return;
      }
      setDeviceCount(result.deviceCount || 0);
      if (result.deviceCount > 0) {
        setDeviceFound(true);
        setDeviceModel(result.deviceModel || 'Ledger Nano');
        setAppVersion(result.appVersion || 'Unknown');
      }
    } catch (err) {
      setScanError('scanLedger exception: ' + err.message);
    }
  }

  function getLedgerImage() {
    const model = deviceModel.toLowerCase();
    if (model.includes('nano x')) {
      return 'images/ledger_nano_x.png';
    } else if (model.includes('nano s')) {
      return 'images/ledger_nano_s.png';
    }
    return 'images/ledger_generic.png';
  }

  const s = getStyles(theme);

  let content;
  if (subStep === 0) {
    content = (
      <div style={{ marginTop: 20 }}>
        <h2 style={s.title}>Ledger Setup: Instructions</h2>
        <p style={s.paragraph}>
          Please follow these steps:
        </p>
        <ol style={s.list}>
          <li>Connect your Ledger device via USB</li>
          <li>Enter your PIN to unlock</li>
          <li>Open the <b>Dogecoin</b> app on device</li>
          <li>Ensure the Ledger screen says "Dogecoin is ready"</li>
        </ol>
        <p style={s.paragraph}>
          Then click <b>Next</b> to scan for the device.
        </p>
      </div>
    );
  } else if (subStep === 1) {
    let mainBoxContent;
    if (scanError) {
      mainBoxContent = (
        <p style={s.errorBox}>
          {scanError}
        </p>
      );
    } else if (deviceFound) {
      const imageSrc = getLedgerImage();
      mainBoxContent = (
        <div style={s.infoBox}>
          <div style={s.foundBox}>
            <img
              src={imageSrc}
              alt="Ledger"
              style={s.ledgerImage}
            />
            <div>
              <p style={{ margin: 0 }}>
                Found {deviceCount} Ledger device(s).
              </p>
              <p style={s.modelLine}>
                <b>Model:</b> {deviceModel}
              </p>
              <p style={s.modelLine}>
                <b>App version:</b> {appVersion}
              </p>
              <p style={{ margin: 0 }}>
                Press <b>Next</b> to continue.
              </p>
            </div>
          </div>
          <p style={s.debugText}>No errors occurred.</p>
        </div>
      );
    } else {
      mainBoxContent = (
        <div style={s.infoBox}>
          <p style={{ margin: 0 }}>
            <b>Devices not found.</b><br />
            Try reconnecting your device, etc.
          </p>
          <p style={s.debugText}>No errors occurred.</p>
        </div>
      );
    }
    content = (
      <div style={{ marginTop: 20 }}>
        <h2 style={s.title}>Ledger Setup: Scanning</h2>
        <p style={s.paragraph}>
          Searching for a Ledger device...
        </p>
        {mainBoxContent}
        <button style={s.button} onClick={doScanLedger}>Rescan</button>
      </div>
    );
  } else {
    content = (
      <div>
        <h2 style={s.title}>Ledger Setup: Configure</h2>
        <p style={s.paragraph}>
          Specify your derivation path and an optional password (to encrypt the wallet file).
        </p>
        <div style={s.row}>
          <label style={s.label}>Derivation path:</label>
          <input
            type="text"
            style={s.input}
            value={derivationPath}
            onChange={(e) => setDerivationPath(e.target.value)}
          />
        </div>
        <div style={s.row}>
          <label style={s.label}>Password:</label>
          <input
            type="password"
            style={s.input}
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
          />
        </div>
        <div style={s.row}>
          <label style={s.label}>Confirm Password:</label>
          <input
            type="password"
            style={s.input}
            value={pwd2}
            onChange={(e) => setPwd2(e.target.value)}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      {content}
      {localError && <p style={s.errorText}>{localError}</p>}
    </div>
  );
}

export default forwardRef(LedgerSetup);

function getStyles(theme) {
  const borderColor = theme.inputBorder || '#888';
  return {
    container: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    },
    title: {
      margin: 0,
      fontSize: '1rem',
      color: theme.color || '#000',
    },
    paragraph: {
      margin: 0,
      fontSize: '0.85rem',
      color: theme.color || '#000',
      lineHeight: 1.4,
    },
    list: {
      marginTop: 10,
      marginBottom: 10,
      paddingLeft: 22,
      fontSize: '0.85rem',
      color: theme.color || '#000',
      lineHeight: 1.4,
    },
    button: {
      border: `1px solid ${borderColor}`,
      borderRadius: 4,
      backgroundColor: 'transparent',
      color: theme.color || '#000',
      padding: '0.3rem 0.6rem',
      cursor: 'pointer',
      marginTop: 10,
      fontSize: '0.85rem',
    },
    infoBox: {
      marginTop: 8,
      border: `1px solid ${borderColor}`,
      borderRadius: 4,
      padding: '0.5rem',
      fontSize: '0.8rem',
      color: theme.color || '#000',
      lineHeight: 1.4,
    },
    foundBox: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '0.5rem',
    },
    ledgerImage: {
      width: 60,
      height: 'auto',
    },
    modelLine: {
      margin: 0,
      fontSize: '0.85rem',
    },
    debugText: {
      margin: 0,
      marginTop: 8,
      fontSize: '0.75rem',
      color: 'gray',
    },
    errorBox: {
      marginTop: 8,
      border: '1px solid red',
      borderRadius: 4,
      padding: '0.5rem',
      fontSize: '0.8rem',
      color: 'red',
      whiteSpace: 'pre-wrap',
    },
    row: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '0.5rem',
      marginTop: 8,
    },
    label: {
      minWidth: 140,
      fontSize: '0.85rem',
      color: theme.color || '#000',
      lineHeight: 1.4,
    },
    input: {
      flex: 1,
      border: `1px solid ${borderColor}`,
      borderRadius: 4,
      backgroundColor: 'transparent',
      color: theme.color || '#000',
      fontSize: '0.85rem',
      padding: '0.2rem 0.4rem',
      outline: 'none',
    },
    errorText: {
      color: 'red',
      fontSize: '0.85rem',
    },
  };
}
