# AccessMesh Middleware

## Add programmable USDC payment verification to any existing application.

AccessMesh Middleware allows developers to protect existing APIs, documentation, AI endpoints, datasets, research portals, download servers, and other premium resources using the same payment verification infrastructure that powers the AccessMesh marketplace.

Instead of migrating content into a new platform, developers continue serving resources from their own application while AccessMesh verifies whether the requesting wallet has already purchased access.

If ownership is verified, the request proceeds normally.

If ownership cannot be verified, the middleware returns a standard **HTTP 402 Payment Required** response containing the information required to unlock the associated resource through AccessMesh before retrying the request.

---

# Why AccessMesh Middleware Exists

Most developers already have an application.

They may have:

* an API serving premium data
* technical documentation
* an AI endpoint
* downloadable reports
* private datasets
* educational material
* internal knowledge bases

The difficult part isn't hosting the content.

It's building everything around payments.

Developers often end up implementing wallet authentication, payment handling, ownership tracking, entitlement management, purchase verification, and secure access control before they can monetize a single endpoint.

AccessMesh removes that burden.

Your application continues doing what it already does best—serving content.

AccessMesh becomes responsible for determining whether the requesting wallet has paid for access.

---

# How It Works

Every request follows the same lifecycle.

```text
Client Request
      │
      ▼
Protected Route
      │
      ▼
AccessMesh Middleware
      │
      ▼
Extract Wallet Address
      │
      ▼
Verify Ownership with AccessMesh
      │
 ┌────┴────┐
 │         │
 ▼         ▼
Owns      Doesn't Own
 │         │
 ▼         ▼
next()   HTTP 402 Payment Required
             │
             ▼
      Unlock Resource
             │
             ▼
         Retry Request
             │
             ▼
      Protected Content
```

The middleware never grants access on its own.

It only verifies ownership using AccessMesh.

---

# Features

| Feature                | Description                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Route Protection       | Protect individual endpoints with AccessMesh verification.                          |
| Dynamic Resources      | Protect multiple resources using route parameters instead of hardcoded IDs.         |
| Ownership Verification | Reuses the same ownership records as the AccessMesh marketplace.                    |
| HTTP 402 Responses     | Returns standard `Payment Required` responses for unpaid requests.                  |
| Existing Applications  | Works with applications that already host their own content.                        |
| AI Agent Friendly      | Machine-readable responses allow autonomous software to complete payment workflows. |
| Stateless Integration  | No payment state is stored inside your application.                                 |

---

# Installation

Clone the AccessMesh repository.

```bash
git clone https://github.com/Kunmiesther/AccessMesh.git
```

Navigate to the middleware example.

```bash
cd examples/accessmesh-middleware
```

Install dependencies.

```bash
npm install
```

Create an environment file.

```env
ACCESSMESH_BASE_URL=https://accessmesh.vercel.app
PORT=4000
```

Start the middleware server.

```bash
npm run dev
```

---

# Protecting a Single Route

The simplest integration protects one resource with one middleware instance.

```javascript
import { accessMeshMiddleware } from "./accessmesh-middleware";

app.get(
  "/premium-report",
  accessMeshMiddleware({
    resourceId: "YOUR_RESOURCE_ID",
    accessMeshBaseUrl: "https://accessmesh.vercel.app"
  }),
  async (req, res) => {
    res.json({
      title: "Premium Report",
      content: "Visible only after successful verification."
    });
  }
);
```

Every request to `/premium-report` will first be verified through AccessMesh.

---

# Protecting Multiple Resources

Many applications expose many premium resources.

Instead of creating separate middleware instances, a resource ID can be resolved dynamically.

```javascript
app.get(
  "/premium/:resourceId/report",
  accessMeshMiddleware({
    getResourceId: (req) => req.params.resourceId,
    accessMeshBaseUrl: "https://accessmesh.vercel.app"
  }),
  handler
);
```

This allows a single middleware instance to protect an unlimited number of AccessMesh resources.

---

# Wallet Identification

The middleware currently supports several methods for identifying the requesting wallet.

### Custom Header

```http
x-accessmesh-wallet: 0x123...
```

### Authorization Header

```http
Authorization: Bearer 0x123...
```

### Query Parameter

The query parameter is provided for demonstrations and local testing.

```text
/premium-report?wallet=0x123...
```

For production applications, header-based authentication is recommended.

---

# Request Lifecycle

Internally, the middleware performs the following steps:

1. Receive the incoming request.
2. Extract the requesting wallet address.
3. Determine which AccessMesh resource is being protected.
4. Call the AccessMesh verification endpoint.
5. Check whether the wallet already owns the resource.
6. Continue the request if ownership exists.
7. Return HTTP 402 if ownership cannot be verified.

No payment logic is executed inside your application.

No purchase records are stored inside your application.

The middleware remains focused solely on verification.

---

# Successful Verification

If ownership exists, the middleware simply calls `next()` and your application continues normally.

Example response:

```json
{
  "title": "Premium AI Research Report",
  "content": "This content is available because ownership has already been verified.",
  "resourceId": "RESOURCE_ID",
  "walletAddress": "0x..."
}
```

From your application's perspective, nothing changes.

---

# Payment Required Response

If ownership cannot be verified, the middleware responds with **HTTP 402 Payment Required**.

Example:

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
  "retry": {
    "method": "GET",
    "headers": {
      "x-accessmesh-wallet": "0x..."
    }
  }
}
```

The response contains everything required for a client, browser, or AI agent to complete the purchase before retrying the original request.

---

# Example Use Cases

## Premium APIs

Protect endpoints such as:

```text
/api/v1/context
/api/v1/analysis
/api/v1/signals
```

---

## Documentation

Protect premium documentation.

```text
/docs/pro
/docs/enterprise
```

---

## AI Applications

Charge for premium inference or retrieval endpoints.

```text
/api/chat
/api/research
/api/retrieve
```

---

## Research Platforms

Protect market reports, intelligence, or proprietary analysis.

```text
/reports/2026-market-outlook
```

---

## Datasets

Protect downloadable datasets.

```text
/downloads/customer-data.csv
/downloads/training-set.zip
```

---

# Live Demo

Middleware Demo:

https://accessmesh.onrender.com/

Marketplace:

https://accessmesh.vercel.app/

A simple way to test the middleware:

1. Request a protected endpoint using a wallet that has **not** unlocked the resource. You should receive an HTTP 402 response.
2. Unlock the corresponding resource on AccessMesh.
3. Repeat the same request using the same wallet.
4. The protected content should now be returned.

---

# Current Status

The middleware currently provides:

* Access verification
* HTTP 402 responses
* Dynamic resource protection
* Example Express integration

Planned improvements include:

* Official npm package (`@accessmesh/middleware`)
* JavaScript and TypeScript SDKs
* Additional framework examples (Fastify, Hono, NestJS, Express)
* Webhook support
* Developer dashboard
* Additional integration templates

---

# Contributing

Bug reports, feature requests, and pull requests are welcome.

If you're integrating AccessMesh into your own application and run into an issue, please open an issue in the repository with enough information to reproduce the problem.

Developer feedback is one of the fastest ways to improve the middleware and expand support for additional frameworks.

---

# Learn More

* Marketplace: https://accessmesh.vercel.app/
* Middleware Demo: https://accessmesh.onrender.com/
* Project Repository: https://github.com/Kunmiesther/AccessMesh
* X: https://x.com/AccessMesh

AccessMesh is building programmable payment infrastructure for premium digital knowledge. The marketplace demonstrates the experience for creators and buyers, while the middleware allows developers to bring the same payment verification model to applications they already own.
