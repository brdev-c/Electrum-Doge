
import React, { useEffect, useState, useRef } from 'react';
import { pingNetwork } from '../../services/apiService';
import { useWallet } from '../../context/WalletContext';

export default function OfflineIndicator() {
  const [failCount, setFailCount] = useState(() => {
    const saved = localStorage.getItem('offlineFailCount');
    return saved ? parseInt(saved, 10) || 0 : 0;
  });

  const [isOnline, setIsOnline] = useState(() => {
    const saved = localStorage.getItem('offlineFailCount');
    if (!saved) return true; 
    const n = parseInt(saved, 10) || 0;
    return n === 0;
  });

  const { serverParam, autoConnectIfNeeded } = useWallet();
  const triedAutoConnectRef = useRef(false);

  useEffect(() => {
    setFailCount(0);
    localStorage.setItem('offlineFailCount', '0');
    setIsOnline(true);
    triedAutoConnectRef.current = false;

    checkNow();
    const timer = setInterval(checkNow, 5000);
    return () => clearInterval(timer);

  }, [serverParam]);

  function saveFailCount(n) {
    setFailCount(n);
    localStorage.setItem('offlineFailCount', String(n));
  }

  async function checkNow() {
    try {
      const ok = await pingNetwork();
      if (ok) {
        console.log('[OfflineIndicator] ping success => online');
        setIsOnline(true);
        saveFailCount(0);
        triedAutoConnectRef.current = false;
      } else {
        console.log('[OfflineIndicator] ping returned false => handle fail');
        handleFail();
      }
    } catch (err) {
      console.log('[OfflineIndicator] pingNetwork threw error =>', err);
      handleFail();
    }
  }

  function handleFail() {
    saveFailCount(prev => {
      const newVal = prev + 1;
      setIsOnline(false);

      if (newVal === 3 && !triedAutoConnectRef.current) {
        triedAutoConnectRef.current = true;
        autoConnectIfNeeded()
          .then(() => console.log('[OfflineIndicator] autoConnectIfNeeded done.'))
          .catch((er) => console.warn('[OfflineIndicator] autoConnectIfNeeded error:', er));
      }
      return newVal;
    });
  }

  const iconSrc = failCount > 0 ? '/images/no-wifi.png' : '/images/wifi.png';
  const altText = failCount > 0 ? 'Offline' : 'Online';

  return (
    <img
      src={iconSrc}
      alt={altText}
      title={altText}
      style={{ width: 24, height: 24, cursor: 'pointer' }}
    />
  );
}
