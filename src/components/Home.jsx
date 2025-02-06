import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useThemeContext } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import CreateSeed from './CreateSeed';
import ImportSeed from './ImportSeed';
import LedgerSetup from './LedgerSetup';
import path from 'path';

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useThemeContext();
  const { walletFileName, setWalletFileName, setWalletWithPath, masterPassword, setMasterPassword } = useWallet();
  const [step, setStep] = useState(1);
  const [walletName, setWalletName] = useState(walletFileName || '');
  const [fileExists, setFileExists] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [decryptionError, setDecryptionError] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [keyStorageChoice, setKeyStorageChoice] = useState('new_seed');
  const createSeedRef = useRef(null);
  const [createSeedSubStep, setCreateSeedSubStep] = useState(1);
  const importSeedRef = useRef(null);
  const [importSeedSubStep, setImportSeedSubStep] = useState(1);
  const ledgerRef = useRef(null);
  const [ledgerSubStep, setLedgerSubStep] = useState(1);

  const searchParams = new URLSearchParams(location.search);
  const fromImportKey = searchParams.get('from') === 'import-key';
  const fromCreateRestore = searchParams.get('fromCreateRestore') === '1';

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('resetFile') === '1') {
      setWalletName('');
      setWalletFileName('');
    }
  }, [location, setWalletFileName]);

  useEffect(() => {
    if (step === 1) {
      checkFileStatus(walletName);
    }
  }, [walletName, step]);

  async function checkFileStatus(filePath) {
    setDecryptionError('');
    setUserPassword('');
    if (!filePath) {
      setFileExists(false);
      setIsEncrypted(false);
      return;
    }
    if (window.electronAPI?.checkWalletFileEncryption) {
      try {
        const result = await window.electronAPI.checkWalletFileEncryption(filePath);
        if (!result) {
          setFileExists(false);
          setIsEncrypted(false);
        } else {
          setFileExists(result.exists);
          setIsEncrypted(result.encrypted);
        }
      } catch {
        setFileExists(false);
        setIsEncrypted(false);
      }
    } else {
      setFileExists(false);
      setIsEncrypted(false);
    }
  }

  async function handleBrowse() {
    setDecryptionError('');
    setUserPassword('');
    if (window.electronAPI?.openWalletFileDialog) {
      const selectedPath = await window.electronAPI.openWalletFileDialog();
      if (selectedPath) {
        setWalletName(selectedPath);
      }
    }
  }

  function handleBack() {

    if (fromCreateRestore) {
      navigate('/dashboard');
      return;
    }

    if (step === 1) {
      if (fromImportKey) {
        navigate('/dashboard');
      } else {
        if (window.electronAPI?.appQuit) {
          window.electronAPI.appQuit();
        } else {
          window.close();
        }
      }
      return;
    }

    if (step === 2) {
      setStep(1);
      return;
    }

    if (step === 3) {
      if (keyStorageChoice === 'new_seed' && createSeedRef.current) {
        const r = createSeedRef.current.handleBack();
        if (r === 'go-previous-step') {
          setStep(2);
        } else {
          const s = createSeedRef.current.getSubStep();
          setCreateSeedSubStep(s);
        }
      } else if (keyStorageChoice === 'existing_seed' && importSeedRef.current) {
        const r = importSeedRef.current.handleBack();
        if (r === 'go-previous-step') {
          setStep(2);
        } else {
          const s = importSeedRef.current.getSubStep();
          setImportSeedSubStep(s);
        }
      } else if (keyStorageChoice === 'ledger' && ledgerRef.current) {
        const r = ledgerRef.current.handleBack();
        if (r === 'go-previous-step') {
          setStep(2);
        } else {
          const s = ledgerRef.current.getSubStep();
          setLedgerSubStep(s);
        }
      } else {
        setStep(2);
      }
    }
  }

  async function handleNext() {
    if (step === 1) {
      if (!walletName.trim()) return;
      setWalletFileName(walletName);
      if (!fileExists) {
        setStep(2);
        return;
      }
      if (fileExists && !isEncrypted) {
        try {
          const resp = await window.electronAPI.openFileByPath(walletName);
          if (resp.error) {
            setDecryptionError('Error opening file: ' + resp.error);
            return;
          }
          if (!resp.fileData) {
            setDecryptionError('No file data returned.');
            return;
          }
          const json = JSON.parse(resp.fileData);
          setMasterPassword('');
          setWalletWithPath(json, walletName);
          navigate('/dashboard');
        } catch (err) {
          setDecryptionError('Open file error: ' + err.message);
        }
        return;
      }
      if (fileExists && isEncrypted) {
        if (!userPassword) {
          setDecryptionError('Please enter password.');
          return;
        }
        const resp = await window.electronAPI.decryptWalletFile(walletName, userPassword);
        if (!resp.ok) {
          setDecryptionError('Decryption error: ' + (resp.error || 'Wrong password?'));
          return;
        }
        setMasterPassword(userPassword);
        setWalletWithPath(resp.wallet, walletName);
        navigate('/dashboard');
      }
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    if (step === 3) {
      if (keyStorageChoice === 'new_seed' && createSeedRef.current) {
        const r = await createSeedRef.current.handleNext();
        const s = createSeedRef.current.getSubStep();
        setCreateSeedSubStep(s);
        if (r === 'finish') {
          navigate('/dashboard');
        }
      } else if (keyStorageChoice === 'existing_seed' && importSeedRef.current) {
        const r = await importSeedRef.current.handleNext();
        const s = importSeedRef.current.getSubStep();
        setImportSeedSubStep(s);
        if (r === 'finish') {
          navigate('/dashboard');
        }
      } else if (keyStorageChoice === 'ledger' && ledgerRef.current) {
        const r = await ledgerRef.current.handleNext();
        const s = ledgerRef.current.getSubStep();
        setLedgerSubStep(s);
        if (r === 'finish') {
          navigate('/dashboard');
        }
      } else {
        setStep(2);
      }
    }
  }

  let rightBtnLabel = 'Next';
  if (step === 3 && keyStorageChoice === 'new_seed' && createSeedSubStep === 3) {
    rightBtnLabel = 'Finish';
  }
  if (step === 3 && keyStorageChoice === 'existing_seed' && importSeedSubStep === 2) {
    rightBtnLabel = 'Finish';
  }
  if (step === 3 && keyStorageChoice === 'ledger' && ledgerSubStep === 2) {
    rightBtnLabel = 'Finish';
  }

  const s = getStyles(theme, inputFocused);
  const radioCss = getRadioCss(theme);
  let nextDisabled = false;
  if (step === 1 && !walletName.trim()) {
    nextDisabled = true;
  }

  let content;
  if (step === 1) {
    content = (
      <Step1FileSelect
        theme={theme}
        walletName={walletName}
        setWalletName={setWalletName}
        fileExists={fileExists}
        isEncrypted={isEncrypted}
        decryptionError={decryptionError}
        userPassword={userPassword}
        setUserPassword={setUserPassword}
        inputFocused={inputFocused}
        setInputFocused={setInputFocused}
        handleBrowse={handleBrowse}
      />
    );
  } else if (step === 2) {
    content = (
      <Step2Choice
        theme={theme}
        keyStorageChoice={keyStorageChoice}
        setKeyStorageChoice={setKeyStorageChoice}
      />
    );
  } else {
    if (keyStorageChoice === 'new_seed') {
      content = (
        <CreateSeed
          ref={createSeedRef}
          onSubStepChanged={(sub) => setCreateSeedSubStep(sub)}
        />
      );
    } else if (keyStorageChoice === 'existing_seed') {
      content = (
        <ImportSeed
          ref={importSeedRef}
          onSubStepChanged={(sub) => setImportSeedSubStep(sub)}
        />
      );
    } else if (keyStorageChoice === 'ledger') {
      content = (
        <LedgerSetup
          ref={ledgerRef}
          onSubStepChanged={(sub) => setLedgerSubStep(sub)}
        />
      );
    }
  }

  return (
    <div style={s.container}>
      <style>{radioCss}</style>
      <img src="images/electrum_logo.png" alt="Electrum Logo" style={s.logo} />
      <div style={s.boundingBox}>{content}</div>

      <div style={s.footerButtons}>
        {(fromCreateRestore || fromImportKey || step > 1) && (
          <button style={s.backBtn} onClick={handleBack}>
            Back
          </button>
        )}

        <button style={s.nextBtn} onClick={handleNext} disabled={nextDisabled}>
          {rightBtnLabel}
        </button>
      </div>
    </div>
  );
}

