import { buildX402AccessRequired, X402AccessResult } from "@/services/x402AccessService";
import { getResourceDetail, getResourceProviderWallet, validateAccess } from "@/services/resourceService";
import { recordX402Access } from "@/services/x402AccessService";
import { InputError, normalizeAddress } from "@/lib/validation";

export async function resolveProtectedResourceAccess(params: {
  resourceId: string;
  walletInput: string | null;
  requestUrl: string;
}) {
  const wallet = params.walletInput
    ? normalizeAddress(params.walletInput, "wallet")
    : null;
  const canonicalRequestUrl = new URL(params.requestUrl);
  canonicalRequestUrl.search = "";
  const { resource: resourceEntity, providerWallet } =
    await getResourceProviderWallet(params.resourceId);
  const resource = await getResourceDetail(params.resourceId, wallet);

  if (!resource || !resource.isActive) {
    throw new InputError("resource not found or inactive");
  }

  const access = wallet ? await validateAccess(params.resourceId, wallet) : null;

  if (!wallet || !access?.allowed) {
    const { paymentRequired, headerValue } = buildX402AccessRequired({
      resource: resourceEntity,
      providerWallet,
      requestUrl: canonicalRequestUrl.toString(),
    });

    await recordX402Access({
      resourceId: params.resourceId,
      wallet,
      result: X402AccessResult.Failed,
    });

    return {
      status: 402 as const,
      resource,
      providerWallet,
      wallet,
      paymentRequired,
      headerValue,
      access,
    };
  }

  await recordX402Access({
    resourceId: params.resourceId,
    wallet,
    result: X402AccessResult.Success,
  });

  return {
    status: 200 as const,
    resource,
    providerWallet,
    wallet,
    access,
  };
}
