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
import { polygonAmoy } from "viem/chains";

const CREDENTIAL_STORAGE_PREFIX = "accessmesh.modularWallet.credential.";

function getClientEnv() {
  const clientKey = process.env.VITE_CLIENT_KEY;
  const clientUrl = process.env.VITE_CLIENT_URL;

  if (!clientKey || !clientUrl) {
    throw new Error("Missing VITE_CLIENT_KEY or VITE_CLIENT_URL.");
  }

  return { clientKey, clientUrl };
}

function credentialStorageKey(username: string) {
  return `${CREDENTIAL_STORAGE_PREFIX}${username.trim().toLowerCase()}`;
}

async function createOrLoginCredential(username: string) {
  const { clientKey, clientUrl } = getClientEnv();
  const transport = toPasskeyTransport(clientUrl, clientKey);
  const storageKey = credentialStorageKey(username);
  const credentialId = window.localStorage.getItem(storageKey);

  try {
    const credential = await toWebAuthnCredential({
      transport,
      username,
      credentialId: credentialId ?? undefined,
      mode: credentialId ? WebAuthnMode.Login : WebAuthnMode.Register,
    });

    window.localStorage.setItem(storageKey, credential.id);
    return credential;
  } catch (error) {
    if (credentialId) {
      window.localStorage.removeItem(storageKey);
    }

    throw error;
  }
}

export async function initWallet(username: string) {
  const normalizedUsername = username.trim();
  if (!normalizedUsername) {
    throw new Error("Username is required.");
  }

  const { clientKey, clientUrl } = getClientEnv();
  const credential = await createOrLoginCredential(normalizedUsername);
  const owner = toWebAuthnAccount({
    credential: {
      id: credential.id,
      publicKey: credential.publicKey,
    },
    rpId: credential.rpId,
  });

  const modularTransport = toModularTransport(clientUrl, clientKey);
  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: modularTransport,
  });

  const smartAccount = await toCircleSmartAccount({
    client: publicClient,
    owner,
    name: normalizedUsername,
  });

  const bundlerClient = createBundlerClient({
    account: smartAccount,
    chain: polygonAmoy,
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
