"use client";

import {
  WebAuthnMode,
  toCircleSmartAccount,
  toModularTransport,
  toPasskeyTransport,
  toWebAuthnCredential,
  type ToCircleSmartAccountReturnType,
} from "@circle-fin/modular-wallets-core";
import { createPublicClient, type Address } from "viem";
import { createBundlerClient, toWebAuthnAccount } from "viem/account-abstraction";
import { arcTestnet } from "viem/chains";

const CREDENTIAL_STORAGE_PREFIX = "accessmesh.modularWallet.credential.";
const MODULAR_WALLET_CHAIN = arcTestnet;
const MODULAR_WALLET_CHAIN_PATH = "arcTestnet";

export type PasskeyCredentialMode = "existing" | "new";

export type WalletInitOptions = {
  onCredentialMode?: (mode: PasskeyCredentialMode) => void;
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
  const owner = toWebAuthnAccount({
    credential: {
      id: credential.id,
      publicKey: credential.publicKey,
    },
    rpId: credential.rpId,
  });

  const modularTransport = toModularTransport(
    getChainClientUrl(clientUrl),
    clientKey,
  );
  const publicClient = createPublicClient({
    chain: MODULAR_WALLET_CHAIN,
    transport: modularTransport,
  });

  const smartAccount = await toCircleSmartAccount({
    client: publicClient,
    owner,
    name: normalizedUsername,
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
    address,
  };
}

export type ModularWalletSession = Awaited<ReturnType<typeof initWallet>>;
export type ModularSmartAccount = ToCircleSmartAccountReturnType;
