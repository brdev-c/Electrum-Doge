const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  dialog,
  shell,
  Notification,
} = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const TransportNodeHid = require('@ledgerhq/hw-transport-node-hid').default;
const Btc = require('@ledgerhq/hw-app-btc').default;

const dogecoinNetwork = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bech32: 'doge',
  bip32: {
    public: 0x02facafd,
    private: 0x02fac398,
  },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
};

let mainWindow = null;
const iconPath = path.join(__dirname, '../../public/images/electrum_logo.ico');

function createWindow() {
  console.log('[electron.js] createWindow() called...');
  mainWindow = new BrowserWindow({
    width: 830,
    height: 535,
    minWidth: 830,
    minHeight: 530,
    resizable: true,
    fullscreenable: true,
    icon: iconPath,
    title: 'Electrum Doge (Dev)',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    console.log('[electron.js] Loading localhost:3000 (dev mode)...');
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    console.log('[electron.js] Loading build/index.html (prod mode)...');
    mainWindow.loadFile(path.join(__dirname, '../../build/index.html'));
  }

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[electron.js] mainWindow did-finish-load event');
    mainWindow.webContents.insertCSS(`
      html, body {
        margin: 0;
        padding: 0;
        overflow: hidden !important;
      }
    `);
  });
}

if (process.platform === 'win32') {
  app.setAppUserModelId('Electrum Doge');
}

