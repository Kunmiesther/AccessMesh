import { handleProtectedResourceGET } from "../protected-resource-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleProtectedResourceGET(request, context);
}
