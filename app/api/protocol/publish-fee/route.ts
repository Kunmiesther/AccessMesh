import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { InputError } from "@/lib/validation";
import { getPublishFeeConfig } from "@/services/publishingFeeService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      config: getPublishFeeConfig(),
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(500, "PUBLISH_FEE_NOT_CONFIGURED", error.message);
    }

    console.error(error);
    return jsonError(
      500,
      "PUBLISH_FEE_FAILED",
      "publish fee config could not be loaded",
    );
  }
}
