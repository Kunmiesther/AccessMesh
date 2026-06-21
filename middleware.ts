import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/access/")) {
    return NextResponse.next();
  }

  const resourceId = request.nextUrl.pathname.split("/").pop();
  const wallet =
    request.headers.get("x-wallet-address") ??
    request.headers.get("x-payer-wallet") ??
    request.nextUrl.searchParams.get("wallet");

  if (!resourceId || !wallet) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "PAYMENT_REQUIRED",
          message: "wallet is required for payment-gated access",
        },
      },
      { status: 402 },
    );
  }

  const checkUrl = new URL("/api/internal/access-check", request.url);
  const checkResponse = await fetch(checkUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ resourceId, wallet }),
  });

  if (checkResponse.ok) {
    return NextResponse.next();
  }

  const responseBody = await checkResponse.json().catch(() => ({
    ok: false,
    error: {
      code: "PAYMENT_REQUIRED",
      message: "payment verification failed",
    },
  }));

  return NextResponse.json(responseBody, { status: checkResponse.status });
}

export const config = {
  matcher: ["/api/access/:path*"],
};
