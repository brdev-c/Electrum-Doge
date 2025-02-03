import React, { useState } from 'react';
import { useThemeContext } from '../../context/ThemeContext';
import { useWallet } from '../../context/WalletContext';
import { getUtxosWithRawTx, sendDogeTransaction } from '../../services/apiService';
import { createPaymentTxLargestFirst } from '../../services/ledgerLocalBuilder';

export default function NewTransactionModalLedger({
  onClose,
  recipient,
  description,
  amountDoge,
  onTxSuccess,
  isMax = false
}) {
  const { theme } = useThemeContext();
  const { wallet, serverParam, isLedgerWallet } = useWallet();
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleClickOK() {
    if (loading) return;
    setLoading(true);
    setErrorMsg('');
    try {
      console.log('[NewTransactionModalLedger] handleClickOK clicked.');
      console.log('Recipient:', recipient, 'Amount DOGE:', amountDoge);
      const amt = parseFloat(amountDoge) || 0;
      if (!recipient || amt <= 0) {
        throw new Error('Invalid data: recipient or amount');
      }
      if (!wallet || !wallet.addresses || !wallet.addresses.length) {
        throw new Error('No wallet addresses in current wallet');
      }
      let addrs = wallet.addresses.map(a => a.address);
      if (isLedgerWallet && wallet.addresses[0]) {
        addrs = [wallet.addresses[0].address];
      }
      console.log('[NewTransactionModalLedger] addresses to use:', addrs);
      console.log('[NewTransactionModalLedger] getUtxosWithRawTx...');
      const utxos = await getUtxosWithRawTx(addrs, serverParam);
      console.log('[NewTransactionModalLedger] UTXOs:', utxos);
      if (!utxos.length) {
        throw new Error('No UTXOs available');
      }
      console.log('[NewTransactionModalLedger] createPaymentTxLargestFirst...');
      const txData = createPaymentTxLargestFirst({
        utxos,
        addressObjects: wallet.addresses,
        recipientAddr: recipient.trim(),
        amountDoge: amt
      });
      console.log('[NewTransactionModalLedger] Calling ledgerSignTransaction. Waiting for Ledger confirmation...');
      const ledgerResp = await window.electronAPI.ledgerSignTransaction(txData);
      console.log('[NewTransactionModalLedger] ledgerResp:', ledgerResp);
      if (!ledgerResp.success) {
        throw new Error('Ledger sign error: ' + ledgerResp.error);
      }
      const signedTxHex = ledgerResp.signedTxHex;
      console.log('[NewTransactionModalLedger] Signed TX hex:', signedTxHex);
      const sendResp = await sendDogeTransaction(signedTxHex, serverParam);
      console.log('[NewTransactionModalLedger] Broadcast response:', sendResp);
      if (!sendResp.txid) {
        throw new Error('Broadcast failed (no txid returned)');
      }
      if (onTxSuccess) {
        onTxSuccess({ txid: sendResp.txid });
      }
    } catch (err) {
      console.error('[NewTransactionModalLedger] Tx error:', err);
      setErrorMsg('Error sending transaction: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={getStyles(theme).overlay}>
      <div style={getStyles(theme).modal}>
        <div style={getStyles(theme).header}>
          <h3 style={getStyles(theme).title}>New Transaction (Ledger)</h3>
          <button style={getStyles(theme).closeBtn} onClick={onClose}>×</button>
        </div>
        <div style={getStyles(theme).body}>
          <p style={{ fontSize:'0.85rem', margin:0 }}>
            Recipient: <b>{recipient}</b><br/>
            Amount: <b>{amountDoge} DOGE</b><br/>
            {description ? (
              <span>Description: {description}<br/></span>
            ) : null}
          </p>
          {loading && (
            <div style={getStyles(theme).infoBox}>
              Please confirm the transaction on your Ledger device...
            </div>
          )}
          {errorMsg && (
            <div style={getStyles(theme).errorBox}>
              {errorMsg}
            </div>
          )}
          <div style={getStyles(theme).footer}>
            <button style={getStyles(theme).cancelBtn} onClick={onClose}>Cancel</button>
            <button style={getStyles(theme).okBtn} onClick={handleClickOK} disabled={loading}>
              {loading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStyles(theme) {
  const textColor = '#fff';
  const modalBg = 'rgb(25,35,45)';
  const borderColor = 'rgba(255,255,255,0.3)';
  return {
    overlay: {
      position:'fixed',
      top:0,
      left:0,
      width:'100vw',
      height:'100vh',
      backgroundColor:'rgba(0,0,0,0.5)',
      zIndex:9999,
      display:'flex',
      justifyContent:'center',
      alignItems:'center'
    },
    modal: {
      backgroundColor: modalBg,
      color: textColor,
      border:`1px solid ${borderColor}`,
      borderRadius:'6px',
      width:'520px',
      padding:'1rem',
      display:'flex',
      flexDirection:'column',
      gap:'0.6rem',
      maxHeight:'80vh',
      overflowY:'auto',
      position:'relative'
    },
    header: {
      display:'flex',
      justifyContent:'space-between',
      alignItems:'center'
    },
    title: {
      margin:0,
      fontSize:'1rem'
    },
    closeBtn: {
      background:'none',
      border:'none',
      fontSize:'1.2rem',
      cursor:'pointer',
      color:textColor
    },
    body: {
      display:'flex',
      flexDirection:'column',
      gap:'0.5rem'
    },
    infoBox: {
      backgroundColor:'rgba(80,80,120,0.2)',
      color:'#ddf',
      padding:'0.5rem',
      borderRadius:'4px',
      fontSize:'0.85rem'
    },
    errorBox: {
      backgroundColor:'rgba(255,60,60,0.2)',
      color:'#fbb',
      padding:'0.4rem',
      borderRadius:'4px',
      fontSize:'0.85rem'
    },
    footer: {
      display:'flex',
      justifyContent:'flex-end',
      gap:'0.5rem',
      marginTop:'0.5rem'
    },
    cancelBtn: {
      height:22,
      padding:'0 8px',
      border:`1px solid ${borderColor}`,
      borderRadius:4,
      background:'none',
      color:textColor,
      cursor:'pointer',
      fontSize:'0.8rem'
    },
    okBtn: {
      height:22,
      padding:'0 10px',
      border:`1px solid ${borderColor}`,
      borderRadius:4,
      background:'rgba(255,255,255,0.1)',
      color:textColor,
      cursor:'pointer',
      fontWeight:'bold',
      fontSize:'0.8rem'
    }
  };
}
