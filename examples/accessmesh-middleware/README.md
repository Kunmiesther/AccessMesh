# AccessMesh Middleware

AccessMesh Middleware lets developers monetize existing apps, APIs, datasets, docs, and AI endpoints using AccessMesh payments without migrating their content into the marketplace.

The marketplace is one AccessMesh interface. The middleware is the AccessMesh integration layer for external apps.

## What It Is

This example shows how to protect an existing Express endpoint with AccessMesh.

The middleware does three things:

1. Reads a wallet identity from the incoming request.
2. Calls the AccessMesh developer authorization endpoint to verify whether that wallet already has access to a resource.
3. Either allows the request through or returns `402 Payment Required` with structured payment and retry instructions.

The middleware does not custody funds, create wallets, settle payments, or execute blockchain transactions. Payment still happens through the existing AccessMesh unlock flow.

## Why Developers Would Use It

Use this when your product already exists outside the AccessMesh marketplace and you want to monetize access without rebuilding your app around marketplace pages.

Examples:

- paid API endpoints
- premium docs
- dataset downloads
- AI agent tools
- paid research feeds
- private file gateways

## How It Differs From Publishing Directly In AccessMesh

Publishing on AccessMesh hosts the monetized resource inside the AccessMesh product experience.

Middleware integration keeps the content in your own app. AccessMesh only handles payment-linked access verification.

## Developer Infrastructure Endpoints

Primary endpoint:

- `POST /api/integrations/authorize`

Compatibility alias:

- `POST /api/integrations/verify-access`

Both routes are read-only. They verify existing access records and return authorization metadata for external apps.

## Files

- `accessmesh-middleware.js`: reusable Express middleware
- `demo-server.js`: demo server with single-route and route-group protection
- `.env.example`: required environment variables

## Required Environment Variables

Copy `.env.example` to `.env` inside this folder and set:

- `ACCESSMESH_BASE_URL`: AccessMesh base URL. Defaults to `https://accessmesh.vercel.app`.
- `ACCESSMESH_RESOURCE_ID`: demo fallback resource ID used by the fixed `/premium-report` example
- `ACCESSMESH_PAYMENT_URL`: optional explicit resource or payment page override
- `PORT`: demo server port, default `4000`

## How To Protect An Existing Endpoint

Single route:

```js
const express = require("express");
const { accessMeshMiddleware } = require("./accessmesh-middleware");

const app = express();

app.get(
  "/premium-report",
  accessMeshMiddleware({
    resourceId: "cm_resource_for_report",
    accessMeshBaseUrl: process.env.ACCESSMESH_BASE_URL,
  }),
  (req, res) => {
    res.json({ secret: "protected content" });
  },
);
```

Dynamic route group:

```js
const express = require("express");
const { accessMeshMiddleware } = require("./accessmesh-middleware");

const app = express();

app.use(
  "/premium/:resourceId",
  accessMeshMiddleware({
    accessMeshBaseUrl: process.env.ACCESSMESH_BASE_URL,
    getResourceId: (req) => req.params.resourceId,
  }),
);

app.get("/premium/:resourceId/report", (_req, res) => {
  res.json({ type: "report" });
});

app.get("/premium/:resourceId/dataset", (_req, res) => {
  res.json({ type: "dataset" });
});
```

## Mapping Routes To AccessMesh Resources

You can map application routes to AccessMesh resources in two ways:

1. Fixed mapping with `resourceId`
   Use this when a route always points to one AccessMesh resource.
2. Per-request mapping with `getResourceId(req)`
   Use this when the route itself determines which AccessMesh resource should be checked.

Examples:

- `/premium-report` -> one fixed AccessMesh resource
- `/premium/:resourceId/report` -> the `:resourceId` path segment maps directly to the AccessMesh resource
- `/datasets/:datasetId/download` -> your `getResourceId(req)` function can translate `datasetId` into the matching AccessMesh resource ID

`ACCESSMESH_RESOURCE_ID` is only a demo fallback for the fixed-route example. The main integration pattern is to set `resourceId` per route or resolve it dynamically with `getResourceId(req)`.

## Middleware Flow

1. Inspect the incoming request for a wallet identity.
2. Resolve the AccessMesh resource ID from either:
   - `resourceId`
   - `getResourceId(req)`
3. Resolve the requester wallet identity from:
   - `x-accessmesh-wallet`
   - `Authorization: Bearer <wallet>`
   - `?wallet=<wallet>` for demo use only
4. POST to `AccessMesh /api/integrations/authorize` with `resourceId` and `walletAddress`.
5. If `authorized` and `hasAccess` are `true`, call `next()`.
6. If `hasAccess` is `false`, return:

```json
{
  "error": "Payment required",
  "code": "ACCESSMESH_PAYMENT_REQUIRED",
  "resourceId": "RESOURCE_ID",
  "payment": {
    "url": "https://accessmesh.vercel.app/resource/RESOURCE_ID",
    "currency": "USDC",
    "network": "Arc Testnet"
  },
  "resource": {
    "title": "RESOURCE_TITLE",
    "price": "1",
    "creator": "0xCreatorWallet"
  },
  "retry": {
    "method": "GET",
    "headers": {
      "x-accessmesh-wallet": "0xBuyerWallet"
    }
  }
}
```

