# Electrum Doge Wallet

**Developer:** brdev  
**Date:** February 03, 2025

This repository hosts **Electrum Doge**, a multi-address wallet for Dogecoin that combines:

- A React frontend (`src/` folder)  
- A Node.js backend (`src-back/` folder)  
- Electron integration for a desktop environment (`main/` folder and `electron.js`)

It supports local wallets generated with BIP39/BIP32 (e.g., 12-word mnemonics), partial Ledger hardware wallet usage, and customizable Electrum servers for Dogecoin.

## Key Features

1. **Local or Ledger**  
   - Create or import seeds (BIP39)  
   - Use a single WIF private key, or connect your Ledger device.  

2. **Multi-Address Management**  
   - Manages multiple addresses for external receiving and internal change.  
   - Automatic or manual expansion of new addresses if needed.

3. **Encrypted Wallet Files**  
   - By default, wallet files can be stored encrypted with AES-256, requiring a password.

4. **Electrum Servers**  
   - Communicate with public or custom Dogecoin Electrum servers.  
   - Automatic failover or manual selection of servers.

5. **React + Electron**  
   - Modern UI built with React, packaged as an Electron desktop application.  
   - Also supports running just the Node backend and the React frontend in dev mode.

## Installation

```bash
# Install dependencies for the main project
npm install

# Start the React frontend
npm run start
# This starts the dev server at http://localhost:3000

# (Optional) Start the Node backend (src-back)
cd src-back
npm install
npm start
# Usually runs on http://localhost:3001
