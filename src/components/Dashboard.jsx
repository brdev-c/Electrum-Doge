import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useThemeContext } from '../context/ThemeContext';
import BalancePanel from './dashboard-panels/BalancePanel';
import TransactionsPanel from './dashboard-panels/TransactionsPanel';
import AddressesPanel from './dashboard-panels/AddressesPanel';
import SendPanel from './dashboard-panels/SendPanel';
import ReceivePanel from './dashboard-panels/ReceivePanel';
import SettingsPanel from './dashboard-panels/SettingsPanel';
import NotesPanel from './dashboard-panels/NotesPanel';
import OfflineIndicator from './dashboard-panels/OfflineIndicator';
import DecryptWalletModal from './dashboard-panels/DecryptWalletModal';

function LockModal({ onUnlock, theme }) {
  const isDark = theme.name === 'dark';
  const [pwd, setPwd] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const styles = getModalStyles(isDark);

  function handleUnlock() {
    if (!pwd.trim()) {
      setErrorMsg('Please enter the password.');
      return;
    }
    const ok = onUnlock(pwd.trim());
    if (!ok) {
      setErrorMsg('Wrong password.');
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.title}>Wallet Locked</h3>
        </div>
        <div style={styles.body}>
          <p style={styles.text}>Enter your wallet password to unlock:</p>
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} style={styles.input} />
          {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}
        </div>
        <div style={styles.footer}>
          <button style={styles.outlineBtn} onClick={handleUnlock}>
            Unlock
          </button>
        </div>
      </div>
    </div>
  );
}

