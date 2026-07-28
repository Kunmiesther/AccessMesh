import { createPublicClient, type Address } from "viem";
import {
  createRpClient,
  toCircleSmartAccount,
  toModularTransport,
  toPasskeyTransport,
} from "@circle-fin/modular-wallets-core";
import { arcTestnet } from "viem/chains";
import { toWebAuthnAccount } from "viem/account-abstraction";
import { base64UrlToBytes, parsePublicKey, serializePublicKey, type PublicKeyCredential } from "webauthn-p256";

type CircleLoginDependencies = {
  clientUrl?: string | null;
  clientKey?: string | null;
};

type VerifyCircleLoginInput = {
  username: string;
  credential: PublicKeyCredential;
};

export type VerifiedCircleLogin = Readonly<{
  walletAddress: Address;
  authenticationMethod: "CIRCLE_SESSION";
}>;

export async function verifyCircleLogin(
  input: VerifyCircleLoginInput,
  deps: CircleLoginDependencies = {},
): Promise<VerifiedCircleLogin> {
  const clientUrl = deps.clientUrl ?? process.env.NEXT_PUBLIC_CLIENT_URL ?? null;
  const clientKey = deps.clientKey ?? process.env.NEXT_PUBLIC_CLIENT_KEY ?? null;

  if (!clientUrl || !clientKey) {
    throw new Error("Circle login verification is not configured.");
  }

  const rpClient = createRpClient({
    transport: toPasskeyTransport(clientUrl, clientKey),
  });
  const { publicKey } = await rpClient.getLoginVerification({
    credential: input.credential,
  });

  const walletAddress = await deriveWalletAddress({
    username: input.username,
    credentialId: input.credential.id,
    publicKey,
    clientUrl,
    clientKey,
  });

  return {
    walletAddress,
    authenticationMethod: "CIRCLE_SESSION",
  };
}

async function deriveWalletAddress(params: {
  username: string;
  credentialId: string;
  publicKey: string;
  clientUrl: string;
  clientKey: string;
}) {
  const publicKey = serializePublicKey(
    parsePublicKey(base64UrlToBytes(params.publicKey)),
    { compressed: true },
  );

  const transport = toModularTransport(params.clientUrl, params.clientKey);
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport,
  });

  const owner = toWebAuthnAccount({
    credential: {
      id: params.credentialId,
      publicKey,
    },
  });

  const smartAccount = await toCircleSmartAccount({
    client: publicClient,
    owner,
    name: params.username,
  });

  return smartAccount.getAddress();
}
