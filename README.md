# Electrum Doge Wallet 🐕🚀

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/brdev/ElectrumDogeWallet?color=green)](https://github.com/brdev/ElectrumDogeWallet/releases)
[![GitHub issues](https://img.shields.io/github/issues/brdev/ElectrumDogeWallet)](https://github.com/brdev/ElectrumDogeWallet/issues)
[![GitHub stars](https://img.shields.io/github/stars/brdev/ElectrumDogeWallet?style=social)](https://github.com/brdev/ElectrumDogeWallet/stargazers)

**Developer:** [brdev](https://github.com/brdev)  
**Date:** February 03, 2025

**Electrum Doge** is a multi-address Dogecoin wallet that combines:

- A React frontend (`src/` folder)
- A Node.js backend (`src-back/` folder)
- Electron integration (`main/` folder and `electron.js`) for desktop environments

It supports wallets generated via BIP39/BIP32 (e.g., 12-word seed phrases), partial usage of Ledger hardware wallets, and custom Electrum servers for Dogecoin.

---

## 🚩 Key Features

1. **Local or Ledger**  
   - Create or import seeds (BIP39) and single WIF private keys.  
   - Partial integration with Ledger for secure key storage.

2. **Multi-Address Management**  
   - Automatic generation of external (receiving) and internal (change) addresses.  
   - Easily expand new addresses if needed.

3. **Encrypted Wallet Files**  
   - By default, AES-256 encrypted wallet files, protected by a password.

4. **Electrum Servers**  
   - Connect to public or custom Dogecoin Electrum servers.  
   - Automatic failover or manual selection.

5. **React + Electron**  
   - Modern UI built with React, packaged into an Electron desktop app.  
   - Optionally run the React frontend and Node.js backend separately in dev mode.

---

## 📥 Downloads

- **[Latest Release](https://github.com/brdev/ElectrumDogeWallet/releases)**  
  Prebuilt binaries for Windows, macOS, and Linux.

Alternatively, clone the repository directly:

```bash
git clone https://github.com/brdev/ElectrumDogeWallet.git