function ShowSeedModal({ onClose, wallet, locked, unlockWallet, theme }) {
  const isDark = theme.name === 'dark';
  const [pwd, setPwd] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [revealed, setRevealed] = useState(false);
  const styles = getModalStyles(isDark);

  function handleConfirm() {
    if (!wallet) {
      setErrorMsg('No wallet loaded.');
      return;
    }
    if (!wallet.mnemonic) {
      setErrorMsg('No seed phrase available.');
      return;
    }
    if (locked) {
      const ok = unlockWallet(pwd.trim());
      if (!ok) {
        setErrorMsg('Wrong password.');
      } else {
        setRevealed(true);
        setErrorMsg('');
      }
    } else {
      setRevealed(true);
      setErrorMsg('');
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.title}>Show Seed Phrase</h3>
          <button style={styles.closeBtn} onClick={onClose}>
            &#10006;
          </button>
        </div>
        <div style={styles.body}>
          {!revealed && (
            <>
              <p style={styles.text}>Please enter your wallet password to view the seed phrase:</p>
              <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} style={styles.input} />
              {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}
              <div style={styles.btnRow}>
                <button style={styles.outlineBtn} onClick={handleConfirm}>
                  Confirm
                </button>
              </div>
            </>
          )}
          {revealed && (
            <div style={styles.revealedBlock}>
              <p style={styles.text}>
                <strong>Seed phrase of your wallet:</strong>
              </p>
              <div style={styles.seedBox}>{wallet.mnemonic}</div>
              <p style={{ ...styles.text, marginTop: '0.8rem' }}>
                Please write down these 12 words on paper (order matters).
              </p>
              <p style={styles.warningText}>
                WARNING:<br />¥ Never share your seed phrase<br />¥ Never enter it on any websites<br />¥ Do not store it digitally
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeleteWalletModal({ onClose, onConfirm, walletPath, theme }) {
  const isDark = theme.name === 'dark';
  const styles = getModalStyles(isDark);

  function handleConfirmDelete() {
    onConfirm();
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.title}>Delete wallet?</h3>
          <button style={styles.closeBtn} onClick={onClose}>
            &#10006;
          </button>
        </div>
        <div style={styles.body}>
          <div style={{ display: 'flex', flexDirection: 'row', gap: '0.8rem' }}>
            <img src="/images/info.png" alt="info" style={{ width: 36, height: 36 }} />
            <p style={styles.text}>If your wallet contains funds, make sure you have saved the seed phrase.</p>
          </div>
          <div style={styles.btnRow}>
            <button style={styles.outlineBtn} onClick={onClose}>
              Cancel
            </button>
            <button style={styles.outlineBtn} onClick={handleConfirmDelete}>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { wallet, setWalletWithPath, setWallet, recentWallets, locked, unlockWallet, lockWallet, fiatCurrency, dogePriceFiat, autoConnectIfNeeded, removeRecentWallet, isLedgerWallet } = useWallet();
  const { theme } = useThemeContext();
  const isDark = theme.name === 'dark';
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [hoveredTab, setHoveredTab] = useState(null);
  const [notesEnabled] = useState(false);
  const [dashboardBalanceDoge, setDashboardBalanceDoge] = useState(0);
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteFilePath, setDeleteFilePath] = useState('');
  const [decryptModalData, setDecryptModalData] = useState(null);
  const [hoverLock, setHoverLock] = useState(false);
  const [hoverSettings, setHoverSettings] = useState(false);
  const [hoverSeed, setHoverSeed] = useState(false);
  const [hoverOffline, setHoverOffline] = useState(false);
  const [hoverBalance, setHoverBalance] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [openSubmenuId, setOpenSubmenuId] = useState(null);
  const [hoveredMenu, setHoveredMenu] = useState(null);
  const [hoveredSubItem, setHoveredSubItem] = useState(null);
  const [hoveredSubSubItem, setHoveredSubSubItem] = useState(null);
  const menuContainerRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target)) {
        setOpenMenu(null);
        setOpenSubmenuId(null);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    if (!wallet) {
      navigate('/');
      return;
    }
    if (typeof wallet.currentBalanceDoge === 'number') {
      setDashboardBalanceDoge(wallet.currentBalanceDoge);
    }
  }, [wallet, navigate]);

  useEffect(() => {
    autoConnectIfNeeded();
  }, []);

  function handleSettingsClick() {
    setActiveTab('settings');
  }

  function clearLocalCaches() {
    localStorage.removeItem('cachedDogeBalanceAll');
    localStorage.removeItem('lastBalanceFetchTime');
    localStorage.removeItem('cachedDogeStats');
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('cachedChart_')) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((key) => localStorage.removeItem(key));
  }

  async function handleOpenRecent(filePath) {
    if (!window.electronAPI?.openFileByPath) {
      alert('Cannot open file: electronAPI not available');
      return;
    }
    try {
      const resp = await window.electronAPI.openFileByPath(filePath);
      if (resp.error) {
        if (/ENOENT|not exist/i.test(resp.error)) {
          removeRecentWallet(filePath);
          alert('File not found. Removing from recents.');
        } else {
          alert('Error opening file:\n' + resp.error);
        }
        return;
      }
      if (!resp.fileData) {
        alert('No file data returned.');
        return;
      }
      let jdata;
      try {
        jdata = JSON.parse(resp.fileData);
      } catch (e) {
        alert('Failed to parse JSON:\n' + e.message);
        return;
      }
      clearLocalCaches();
      if (jdata.encrypted && jdata.cipherText) {
        setDecryptModalData({ filePath, encryptedData: resp.fileData });
      } else {
        setWalletWithPath(jdata, filePath);
      }
    } catch (err) {
      alert('handleOpenRecent error:\n' + err.message);
    }
  }

  function handleRemoveRecentRequest(filePath) {
    setDeleteFilePath(filePath);
    setShowDeleteModal(true);
  }

  function confirmDeleteWallet() {
    setShowDeleteModal(false);
    removeRecentWallet(deleteFilePath);
    if (wallet?.filePath === deleteFilePath) {
      setWallet(null);
      navigate('/');
    }
    setDeleteFilePath('');
  }

  function handleCreateOrRestore() {
    navigate('/');
    setOpenMenu(null);
  }

  function handleDeleteWallet() {
    setDeleteFilePath(wallet?.filePath || '');
    setShowDeleteModal(true);
    setOpenMenu(null);
  }

  async function handleExitApp() {
    if (window.electronAPI?.appQuit) {
      await window.electronAPI.appQuit();
    }
    setOpenMenu(null);
  }

  function handleChangePassword() {
    setActiveTab('settings');
    setOpenMenu(null);
  }

  function handleLockWalletClick() {
    lockWallet();
    setOpenMenu(null);
  }

  async function handleFullscreen() {
    if (!window.electronAPI?.toggleFullscreen) return;
    await window.electronAPI.toggleFullscreen();
    setOpenMenu(null);
  }

  function handleImportPrivateKey() {
    navigate('/?resetFile=1');
    setOpenMenu(null);
  }

  async function handleHelp() {
    if (window.electronAPI?.openUrl) {
      await window.electronAPI.openUrl('https://example.com/help');
    }
    setOpenMenu(null);
  }

  async function handleAbout() {
    if (window.electronAPI?.openUrl) {
      await window.electronAPI.openUrl('https://example.com/about');
    }
    setOpenMenu(null);
  }

  function handleDecryptedWallet(obj) {
    if (!decryptModalData) return;
    clearLocalCaches();
    setDecryptModalData(null);
    setWalletWithPath(obj, decryptModalData.filePath || '');
  }

  const recentOpenedSubmenuItems = (recentWallets || []).map((item) => ({
    label: item.filePath,
    onClick: () => handleOpenRecent(item.filePath),
    remove: () => handleRemoveRecentRequest(item.filePath),
  }));

  const topMenuItems = [
    {
      label: 'File',
      id: 'file',
      submenu: [
        {
          label: 'Recently opened ?',
          hasSubmenu: true,
          items: recentOpenedSubmenuItems,
        },
        {
          label: 'Create/Restore',
          onClick: handleCreateOrRestore,
        },
        {
          label: 'Delete',
          onClick: handleDeleteWallet,
        },
        {
          label: 'Exit',
          onClick: handleExitApp,
        },
      ],
    },
    {
      label: 'Wallet',
      id: 'wallet',
      submenu: [
        {
          label: 'Change password...',
          ledgerDisabled: true,
          onClick: handleChangePassword,
        },
        {
          label: 'Lock wallet',
          ledgerDisabled: true,
          onClick: handleLockWalletClick,
        },
      ],
    },
    {
      label: 'View',
      id: 'view',
      submenu: [
        {
          label: 'Fullscreen mode',
          onClick: handleFullscreen,
        },
      ],
    },
    {
      label: 'Tools',
      id: 'tools',
      submenu: [
        {
          label: 'Import private key',
          ledgerDisabled: true,
          onClick: handleImportPrivateKey,
        },
      ],
    },
    {
      label: 'Help',
      id: 'help',
      submenu: [
        { label: 'Help', onClick: handleHelp },
        { label: 'About', onClick: handleAbout },
      ],
    },
  ];

  function handleMenuClick(menuId) {
    setOpenMenu((prev) => (prev === menuId ? null : menuId));
    setOpenSubmenuId(null);
  }

  function handleSubmenuItemClick(subItem) {
    if (subItem.hasSubmenu) {
      setOpenSubmenuId((prev) => (prev === subItem.label ? null : subItem.label));
    } else if (subItem.onClick) {
      subItem.onClick();
    }
  }

  const tabs = [
    { key: 'Dashboard', label: 'Dashboard', icon: '/images/balance.png' },
    { key: 'transactions', label: 'Transactions', icon: '/images/transactions.png' },
    { key: 'send', label: 'Send', icon: '/images/send.png' },
    { key: 'receive', label: 'Receive', icon: '/images/receive.png' },
    { key: 'addresses', label: 'Addresses', icon: '/images/addresses.png' },
    { key: 'settings', label: 'Settings', icon: '/images/settings.png' },
  ];
  if (notesEnabled) {
    tabs.push({ key: 'notes', label: 'Notes', icon: '/images/notes.png' });
  }

  function renderActiveTab() {
    switch (activeTab) {
      case 'Dashboard':
        return <BalancePanel theme={theme} />;
      case 'transactions':
        return <TransactionsPanel theme={theme} />;
      case 'send':
        return <SendPanel theme={theme} />;
      case 'receive':
        return <ReceivePanel theme={theme} />;
      case 'addresses':
        return <AddressesPanel theme={theme} />;
      case 'settings':
        return <SettingsPanel theme={theme} />;
      case 'notes':
        return <NotesPanel theme={theme} />;
      default:
        return <div style={{ padding: '1rem' }}>No tab selected.</div>;
    }
  }

  const totalFiat = dashboardBalanceDoge * dogePriceFiat;
  const menuTextColor = isDark ? 'rgb(223,225,226)' : '#333';
  const tabUnderlineColor = '#339af0';
  const tabUnderlineHoverColor = '#1e7cd8';
  const hoverColor = 'rgb(22,97,158)';

  return (
    <div style={{ ...styles.appContainer, backgroundColor: theme.background }}>
      <div
        ref={menuContainerRef}
        style={{
          ...styles.topMenuBar,
          backgroundColor: theme.menubarBg,
          borderBottom: isDark ? '1px solid #444' : '1px solid #ccc',
        }}
      >
        {topMenuItems.map((menu) => {
          const isOpen = openMenu === menu.id;
          const isHovered = hoveredMenu === menu.id;
          const bgColor = isOpen || isHovered ? hoverColor : 'transparent';
          const clr = isOpen || isHovered ? '#fff' : menuTextColor;
          return (
            <div
              key={menu.id}
              style={{
                ...styles.menuItem,
                backgroundColor: bgColor,
                color: clr,
              }}
              onMouseEnter={() => {
                if (openMenu !== null && openMenu !== menu.id) {
                  setOpenMenu(menu.id);
                  setOpenSubmenuId(null);
                }
                setHoveredMenu(menu.id);
              }}
              onMouseLeave={() => setHoveredMenu(null)}
              onClick={() => handleMenuClick(menu.id)}
            >
              <div style={styles.menuItemLabel}>{menu.label}</div>
              {isOpen && (
                <div
                  style={{
                    ...styles.dropdownMenu,
                    backgroundColor: theme.menubarBg,
                    color: theme.color,
                    border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #ccc',
                    left: '-5px',
                  }}
                >
                  {menu.submenu.map((subItem, idx) => {
                    const isSubOpen = openSubmenuId === subItem.label;
                    const showSubSubmenu = subItem.hasSubmenu && isSubOpen;
                    const isSubHovered = hoveredSubItem === subItem.label;
                    const subItemBg = isSubHovered ? hoverColor : 'transparent';
                    const subItemClr = isSubHovered ? '#fff' : theme.color;
                    const disabled = subItem.ledgerDisabled && isLedgerWallet;
                    return (
                      <div
                        key={idx}
                        style={{
                          ...styles.dropdownMenuItem,
                          backgroundColor: subItemBg,
                          color: subItemClr,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          opacity: disabled ? 0.5 : 1,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                        }}
                        onMouseEnter={() => setHoveredSubItem(subItem.label)}
                        onMouseLeave={() => setHoveredSubItem(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!disabled) {
                            handleSubmenuItemClick(subItem);
                          }
                        }}
                        title={disabled ? 'Disabled because you are using a Ledger wallet.' : ''}
                      >
                        <div>{subItem.label}</div>
                        {subItem.hasSubmenu && showSubSubmenu && (
                          <div
                            style={{
                              ...styles.subDropdownMenu,
                              backgroundColor: theme.menubarBg,
                              color: theme.color,
                              border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #ccc',
                              top: '0',
                              left: '100%',
                            }}
                          >
                            {subItem.items.map((recentItem, rIdx) => {
                              const isSubSubHovered = hoveredSubSubItem === recentItem.label;
                              const subSubBg = isSubSubHovered ? hoverColor : 'transparent';
                              const subSubClr = isSubSubHovered ? '#fff' : theme.color;
                              return (
                                <div
                                  key={rIdx}
                                  style={{
                                    ...styles.dropdownMenuItem,
                                    backgroundColor: subSubBg,
                                    color: subSubClr,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                  }}
                                  onMouseEnter={() => setHoveredSubSubItem(recentItem.label)}
                                  onMouseLeave={() => setHoveredSubSubItem(null)}
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    if (recentItem.onClick) {
                                      recentItem.onClick();
                                    }
                                    setOpenSubmenuId(null);
                                    setOpenMenu(null);
                                  }}
                                >
                                  <div style={{ marginRight: '0.5rem' }}>{recentItem.label}</div>
                                  <div
                                    style={{
                                      cursor: 'pointer',
                                      fontSize: '0.9rem',
                                      color: subSubClr,
                                      opacity: 0.8,
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      recentItem.remove?.();
                                      setOpenSubmenuId(null);
                                      setOpenMenu(null);
                                    }}
                                  >
                                    x
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ ...styles.tabsBar, marginTop: '2px' }}>
        {tabs.map((tab, i) => {
          const isActive = tab.key === activeTab;
          const isHovered = hoveredTab === tab.key;
          const lineColor = isActive ? tabUnderlineColor : isHovered ? tabUnderlineHoverColor : 'transparent';
          return (
            <div
              key={tab.key}
              onMouseEnter={() => setHoveredTab(tab.key)}
              onMouseLeave={() => setHoveredTab(null)}
              onClick={() => setActiveTab(tab.key)}
              style={{
                ...styles.tabItem,
                color: isDark ? 'rgb(223,225,226)' : '#333',
                border: `1px solid ${theme.borderColor}`,
                marginRight: i < tabs.length - 1 ? '2px' : '0',
                backgroundColor: theme.menubarBg,
                borderRadius: '5px 6px 0 0',
                position: 'relative',
                marginBottom: '1.9px',
                paddingBottom: '0px',
              }}
            >
              <img src={tab.icon} alt={tab.label} style={{ width: 14, height: 14, marginRight: 4 }} />
              {tab.label}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: '-3px',
                  width: '101%',
                  height: '3.5px',
                  backgroundColor: lineColor,
                  transition: 'background-color 0.2s ease',
                }}
              />
            </div>
          );
        })}
      </div>
      <div
        style={{
          ...styles.mainContent,
          border: isDark ? '1px solid rgb(69,83,100)' : '1px solid #ccc',
          borderRadius: '6px',
          backgroundColor: isDark ? 'rgba(60,70,80,0%)' : '#f3f3f3',
          position: 'relative',
        }}
      >
        <div style={styles.backgroundImage}>
          <img src="/images/dogebackground.png" alt="Doge background" style={styles.bgImage} />
        </div>
        <div style={styles.panelWrapper}>{renderActiveTab()}</div>
      </div>
      <div
        style={{
          ...styles.statusBar,
          backgroundColor: theme.menubarBg,
          color: theme.color,
          borderTop: isDark ? '1px solid #444' : '1px solid #ccc',
        }}
      >
        <div
          style={{
            ...styles.statusBarLeft,
            backgroundColor: hoverBalance ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)') : 'transparent',
            borderRadius: 4,
            padding: '4px 8px',
            cursor: 'default',
          }}
          onMouseEnter={() => setHoverBalance(true)}
          onMouseLeave={() => setHoverBalance(false)}
        >
          Balance: {dashboardBalanceDoge.toFixed(4)} DOGE ({totalFiat.toFixed(2)} {fiatCurrency}) 1 DOGE ~{dogePriceFiat.toFixed(2)} {fiatCurrency}
        </div>
        <div style={styles.statusBarRight}>
          <div
            style={{
              ...styles.iconContainer,
              backgroundColor: hoverLock ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)') : 'transparent',
              opacity: isLedgerWallet ? 0.5 : 1,
              cursor: isLedgerWallet ? 'not-allowed' : 'pointer',
            }}
            title={isLedgerWallet ? 'Disabled because you are using a Ledger wallet.' : 'Lock wallet'}
            onMouseEnter={() => setHoverLock(true)}
            onMouseLeave={() => setHoverLock(false)}
            onClick={() => {
              if (!isLedgerWallet) lockWallet();
            }}
          >
            <img src="/images/lock.png" alt="Lock" style={styles.iconImage} />
          </div>
          <div
            style={{
              ...styles.iconContainer,
              backgroundColor: hoverSettings ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)') : 'transparent',
            }}
            onMouseEnter={() => setHoverSettings(true)}
            onMouseLeave={() => setHoverSettings(false)}
            onClick={handleSettingsClick}
          >
            <img src="/images/settings.png" alt="Settings" title="Open Settings" style={styles.iconImage} />
          </div>
          <div
            style={{
              ...styles.iconContainer,
              backgroundColor: hoverSeed ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)') : 'transparent',
              opacity: isLedgerWallet ? 0.5 : 1,
              cursor: isLedgerWallet ? 'not-allowed' : 'pointer',
            }}
            title={isLedgerWallet ? 'Disabled because you are using a Ledger wallet.' : 'Show seed phrase'}
            onMouseEnter={() => setHoverSeed(true)}
            onMouseLeave={() => setHoverSeed(false)}
            onClick={() => {
              if (!isLedgerWallet) setShowSeedModal(true);
            }}
          >
            <img src="/images/showseed.png" alt="Show Seed" style={styles.iconImage} />
          </div>
          <div
            style={{
              ...styles.iconContainer,
              backgroundColor: hoverOffline ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)') : 'transparent',
              marginLeft: '0.1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={() => setHoverOffline(true)}
            onMouseLeave={() => setHoverOffline(false)}
          >
            <OfflineIndicator />
          </div>
        </div>
      </div>
      {locked && !isLedgerWallet && (
        <LockModal onUnlock={unlockWallet} theme={theme} />
      )}
      {showSeedModal && !isLedgerWallet && (
        <ShowSeedModal onClose={() => setShowSeedModal(false)} wallet={wallet} locked={locked} unlockWallet={unlockWallet} theme={theme} />
      )}
      {showDeleteModal && (
        <DeleteWalletModal onClose={() => { setShowDeleteModal(false); setDeleteFilePath(''); }} onConfirm={confirmDeleteWallet} walletPath={deleteFilePath} theme={theme} />
      )}
      {decryptModalData && (
        <DecryptWalletModal onClose={() => setDecryptModalData(null)} encryptedData={decryptModalData.encryptedData} theme={theme} onDecrypted={handleDecryptedWallet} />
      )}
    </div>
  );
}

const styles = {
  appContainer: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100vh',
    overflow: 'hidden',
  },
  topMenuBar: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: '4px 5px',
    userSelect: 'none',
    position: 'relative',
  },
  menuItem: {
    position: 'relative',
    marginRight: '6px',
    padding: '2px 6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  menuItemLabel: {
    fontSize: '0.9rem',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: '-5px',
    minWidth: '180px',
    zIndex: 10,
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
  },
  dropdownMenuItem: {
    padding: '6px 10px',
    fontSize: '0.9rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background-color 0.15s ease',
  },
  subDropdownMenu: {
    position: 'absolute',
    minWidth: '200px',
    zIndex: 11,
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
  },
  tabsBar: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: '2px',
  },
  tabItem: {
    display: 'flex',
    alignItems: 'center',
    height: 22,
    padding: '0 0.8rem',
    cursor: 'pointer',
    fontSize: '0.9rem',
    userSelect: 'none',
    marginBottom: 0.9,
    transition: 'border-bottom 0.2s ease',
  },
  mainContent: {
    flex: 1,
    position: 'relative',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
    pointerEvents: 'none',
  },
  bgImage: {
    width: '600px',
    height: '600px',
    opacity: 0.1,
  },
  panelWrapper: {
    flex: 1,
    marginBottom: '2px',
    borderRadius: '0 0px 0px 0px',
    padding: '0.2rem 0.3rem',
  },
  statusBar: {
    height: 36,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: '0 1rem',
    justifyContent: 'space-between',
  },
  statusBarLeft: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9rem',
  },
  statusBarRight: {
    display: 'flex',
    alignItems: 'center',
  },
  iconContainer: {
    width: 34,
    height: 34,
    marginLeft: '0.2rem',
    borderRadius: 4,
    transition: 'background-color 0.15s ease',
    cursor: 'pointer',
  },
  iconImage: {
    width: 24,
    height: 24,
    margin: 4,
  },
};

function getModalStyles(isDark) {
  return {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.3)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modal: {
      backgroundColor: isDark ? 'rgb(25,35,45)' : '#fff',
      color: isDark ? '#fff' : '#333',
      border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #ccc',
      borderRadius: 6,
      width: 420,
      maxWidth: '90%',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.8rem',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      margin: 0,
      fontSize: '1rem',
    },
    closeBtn: {
      background: 'none',
      border: 'none',
      fontSize: '1.2rem',
      cursor: 'pointer',
      color: isDark ? '#fff' : '#333',
      lineHeight: '1rem',
    },
    body: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.6rem',
    },
    text: {
      fontSize: '0.9rem',
      lineHeight: 1.3,
    },
    input: {
      border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #ccc',
      borderRadius: 4,
      padding: '0.4rem 0.5rem',
      backgroundColor: isDark ? 'rgb(40,50,60)' : '#fff',
      color: isDark ? '#fff' : '#333',
      outline: 'none',
    },
    errorBox: {
      backgroundColor: isDark ? 'rgba(255,60,60,0.2)' : '#fdd',
      color: isDark ? '#fbb' : '#900',
      padding: '0.4rem',
      borderRadius: 4,
      fontSize: '0.85rem',
    },
    footer: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '0.5rem',
    },
    outlineBtn: {
      padding: '0.3rem 0.7rem',
      border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #999',
      borderRadius: 4,
      background: 'none',
      color: isDark ? '#fff' : '#333',
      cursor: 'pointer',
      fontSize: '0.85rem',
    },
    btnRow: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '0.5rem',
    },
    revealedBlock: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    },
    seedBox: {
      border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #ccc',
      borderRadius: 4,
      padding: '0.6rem',
      backgroundColor: isDark ? 'rgb(40,50,60)' : '#fafafa',
      fontFamily: 'monospace',
      whiteSpace: 'pre-wrap',
      color: isDark ? '#fff' : '#333',
      fontSize: '0.9rem',
      lineHeight: 1.4,
    },
    warningText: {
      fontSize: '0.85rem',
      color: isDark ? '#f77' : '#c00',
      lineHeight: 1.4,
    },
  };
}
