"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  clearStoredWalletSession,
  getStoredWalletSession,
  initWallet,
  restoreWalletSession,
  storeWalletSession,
  type ModularWalletSession,
  type WalletInitOptions,
} from "@/lib/modular-wallet";

type WalletContextValue = {
  address: ModularWalletSession["address"] | null;
  smartAccount: ModularWalletSession["smartAccount"] | null;
  bundlerClient: ModularWalletSession["bundlerClient"] | null;
  connected: boolean;
  ready: boolean;
  loading: boolean;
  error: string | null;
  connectWallet: (
    username: string,
    options?: WalletInitOptions,
  ) => Promise<ModularWalletSession>;
  disconnect: () => void;
};

const WalletContext = createContext<WalletContextValue>({
  address: null,
  smartAccount: null,
  bundlerClient: null,
  connected: false,
  ready: false,
  loading: false,
  error: null,
  connectWallet: async () => {
    throw new Error("WalletProvider is not mounted.");
  },
  disconnect: () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] =
    useState<ModularWalletSession["address"] | null>(null);
  const [smartAccount, setSmartAccount] =
    useState<ModularWalletSession["smartAccount"] | null>(null);
  const [bundlerClient, setBundlerClient] =
    useState<ModularWalletSession["bundlerClient"] | null>(null);
  const [session, setActiveSession] = useState<ModularWalletSession | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setSession = useCallback((session: ModularWalletSession) => {
    setActiveSession(session);
    setAddress(session.address);
    setSmartAccount(session.smartAccount);
    setBundlerClient(session.bundlerClient);
  }, []);

  const clearSession = useCallback(() => {
    setActiveSession(null);
    setAddress(null);
    setSmartAccount(null);
    setBundlerClient(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const stored = getStoredWalletSession();

    if (!stored) {
      setReady(true);
      return;
    }

    setLoading(true);
    setError(null);

    restoreWalletSession(stored)
      .then(async (session) => {
        await restoreWalletIdentity(session.address);
        if (cancelled) {
          return;
        }

        setSession(session);
        storeWalletSession(session);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }

        if (err instanceof Error && /no longer matches/i.test(err.message)) {
          clearStoredWalletSession();
        }

        clearSession();
        setError(
          err instanceof Error ? err.message : "Wallet session could not be restored.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clearSession, setSession]);

  const connectWallet = useCallback(async (
    username: string,
    options: WalletInitOptions = {},
  ) => {
    if (session) {
      return session;
    }

    setLoading(true);
    setError(null);

    try {
      const session = await initWallet(username, options);
      await restoreWalletIdentity(session.address);
      setSession(session);
      storeWalletSession(session);
      setReady(true);

      return session;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to initialize wallet.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [session, setSession]);

  const disconnect = useCallback(() => {
    clearSession();
    setError(null);
    clearStoredWalletSession();
    setReady(true);
  }, [clearSession]);

  return (
    <WalletContext.Provider
      value={{
        address,
        smartAccount,
        bundlerClient,
        connected: !!address && !!smartAccount && !!bundlerClient,
        ready,
        loading,
        error,
        connectWallet,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}

async function restoreWalletIdentity(wallet: string) {
  const response = await fetch("/api/wallet/identity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet }),
  });

  if (!response.ok) {
    throw new Error("Wallet identity could not be restored.");
  }
}
