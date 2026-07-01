import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getWalletFromRequest, InputError } from "@/lib/validation";
import {
  recordBridgeCompleted,
  recordBridgeFailed,
  recordBridgeStarted,
} from "@/services/cctpBridgeService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const event = requireString(body.event, "event");
    const payerWallet = requireString(
      body.payerWallet ?? getWalletFromRequest(request),
      "payerWallet",
    );

    if (event === "started") {
      const bridge = await recordBridgeStarted({
        resourceId: requireString(body.resourceId, "resourceId"),
        payerWallet,
        sourceWallet: requireString(body.sourceWallet, "sourceWallet"),
        sourceChain: requireBridgeChain(body.sourceChain, "sourceChain"),
        destinationChain: requireBridgeChain(
          body.destinationChain,
          "destinationChain",
        ),
        amountUSDC: requireNumber(body.amountUSDC, "amountUSDC"),
        feeUSDC: optionalNumber(body.feeUSDC, "feeUSDC"),
        totalBurnUSDC: optionalNumber(body.totalBurnUSDC, "totalBurnUSDC"),
        sourceTxHash: requireString(body.sourceTxHash, "sourceTxHash"),
      });

      return NextResponse.json({ ok: true, bridge });
    }

    if (event === "completed") {
      const bridge = await recordBridgeCompleted({
        payerWallet,
        sourceTxHash: requireString(body.sourceTxHash, "sourceTxHash"),
        destinationTxHash: requireString(
          body.destinationTxHash,
          "destinationTxHash",
        ),
      });

      return NextResponse.json({ ok: true, bridge });
    }

    if (event === "failed") {
      const bridge = await recordBridgeFailed({
        payerWallet,
        sourceTxHash: requireString(body.sourceTxHash, "sourceTxHash"),
        errorMessage: requireString(body.errorMessage, "errorMessage"),
      });

      return NextResponse.json({ ok: true, bridge });
    }

    throw new InputError("event must be started, completed, or failed");
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "CCTP_BRIDGE_INVALID", error.message);
    }

    console.error(error);
    return jsonError(500, "CCTP_BRIDGE_FAILED", "bridge record failed");
  }
}

function requireBridgeChain(value: unknown, field: string) {
  if (!value || typeof value !== "object") {
    throw new InputError(`${field} is required`);
  }

  const chain = value as Record<string, unknown>;

  return {
    name: requireString(chain.name, `${field}.name`),
    chainId: requireInteger(chain.chainId, `${field}.chainId`),
    domain: requireInteger(chain.domain, `${field}.domain`),
  };
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InputError(`${field} is required`);
  }

  return value.trim();
}

function requireNumber(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InputError(`${field} must be a number`);
  }

  return value;
}

function optionalNumber(value: unknown, field: string) {
  if (value === undefined || value === null) {
    return null;
  }

  return requireNumber(value, field);
}

function requireInteger(value: unknown, field: string) {
  const number = requireNumber(value, field);
  if (!Number.isInteger(number)) {
    throw new InputError(`${field} must be an integer`);
  }

  return number;
}