function Step1FileSelect({
  theme,
  walletName,
  setWalletName,
  fileExists,
  isEncrypted,
  decryptionError,
  userPassword,
  setUserPassword,
  inputFocused,
  setInputFocused,
  handleBrowse
}) {
  const s = getStyles(theme, inputFocused);
  return (
    <>
      <h2 style={s.title}>Electrum wallet</h2>
      <div style={s.fieldsBlock}>
        <div style={s.fieldRow}>
          <span style={s.fieldLabel}>Wallet:</span>
          <input
            type="text"
            style={s.inputBox}
            value={walletName}
            onChange={(e) => setWalletName(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />
          <button style={s.browseBtn} onClick={handleBrowse}>
            Browse...
          </button>
        </div>
        {!fileExists && (
          <p style={s.infoText}>
            This file does not exist.<br />
            Press <strong>Next</strong> to create a new wallet or choose a different file.
          </p>
        )}
        {fileExists && !isEncrypted && (
          <p style={s.infoText}>
            This wallet file is not encrypted.<br />
            Press <strong>Next</strong> to open/import it.
          </p>
        )}
        {fileExists && isEncrypted && (
          <div style={s.encBox}>
            <p style={s.encText}>
              This wallet file is <strong>encrypted</strong>.<br />
              Please enter your password to decrypt:
            </p>
            <input
              type="password"
              style={s.inputPassword}
              placeholder="Enter wallet password..."
              value={userPassword}
              onChange={(e) => setUserPassword(e.target.value)}
            />
            {decryptionError && <p style={s.errorLine}>{decryptionError}</p>}
          </div>
        )}
      </div>
    </>
  );
}

function Step2Choice({ theme, keyStorageChoice, setKeyStorageChoice }) {
  const s = getStyles(theme, false);
  return (
    <>
      <h2 style={s.title}>Key storage</h2>
      <div style={s.fieldsBlock}>
        <p style={s.infoText}>
          Do you want to create a new seed phrase, restore a wallet from an existing seed, or use a hardware wallet?
        </p>
        <div style={s.radioContainer}>
          <div style={s.radioGroup}>
            <label style={s.radioLabel}>
              <input
                type="radio"
                name="keyStorage"
                value="new_seed"
                checked={keyStorageChoice === 'new_seed'}
                onChange={() => setKeyStorageChoice('new_seed')}
                className="radioInput"
              />
              Create a new seed phrase
            </label>
            <label style={s.radioLabel}>
              <input
                type="radio"
                name="keyStorage"
                value="existing_seed"
                checked={keyStorageChoice === 'existing_seed'}
                onChange={() => setKeyStorageChoice('existing_seed')}
                className="radioInput"
              />
              I already have a seed phrase
            </label>
            <label style={s.radioLabel}>
              <input
                type="radio"
                name="keyStorage"
                value="ledger"
                checked={keyStorageChoice === 'ledger'}
                onChange={() => setKeyStorageChoice('ledger')}
                className="radioInput"
              />
              Use a hardware wallet (Ledger/Trezor)
            </label>
          </div>
        </div>
      </div>
    </>
  );
}

function getStyles(theme, inputFocused) {
  const baseBtnBg = theme.name === 'light' ? 'transparent' : 'rgb(69,83,100)';
  const baseBtnBorder = `1px solid ${theme.inputBorder}`;
  const normalInputBorder = `1px solid ${theme.inputBorder}`;
  const focusedInputBorder = '1px solid rgb(26,114,187)';
  return {
    container: {
      width: '100vw',
      height: '100vh',
      position: 'relative',
      backgroundColor: theme.background,
      display: 'flex',
      flexDirection: 'column',
      color: theme.color,
    },
    logo: {
      position: 'absolute',
      top: 20,
      left: 20,
      width: 55,
      height: 55,
    },
    boundingBox: {
      flex: 1,
      marginLeft: 90,
      marginRight: 10,
      marginTop: 10,
      marginBottom: 55,
      border: theme.name === 'dark' ? '1px solid rgba(223,225,226,0.2)' : '1px solid #ccc',
      borderRadius: 6,
      padding: '1rem',
      boxSizing: 'border-box',
      backgroundColor: theme.background,
      fontSize: '0.85rem',
    },
    footerButtons: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      display: 'flex',
      gap: '0.5rem',
    },
    backBtn: {
      backgroundColor: baseBtnBg,
      border: baseBtnBorder,
      color: theme.color,
      borderRadius: 4,
      padding: '0.15rem 0.5rem',
      cursor: 'pointer',
      fontSize: '0.85rem',
    },
    nextBtn: {
      backgroundColor: baseBtnBg,
      border: baseBtnBorder,
      color: theme.color,
      borderRadius: 4,
      padding: '0.15rem 0.6rem',
      cursor: 'pointer',
      fontSize: '0.85rem',
    },
    title: {
      margin: 0,
      fontSize: '0.9rem',
      color: theme.color,
      fontWeight: 'normal',
    },
    fieldsBlock: {
      marginTop: '2.5rem',
      marginLeft: '1rem',
    },
    fieldRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      marginBottom: '0.6rem',
      width: '100%',
    },
    fieldLabel: {
      fontSize: '0.85rem',
      color: theme.color,
      fontWeight: 'normal',
    },
    inputBox: {
      flex: 1,
      backgroundColor: 'transparent',
      border: inputFocused ? focusedInputBorder : normalInputBorder,
      color: theme.color,
      borderRadius: 4,
      padding: '0.2rem 0.4rem',
      fontSize: '0.85rem',
      outline: 'none',
    },
    browseBtn: {
      backgroundColor: baseBtnBg,
      border: baseBtnBorder,
      color: theme.color,
      borderRadius: 4,
      padding: '0.15rem 0.5rem',
      cursor: 'pointer',
      fontSize: '0.85rem',
    },
    infoText: {
      margin: 0,
      fontSize: '0.85rem',
      lineHeight: 1.4,
      color: theme.color,
      marginTop: '0.6rem',
    },
    encBox: {
      marginTop: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      maxWidth: '300px',
    },
    encText: {
      margin: 0,
      fontSize: '0.85rem',
      lineHeight: 1.4,
      color: theme.color,
    },
    inputPassword: {
      backgroundColor: 'transparent',
      border: normalInputBorder,
      color: theme.color,
      borderRadius: 4,
      padding: '0.2rem 0.4rem',
      fontSize: '0.85rem',
      outline: 'none',
    },
    errorLine: {
      color: 'rgb(255,100,100)',
      fontSize: '0.8rem',
      margin: 0,
    },
    radioContainer: {
      marginTop: '1rem',
      border: theme.name === 'dark' ? '1px solid rgba(223,225,226,0.2)' : '1px solid #ccc',
      borderRadius: 6,
      padding: '1rem',
    },
    radioGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    },
    radioLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
      fontSize: '0.85rem',
      color: theme.color,
      fontWeight: 'normal',
      cursor: 'pointer',
    },
  };
}

function getRadioCss(theme) {
  const borderColor = theme.inputBorder;
  const hoverColor = 'rgb(26,114,187)';
  const checkColor = theme.color;
  return `
    .radioInput[type="radio"] {
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
      width: 16px;
      height: 16px;
      border: 1px solid ${borderColor};
      border-radius: 50%;
      background-color: transparent;
      cursor: pointer;
      position: relative;
      outline: none;
      vertical-align: middle;
      margin: 0;
      padding: 0;
    }
    .radioInput[type="radio"]:hover {
      border-color: ${hoverColor};
    }
    .radioInput[type="radio"]:checked::before {
      content: '';
      display: block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: ${checkColor};
      position: absolute;
      top: 3px;
      left: 3px;
    }
  `;
}
