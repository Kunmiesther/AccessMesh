require("dotenv").config();

const express = require("express");
const { accessMeshMiddleware } = require("./accessmesh-middleware");

const DEFAULT_ACCESSMESH_BASE_URL = "https://accessmesh.vercel.app";

const app = express();
const port = Number(process.env.PORT || 4000);
const accessMeshBaseUrl =
  process.env.ACCESSMESH_BASE_URL || DEFAULT_ACCESSMESH_BASE_URL;
const fixedResourceId = process.env.ACCESSMESH_RESOURCE_ID;

if (!fixedResourceId) {
  throw new Error("ACCESSMESH_RESOURCE_ID is required.");
}

app.get("/", (_req, res) => {
  res.json({
    name: "AccessMesh Middleware Demo",
    protectedRoutes: [
      "/premium-report",
      "/premium/:resourceId/report",
      "/premium/:resourceId/dataset",
    ],
    accessMeshBaseUrl,
    demoFallbackResourceId: fixedResourceId,
  });
});

const fixedProtectionConfig = {
  resourceId: fixedResourceId,
  accessMeshBaseUrl,
  paymentUrl: process.env.ACCESSMESH_PAYMENT_URL,
};

app.get(
  "/premium-report",
  accessMeshMiddleware(fixedProtectionConfig),
  (req, res) => {
    res.json({
      title: "Premium AI Research Report",
      content:
        "This is protected content served after AccessMesh access verification.",
      resourceId: fixedResourceId,
      walletAddress: req.accessMesh ? req.accessMesh.walletAddress : null,
    });
  },
);

app.use(
  "/premium/:resourceId",
  accessMeshMiddleware({
    accessMeshBaseUrl,
    getResourceId: (req) => req.params.resourceId,
  }),
);

app.get("/premium/:resourceId/report", (req, res) => {
  res.json({
    title: "Premium Dynamic Report",
    content:
      "This route is protected through app.use('/premium/:resourceId', ...).",
    resourceId: req.params.resourceId,
    walletAddress: req.accessMesh ? req.accessMesh.walletAddress : null,
  });
});

app.get("/premium/:resourceId/dataset", (req, res) => {
  res.json({
    title: "Premium Dynamic Dataset",
    content:
      "This dataset endpoint resolves its AccessMesh resource from the URL.",
    format: "json",
    resourceId: req.params.resourceId,
    walletAddress: req.accessMesh ? req.accessMesh.walletAddress : null,
  });
});

app.listen(port, () => {
  console.log(
    `AccessMesh middleware demo listening on http://localhost:${port}`,
  );
});
