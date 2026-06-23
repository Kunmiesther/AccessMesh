"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type WalletContextValue = {
  address: string | null;
  connected: boolean;
  connect: (address: string) => void;
  disconnect: () => void;
};

const WalletContext = createContext<WalletContextValue>({
  address: null,
  connected: false,
  connect: () => {},
  disconnect: () => {},
});

const STORAGE_KEY = "accessmesh_wallet";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) setAddress(stored);
    } catch {
      // storage unavailable
    }
  }, []);

  const connect = useCallback((addr: string) => {
    const normalised = addr.trim().toLowerCase();
    setAddress(normalised);
    try {
      sessionStorage.setItem(STORAGE_KEY, normalised);
    } catch {
      // storage unavailable
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable
    }
  }, []);

  return (
    <WalletContext.Provider
      value={{ address, connected: !!address, connect, disconnect }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}