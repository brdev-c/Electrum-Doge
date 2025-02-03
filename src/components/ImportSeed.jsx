import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useThemeContext } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { importWallet } from '../services/walletService';

function ImportSeed({ onSubStepChanged }, ref) {
  const { theme } = useThemeContext();
  const { walletFileName, setWalletWithPath, setMasterPassword } = useWallet();

  const [subStep, setSubStep] = useState(1);
  const [typedSeed, setTypedSeed] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (onSubStepChanged) {
      onSubStepChanged(subStep);
    }
  }, [subStep, onSubStepChanged]);

  useImperativeHandle(ref, () => ({
    handleBack: () => {
      setError('');
      if (subStep === 1) {
        return 'go-previous-step';
      } else {
        setPwd('');
        setPwd2('');
        setSubStep(1);
        return null;
      }
    },
    handleNext: async () => {
      setError('');
      if (subStep === 1) {
        if (!typedSeed.trim()) {
          setError('Please enter your seed phrase (mnemonic or WIF).');
          return null;
        }
        setSubStep(2);
        return null;
      }
      if (subStep === 2) {
        if (!pwd.trim() || !pwd2.trim()) {
          setError('Please enter a wallet password (both fields).');
          return null;
        }
        if (pwd !== pwd2) {
          setError('Passwords do not match.');
          return null;
        }
        try {
          const imported = importWallet(typedSeed.trim());
          if (!walletFileName) {
            setError('No wallet file path selected. Go back and choose a file.');
            return null;
          }
          const result = await window.electronAPI.saveWalletFile(imported, pwd, walletFileName);
          if (!result.success) {
            setError('Failed to save wallet: ' + (result.error || 'Unknown'));
            return null;
          }
          setMasterPassword(pwd);
          setWalletWithPath(imported, walletFileName);
        } catch (err) {
          setError('Failed to import or save: ' + err.message);
          return null;
        }
        return 'finish';
      }
      return null;
    },
    getSubStep: () => subStep,
  }));

  const s = getStyles(theme);

  let content;
  if (subStep === 1) {
    content = (
      <div>
        <h2 style={s.title}><strong>Import Wallet</strong></h2>
        <p style={{ ...s.paragraph, marginTop: 20 }}>
          Enter your mnemonic (12/24 words) or WIF to restore your wallet.
        </p>
        <div style={s.seedContainer}>
          <img
            src="images/showseed.png"
            alt="Seed"
            style={s.seedImage}
          />
          <div style={s.seedBox}>
            <textarea
              style={s.seedTextArea}
              rows={3}
              value={typedSeed}
              onChange={(e) => setTypedSeed(e.target.value)}
              placeholder="Paste your seed or WIF here..."
            />
          </div>
        </div>
      </div>
    );
  } else {
    content = (
      <div>
        <h2 style={s.title}><strong>Wallet Password</strong></h2>
        <div style={{ marginTop: 20 }}>
          <div style={s.pwRow}>
            <img
              src="images/unlock.png"
              alt="Unlock"
              style={s.unlockIcon}
            />
            <div style={{ flex: 1 }}>
              <p style={s.paragraph}>
                Please set a password to encrypt your wallet keys.<br />
                This is mandatory.
              </p>
            </div>
          </div>
          <div style={s.pwLine}>
            <label style={s.pwLabel}>Password:</label>
            <input
              type="password"
              style={s.pwInput}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
            />
          </div>
          <div style={s.pwLine}>
            <label style={s.pwLabel}>Confirm Password:</label>
            <input
              type="password"
              style={s.pwInput}
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
            />
          </div>
          <div style={s.checkboxRow}>
            <label style={s.checkboxLabel}>
              <input
                type="checkbox"
                checked={true}
                disabled={true}
                style={s.checkboxInput}
              />
              Encrypted wallet file
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      {content}
      {error && <p style={s.error}>{error}</p>}
    </div>
  );
}

export default forwardRef(ImportSeed);

function getStyles(theme) {
  const borderColor = theme.inputBorder;
  return {
    container: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
    },
    title: {
      margin: 0,
      fontSize: '0.9rem',
      fontWeight: 'bold',
      marginBottom: '0.5rem',
      color: theme.color,
    },
    paragraph: {
      fontSize: '0.85rem',
      lineHeight: 1.4,
      margin: 0,
      color: theme.color,
    },
    error: {
      color: 'red',
      fontSize: '0.85rem',
      marginTop: '0.5rem',
    },
    seedContainer: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 15,
      gap: 10,
    },
    seedImage: {
      width: 70,
      height: 70,
      objectFit: 'contain',
    },
    seedBox: {
      border: `1px solid ${borderColor}`,
      borderRadius: 6,
      padding: '0.5rem',
      flex: 1,
      minWidth: '300px',
      minHeight: '75px',
      fontSize: '0.85rem',
      lineHeight: 1.4,
      backgroundColor: 'transparent',
      color: theme.color,
    },
    seedTextArea: {
      width: '100%',
      height: '100%',
      backgroundColor: 'transparent',
      border: 'none',
      resize: 'none',
      color: theme.color,
      fontSize: '0.85rem',
      outline: 'none',
      lineHeight: 1.4,
    },
    pwRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '1rem',
    },
    unlockIcon: {
      width: 50,
      height: 50,
      objectFit: 'contain',
    },
    pwLine: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 15,
      gap: 10,
    },
    pwLabel: {
      minWidth: '120px',
      fontSize: '0.85rem',
      color: theme.color,
    },
    pwInput: {
      border: `1px solid ${borderColor}`,
      borderRadius: 4,
      fontSize: '0.85rem',
      outline: 'none',
      color: theme.color,
      backgroundColor: 'transparent',
      padding: '0.2rem 0.4rem',
      width: '260px',
      boxSizing: 'border-box',
    },
    checkboxRow: {
      marginTop: 10,
    },
    checkboxLabel: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.3rem',
      fontSize: '0.85rem',
      opacity: 0.8,
      color: theme.color,
    },
    checkboxInput: {
      width: 14,
      height: 14,
      cursor: 'default',
      accentColor: theme.color,
      backgroundColor: 'transparent',
    },
  };
}
