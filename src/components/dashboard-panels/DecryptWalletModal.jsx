import React, { useState } from 'react';

export default function DecryptWalletModal({ onClose, encryptedData, onDecrypted, theme }) {
  const isDark = theme.name === 'dark';
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const styles = getStyles(isDark);

  async function handleDecrypt() {
    setErrorMsg('');
    if (!password.trim()) {
      setErrorMsg('Please enter a password.');
      return;
    }
    if (!window.electronAPI) {
      setErrorMsg('Electron API not available.');
      return;
    }
    try {
      const resp = await window.electronAPI.decryptWalletRaw(encryptedData, password);
      if (!resp.ok) {
        setErrorMsg('Decryption failed: ' + (resp.error || 'Unknown error'));
        return;
      }
      if (!resp.wallet) {
        setErrorMsg('No wallet data returned after decryption.');
        return;
      }
      onDecrypted(resp.wallet);
      onClose();
    } catch (err) {
      console.error('handleDecrypt error:', err);
      setErrorMsg('Decryption error: ' + err.message);
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.title}>Decrypt Wallet File</h3>
          <button style={styles.closeBtn} onClick={onClose}>
            &#10006;
          </button>
        </div>
        <div style={styles.body}>
          <p style={styles.text}>
            This wallet file is encrypted. Please enter password to decrypt:
          </p>
          <input
            type="password"
            style={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}
        </div>
        <div style={styles.footer}>
          <button style={styles.outlineBtn} onClick={handleDecrypt}>
            Decrypt
          </button>
          <button style={styles.outlineBtn} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function getStyles(isDark) {
  return {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    },
    modal: {
      backgroundColor: isDark ? 'rgb(25,35,45)' : '#fff',
      color: isDark ? '#fff' : '#333',
      border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #ccc',
      borderRadius: 6,
      width: 400,
      maxWidth: '90%',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.8rem'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    title: {
      margin: 0,
      fontSize: '1rem'
    },
    closeBtn: {
      background: 'none',
      border: 'none',
      fontSize: '1.2rem',
      cursor: 'pointer',
      color: isDark ? '#fff' : '#333',
      lineHeight: '1rem'
    },
    body: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.6rem'
    },
    text: {
      fontSize: '0.9rem',
      lineHeight: 1.3
    },
    input: {
      border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #ccc',
      borderRadius: 4,
      padding: '0.4rem 0.5rem',
      backgroundColor: isDark ? 'rgb(40,50,60)' : '#fff',
      color: isDark ? '#fff' : '#333',
      outline: 'none'
    },
    errorBox: {
      backgroundColor: isDark ? 'rgba(255,60,60,0.2)' : '#fdd',
      color: isDark ? '#fbb' : '#900',
      padding: '0.4rem',
      borderRadius: 4,
      fontSize: '0.85rem'
    },
    footer: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '0.5rem'
    },
    outlineBtn: {
      padding: '0.3rem 0.7rem',
      border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #999',
      borderRadius: 4,
      background: 'none',
      color: isDark ? '#fff' : '#333',
      cursor: 'pointer',
      fontSize: '0.85rem'
    }
  };
}
