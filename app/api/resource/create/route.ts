import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { InputError } from "@/lib/validation";
import { createResource } from "@/services/resourceService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const resource = await createResource(body);

    return NextResponse.json({
      ok: true,
      resource,
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "INVALID_RESOURCE", error.message);
    }

    console.error(error);
    return jsonError(500, "RESOURCE_CREATE_FAILED", "resource could not be created");
  }
}
