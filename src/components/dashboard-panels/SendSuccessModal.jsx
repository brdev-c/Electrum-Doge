import React from 'react';
import { useThemeContext } from '../../context/ThemeContext';

export default function SendSuccessModal({ onClose }) {
  const { theme } = useThemeContext();
  const styles = getStyles(theme);

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.title}>Transaction Successful</h3>
          <button style={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>
        <div style={styles.body}>
          <img
            src="/images/success.png"
            alt="Success"
            style={styles.successImg}
          />
          <p style={styles.msgText}>
            Your transaction was sent successfully!
          </p>
          <button style={styles.closeModalBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function getStyles(theme) {
  const isDark = theme.darkMode || theme.name === 'dark';
  const textColor = theme.color || '#fff';
  const borderColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)';
  const modalBg = theme.background || (isDark ? '#2f2f2f' : '#fff');

  return {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 99999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modal: {
      backgroundColor: modalBg,
      color: textColor,
      border: `1px solid ${borderColor}`,
      borderRadius: 6,
      width: '400px',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.8rem',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      margin: 0,
      fontSize: '1rem',
    },
    closeBtn: {
      background: 'none',
      border: 'none',
      fontSize: '1.2rem',
      cursor: 'pointer',
      color: textColor,
    },
    body: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem',
      marginTop: '0.5rem',
    },
    successImg: {
      width: '80px',
      height: '80px',
    },
    msgText: {
      fontSize: '0.95rem',
      textAlign: 'center',
    },
    closeModalBtn: {
      padding: '0.3rem 0.7rem',
      border: `1px solid ${borderColor}`,
      borderRadius: 4,
      backgroundColor: 'none',
      color: textColor,
      cursor: 'pointer',
      fontSize: '0.85rem',
    },
  };
}
