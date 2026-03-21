import { useState, useEffect, useRef } from 'react';
import { Shield, Lock, Unlock, Copy, ChevronDown, ShieldOff, Sun, Moon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../ui/Button';
import { LockdownModal } from './LockdownModal';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { LanguageSelector } from '../ui/LanguageSelector';
import { getLatestLockdown } from '../../lib/lockdown';
import { isContractAvailable, getChainName } from '../../lib/contract';
import type { LockdownEvent } from '../../types';

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function Header() {
  const {
    walletAddress,
    vaultId,
    isConnecting,
    connectWallet,
    disconnectWallet,
    notifications,
    markNotificationAsRead,
    dismissNotification,
    clearAllNotifications,
  } = useApp();
  const { theme, toggleTheme } = useTheme();
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lockdownOpen, setLockdownOpen] = useState(false);
  const [activeLockdown, setActiveLockdown] = useState<LockdownEvent | null>(null);
  const [chainName, setChainName] = useState('Base Mainnet');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!vaultId) return;
    getLatestLockdown(vaultId).then(setActiveLockdown).catch(() => {});
  }, [vaultId]);

  useEffect(() => {
    if (isContractAvailable()) {
      setChainName(getChainName());
    }
  }, [walletAddress]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  function copyAddress() {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleLockdownComplete() {
    if (vaultId) getLatestLockdown(vaultId).then(setActiveLockdown).catch(() => {});
  }

  return (
    <>
      <header className="h-14 bg-white dark:bg-slate-950/80 backdrop-blur-md border-b border-sky-200 dark:border-slate-800/60 flex items-center justify-between px-4 md:px-6 fixed top-0 left-0 right-0 z-40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <Shield size={14} className="text-cyan-400" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">ShadowKey</span>
          </div>
          {activeLockdown ? (
            <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              <span className="text-xs text-rose-400 font-medium">Locked Down</span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-400">{chainName}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <LanguageSelector />
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-sky-100 dark:hover:bg-slate-800/40 transition-all"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? (
              <Moon size={18} className="text-sky-700" />
            ) : (
              <Sun size={18} className="text-slate-400" />
            )}
          </button>
          {walletAddress && (
            <>
              <NotificationCenter
                notifications={notifications}
                onMarkAsRead={markNotificationAsRead}
                onDismiss={dismissNotification}
                onClearAll={clearAllNotifications}
              />
              <button
                onClick={() => setLockdownOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-all text-xs font-medium"
                title="Emergency Lockdown"
              >
                <ShieldOff size={13} />
                <span className="hidden sm:inline">Lockdown</span>
              </button>
            </>
          )}
          {walletAddress ? (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40 hover:border-slate-600 transition-all text-sm text-slate-300 hover:text-white"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex-shrink-0" />
                <span className="hidden sm:block font-mono text-xs">{truncateAddress(walletAddress)}</span>
                <ChevronDown size={12} className="opacity-60" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-slate-900 border border-slate-700/60 rounded-xl shadow-xl py-1 z-50">
                  <button
                    onClick={() => { copyAddress(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all"
                  >
                    <Copy size={13} /> {copied ? 'Copied!' : 'Copy Address'}
                  </button>
                  <div className="my-1 border-t border-slate-700/60" />
                  <button
                    onClick={() => { disconnectWallet(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all"
                  >
                    <Lock size={13} /> Lock Vault
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Button onClick={connectWallet} loading={isConnecting} size="sm">
              <Unlock size={13} /> Connect Wallet
            </Button>
          )}
        </div>
      </header>
      <LockdownModal open={lockdownOpen} onClose={() => setLockdownOpen(false)} onComplete={handleLockdownComplete} />
    </>
  );
}
