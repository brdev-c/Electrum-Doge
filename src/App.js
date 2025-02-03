import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import { WalletProvider } from './context/WalletContext';
import { ThemeProvider } from './context/ThemeContext';

import Home from './components/Home';
import CreateSeed from './components/CreateSeed';
import ImportSeed from './components/ImportSeed';
import LedgerSetup from './components/LedgerSetup';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <ThemeProvider>
      <WalletProvider>
        <Router>
          <div style={{ fontFamily: 'sans-serif' }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/create" element={<CreateSeed />} />
              <Route path="/import" element={<ImportSeed />} />
              <Route path="/ledger" element={<LedgerSetup />} />
              <Route path="/dashboard" element={<Dashboard />} />
            </Routes>
          </div>
        </Router>
      </WalletProvider>
    </ThemeProvider>
  );
}

export default App;
