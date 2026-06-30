"use client";

import {
  WebAuthnMode,
  toCircleSmartAccount,
  toModularTransport,
  toPasskeyTransport,
  toWebAuthnCredential,
  type ToCircleSmartAccountReturnType,
} from "@circle-fin/modular-wallets-core";
import { createPublicClient, getAddress, isAddress, type Address, type Hex } from "viem";
import { createBundlerClient, toWebAuthnAccount } from "viem/account-abstraction";
import { arcTestnet } from "viem/chains";

const CREDENTIAL_STORAGE_PREFIX = "accessmesh.modularWallet.credential.";
const ACTIVE_SESSION_STORAGE_KEY = "accessmesh.modularWallet.activeSession";
const LEGACY_ADDRESS_STORAGE_KEY = "accessmesh_modular_wallet_address";
const MODULAR_WALLET_CHAIN = arcTestnet;
const MODULAR_WALLET_CHAIN_PATH = "arcTestnet";

export type PasskeyCredentialMode = "existing" | "new";

export type WalletInitOptions = {
  onCredentialMode?: (mode: PasskeyCredentialMode) => void;
};

export type StoredWalletSession = {
  username: string;
  credentialId: string;
  credentialPublicKey: Hex;
  rpId?: string;
  address: Address;
};

function getClientEnv() {
  const clientKey = process.env.NEXT_PUBLIC_CLIENT_KEY;
  const clientUrl = process.env.NEXT_PUBLIC_CLIENT_URL;

  if (!clientKey || !clientUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_CLIENT_KEY or NEXT_PUBLIC_CLIENT_URL.",
    );
  }

  return { clientKey, clientUrl };
}

function getChainClientUrl(clientUrl: string) {
  return `${clientUrl.replace(/\/+$/, "")}/${MODULAR_WALLET_CHAIN_PATH}`;
}

function credentialStorageKey(username: string) {
  return `${CREDENTIAL_STORAGE_PREFIX}${username.trim().toLowerCase()}`;
}

export function getStoredCredentialMode(username: string): PasskeyCredentialMode {
  const credentialId = getStoredCredentialId(username);
  return credentialId ? "existing" : "new";
}

function getStoredCredentialId(username: string) {
  try {
    return window.localStorage.getItem(credentialStorageKey(username));
  } catch {
    return null;
  }
}

function setStoredCredentialId(username: string, credentialId: string) {
  try {
    window.localStorage.setItem(credentialStorageKey(username), credentialId);
  } catch {
    // storage unavailable
  }
}

export function getStoredWalletSession(): StoredWalletSession | null {
  try {
    const raw = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return parseStoredWalletSession(raw);
  } catch {
    clearStoredWalletSession();
    return null;
  }
}

export function storeWalletSession(session: ModularWalletSession) {
  const stored: StoredWalletSession = {
    username: session.identity.username,
    credentialId: session.identity.credentialId,
    credentialPublicKey: session.identity.credentialPublicKey,
    rpId: session.identity.rpId,
    address: session.address,
  };

  try {
    window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(stored));
    window.localStorage.setItem(LEGACY_ADDRESS_STORAGE_KEY, session.address);
  } catch {
    // storage unavailable
  }
}

export function clearStoredWalletSession() {
  try {
    window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_ADDRESS_STORAGE_KEY);
  } catch {
    // storage unavailable
  }
}

function parseStoredWalletSession(raw: string): StoredWalletSession | null {
  const parsed = JSON.parse(raw) as Partial<StoredWalletSession> | null;
  if (!parsed || typeof parsed !== "object") {
    clearStoredWalletSession();
    return null;
  }

  const username = typeof parsed.username === "string" ? parsed.username.trim() : "";
  const credentialId =
    typeof parsed.credentialId === "string" ? parsed.credentialId.trim() : "";
  const credentialPublicKey =
    typeof parsed.credentialPublicKey === "string"
      ? parsed.credentialPublicKey
      : "";
  const rpId =
    typeof parsed.rpId === "string" && parsed.rpId.trim().length > 0
      ? parsed.rpId.trim()
      : undefined;

  if (
    !username ||
    !credentialId ||
    !isHex(credentialPublicKey) ||
    !parsed.address ||
    !isAddress(parsed.address)
  ) {
    clearStoredWalletSession();
    return null;
  }

  return {
    username,
    credentialId,
    credentialPublicKey,
    rpId,
    address: getAddress(parsed.address) as Address,
  };
}

