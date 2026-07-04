const DEFAULT_ACCESSMESH_BASE_URL = "https://accessmesh.vercel.app";
const DEFAULT_NETWORK = "Arc Testnet";
const DEFAULT_CURRENCY = "USDC";
const EVM_WALLET_PATTERN = /^0x[a-fA-F0-9]{40}$/;

function accessMeshMiddleware(options) {
  const config = normalizeOptions(options);
  const authorizeUrl = new URL(
    "/api/integrations/authorize",
    config.accessMeshBaseUrl,
  ).toString();

  return async function accessMeshProtectedRoute(req, res, next) {
    try {
      const resourceId = await resolveResourceId(req, config);
      const wallet = await resolveUserWallet(req, config.getUserWallet);

      if (!resourceId) {
        return res.status(500).json({
          error: "AccessMesh resource resolution failed",
          code: "ACCESSMESH_RESOURCE_ID_REQUIRED",
          message:
            "Configure resourceId or getResourceId(req) so the middleware can map this request to an AccessMesh resource.",
        });
      }

      if (!wallet || !EVM_WALLET_PATTERN.test(wallet)) {
        return sendPaymentRequired(res, config, {
          resourceId,
        });
      }

      const authorizeResponse = await fetch(authorizeUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(config.apiKey
            ? { "x-accessmesh-api-key": config.apiKey }
            : {}),
        },
        body: JSON.stringify({
          resourceId,
          walletAddress: wallet,
        }),
      });

      if (!authorizeResponse.ok) {
        const errorBody = await safeJson(authorizeResponse);
        const message =
          errorBody &&
          typeof errorBody === "object" &&
          errorBody.error &&
          typeof errorBody.error === "object" &&
          typeof errorBody.error.message === "string"
            ? errorBody.error.message
            : "AccessMesh authorization request failed.";

        return res.status(authorizeResponse.status === 404 ? 404 : 502).json({
          error:
            authorizeResponse.status === 404
              ? "AccessMesh resource not found"
              : "Access verification failed",
          code:
            authorizeResponse.status === 404
              ? "ACCESSMESH_RESOURCE_NOT_FOUND"
              : "ACCESSMESH_AUTHORIZATION_FAILED",
          resourceId,
          message,
        });
      }

      const authorization = await authorizeResponse.json();

      if (authorization.hasAccess === true) {
        req.accessMesh = {
          resourceId,
          walletAddress: authorization.walletAddress || wallet,
          authorization,
        };
        return next();
      }

      return sendPaymentRequired(res, config, {
        authorization,
        resourceId,
        wallet,
      });
    } catch (error) {
      return res.status(502).json({
        error: "Access verification failed",
        code: "ACCESSMESH_AUTHORIZATION_FAILED",
        ...(typeof config.resourceId === "string" && config.resourceId
          ? { resourceId: config.resourceId }
          : {}),
        message:
          error instanceof Error
            ? error.message
            : "Could not verify access with AccessMesh.",
      });
    }
  };
}

function normalizeOptions(options) {
  if (!options || typeof options !== "object") {
    throw new Error("accessMeshMiddleware options are required.");
  }

  const resourceId =
    typeof options.resourceId === "string" ? options.resourceId.trim() : "";
  const getResourceId =
    typeof options.getResourceId === "function"
      ? options.getResourceId
      : undefined;
  const accessMeshBaseUrl =
    typeof options.accessMeshBaseUrl === "string" &&
    options.accessMeshBaseUrl.trim()
      ? options.accessMeshBaseUrl.trim().replace(/\/+$/, "")
      : DEFAULT_ACCESSMESH_BASE_URL;

  if (!resourceId && !getResourceId) {
    throw new Error(
      "accessMeshMiddleware requires either resourceId or getResourceId(req).",
    );
  }

  return {
    resourceId,
    getResourceId,
    accessMeshBaseUrl,
    apiKey:
      typeof options.apiKey === "string" && options.apiKey.trim()
        ? options.apiKey.trim()
        : undefined,
    getUserWallet:
      typeof options.getUserWallet === "function"
        ? options.getUserWallet
        : undefined,
    paymentUrl:
      typeof options.paymentUrl === "string" && options.paymentUrl.trim()
        ? options.paymentUrl.trim()
        : undefined,
  };
}

async function resolveResourceId(req, config) {
  if (typeof config.getResourceId === "function") {
    const resolved = await config.getResourceId(req);
    return typeof resolved === "string" ? resolved.trim() : "";
  }

  return config.resourceId;
}

async function resolveUserWallet(req, customResolver) {
  if (typeof customResolver === "function") {
    const resolved = await customResolver(req);
    return typeof resolved === "string" ? resolved.trim() : null;
  }

  const headerWallet = readHeader(req, "x-accessmesh-wallet");
  if (headerWallet) {
    return headerWallet.trim();
  }

  const authorization = readHeader(req, "authorization");
  if (authorization && /^Bearer\s+/i.test(authorization)) {
    return authorization.replace(/^Bearer\s+/i, "").trim();
  }

  const queryWallet =
    req &&
    req.query &&
    typeof req.query.wallet === "string" &&
    req.query.wallet.trim()
      ? req.query.wallet.trim()
      : null;

  return queryWallet;
}

function readHeader(req, headerName) {
  if (!req) {
    return null;
  }

  if (typeof req.get === "function") {
    return req.get(headerName) || null;
  }

  const value = req.headers ? req.headers[headerName] : null;
  return typeof value === "string" ? value : null;
}

function sendPaymentRequired(res, config, context) {
  const authorization =
    context && context.authorization && typeof context.authorization === "object"
      ? context.authorization
      : null;
  const resourceId =
    context && typeof context.resourceId === "string" ? context.resourceId : "";
  const wallet =
    context && typeof context.wallet === "string" ? context.wallet : null;
  const payment =
    authorization &&
    authorization.payment &&
    typeof authorization.payment === "object"
      ? authorization.payment
      : null;
  const resource =
    authorization &&
    authorization.resource &&
    typeof authorization.resource === "object"
      ? authorization.resource
      : null;
  const retryHeaders = wallet ? { "x-accessmesh-wallet": wallet } : undefined;

  const response = {
    error: "Payment required",
    code: "ACCESSMESH_PAYMENT_REQUIRED",
    resourceId,
    payment: {
      url:
        payment && typeof payment.paymentUrl === "string"
          ? payment.paymentUrl
          : buildPaymentUrl(config, resourceId),
      currency:
        payment && typeof payment.currency === "string"
          ? payment.currency
          : DEFAULT_CURRENCY,
      network:
        payment && typeof payment.network === "string"
          ? payment.network
          : DEFAULT_NETWORK,
    },
    retry: {
      method: "GET",
      ...(retryHeaders ? { headers: retryHeaders } : {}),
    },
  };

  if (resource && Object.keys(resource).length > 0) {
    response.resource = resource;
  }

  return res.status(402).json(response);
}

function buildPaymentUrl(config, resourceId) {
  if (typeof config.paymentUrl === "string" && config.paymentUrl) {
    return config.paymentUrl;
  }

  return new URL(`/resource/${resourceId}`, config.accessMeshBaseUrl).toString();
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

module.exports = {
  accessMeshMiddleware,
};
