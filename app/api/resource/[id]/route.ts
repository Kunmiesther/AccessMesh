import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getWalletFromRequest, InputError } from "@/lib/validation";
import { getResourceDetail } from "@/services/resourceService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const resource = await getResourceDetail(id, getWalletFromRequest(request));

    if (!resource || !resource.isActive) {
      return jsonError(404, "RESOURCE_NOT_FOUND", "resource not found");
    }

    return NextResponse.json({
      ok: true,
      resource,
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "INVALID_RESOURCE_DETAIL", error.message);
    }

    console.error(error);
    return jsonError(500, "RESOURCE_DETAIL_FAILED", "resource could not be fetched");
  }
}
