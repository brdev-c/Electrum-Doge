![Electrum Doge Banner](https://github.com/user-attachments/assets/27f58820-f2c3-42af-9b60-a0653a156c8a)

[![Latest Release](https://img.shields.io/github/v/release/brdev-c/Electrum-Doge?include_prereleases\&style=for-the-badge)](https://github.com/brdev-c/Electrum-Doge/releases)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)](LICENSE)

> Lightweight Dogecoin wallet built on Electrum. Fast ⸱ Secure ⸱ Open‑source.

---

## Feature Map

```mermaid
mindmap
  root((Electrum Doge))
    Seeds
      BIP‑39   
      BIP‑32   
    Keys
      WIF Import   
      Ledger Nano  
    Network
      Public Servers 
      Custom Servers 
    Build
      Electron   
      React  
```

---

## Architecture

```mermaid
flowchart LR
    subgraph Desktop
        A[React UI] --> B{Wallet Core}
    end
    B -->|JSON‑RPC| C(Electrum Protocol)
    C -->|SSL| D[Electrum Servers]
    B -->|USB| E[Ledger Nano]
```

---

## Get Started (dev)

```bash
npm install && npm run start   # http://localhost:3000
```

Build desktop app:

```bash
npm run electron:build         # ➜ dist/
```

Full setup docs → `docs/DEV.md`

---

## Downloads

Grab pre‑built binaries for Windows, macOS, and Linux on the
[Releases page](https://github.com/brdev-c/Electrum-Doge/releases).

---

## Security

Your 12‑word seed **is** your wallet. Store it offline and verify signatures before installing.

---

## License

MIT – see [LICENSE](LICENSE).
