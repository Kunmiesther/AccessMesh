"use client";

import { useCallback, useState } from "react";
import {
  initWallet,
  type ModularWalletSession,
} from "@/lib/modular-wallet";

type WalletState = {
  address: ModularWalletSession["address"] | null;
  smartAccount: ModularWalletSession["smartAccount"] | null;
  bundlerClient: ModularWalletSession["bundlerClient"] | null;
  loading: boolean;
  error: string | null;
};

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    smartAccount: null,
    bundlerClient: null,
    loading: false,
    error: null,
  });

  const connectWallet = useCallback(async (username: string) => {
    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const session = await initWallet(username);
      setState({
        address: session.address,
        smartAccount: session.smartAccount,
        bundlerClient: session.bundlerClient,
        loading: false,
        error: null,
      });

      return session;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to initialize wallet.";
      setState((current) => ({
        ...current,
        loading: false,
        error: message,
      }));
      throw error;
    }
  }, []);

  return {
    ...state,
    connectWallet,
  };
}
