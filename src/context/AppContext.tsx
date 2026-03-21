import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Toast, ToastType } from '../types';
import { getOrCreateVault } from '../lib/shadowVault';
import { localGetOrCreateVault } from '../lib/localVault';
import { BASE_SEPOLIA_CHAIN_ID, BASE_SEPOLIA_CONFIG } from '../lib/constants';
import type { Notification } from '../components/notifications/NotificationCenter';

const SESSION_KEY = 'shadowkey_session';
const LOCAL_MODE_KEY = 'shadowkey_local_mode';

interface StoredSession {
  walletAddress: string;
  vaultId: string;
  vaultKey: string;
  timestamp: number;
  isLocalMode?: boolean;
  authenticated?: boolean;
}

interface AppContextValue {
  walletAddress: string | null;
  vaultId: string | null;
  vaultKey: string | null;
  isConnecting: boolean;
  isLocalMode: boolean;
  setLocalMode: (enabled: boolean) => void;
  isAuthenticated: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationAsRead: (id: string) => void;
  dismissNotification: (id: string) => void;
  clearAllNotifications: () => void;
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (accounts: string[]) => void) => void;
};

function getEthereum(): EthereumProvider | undefined {
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum;
}

function saveSession(session: StoredSession) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* noop */ }
}

function loadSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    const maxAge = 60 * 60 * 1000;
    if (Date.now() - session.timestamp > maxAge) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [vaultId, setVaultId] = useState<string | null>(null);
  const [vaultKey, setVaultKey] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLocalMode, setIsLocalModeState] = useState(() =>
    localStorage.getItem(LOCAL_MODE_KEY) === 'true'
  );
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const restoredRef = useRef(false);

  const setLocalMode = useCallback((enabled: boolean) => {
    localStorage.setItem(LOCAL_MODE_KEY, String(enabled));
    setIsLocalModeState(enabled);
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const id = Math.random().toString(36).slice(2, 11);
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      read: false,
    };
    setNotifications((prev) => [newNotification, ...prev]);
  }, []);

  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const connectWallet = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) {
      const demoAddress = '0xdemo1234567890abcdef1234567890abcdef1234';
      setWalletAddress(demoAddress);
      const demoKey = `demo-key-${demoAddress}`;
      setVaultKey(demoKey);
      const id = await getOrCreateVault(demoAddress);
      setVaultId(id);
      saveSession({ walletAddress: demoAddress, vaultId: id, vaultKey: demoKey, timestamp: Date.now() });
      addToast('MetaMask not found. Using demo mode.', 'warning');
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = (await ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      const address = accounts[0];

      // Switch to Base Sepolia if not already on it
      try {
        const chainId = await ethereum.request({ method: 'eth_chainId' }) as string;
        if (parseInt(chainId, 16) !== BASE_SEPOLIA_CHAIN_ID) {
          try {
            await ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: BASE_SEPOLIA_CONFIG.chainId }],
            });
          } catch (switchErr: unknown) {
            // Chain not added yet — add it
            if ((switchErr as { code?: number }).code === 4902) {
              await ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [BASE_SEPOLIA_CONFIG],
              });
            }
          }
        }
      } catch {
        // Chain switch not critical — continue
      }

      const message = `ShadowKey vault unlock\nAddress: ${address}\nTimestamp: ${Math.floor(Date.now() / 60000)}`;
      const signature = (await ethereum.request({
        method: 'personal_sign',
        params: [message, address],
      })) as string;
      const vaultKeyDerived = `sig:${signature.slice(0, 64)}`;
      setWalletAddress(address);
      setVaultKey(vaultKeyDerived);

      // Resolve vault based on storage mode
      const localMode = localStorage.getItem(LOCAL_MODE_KEY) === 'true';
      const id = localMode
        ? localGetOrCreateVault(address)
        : await getOrCreateVault(address);
      setVaultId(id);

      // Challenge-response: verify signature (UI flag only — vault uses anon RLS)
      let authenticated = false;
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const resp = await fetch(`${supabaseUrl}/functions/v1/auth-nonce`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
          body: JSON.stringify({ wallet_address: address, message, signature }),
        });
        if (resp.ok) {
          authenticated = true;
        }
      } catch {
        // Signature verification is additive — vault works without it
      }
      setIsAuthenticated(authenticated);

      saveSession({ walletAddress: address, vaultId: id, vaultKey: vaultKeyDerived, timestamp: Date.now(), isLocalMode: localMode, authenticated });
      addToast('Vault unlocked successfully', 'success');
      setShowOnboarding(true);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Connection failed', 'error');
    } finally {
      setIsConnecting(false);
    }
  }, [addToast]);

  const disconnectWallet = useCallback(() => {
    setWalletAddress(null);
    setVaultId(null);
    setVaultKey(null);
    setIsAuthenticated(false);
    clearSession();
    addToast('Vault locked', 'info');
  }, [addToast]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const session = loadSession();
    if (session) {
      const ethereum = getEthereum();
      if (ethereum) {
        ethereum.request({ method: 'eth_accounts' }).then((accounts) => {
          const currentAccounts = accounts as string[];
          if (currentAccounts.length > 0 && currentAccounts[0].toLowerCase() === session.walletAddress.toLowerCase()) {
            setWalletAddress(session.walletAddress);
            setVaultId(session.vaultId);
            setVaultKey(session.vaultKey);
          } else {
            clearSession();
          }
        }).catch(() => {
          clearSession();
        });
      } else {
        // Demo mode restoration
        if (session.walletAddress.startsWith('0xdemo')) {
          setWalletAddress(session.walletAddress);
          setVaultId(session.vaultId);
          setVaultKey(session.vaultKey);
        } else {
          clearSession();
        }
      }
    }
  }, []);

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (walletAddress && accounts[0].toLowerCase() !== walletAddress.toLowerCase()) {
        disconnectWallet();
      }
    };

    ethereum.on('accountsChanged', handleAccountsChanged);

    return () => {
      const ethWithRemove = ethereum as unknown as { removeListener?: (event: string, handler: (accounts: string[]) => void) => void };
      if (ethWithRemove.removeListener) {
        ethWithRemove.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, [disconnectWallet, walletAddress]);

  const contextValue = useMemo(
    () => ({
      walletAddress,
      vaultId,
      vaultKey,
      isConnecting,
      isLocalMode,
      setLocalMode,
      isAuthenticated,
      connectWallet,
      disconnectWallet,
      toasts,
      addToast,
      removeToast,
      notifications,
      addNotification,
      markNotificationAsRead,
      dismissNotification,
      clearAllNotifications,
      showOnboarding,
      setShowOnboarding,
    }),
    [
      walletAddress,
      vaultId,
      vaultKey,
      isConnecting,
      isLocalMode,
      setLocalMode,
      isAuthenticated,
      connectWallet,
      disconnectWallet,
      addToast,
      removeToast,
      addNotification,
      markNotificationAsRead,
      dismissNotification,
      clearAllNotifications,
      showOnboarding,
    ]
  );

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