app.whenReady().then(() => {
  console.log('[electron.js] app.whenReady => Creating main window...');
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  console.log('[electron.js] All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('toggle-fullscreen', () => {
  if (!mainWindow) return;
  const isFull = mainWindow.isFullScreen();
  mainWindow.setFullScreen(!isFull);
  mainWindow.focus();
});

ipcMain.handle('app-quit', () => {
  console.log('[IPC] app-quit => quitting app...');
  app.quit();
});

ipcMain.handle('open-url', (event, urlToOpen) => {
  if (urlToOpen) shell.openExternal(urlToOpen);
});

ipcMain.handle('open-wallet-file-dialog', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select your wallet file',
    properties: ['openFile'],
    filters: [
      { name: 'Wallet Files', extensions: ['dat', 'wallet', 'json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePaths.length) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('check-wallet-file-encryption', async (event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(raw);
    return { exists: true, encrypted: !!json.encrypted };
  } catch (err) {
    console.error('checkWalletFileEncryption error:', err);
    return null;
  }
});

ipcMain.handle('decrypt-wallet-file', async (event, filePath, userPassword) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { ok: false, error: 'File not found' };
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(raw);
    if (!json.encrypted || !json.cipherText) {
      return { ok: true, wallet: json };
    }
    const decrypted = decryptWithPassword(json.cipherText, userPassword);
    if (!decrypted) {
      return { ok: false, error: 'Wrong password or decrypt error' };
    }
    const combined = {
      ...json,
      ...decrypted,
      encrypted: false,
      cipherText: undefined,
    };
    return { ok: true, wallet: combined };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('decrypt-wallet-raw', async (event, encryptedJsonString, userPassword) => {
  try {
    const jdata = JSON.parse(encryptedJsonString);
    if (!jdata.encrypted || !jdata.cipherText) {
      return { ok: true, wallet: jdata };
    }
    const decrypted = decryptWithPassword(jdata.cipherText, userPassword);
    if (!decrypted) {
      return { ok: false, error: 'Wrong password or decrypt error' };
    }
    const combined = {
      ...jdata,
      ...decrypted,
      encrypted: false,
      cipherText: undefined,
    };
    return { ok: true, wallet: combined };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('save-wallet-file', async (event, walletObject, password, filePath) => {
  try {
    if (!filePath) {
      return { success: false, error: 'No file path provided' };
    }
    const dataToSave = {
      version: 1,
      encrypted: false,
      mnemonic: walletObject.mnemonic || null,
      addresses: walletObject.addresses || [],
      xpub: walletObject.xpub || null,
    };
    if (password && password.trim().length > 0) {
      const plainData = JSON.stringify({
        mnemonic: dataToSave.mnemonic,
        xpub: dataToSave.xpub,
        addresses: dataToSave.addresses,
      });
      const cipherText = encryptWithPassword(plainData, password.trim());
      dataToSave.encrypted = true;
      dataToSave.cipherText = cipherText;
      dataToSave.mnemonic = null;
      dataToSave.addresses = [];
      dataToSave.xpub = null;
    }
    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('openFileByPath', async (event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { error: 'File not found' };
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return { fileData: raw };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('scan-ledger', async () => {
  console.log('[IPC] scan-ledger => start scanning...');
  let transport;
  try {
    const devices = await TransportNodeHid.list();
    console.log('[IPC] scan-ledger => devices:', devices);
    if (!devices || devices.length === 0) {
      return { success: true, deviceCount: 0 };
    }
    transport = await TransportNodeHid.create();
    const deviceModel = transport.deviceModel || null;
    const btc = new Btc(transport);
    let config;
    try {
      config = await btc.getAppConfiguration();
    } catch (e) {
      config = null;
    }
    let modelName = 'Unknown Ledger';
    if (deviceModel && deviceModel.productName) {
      modelName = deviceModel.productName;
    }
    let appVersion = 'Unknown';
    if (config && config.version) {
      appVersion = config.version;
    }
    await transport.close().catch(() => {});
    console.log('[IPC] scan-ledger => done');
    return {
      success: true,
      deviceCount: devices.length,
      deviceModel: modelName,
      appVersion,
    };
  } catch (err) {
    console.error('[IPC] scan-ledger error:', err);
    return { success: false, error: err.message };
  } finally {
    if (transport) {
      try {
        await transport.close();
      } catch {}
    }
  }
});

ipcMain.handle('read-ledger-xpub', async (event, derivationPathString) => {
  console.log('[IPC] read-ledger-xpub => derivationPath:', derivationPathString);
  let transport;
  try {
    transport = await TransportNodeHid.create();
    const btc = new Btc(transport);
    const pubResp = await btc.getWalletPublicKey(derivationPathString, {
      verify: false,
      format: 'legacy'
    });
    return {
      success: true,
      publicKeyHex: pubResp.publicKey.toString('hex'),
      chainCodeHex: pubResp.chainCode.toString('hex')
    };
  } catch (err) {
    console.error('[IPC] read-ledger-xpub error:', err);
    return { success: false, error: err.message };
  } finally {
    if (transport) {
      await transport.close().catch(() => {});
    }
  }
});

ipcMain.handle('ledgerSignTransaction', async (event, txData) => {
  console.log('[IPC] ledgerSignTransaction => txData:', txData);
  let transport;
  try {
    transport = await TransportNodeHid.create();
    const btc = new Btc(transport);
    const splittedInputs = txData.inputs.map(([rawHex, vout, redeemScript, sequence], idx) => {
      console.log(`[IPC] ledgerSignTransaction => Input #${idx}`, rawHex?.length, vout);
      return [
        btc.splitTransaction(rawHex, false, false, false, ['dogecoin']),
        vout,
        redeemScript,
        sequence
      ];
    });
    const signedTxHex = await btc.createPaymentTransactionNew({
      inputs: splittedInputs,
      associatedKeysets: txData.associatedKeysets,
      outputScriptHex: txData.outputScriptHex,
      lockTime: txData.lockTime || 0,
      sigHashType: 1,
      segwit: false,
      additionals: ['dogecoin'],
    });
    console.log('[IPC] ledgerSignTransaction => signedTxHex:', signedTxHex);
    return { success: true, signedTxHex };
  } catch (err) {
    console.error('[IPC] ledgerSignTransaction error:', err);
    return { success: false, error: err.message };
  } finally {
    if (transport) {
      await transport.close().catch(() => {});
    }
  }
});

ipcMain.handle('notify-incoming-transaction', (event, { address, txid, amount }) => {
  try {
    const amountStr = amount ? `${amount}` : '0.0';
    const notif = new Notification({
      title: 'Incoming Transaction',
      body: `Received: ${amountStr} DOGE`,
      icon: iconPath,
    });
    notif.show();
  } catch {}
});

ipcMain.handle('notify-outgoing-transaction', (event, { txid, amountDoge, to }) => {
  try {
    const amtStr = amountDoge ? `${amountDoge}` : '0.0';
    const notif = new Notification({
      title: 'Transaction Sent',
      body: `Sent: ${amtStr} DOGE`,
      icon: iconPath,
    });
    notif.show();
  } catch {}
});

function encryptWithPassword(plainText, password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const packed = {
    s: salt.toString('base64'),
    i: iv.toString('base64'),
    d: encrypted,
  };
  return Buffer.from(JSON.stringify(packed)).toString('base64');
}

function decryptWithPassword(cipherBase64, password) {
  try {
    const rawPacked = Buffer.from(cipherBase64, 'base64').toString('utf-8');
    const { s, i, d } = JSON.parse(rawPacked);
    const salt = Buffer.from(s, 'base64');
    const iv = Buffer.from(i, 'base64');
    const key = crypto.scryptSync(password, salt, 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(d, 'base64', 'utf-8');
    decrypted += decipher.final('utf-8');
    return JSON.parse(decrypted);
  } catch (e) {
    return null;
  }
}
