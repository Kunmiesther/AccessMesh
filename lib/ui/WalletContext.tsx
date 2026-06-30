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
  initWallet,
  type ModularWalletSession,
  type WalletInitOptions,
} from "@/lib/modular-wallet";
import { getAddress, isAddress } from "viem";

type WalletContextValue = {
  address: ModularWalletSession["address"] | null;
  smartAccount: ModularWalletSession["smartAccount"] | null;
  bundlerClient: ModularWalletSession["bundlerClient"] | null;
  connected: boolean;
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
  loading: false,
  error: null,
  connectWallet: async () => {
    throw new Error("WalletProvider is not mounted.");
  },
  disconnect: () => {},
});

const STORAGE_KEY = "accessmesh_modular_wallet_address";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] =
    useState<ModularWalletSession["address"] | null>(null);
  const [smartAccount, setSmartAccount] =
    useState<ModularWalletSession["smartAccount"] | null>(null);
  const [bundlerClient, setBundlerClient] =
    useState<ModularWalletSession["bundlerClient"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isAddress(stored)) {
        setAddress(getAddress(stored) as ModularWalletSession["address"]);
      } else if (stored) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // storage unavailable
    }
  }, []);

  const connectWallet = useCallback(async (
    username: string,
    options: WalletInitOptions = {},
  ) => {
    setLoading(true);
    setError(null);

    try {
      const session = await initWallet(username, options);
      await restoreWalletIdentity(session.address);
      setAddress(session.address);
      setSmartAccount(session.smartAccount);
      setBundlerClient(session.bundlerClient);

      try {
        window.localStorage.setItem(STORAGE_KEY, session.address);
      } catch {
        // storage unavailable
      }

      return session;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to initialize wallet.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setSmartAccount(null);
    setBundlerClient(null);
    setError(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable
    }
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        smartAccount,
        bundlerClient,
        connected: !!address,
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
