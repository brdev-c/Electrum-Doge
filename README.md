<p align="center">
  <img src="https://github.com/user-attachments/assets/27f58820-f2c3-42af-9b60-a0653a156c8a" width="720" alt="Electrum Doge Banner"/>
</p>

<p align="center">
  <a href="https://github.com/brdev-c/Electrum-Doge/releases/latest">
    <img src="https://img.shields.io/github/v/release/brdev-c/Electrum-Doge?include_prereleases&style=for-the-badge" alt="Latest Release"/>
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge" alt="MIT License"/>
  </a>
</p>

<p align="center"><b>Lightweight Dogecoin wallet built on Electrum • Fast ⸱ Secure ⸱ Open‑source</b></p>



<p align="center">
  <a href="https://github.com/brdev-c/Electrum-Doge/releases/download/v.1.4.2/electrum-doge-1.4.2.exe">
    <img src="https://img.shields.io/badge/Windows‑x64‑EXE-0078D6?logo=windows&logoColor=white&style=for-the-badge" alt="Download for Windows"/>
  </a>
  <a href="https://github.com/brdev-c/Electrum-Doge/releases/download/v.1.4.2/electrum-doge-1.4.2.dmg">
    <img src="https://img.shields.io/badge/macOS‑Universal‑DMG-000000?logo=apple&logoColor=white&style=for-the-badge" alt="Download for macOS"/>
  </a>
  <a href="https://github.com/brdev-c/Electrum-Doge/releases/download/v.1.4.2/electrum-doge-1.4.2.AppImage">
    <img src="https://img.shields.io/badge/Linux‑AppImage-FCC624?logo=linux&logoColor=black&style=for-the-badge" alt="Download for Linux"/>
  </a>
</p>

---


### Architecture

```mermaid
flowchart LR
    subgraph Desktop
        A[React UI] --> B{Wallet Core}
    end
    B -->|JSON‑RPC| C(Electrum Protocol)
    C -->|SSL| D[Electrum Servers]
    B -->|USB| E[Ledger Nano]
    B -->|USB| F[Trezor]
```

---

### Get Started (dev)

```bash
git clone https://github.com/brdev-c/Electrum-Doge.git
cd Electrum-Doge
npm install
npm run start        # http://localhost:3000
```

Build desktop app:

```bash
npm run electron:build   # ➜ dist/
```

Full setup docs → [`docs/DEV.md`](docs/DEV.md)

---


Signatures and checksums are provided on the [Releases](https://github.com/brdev-c/Electrum-Doge/releases) page.

---

### License

[MIT](LICENSE)
