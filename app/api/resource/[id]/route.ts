import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getResource } from "@/services/resourceService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const resource = await getResource(id);

  if (!resource || !resource.isActive) {
    return jsonError(404, "RESOURCE_NOT_FOUND", "resource not found");
  }

  return NextResponse.json({
    ok: true,
    resource,
  });
}
