"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import {
  authenticateStoredWalletSession,
  getStoredWalletSession,
} from "@/lib/modular-wallet";

export type AgentOwner = {
  ownerId: string;
  walletAddress: string;
  username: string;
  authenticationMethod: "CIRCLE_SESSION" | "SIGNED_CHALLENGE";
};

export type AgentOwnerSessionState =
  | {
      status: "idle" | "unauthenticated" | "authenticating";
      owner: null;
      error: null;
    }
  | {
      status: "authenticated";
      owner: AgentOwner;
      error: null;
    }
  | {
      status: "error";
      owner: null;
      error: string;
  };

export function doesAgentOwnerSessionMatchWallet(
  owner: AgentOwner | null,
  walletAddress: string | null | undefined,
) {
  if (!owner || !walletAddress) {
    return false;
  }

  return owner.walletAddress.toLowerCase() === walletAddress.toLowerCase();
}

async function fetchAgentOwnerSession() {
  const response = await fetch("/api/auth/session", {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Agent owner session could not be loaded.");
  }

  return (await response.json()) as {
    ok: boolean;
    authenticated: boolean;
    owner: AgentOwner | null;
  };
}

async function logoutAgentOwnerSession() {
  await fetch("/api/auth/logout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export function useAgentOwnerSession() {
  const { address, connected, ready } = useWallet();
  const [state, setState] = useState<AgentOwnerSessionState>({
    status: "idle",
    owner: null,
    error: null,
  });
  const inFlightRef = useRef<Promise<AgentOwnerSessionState["owner"] | null> | null>(
    null,
  );

  const refreshAgentOwnerSession = useCallback(async () => {
    if (!ready) {
      return null;
    }

    if (!connected || !address) {
      await logoutAgentOwnerSession().catch(() => {});
      setState({
        status: "unauthenticated",
        owner: null,
        error: null,
      });
      return null;
    }

    try {
      const session = await fetchAgentOwnerSession();
      if (session.authenticated && session.owner) {
        if (!doesAgentOwnerSessionMatchWallet(session.owner, address)) {
          await logoutAgentOwnerSession().catch(() => {});
          setState({
            status: "unauthenticated",
            owner: null,
            error: null,
          });
          return null;
        }

        setState({
          status: "authenticated",
          owner: session.owner,
          error: null,
        });
        return session.owner;
      }

      setState({
        status: "unauthenticated",
        owner: null,
        error: null,
      });
      return null;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Agent owner session could not be loaded.";
      setState({
        status: "error",
        owner: null,
        error: message,
      });
      return null;
    }
  }, [address, connected, ready]);

  const ensureAgentOwnerSession = useCallback(async () => {
    if (!ready || !connected || !address) {
      throw new Error("Connect your Circle Smart Account to continue.");
    }

    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const task = (async () => {
      const current = await refreshAgentOwnerSession();
      if (current) {
        return current;
      }

      const stored = getStoredWalletSession();
      if (!stored) {
        throw new Error("Your wallet session could not be restored.");
      }

      setState({
        status: "authenticating",
        owner: null,
        error: null,
      });

      const credential = await authenticateStoredWalletSession(stored);
      const response = await fetch("/api/auth/wallet/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: stored.username,
          credential: serializeCredential(credential.raw),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok: boolean;
            owner?: AgentOwner | null;
            error?: { message?: string } | string;
          }
        | null;

      if (!response.ok || !payload?.ok || !payload.owner) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : payload?.error?.message ?? "Wallet authentication failed.";
        throw new Error(message);
      }

      if (!doesAgentOwnerSessionMatchWallet(payload.owner, address)) {
        await logoutAgentOwnerSession().catch(() => {});
        throw new Error("Authenticated wallet no longer matches the connected account.");
      }

      setState({
        status: "authenticated",
        owner: payload.owner,
        error: null,
      });

      return payload.owner;
    })();

    inFlightRef.current = task;

    try {
      return await task;
    } finally {
      inFlightRef.current = null;
    }
  }, [address, connected, ready, refreshAgentOwnerSession]);

  useEffect(() => {
    void refreshAgentOwnerSession();
  }, [refreshAgentOwnerSession]);

  return {
    ...state,
    refreshAgentOwnerSession,
    ensureAgentOwnerSession,
    logoutAgentOwnerSession: async () => {
      await logoutAgentOwnerSession();
      setState({
        status: "unauthenticated",
        owner: null,
        error: null,
      });
    },
  };
}

function serializeCredential(credential: unknown) {
  if (
    credential &&
    typeof credential === "object" &&
    typeof (credential as { toJSON?: () => unknown }).toJSON === "function"
  ) {
    return (credential as { toJSON: () => unknown }).toJSON();
  }

  return credential;
}
