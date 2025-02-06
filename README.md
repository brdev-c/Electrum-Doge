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

git clone https://github.com/brdev/ElectrumDogeWallet.git

Below is the rest of the README (in plain text, not code):

## 🛠 Installation & Usage

1. **Install dependencies (root folder):**  
   npm install

2. **Start the React frontend:**  
   npm run start  
   (Runs on http://localhost:3000)

3. **(Optional) Start the Node.js backend:**  
   cd src-back  
   npm install  
   npm start  
   (Typically runs on http://localhost:3001)

### Building the Electron App

To build a desktop application using Electron:

npm run electron:build

The bundled application will appear in the `dist/` folder (or equivalent).

---

## 🚀 How to Use

1. **Create or Import a Wallet**  
   On first run, choose **Create** (fresh BIP39 seed) or **Import** (existing seed/private key).

2. **Password & Encryption**  
   Set a password to encrypt wallet files (AES-256) securely.

3. **Manage Addresses**  
   Use the **Addresses** section to view your addresses and generate new ones as needed.

4. **Configure Electrum Servers**  
   In the **Settings** panel, select public or custom Dogecoin Electrum servers.

5. **Ledger Support (optional)**  
   Connect your Ledger device and follow on-screen instructions for hardware-based security.

---

## 🎨 Screenshots

<details>
  <summary>Sample Screenshot</summary>
  <img src="https://user-images.githubusercontent.com/123456/your-screenshot.png" alt="Electrum Doge Wallet Screenshot" />
</details>

---

## 🤝 Contributing

- **Report bugs**: [Issues](https://github.com/brdev/ElectrumDogeWallet/issues)  
- **Submit improvements**: [Pull Requests](https://github.com/brdev/ElectrumDogeWallet/pulls)  
- **Ask questions**: [Discussions](https://github.com/brdev/ElectrumDogeWallet/discussions) (if enabled)

---

## 📄 License

This project is released under the [MIT License](LICENSE).

---

**Note**: By using Electrum Doge Wallet, you accept responsibility for keeping your keys and funds secure. Always keep offline backups of your wallets and seed phrases.

Thank you for choosing Electrum Doge Wallet! Much wow, very Doge! 🐶