function clearStoredCredentialId(username: string) {
  try {
    window.localStorage.removeItem(credentialStorageKey(username));
  } catch {
    // storage unavailable
  }
}

async function createOrLoginCredential(
  username: string,
  options: WalletInitOptions = {},
) {
  const { clientKey, clientUrl } = getClientEnv();
  const transport = toPasskeyTransport(clientUrl, clientKey);
  const credentialId = getStoredCredentialId(username);
  options.onCredentialMode?.(credentialId ? "existing" : "new");

  try {
    const credential = await toWebAuthnCredential({
      transport,
      username,
      credentialId: credentialId ?? undefined,
      mode: credentialId ? WebAuthnMode.Login : WebAuthnMode.Register,
    });

    setStoredCredentialId(username, credential.id);
    return credential;
  } catch (error) {
    if (!credentialId && isDuplicateUsernameError(error)) {
      options.onCredentialMode?.("existing");
      const credential = await toWebAuthnCredential({
        transport,
        username,
        mode: WebAuthnMode.Login,
      });

      setStoredCredentialId(username, credential.id);
      return credential;
    }

    if (credentialId) {
      clearStoredCredentialId(username);
    }

    throw error;
  }
}

function isDuplicateUsernameError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /username.*duplicat|duplicat.*username/i.test(message);
}

export async function initWallet(
  username: string,
  options: WalletInitOptions = {},
) {
  const normalizedUsername = username.trim();
  if (!normalizedUsername) {
    throw new Error("Username is required.");
  }

  const { clientKey, clientUrl } = getClientEnv();
  const credential = await createOrLoginCredential(normalizedUsername, options);
  return createWalletSession({
    username: normalizedUsername,
    clientKey,
    clientUrl,
    credentialId: credential.id,
    credentialPublicKey: credential.publicKey,
    rpId: credential.rpId,
  });
}

export async function restoreWalletSession(stored: StoredWalletSession) {
  const { clientKey, clientUrl } = getClientEnv();
  const session = await createWalletSession({
    username: stored.username,
    clientKey,
    clientUrl,
    credentialId: stored.credentialId,
    credentialPublicKey: stored.credentialPublicKey,
    rpId: stored.rpId,
  });

  if (session.address !== stored.address) {
    throw new Error("Stored wallet identity no longer matches the active wallet.");
  }

  return session;
}

async function createWalletSession(params: {
  username: string;
  clientKey: string;
  clientUrl: string;
  credentialId: string;
  credentialPublicKey: Hex;
  rpId?: string;
}) {
  const owner = toWebAuthnAccount({
    credential: {
      id: params.credentialId,
      publicKey: params.credentialPublicKey,
    },
    rpId: params.rpId,
  });

  const modularTransport = toModularTransport(
    getChainClientUrl(params.clientUrl),
    params.clientKey,
  );
  const publicClient = createPublicClient({
    chain: MODULAR_WALLET_CHAIN,
    transport: modularTransport,
  });

  const smartAccount = await toCircleSmartAccount({
    client: publicClient,
    owner,
    name: params.username,
  });

  const bundlerClient = createBundlerClient({
    account: smartAccount,
    chain: MODULAR_WALLET_CHAIN,
    client: publicClient,
    transport: modularTransport,
    paymaster: true,
  });

  const address = (await smartAccount.getAddress()) as Address;

  return {
    smartAccount,
    bundlerClient,
    address: getAddress(address) as Address,
    identity: {
      username: params.username,
      credentialId: params.credentialId,
      credentialPublicKey: params.credentialPublicKey,
      rpId: params.rpId,
    },
  };
}

export type ModularWalletSession = Awaited<ReturnType<typeof initWallet>>;
export type ModularSmartAccount = ToCircleSmartAccountReturnType;

function isHex(value: string): value is Hex {
  return /^0x[0-9a-fA-F]+$/.test(value);
}