## How The 402 Response Works

The `402` response does not prove payment. It only tells the caller that:

- access has not been verified yet
- the resource is monetized through AccessMesh
- the caller must complete the AccessMesh unlock flow and retry

The `payment.url` field points to the existing AccessMesh resource page for that resource, where the normal AccessMesh unlock flow is available.

## How An AI Agent Or App Can Pay And Retry

1. Call the protected endpoint.
2. Receive `402 Payment Required`.
3. Parse the `payment.url` and `retry` fields from the response.
4. Send the user or agent through the normal AccessMesh unlock flow.
5. Retry the original endpoint using the same wallet identity that completed the unlock.

The middleware only verifies access after the AccessMesh records already show that wallet as unlocked.

Human users can open the payment URL, unlock the resource, then retry.

AI agents can parse the `402` payload, follow the payment URL, complete payment through AccessMesh, and retry the original request with the same wallet identity.

## Production Usage

Use the production AccessMesh site as the verification source unless you are explicitly developing against a local AccessMesh instance.

Example `.env`:

```bash
ACCESSMESH_BASE_URL=https://accessmesh.vercel.app
ACCESSMESH_RESOURCE_ID=your-fixed-demo-resource-id
ACCESSMESH_PAYMENT_URL=https://accessmesh.vercel.app/resource/your-resource-id
PORT=4000
```

The demo server still runs locally on port `4000`, but it verifies access against the configured AccessMesh URL.

## Example Request Before Payment

```bash
curl -i "http://localhost:4000/premium-report?wallet=0x1111111111111111111111111111111111111111"
```

Expected response:

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json; charset=utf-8
```

```json
{
  "error": "Payment required",
  "code": "ACCESSMESH_PAYMENT_REQUIRED",
  "resourceId": "YOUR_RESOURCE_ID",
  "payment": {
    "url": "https://accessmesh.vercel.app/resource/YOUR_RESOURCE_ID",
    "currency": "USDC",
    "network": "Arc Testnet"
  },
  "resource": {
    "title": "YOUR_RESOURCE_TITLE",
    "price": "1",
    "creator": "0xCreatorWallet"
  },
  "retry": {
    "method": "GET",
    "headers": {
      "x-accessmesh-wallet": "0x1111111111111111111111111111111111111111"
    }
  }
}
```

Dynamic route example:

```bash
curl -i "http://localhost:4000/premium/cmr4doiuj0009js04qv2m1tac/report?wallet=0x1111111111111111111111111111111111111111"
```

## Example Request After Payment

After that wallet completes the normal AccessMesh unlock flow:

```bash
curl -i "http://localhost:4000/premium-report?wallet=0xVerifiedWalletThatUnlockedTheResource"
```

Expected response:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
```

```json
{
  "title": "Premium AI Research Report",
  "content": "This is protected content served after AccessMesh access verification."
}
```

## Production Security Notes

- Do not treat `x-accessmesh-wallet` as proof of payment.
- The wallet value is only an identity hint for verification.
- In production, resolve the wallet from signed sessions, API keys, server-side auth, or another authenticated identity layer.
- Do not expose internal secrets to clients.
- The `apiKey` middleware option is reserved for future AccessMesh integration use.
- Do not rely on plain wallet query parameters outside local testing.

## Current Limitations

- This example is Express-only, but the verification pattern works in any server framework.
- The default bearer token behavior expects the bearer token itself to be a wallet address.
- The query parameter wallet resolver exists only for local demo/testing.
- Each protected request performs a live verification call to AccessMesh.
- This example assumes the resource already exists in AccessMesh and uses the existing unlock flow.
- The middleware does not initiate payment. It only reports that payment is required and where to complete it.

## Local Development Usage

Use localhost only when you are intentionally running AccessMesh locally.

Example local override:

```bash
ACCESSMESH_BASE_URL=http://localhost:3000
ACCESSMESH_RESOURCE_ID=your-fixed-demo-resource-id
ACCESSMESH_PAYMENT_URL=http://localhost:3000/resource/your-resource-id
PORT=4000
```

This keeps the example server on `http://localhost:4000` while pointing verification at your local AccessMesh app instead of production.

## Run The Demo

### Production-backed demo

From `examples/accessmesh-middleware`:

```bash
npm install
npm run dev
```

With the default `.env`, the demo verifies access against `https://accessmesh.vercel.app`.

Available demo routes:

- `GET /premium-report`
- `GET /premium/:resourceId/report`
- `GET /premium/:resourceId/dataset`

### Local development demo

From the repository root:

1. Start AccessMesh:

```bash
npm run dev
```

2. In a second terminal, start the example:

```bash
cd examples/accessmesh-middleware
npm install
npm run dev
```

3. Set `ACCESSMESH_BASE_URL=http://localhost:3000` in `examples/accessmesh-middleware/.env`.

4. Request the protected endpoint:

```bash
curl -i "http://localhost:4000/premium-report?wallet=0x1111111111111111111111111111111111111111"
```
