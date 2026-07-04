import {
  handleAuthorizeRequest,
} from "../verify-access/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleAuthorizeRequest(request);
}
