import React from 'react';
import { useWallet } from '../../context/WalletContext';
import SendPanelLocal from './SendPanelLocal';
import SendPanelLedger from './SendPanelLedger';

export default function SendPanel() {
  const { isLedgerWallet } = useWallet();

  if (isLedgerWallet) {
    return <SendPanelLedger />;
  } else {
    return <SendPanelLocal />;
  }
}
