[![Latest Release](https://img.shields.io/github/v/release/brdev-c/Electrum-Doge?include_prereleases&style=flat-square)](https://github.com/brdev-c/Electrum-Doge/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/brdev-c/Electrum-Doge/blob/main/LICENSE)
<!DOCTYPE html>
<html lang="en">
<body>
<h1> 🌟 Electrum Doge Wallet</h1>
<p>
  A Dogecoin wallet built on the Electrum framework. Supports BIP39/BIP32 (12-word seeds),  
  single WIF private keys, partial Ledger integration, and custom Electrum servers.
</p>

<hr>



<hr>

<h2>Downloads 📦</h2>
<p>
  <strong><a href="https://github.com/brdev-c/Electrum-Doge/releases">Latest Release</a></strong><br>
  (Windows, macOS, Linux)
</p>
<p>Or clone directly:</p>
<pre><code>git clone https://github.com/brdev-c/Electrum-Doge.git</code></pre>

<hr>

<h2>Installation &amp; Usage 💻</h2>
<ol>
  <li>
    <strong>Install dependencies:</strong>
    <pre><code>npm install</code></pre>
  </li>
  <li>
    <strong>Start React frontend:</strong>
    <pre><code>npm run start</code></pre>
    Runs on <a href="http://localhost:3000">http://localhost:3000</a>
  </li>
  <li>
    <strong>(Optional) Node.js backend:</strong>
    <pre><code>cd src-back
npm install
npm start</code></pre>
    Typically on <a href="http://localhost:3001">http://localhost:3001</a>
  </li>
</ol>

<h3>Building Electron</h3>
<pre><code>npm run electron:build</code></pre>
<p>Output goes to <code>dist/</code> folder.</p>

<hr>

<h2>Basic Usage</h2>
<ol>
  <li><strong>Create/Import</strong> a wallet (BIP39 seed or WIF)</li>
  <li><strong>Encryption</strong> with a user-defined password (AES-256)</li>
  <li><strong>Addresses</strong> for external (receiving) and change</li>
  <li><strong>Electrum Servers</strong> (public/custom)</li>
  <li><strong>Ledger</strong> (optional) for hardware security</li>
</ol>



<hr>

<h2>License 📄</h2>
<p>Released under the <a href="LICENSE">MIT License</a>.</p>
<p><strong>Note:</strong> Keep seed phrases safe. You are responsible for your private keys.</p>

</body>
</html>
