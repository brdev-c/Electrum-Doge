import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect
} from 'react';
import { useThemeContext } from '../../context/ThemeContext';
import { useWallet } from '../../context/WalletContext';
import jsQR from 'jsqr';
import NewTransactionModalLocal from './NewTransactionModalLocal';
import {
  getUtxosWithRawTx,
  getDogeTransactionsAll
} from '../../services/apiService';
import { createUnsignedTx } from '../../services/walletService';

function SendSuccessModal({ onClose }) {
  const { theme } = useThemeContext();
  const styles = getStyles(theme);
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Transaction Successful</h3>
          <button style={styles.modalCloseBtn} onClick={onClose}>
            ×
          </button>
        </div>
        <div style={styles.modalBody}>
          <img
            src="/images/success.png"
            alt="Success"
            style={{ width: 80, height: 80 }}
          />
          <p>Your transaction was sent successfully!</p>
          <button
            style={{
              padding: '0.3rem 0.7rem',
              border: `1px solid ${styles.borderColor}`,
              borderRadius: 4,
              background: 'none',
              color: styles.textColor,
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SendPanelLocal() {
  const { theme } = useThemeContext();
  const { fiatCurrency, dogePriceFiat, cameraDeviceId, wallet, serverParam } = useWallet();
  const styles = getStyles(theme);
  const isDark = theme.darkMode || theme.name === 'dark';

  const [recipient, setRecipient] = useState('');
  const [description, setDescription] = useState('');
  const [amountDoge, setAmountDoge] = useState('');
  const [amountFiat, setAmountFiat] = useState('');

  const [allUtxos, setAllUtxos] = useState([]);
  const [insufficientFunds, setInsufficientFunds] = useState(false);
  const [canSend, setCanSend] = useState(false);

  const [maxUsed, setMaxUsed] = useState(false);

  const [localTxList, setLocalTxList] = useState([]);
  const walletId = wallet?.mnemonic || wallet?.address || 'temp_wallet';

  useEffect(() => {
    const saved = localStorage.getItem('app_sendTx_' + walletId);
    if (saved) {
      try {
        const arr = JSON.parse(saved);
        setLocalTxList(arr);
      } catch (err) {
        console.warn('Failed to parse localTxList from storage', err);
      }
    }
  }, [walletId]);

  useEffect(() => {
    localStorage.setItem('app_sendTx_' + walletId, JSON.stringify(localTxList));
  }, [localTxList, walletId]);

  useEffect(() => {
    const timer = setInterval(() => {
      checkOverdueTxs();
      pollConfirmationsAll();
    }, 10000);
    return () => clearInterval(timer);
  }, [localTxList, wallet, serverParam]);

  function checkOverdueTxs() {
    setLocalTxList(prev => {
      const arr = [...prev];
      const now = Date.now();
      arr.forEach(item => {
        if (item.status === 'Not sent') {
          const createdTime = item.createdTime || 0;
          if (now - createdTime > 86400000) {
            item.status = 'Overdue';
            item.confirmations = 0;
          }
        }
      });
      return arr;
    });
  }

  async function pollConfirmationsAll() {
    try {
      if (!wallet || !wallet.addresses) return;
      const addrArray = wallet.addresses.map(a => a.address);
      if (!addrArray.length) return;
      const resp = await getDogeTransactionsAll(addrArray, serverParam);
      const txs = resp.txs || [];
      setLocalTxList(prevList => {
        const newList = prevList.map(item => {
          if (item.txid) {
            const match = txs.find(t => t.txid === item.txid);
            if (match) {
              item.confirmations = match.confirmations || 0;
              if (item.confirmations >= 6) {
                item.status = 'Confirmed';
              } else if (item.confirmations >= 1) {
                item.status = 'Sent';
              }
              item.blockTime = match.time || 0;
            }
          }
          return item;
        });
        return [...newList];
      });
    } catch (err) {
      console.error('pollConfirmationsAll error', err);
    }
  }

  const [showSettings, setShowSettings] = useState(false);
  const menuRef = useRef(null);

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

  function toggleSettings() {
    setShowSettings(!showSettings);
  }

  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const frameIdRef = useRef(0);

  function handleReadQrCamera() {
    setShowSettings(false);
    if (!cameraDeviceId) {
      alert('No camera selected! Go to Settings → Camera Settings');
      return;
    }
    setCameraModalOpen(true);
    setCameraError('');
  }

  useEffect(() => {
    if (!cameraModalOpen) return;
    let streamRef = null;
    const constraints = { video: { deviceId: cameraDeviceId } };
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        streamRef = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            frameIdRef.current = requestAnimationFrame(scanCameraFrame);
          };
        }
      })
      .catch((err) => {
        setCameraError(`Failed to open camera: ${err.name} / ${err.message}`);
      });
    return () => {
      if (streamRef) {
        streamRef.getTracks().forEach((t) => t.stop());
      }
      cancelAnimationFrame(frameIdRef.current);
    };
  }, [cameraModalOpen]);

  const scanCameraFrame = useCallback(() => {
    if (!cameraModalOpen) return;
    const videoEl = videoRef.current;
    const canvasEl = canvasRef.current;
    if (!videoEl || !canvasEl) {
      frameIdRef.current = requestAnimationFrame(scanCameraFrame);
      return;
    }
    const w = videoEl.videoWidth;
    const h = videoEl.videoHeight;
    if (w <= 0 || h <= 0) {
      frameIdRef.current = requestAnimationFrame(scanCameraFrame);
      return;
    }
    const ctx = canvasEl.getContext('2d');
    canvasEl.width = w;
    canvasEl.height = h;
    ctx.drawImage(videoEl, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const code = jsQR(imageData.data, w, h);
    if (code) {
      if (isValidDogeAddress(code.data)) {
        setRecipient(code.data);
        setCameraModalOpen(false);
      } else {
        setCameraError('Invalid address found in QR');
      }
      return;
    }
    frameIdRef.current = requestAnimationFrame(scanCameraFrame);
  }, [cameraModalOpen]);

  function closeCameraModal() {
    setCameraModalOpen(false);
    setCameraError('');
  }

  const [screenModalOpen, setScreenModalOpen] = useState(false);
  const [screenError, setScreenError] = useState('');
  const [screenImg, setScreenImg] = useState(null);
  const [selection, setSelection] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [mouseDownPos, setMouseDownPos] = useState(null);
  const screenCanvasRef = useRef(null);

  function handleReadQrFromScreen() {
    setShowSettings(false);
    setScreenModalOpen(true);
    setScreenError('');
    setScreenImg(null);
    setSelection({ x: 0, y: 0, w: 0, h: 0 });
    setMouseDownPos(null);
  }

  async function handleSelectEntireScreen() {
    try {
      setScreenError('');
      const result = await window.electronAPI.getEntireScreen({
        types: ['screen'],
        thumbnailSize: { width: 1600, height: 900 }
      });
      if (result.error) {
        setScreenError(`Screen capture error: ${result.error}`);
        return;
      }
      if (result.dataURL) {
        setScreenImg(result.dataURL);
      } else {
        setScreenError('No screen data returned.');
      }
    } catch (err) {
      setScreenError('Unexpected error: ' + err.message);
    }
  }

  function handleUploadScreenshot(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setScreenError('Please select an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setScreenImg(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  function onMouseDownCanvas(e) {
    if (!screenCanvasRef.current) return;
    const rect = screenCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMouseDownPos({ x, y });
    setSelection({ x, y, w: 0, h: 0 });
  }

  function onMouseMoveCanvas(e) {
    if (!mouseDownPos) return;
    if (!screenCanvasRef.current) return;
    const rect = screenCanvasRef.current.getBoundingClientRect();
    const x2 = e.clientX - rect.left;
    const y2 = e.clientY - rect.top;
    setSelection({
      x: Math.min(mouseDownPos.x, x2),
      y: Math.min(mouseDownPos.y, y2),
      w: Math.abs(x2 - mouseDownPos.x),
      h: Math.abs(y2 - mouseDownPos.y)
    });
  }
  function onMouseUpCanvas() {
    setMouseDownPos(null);
  }

  useLayoutEffect(() => {
    if (!screenImg) return;
    const cvs = screenCanvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const img = new Image();
    img.onload = () => {
      cvs.width = img.width;
      cvs.height = img.height;
      ctx.drawImage(img, 0, 0);
      if (selection.w > 2 && selection.h > 2) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(selection.x, selection.y, selection.w, selection.h);
      }
    };
    img.src = screenImg;
  }, [screenImg, selection]);

  function handleScanSelectedArea() {
    if (!screenCanvasRef.current || !screenImg) return;
    if (selection.w < 5 || selection.h < 5) {
      setScreenError('No area selected. Drag on image to select region with QR.');
      return;
    }
    const cvs = screenCanvasRef.current;
    const ctx = cvs.getContext('2d');
    const imgData = ctx.getImageData(selection.x, selection.y, selection.w, selection.h);
    const code = jsQR(imgData.data, selection.w, selection.h);
    if (code) {
      if (isValidDogeAddress(code.data)) {
        setRecipient(code.data);
        setScreenModalOpen(false);
      } else {
        setScreenError('Invalid address found in QR.');
      }
    } else {
      setScreenError('No QR detected in selected area.');
    }
  }

  function closeScreenModal() {
    setScreenModalOpen(false);
  }

  function handleReadInvoiceFile() {
    setShowSettings(false);
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt, .png, .jpg, .jpeg';
    fileInput.onchange = () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = ev.target.result;
          const possible = parseTextForDogeAddress(text);
          if (possible) {
            setRecipient(possible);
          } else {
            alert('No valid DOGE address found in file.');
          }
        };
        reader.readAsText(file);
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataURL = ev.target.result;
          const img = new Image();
          img.onload = () => {
            const offCanvas = document.createElement('canvas');
            offCanvas.width = img.width;
            offCanvas.height = img.height;
            const ctx = offCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            const code = jsQR(imageData.data, img.width, img.height);
            if (code) {
              if (isValidDogeAddress(code.data)) {
                setRecipient(code.data);
              } else {
                alert('Invalid address found in QR.');
              }
            } else {
              alert('No QR found in image.');
            }
          };
          img.src = dataURL;
        };
        reader.readAsDataURL(file);
      } else {
        alert('Unsupported file type.');
      }
    };
    fileInput.click();
  }

  useEffect(() => {
    if (!wallet || !wallet.addresses) return;
    const addrArray = wallet.addresses.map(a => a.address);
    getUtxosWithRawTx(addrArray, serverParam)
      .then(res => {
        setAllUtxos(res);
      })
      .catch(err => {
        console.error('Failed to load UTXOs for coin selection', err);
        setAllUtxos([]);
      });
  }, [wallet, serverParam]);

  useEffect(() => {
    const timer = setTimeout(() => {
      draftCheck();
    }, 500);
    return () => clearTimeout(timer);
  }, [amountDoge, allUtxos, recipient]);

  async function draftCheck() {
    setInsufficientFunds(false);
    setCanSend(false);
    if (!wallet || !wallet.addresses) return;
    if (!isValidDogeAddress(recipient)) return;
    const amt = parseFloat(amountDoge);
    if (!amt || amt <= 0) return;
    if (!allUtxos.length) {
      setInsufficientFunds(true);
      return;
    }
    try {
      const recipients = [
        { address: recipient, valueSat: Math.floor(amt * 1e8) }
      ];
      await createUnsignedTx({
        recipients,
        feeRate: 200,
        allUtxos,
        walletAddresses: wallet.addresses,
        lockTime: null,
        useChange: true
      });
      setCanSend(true);
      setInsufficientFunds(false);
    } catch (err) {
      if (err.message.includes('Not enough funds')) {
        setInsufficientFunds(true);
      } else {
        console.warn('draftCheck error:', err);
      }
    }
  }

  function handlePaste() {
    navigator.clipboard
      .readText()
      .then((txt) => {
        setRecipient(txt);
      })
      .catch(() => {
        alert('Failed to read from clipboard');
      });
  }

  async function handleMax() {
    if (!wallet || !wallet.addresses || !allUtxos.length) return;
    if (!isValidDogeAddress(recipient)) {
      alert('Please enter a valid DOGE address first.');
      return;
    }
    try {
      let totalIn = 0;
      allUtxos.forEach(u => {
        totalIn += u.value;
      });
      const dummyRecipients = [
        { address: recipient, valueSat: totalIn }
      ];
      const draft = await createUnsignedTx({
        recipients: dummyRecipients,
        feeRate: 200,
        allUtxos,
        walletAddresses: wallet.addresses,
        lockTime: null,
        useChange: false
      });
      const realSpent = draft.outputs[0].value;
      const dogeAmt = realSpent / 1e8;
      setAmountDoge(dogeAmt.toFixed(8));
      if (dogePriceFiat > 0) {
        setAmountFiat((dogeAmt * dogePriceFiat).toFixed(2));
      }
      setInsufficientFunds(false);
      setCanSend(true);
      setMaxUsed(true);
    } catch (err) {
      console.warn('Max button error:', err);
      setInsufficientFunds(true);
      setCanSend(false);
      setMaxUsed(false);
    }
  }

  function onChangeDoge(e) {
    const val = e.target.value;
    setAmountDoge(val);
    setMaxUsed(false);
    if (!val) {
      setAmountFiat('');
      setCanSend(false);
      return;
    }
    const dogeNum = parseFloat(val);
    if (!isNaN(dogeNum) && dogeNum > 0 && dogePriceFiat > 0) {
      setAmountFiat((dogeNum * dogePriceFiat).toFixed(2));
    } else {
      setAmountFiat('');
    }
  }

  function onChangeFiat(e) {
    const val = e.target.value;
    setAmountFiat(val);
    setMaxUsed(false);
    if (!val) {
      setAmountDoge('');
      setCanSend(false);
      return;
    }
    const fiatNum = parseFloat(val);
    if (!isNaN(fiatNum) && fiatNum > 0 && dogePriceFiat > 0) {
      const dogeNum = fiatNum / dogePriceFiat;
      setAmountDoge(dogeNum.toFixed(4));
    } else {
      setAmountDoge('');
    }
  }

  function handleSave() {
    const now = Date.now();
    const nowStr = new Date(now).toLocaleString();
    const newItem = {
      date: nowStr,
      createdTime: now,
      description: description || '',
      amountDoge: amountDoge || '0',
      address: recipient || '',
      status: 'Not sent',
      txid: null,
      confirmations: 0,
      blockTime: null
    };
    setLocalTxList(prev => [newItem, ...prev]);
  }

  const [showNewTxModal, setShowNewTxModal] = useState(false);
  function handleCloseNewTx() {
    setShowNewTxModal(false);
  }

  const [showSuccessModal, setShowSuccessModal] = useState(false);

  function handleTxSuccess(info) {
    setShowNewTxModal(false);
    setShowSuccessModal(true);
    const now = Date.now();
    const nowStr = new Date(now).toLocaleString();
    const newItem = {
      date: nowStr,
      createdTime: now,
      description: description || '',
      amountDoge: amountDoge || '0',
      address: recipient || '',
      status: 'Sent',
      txid: info.txid,
      confirmations: 0,
      blockTime: null
    };
    setLocalTxList(prev => [newItem, ...prev]);
  }

  function handleCloseSuccess() {
    setShowSuccessModal(false);
  }

  function handleTransfer() {
    if (!canSend) return;
    setShowNewTxModal(true);
  }

  function copyTxidToClipboard(txid) {
    if (!txid) return;
    navigator.clipboard
      .writeText(txid)
      .then(() => {})
      .catch(() => {
        console.error('Failed to copy txid');
      });
  }

  function handleExplorerClick(txid) {
    if (!txid) return;
    const url = `https://dogechain.info/tx/${txid}`;
    window.open(url, '_blank');
  }

  function renderConfCell(item) {
    if (!item.txid) {
      return item.status;
    }
    const conf = item.confirmations || 0;
    if (conf < 6) {
      return (
        <span style={styles.confCell}>
          {conf}/6
          <img
            src="/images/pending.png"
            alt="pending"
            style={{ width: 14, height: 14, marginLeft: 4 }}
          />
        </span>
      );
    } else {
      return (
        <span style={styles.confCell}>
          <img
            src="/images/donetrans.png"
            alt="confirmed"
            style={{ width: 14, height: 14 }}
          />
        </span>
      );
    }
  }

  function renderTxidCell(item) {
    if (!item.txid) {
      return item.status;
    }
    return (
      <div style={styles.txidCell}>
        <button
          style={styles.copyBtn}
          onClick={() => copyTxidToClipboard(item.txid)}
        >
          Copy
        </button>
      </div>
    );
  }

  function renderExplorerCell(item) {
    if (!item.txid) {
      return '—';
    }
    return (
      <button style={styles.explorerBtn} onClick={() => handleExplorerClick(item.txid)}>
        Explorer
      </button>
    );
  }

  const isRecipientFilled = recipient.trim().length > 0;
  const isDescriptionFilled = description.trim().length > 0;
  const isAmountFilled = parseFloat(amountDoge) > 0;
  const isSaveDisabled = !isRecipientFilled || !isDescriptionFilled || !isAmountFilled;
  const isRecipientValid = isValidDogeAddress(recipient);
  const isTransferDisabled = !isRecipientValid || !isAmountFilled || !canSend;

  const [tableMaxHeight, setTableMaxHeight] = useState('200px');
  useEffect(() => {
    function updateTableHeight() {
      const rowHeight = 40;
      const minHeight = 3.5 * rowHeight;
      const headerOffset = 350;
      const available = window.innerHeight - headerOffset;
      const effectiveHeight = available > minHeight ? available : minHeight;
      setTableMaxHeight(`${effectiveHeight}px`);
    }
    updateTableHeight();
    window.addEventListener('resize', updateTableHeight);
    return () => window.removeEventListener('resize', updateTableHeight);
  }, []);

  return (
    <div style={styles.container}>
      <style>{`
        .table-scroll {
          overflow-y: auto;
          scrollbar-width: thin;
        }
        .table-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .table-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .table-scroll::-webkit-scrollbar-thumb {
          background-color: rgb(69,83,100);
          border-top-left-radius: 0;
          border-top-right-radius: 0;
          border-bottom-left-radius: 3px;
          border-bottom-right-radius: 3px;
        }
      `}</style>
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
              <div style={styles.settingsMenu}>
                <div style={styles.menuItem} onClick={handleReadQrCamera}>
                  Read QR code with camera
                </div>
                <div style={styles.menuSeparator} />
                <div style={styles.menuItem} onClick={handleReadQrFromScreen}>
                  Read QR code from screen
                </div>
                <div style={styles.menuSeparator} />
                <div style={styles.menuItem} onClick={handleReadInvoiceFile}>
                  Read invoice from file
                </div>
              </div>
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
        />
      </div>
      <div style={styles.formRow}>
        <label style={styles.formLabel}>Amount</label>
        <div style={styles.amountLine}>
          <div style={styles.suffixContainer}>
            <input
              style={styles.suffixInput}
              value={amountDoge}
              onChange={onChangeDoge}
              placeholder="0.0"
            />
            <div style={styles.suffixLabel}>DOGE</div>
          </div>
          <div style={styles.suffixContainer}>
            <input
              style={styles.suffixInput}
              value={amountFiat}
              onChange={onChangeFiat}
              placeholder={fiatCurrency}
            />
            <div style={styles.suffixLabel}>{fiatCurrency}</div>
          </div>
          <div style={styles.maxLink} onClick={handleMax}>
            Max
          </div>
        </div>
      </div>
      {insufficientFunds && (
        <div style={styles.errorBox}>
          Not enough funds to cover amount + fee.
        </div>
      )}
      <div style={styles.buttonsContainer}>
        <button
          style={styles.clearBtn}
          onClick={() => {
            setRecipient('');
            setDescription('');
            setAmountDoge('');
            setAmountFiat('');
            setInsufficientFunds(false);
            setCanSend(false);
            setMaxUsed(false);
          }}
        >
          Clear
        </button>
        <button
          style={{
            ...styles.saveBtn,
            ...(isSaveDisabled ? styles.disabledBtn : {})
          }}
          onClick={handleSave}
          disabled={isSaveDisabled}
        >
          Save
        </button>
        <button
          style={{
            ...styles.payBtn,
            ...(isTransferDisabled ? styles.disabledBtn : {})
          }}
          onClick={handleTransfer}
          disabled={isTransferDisabled}
        >
          Transfer
        </button>
      </div>
      {cameraModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Scan QR (Camera)</h3>
              <button style={styles.modalCloseBtn} onClick={closeCameraModal}>
                ×
              </button>
            </div>
            <div style={styles.modalBody}>
              {cameraError && <div style={styles.modalError}>{cameraError}</div>}
              <video ref={videoRef} style={styles.videoPreview} muted />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
          </div>
        </div>
      )}
      {screenModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Read QR from screen</h3>
              <button style={styles.modalCloseBtn} onClick={closeScreenModal}>
                ×
              </button>
            </div>
            <div style={styles.modalBody}>
              {screenError && <div style={styles.modalError}>{screenError}</div>}
              {!screenImg && (
                <div style={styles.screenActions}>
                  <button style={styles.selectBtn} onClick={handleSelectEntireScreen}>
                    Select entire screen
                  </button>
                  <div style={{ marginTop: '0.5rem' }}>
                    or <input type="file" accept="image/*" onChange={handleUploadScreenshot} />
                  </div>
                </div>
              )}
              {screenImg && (
                <div style={styles.screenshotWrapper}>
                  <canvas
                    ref={screenCanvasRef}
                    style={styles.screenshotCanvas}
                    onMouseDown={onMouseDownCanvas}
                    onMouseMove={onMouseMoveCanvas}
                    onMouseUp={onMouseUpCanvas}
                  />
                </div>
              )}
            </div>
            {screenImg && (
              <div style={styles.modalFooter}>
                <button style={styles.selectBtn} onClick={handleScanSelectedArea}>
                  Scan selected area
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {showNewTxModal && (
        <NewTransactionModalLocal
          onClose={handleCloseNewTx}
          recipient={recipient}
          description={description}
          amountDoge={amountDoge}
          onTxSuccess={handleTxSuccess}
          isMax={maxUsed}
        />
      )}
      {showSuccessModal && (
        <SendSuccessModal onClose={handleCloseSuccess} />
      )}
      {localTxList.length > 0 && (
        <div style={styles.outgoingSection}>
          <h4 style={styles.tableTitle}>Outgoing Transactions</h4>
          <div style={styles.tableWrapper}>
            <table style={styles.outgoingTable}>
              <colgroup>
                <col style={{ width: '16%' }} />
                <col style={{ width: '26%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '7%' }} />
              </colgroup>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={{ ...styles.th, ...styles.thFirst }}>Date</th>
                  <th style={styles.th}>Address</th>
                  <th style={styles.th}>Description</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Conf</th>
                  <th style={styles.th}>TXID</th>
                  <th style={{ ...styles.th, ...styles.thLast }}>Explorer</th>
                </tr>
              </thead>
            </table>
            <div className="table-scroll" style={{ maxHeight: tableMaxHeight }}>
              <table style={{ ...styles.outgoingTable, marginTop: 0 }}>
                <colgroup>
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '26%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                </colgroup>
                <tbody>
                  {localTxList.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ ...styles.td, ...styles.tdFirstBottom }}>{item.date}</td>
                      <td style={styles.td}>{item.address || '-'}</td>
                      <td style={styles.td}>{item.description}</td>
                      <td style={styles.td}>{item.amountDoge} DOGE</td>
                      <td style={styles.td}>{renderConfCell(item)}</td>
                      <td style={styles.td}>{renderTxidCell(item)}</td>
                      <td style={{ ...styles.td, ...styles.tdLastBottom }}>
                        {renderExplorerCell(item)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function isValidDogeAddress(addr) {
  if (!addr) return false;
  if (!addr.startsWith('D')) return false;
  if (addr.length < 30 || addr.length > 40) return false;
  return true;
}
function parseTextForDogeAddress(text) {
  const lines = text.split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (isValidDogeAddress(line)) {
      return line;
    }
  }
  return null;
}

function getStyles(theme) {
  const isDark = theme.darkMode || theme.name === 'dark';
  const textColor = theme.color || '#333';
  const inputBorderColor = theme.inputBorder || (isDark ? '#777' : '#ccc');
  const borderColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)';
  const inputBg = theme.inputBg || (isDark ? '#2f2f2f' : '#fff');
  return {
    textColor,
    borderColor,
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
    saveBtn: {
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
    disabledBtn: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: isDark ? '#333' : '#fff',
      color: isDark ? '#fff' : '#333',
      padding: '1rem',
      borderRadius: '6px',
      width: '600px',
      maxWidth: '95%',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalTitle: {
      margin: 0,
      fontSize: '1rem',
    },
    modalCloseBtn: {
      background: 'none',
      border: 'none',
      fontSize: '1.2rem',
      cursor: 'pointer',
      color: isDark ? '#fff' : '#333',
    },
    modalBody: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.5rem',
    },
    modalError: {
      backgroundColor: isDark ? 'rgba(180,60,60,0.2)' : '#fbdada',
      color: isDark ? '#ff8080' : '#900',
      padding: '0.5rem',
      borderRadius: '4px',
      width: '100%',
      boxSizing: 'border-box',
    },
    videoPreview: {
      width: '100%',
      maxHeight: '50vh',
      backgroundColor: '#000',
    },
    screenActions: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.5rem',
    },
    selectBtn: {
      padding: '0.3rem 0.6rem',
      border: `1px solid ${inputBorderColor}`,
      borderRadius: 4,
      background: 'none',
      color: isDark ? '#fff' : '#333',
      cursor: 'pointer',
      fontSize: '0.85rem',
    },
    screenshotWrapper: {
      width: '100%',
      maxHeight: '50vh',
      overflow: 'auto',
      border: `1px solid ${borderColor}`,
      borderRadius: 4,
      position: 'relative',
    },
    screenshotCanvas: {
      display: 'block',
    },
    modalFooter: {
      display: 'flex',
      justifyContent: 'center',
    },
    errorBox: {
      marginTop: '0.5rem',
      backgroundColor: isDark ? 'rgba(255,60,60,0.2)' : '#fdd',
      color: isDark ? '#fbb' : '#900',
      padding: '0.4rem',
      borderRadius: '4px',
      fontSize: '0.85rem',
    },
    outgoingSection: {
      marginTop: '2rem',
    },
    tableTitle: {
      margin: '1rem 0 0.5rem',
      fontSize: '1rem',
    },
    tableWrapper: {
      border: `1px solid ${borderColor}`,
      borderRadius: 6,
      overflow: 'hidden',
    },
    outgoingTable: {
      width: '100%',
      borderCollapse: 'separate',
      borderSpacing: 0,
      fontSize: '0.85rem',
      tableLayout: 'fixed',
    },
    tableHeaderRow: {
      backgroundColor: isDark ? 'rgb(69,83,100)' : '#f1f1f1',
      color: isDark ? '#fff' : '#333',
    },
    thFirst: {
      borderTopLeftRadius: 6,
    },
    thLast: {
      borderTopRightRadius: 6,
    },
    th: {
      textAlign: 'left',
      fontSize: '0.85rem',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      padding: '0.4rem',
      lineHeight: 1.2,
      borderBottom: `1px solid ${borderColor}`,
    },
    tdFirstBottom: {
      borderBottomLeftRadius: 6,
    },
    tdLastBottom: {
      borderBottomRightRadius: 6,
    },
    td: {
      padding: '0.4rem',
      borderBottom: `1px solid ${borderColor}`,
      fontSize: '0.85rem',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      lineHeight: 1.2,
      verticalAlign: 'middle',
    },
    confCell: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    },
    txidCell: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
    },
    copyBtn: {
      padding: '0.2rem 0.4rem',
      fontSize: '0.75rem',
      border: `1px solid ${inputBorderColor}`,
      borderRadius: 4,
      background: 'none',
      color: textColor,
      cursor: 'pointer',
    },
    explorerBtn: {
      padding: '0.2rem 0.6rem',
      fontSize: '0.75rem',
      border: `1px solid ${inputBorderColor}`,
      borderRadius: 4,
      background: 'none',
      color: textColor,
      cursor: 'pointer',
    }
  };
}
