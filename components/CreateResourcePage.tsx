"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { FormEvent, useEffect, useState } from "react";
import { type Address, type Hash } from "viem";
import { CoverImageUpload } from "@/components/CoverImageUpload";
import { Navbar } from "@/components/Navbar";
import { getPublishFeeConfig, postResource } from "@/lib/api";
import {
  confirmUsdcPayment,
  submitUsdcPayment,
} from "@/lib/usdc-transfer";
import { useWallet } from "@/lib/ui/WalletContext";
import type {
  CreateResourceRequest,
  PublishedResourceType,
  PublishFeeConfig,
} from "@/types";

const resourceTypeOptions: Array<{
  value: PublishedResourceType;
  label: string;
  description: string;
}> = [
  {
    value: "ARTICLE",
    label: "Article",
    description: "Publish markdown content directly on the platform.",
  },
  {
    value: "FILE_UPLOAD",
    label: "File Upload",
    description: "Upload a PDF, ZIP, or DOCX file for gated delivery.",
  },
  {
    value: "EXTERNAL_LINK",
    label: "External Link",
    description: "Send buyers to an external URL after unlock.",
  },
];

type PublishState =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "awaiting-confirmation" }
  | { status: "paying" }
  | { status: "confirming"; userOpHash: Hash; message: string }
  | { status: "publishing" }
  | { status: "error"; message: string };

type PendingResourceRequest = Omit<CreateResourceRequest, "publishTxHash">;

const PUBLISH_PAYMENT_CONFIRMATION_TIMEOUT_MS = 120_000;

export function CreateResourcePage() {
  const router = useRouter();
  const { connected, ready, address, smartAccount, bundlerClient } = useWallet();
  const [state, setState] = useState<PublishState>({ status: "idle" });
  const [publishFeeConfig, setPublishFeeConfig] =
    useState<PublishFeeConfig | null>(null);
  const [pendingResource, setPendingResource] =
    useState<PendingResourceRequest | null>(null);
  const [publishUserOpHash, setPublishUserOpHash] = useState<Hash | null>(null);
  const [checkingPublishStatus, setCheckingPublishStatus] = useState(false);
  const [creatorDisplayName, setCreatorDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priceUSDC, setPriceUSDC] = useState("");
  const [resourceType, setResourceType] = useState<PublishedResourceType>("ARTICLE");
  const [articleContent, setArticleContent] = useState("");
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (ready && !connected) {
      router.replace("/wallet?next=/create");
    }
  }, [connected, ready, router]);

  useEffect(() => {
    if (!ready || !connected || !address) {
      return;
    }

    let cancelled = false;

    getPublishFeeConfig()
      .then((response) => {
        if (!cancelled) {
          console.info("[publish] fee config loaded");
          setPublishFeeConfig(response.config);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Publish fee config could not be loaded.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address, connected, ready]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!connected || !address) {
      router.push("/wallet?next=/create");
      return;
    }

    setState({ status: "preparing" });
    setPublishUserOpHash(null);

    try {
      const coverImage = coverImageFile
        ? await readFileAsDataUrl(coverImageFile)
        : undefined;
      const resourceData = await buildResourceData({
        resourceType,
        articleContent,
        resourceFile,
        externalUrl,
      });

      setPendingResource({
        creatorWallet: address,
        creatorDisplayName,
        title,
        description,
        category,
        priceUSDC,
        resourceType,
        coverImage,
        tags,
        ...resourceData,
      });
      setState({ status: "awaiting-confirmation" });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Resource could not be published.",
      });
    }
  }

  async function handleConfirmPublish() {
    if (!connected || !address) {
      router.push("/wallet?next=/create");
      return;
    }

    if (!smartAccount || !bundlerClient) {
      setState({
        status: "error",
        message:
          "Active wallet session is not available. Refresh and sign in again if the session has expired.",
      });
      return;
    }

    if (!publishFeeConfig) {
      setState({
        status: "error",
        message: "Publish fee config is not loaded.",
      });
      return;
    }

    if (!pendingResource) {
      setState({
        status: "error",
        message: "Resource form data could not be prepared.",
      });
      return;
    }

    try {
      setState({ status: "paying" });
      setPublishUserOpHash(null);
      console.info("[publish] sending publish fee");
      const userOpHash = await submitUsdcPayment({
        bundlerClient,
        transfers: [
          {
            recipientWallet: publishFeeConfig.treasuryWallet as Address,
            amountUSDC: publishFeeConfig.publishFeeUSDC,
          },
        ],
      });

      console.info("[publish] userOp hash received", userOpHash);
      setPublishUserOpHash(userOpHash);
      console.info("[publish] waiting for receipt");

      const confirmation = await confirmUsdcPayment({
        bundlerClient,
        userOpHash,
        timeoutMs: PUBLISH_PAYMENT_CONFIRMATION_TIMEOUT_MS,
      });

      if (confirmation.status === "pending") {
        console.info("[publish] user operation still pending", userOpHash);
        setState({
          status: "confirming",
          userOpHash,
          message: "Transaction is taking longer than expected.",
        });
        return;
      }

      console.info("[publish] receipt confirmed", confirmation.transactionHash);
      setState({ status: "publishing" });
      console.info("[publish] creating resource");
      const response = await postResource(
        {
          ...pendingResource,
          publishTxHash: confirmation.transactionHash,
        },
        { wallet: address },
      );

      console.info("[publish] resource created", response.resource.id);
      setPublishUserOpHash(null);
      router.replace(`/resource/${response.resource.id}?published=1`);
    } catch (error) {
      console.error("[publish] failed", error);
      setPublishUserOpHash(null);
      setState({
        status: "error",
        message: getPublishErrorMessage(error),
      });
    }
  }

  async function handleCheckPublishStatus() {
    if (!connected || !address || !bundlerClient || !pendingResource) {
      return;
    }

    const userOpHash =
      state.status === "confirming" ? state.userOpHash : publishUserOpHash;

    if (!userOpHash) {
      setState({
        status: "error",
        message: "No pending publish transaction was found.",
      });
      return;
    }

    setCheckingPublishStatus(true);
    try {
      console.info("[publish] checking pending payment status", userOpHash);
      const confirmation = await confirmUsdcPayment({
        bundlerClient,
        userOpHash,
        timeoutMs: PUBLISH_PAYMENT_CONFIRMATION_TIMEOUT_MS,
      });

      if (confirmation.status === "pending") {
        console.info("[publish] still pending", userOpHash);
        setState({
          status: "confirming",
          userOpHash,
          message: "Transaction is taking longer than expected.",
        });
        return;
      }

      console.info("[publish] receipt confirmed after retry", confirmation.transactionHash);
      setState({ status: "publishing" });
      console.info("[publish] creating resource");
      const response = await postResource(
        {
          ...pendingResource,
          publishTxHash: confirmation.transactionHash,
        },
        { wallet: address },
      );

      console.info("[publish] resource created", response.resource.id);
      setPublishUserOpHash(null);
      router.replace(`/resource/${response.resource.id}?published=1`);
    } catch (error) {
      console.error("[publish] status check failed", error);
      setState({
        status: "confirming",
        userOpHash,
        message:
          error instanceof Error ? error.message : "Could not confirm payment yet.",
      });
    } finally {
      setCheckingPublishStatus(false);
    }
  }

  function handleCancelConfirmation() {
    setPendingResource(null);
    setState({ status: "idle" });
  }

  const disabled =
    state.status === "preparing" ||
    state.status === "paying" ||
    state.status === "publishing" ||
    state.status === "confirming";
  const submitDisabled = disabled || !publishFeeConfig;
  const confirmationOpen =
    state.status === "awaiting-confirmation" ||
    state.status === "paying" ||
    state.status === "publishing";
  const activeResourceType = resourceTypeOptions.find(
    (option) => option.value === resourceType,
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <main style={{ maxWidth: 920, margin: "0 auto", padding: "44px 24px 80px" }}>
        <header style={{ marginBottom: 28 }}>
          <p style={eyebrowStyle}>Create resource</p>
          <h1 style={{ fontSize: 30, color: "var(--text-primary)", marginBottom: 10 }}>
            Publish a paid resource
          </h1>
          <p style={bodyStyle}>
            Create an Article, File Upload, or External Link and publish it behind a USDC price.
          </p>
          {connected && address ? (
            <p style={{ ...bodyStyle, marginTop: 10 }}>
              Active wallet:{" "}
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                {address}
              </span>
            </p>
          ) : (
            <p style={{ ...bodyStyle, marginTop: 10 }}>Authenticating wallet...</p>
          )}
        </header>

        {ready && connected && address ? (
          <form onSubmit={handleSubmit} style={panelStyle}>
            <div style={gridStyle}>
              <Field label="Title" htmlFor="title" required>
                <input
                  id="title"
                  value={title}
                  disabled={disabled}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  style={inputStyle}
                />
              </Field>

              <Field label="Creator display name" htmlFor="creatorDisplayName">
                <input
                  id="creatorDisplayName"
                  value={creatorDisplayName}
                  disabled={disabled}
                  onChange={(event) => setCreatorDisplayName(event.target.value)}
                  placeholder="Shown with your wallet address"
                  style={inputStyle}
                />
              </Field>

              <Field label="Description" htmlFor="description" required>
                <textarea
                  id="description"
                  value={description}
                  disabled={disabled}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                  rows={5}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                />
              </Field>

              <div style={twoColumnStyle}>
                <Field label="Category" htmlFor="category" required>
                  <input
                    id="category"
                    value={category}
                    disabled={disabled}
                    onChange={(event) => setCategory(event.target.value)}
                    required
                    placeholder="Guides, Templates, Research, etc."
                    style={inputStyle}
                  />
                </Field>

                <Field label="Price (USDC)" htmlFor="priceUSDC" required>
                  <input
                    id="priceUSDC"
                    type="number"
                    inputMode="decimal"
                    min="0.000001"
                    step="0.000001"
                    value={priceUSDC}
                    disabled={disabled}
                    onChange={(event) => setPriceUSDC(event.target.value)}
                    required
                    placeholder="0.00"
                    style={inputStyle}
                  />
                </Field>
              </div>

              <Field label="Resource Type" htmlFor="resourceType" required>
                <select
                  id="resourceType"
                  value={resourceType}
                  disabled={disabled}
                  onChange={(event) => {
                    setResourceType(event.target.value as PublishedResourceType);
                    setState({ status: "idle" });
                    setArticleContent("");
                    setResourceFile(null);
                    setExternalUrl("");
                  }}
                  required
                  style={inputStyle}
                >
                  {resourceTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p style={helperTextStyle}>{activeResourceType?.description}</p>
              </Field>

              {resourceType === "ARTICLE" && (
                <Field label="Markdown editor" htmlFor="articleContent" required>
                  <textarea
                    id="articleContent"
                    value={articleContent}
                    disabled={disabled}
                    onChange={(event) => setArticleContent(event.target.value)}
                    required
                    rows={12}
                    placeholder="# Start writing..."
                    spellCheck={false}
                    style={{
                      ...inputStyle,
                      minHeight: 280,
                      fontFamily: "var(--font-mono)",
                      lineHeight: 1.65,
                    }}
                  />
                  <p style={helperTextStyle}>
                    Markdown is supported for headings, lists, links, and code blocks.
                  </p>
                </Field>
              )}

              {resourceType === "FILE_UPLOAD" && (
                <Field label="Upload PDF, ZIP, or DOCX" htmlFor="resourceFile" required>
                  <input
                    id="resourceFile"
                    type="file"
                    accept=".pdf,.zip,.docx,application/pdf,application/zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    disabled={disabled}
                    onChange={(event) =>
                      setResourceFile(event.target.files?.[0] ?? null)
                    }
                    required
                    style={fileInputStyle}
                  />
                  <p style={helperTextStyle}>
                    {resourceFile
                      ? `Selected: ${resourceFile.name}`
                      : "Accepted formats: PDF, ZIP, and DOCX."}
                  </p>
                </Field>
              )}

              {resourceType === "EXTERNAL_LINK" && (
                <Field label="URL" htmlFor="externalUrl" required>
                  <input
                    id="externalUrl"
                    type="url"
                    value={externalUrl}
                    disabled={disabled}
                    onChange={(event) => setExternalUrl(event.target.value)}
                    required
                    placeholder="https://"
                    style={inputStyle}
                  />
                </Field>
              )}

              <Field label="Cover image" htmlFor="coverImage">
                <CoverImageUpload
                  inputId="coverImage"
                  value={coverImageFile}
                  disabled={disabled}
                  onChange={setCoverImageFile}
                />
              </Field>

              <Field label="Tags" htmlFor="tags">
                <input
                  id="tags"
                  value={tags}
                  disabled={disabled}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="analytics, guide, template"
                  style={inputStyle}
                />
              </Field>
            </div>

            {state.status === "error" && (
              <p style={{ ...messageStyle, color: "var(--error)" }}>{state.message}</p>
            )}

            {state.status === "confirming" && (
              <div style={pendingPaymentStyle}>
                <p style={pendingPaymentTitleStyle}>
                  Transaction is taking longer than expected.
                </p>
                <p style={pendingPaymentBodyStyle}>
                  Check status to continue once the payment confirms.
                </p>
                <HashBlock label="User operation" hash={state.userOpHash} />
                <div style={pendingPaymentActionRowStyle}>
                  <button
                    type="button"
                    onClick={handleCheckPublishStatus}
                    disabled={checkingPublishStatus}
                    style={{
                      ...primaryButtonStyle,
                      background: checkingPublishStatus
                        ? "var(--border)"
                        : "var(--accent)",
                      color: checkingPublishStatus ? "var(--text-muted)" : "#000",
                      cursor: checkingPublishStatus ? "not-allowed" : "pointer",
                    }}
                  >
                    {checkingPublishStatus ? "Checking status..." : "Check status"}
                  </button>
                </div>
              </div>
            )}

            <div style={actionsStyle}>
              <Link href="/dashboard" style={secondaryButtonStyle}>
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitDisabled}
                style={{
                  ...primaryButtonStyle,
                  background: submitDisabled ? "var(--accent-dim)" : "var(--accent)",
                  color: submitDisabled ? "var(--text-secondary)" : "#000",
                  cursor: submitDisabled ? "wait" : "pointer",
                }}
              >
                {state.status === "preparing"
                  ? "Preparing..."
                  : state.status === "paying"
                    ? publishUserOpHash
                      ? "Waiting for confirmation..."
                      : "Submitting payment..."
                    : state.status === "publishing"
                      ? "Payment confirmed. Publishing resource..."
                      : state.status === "confirming"
                        ? "Transaction is pending..."
                        : publishFeeConfig
                          ? "Publish"
                          : "Loading publish fee..."}
              </button>
            </div>
          </form>
        ) : ready && !connected ? (
          <section style={panelStyle}>
            <p style={bodyStyle}>Connect your authenticated wallet before publishing.</p>
            <Link href="/wallet?next=/create" style={{ ...primaryButtonStyle, marginTop: 16 }}>
              Connect Wallet
            </Link>
          </section>
        ) : (
          <section style={panelStyle}>
            <p style={bodyStyle}>Restoring authenticated wallet...</p>
          </section>
        )}

        {confirmationOpen && publishFeeConfig && (
          <PublishConfirmationModal
            feeUSDC={publishFeeConfig.publishFeeUSDC}
            treasuryWallet={publishFeeConfig.treasuryWallet}
            status={state.status}
            onCancel={handleCancelConfirmation}
            onConfirm={handleConfirmPublish}
          />
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required = false,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} style={labelStyle}>
        {label}
        {required ? <span style={{ color: "var(--accent)" }}> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function PublishConfirmationModal({
  feeUSDC,
  treasuryWallet,
  status,
  onCancel,
  onConfirm,
}: {
  feeUSDC: number;
  treasuryWallet: string;
  status: PublishState["status"];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const busy = status === "paying" || status === "publishing";
  const actionLabel =
    status === "paying"
      ? "Submitting payment..."
      : status === "publishing"
        ? "Payment confirmed. Publishing resource..."
        : "Pay fee and publish";

  return (
    <div style={modalOverlayStyle} role="dialog" aria-modal="true">
      <section style={modalPanelStyle}>
        <p style={eyebrowStyle}>Protocol fee</p>
        <h2 style={modalTitleStyle}>Confirm publishing</h2>
        <p style={bodyStyle}>
          Publishing this resource requires a protocol fee of {feeUSDC} USDC.
        </p>
        <div style={resourceUrlBoxStyle}>
          <p style={modalMetaLabelStyle}>Treasury wallet</p>
          <p style={modalMetaValueStyle}>{treasuryWallet}</p>
        </div>
        <div style={actionsStyle}>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            style={{
              ...secondaryButtonStyle,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            style={{
              ...primaryButtonStyle,
              background: busy ? "var(--accent-dim)" : "var(--accent)",
              color: busy ? "var(--text-secondary)" : "#000",
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {actionLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function HashBlock({ label, hash }: { label: string; hash: string }) {
  return (
    <div style={hashBlockStyle}>
      <p style={hashLabelStyle}>{label}</p>
      <p style={hashValueStyle}>{hash}</p>
    </div>
  );
}

async function buildResourceData(params: {
  resourceType: PublishedResourceType;
  articleContent: string;
  resourceFile: File | null;
  externalUrl: string;
}) {
  if (params.resourceType === "ARTICLE") {
    const content = params.articleContent.trim();
    if (!content) {
      throw new Error("Markdown content is required for articles.");
    }

    return {
      articleContent: content,
    };
  }

  if (params.resourceType === "FILE_UPLOAD") {
    if (!params.resourceFile) {
      throw new Error("Select a PDF, ZIP, or DOCX file to publish.");
    }

    const fileDataUrl = await readFileAsDataUrl(params.resourceFile);
    return {
      fileName: params.resourceFile.name,
      fileMimeType: params.resourceFile.type || undefined,
      fileDataUrl,
    };
  }

  const url = params.externalUrl.trim();
  if (!url) {
    throw new Error("Add a URL for the external link resource.");
  }

  return {
    externalUrl: url,
  };
}

function getPublishErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (/timed out while waiting for user operation/i.test(error.message)) {
      return "Transaction is taking longer than expected.";
    }

    return error.message;
  }

  return "Resource could not be published.";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Resource file could not be read."));
    reader.readAsDataURL(file);
  });
}

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: 10,
} satisfies CSSProperties;

const bodyStyle = {
  fontSize: 14,
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  overflowWrap: "anywhere",
} satisfies CSSProperties;

const panelStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 24,
} satisfies CSSProperties;

const gridStyle = {
  display: "grid",
  gap: 18,
} satisfies CSSProperties;

const twoColumnStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
} satisfies CSSProperties;

const labelStyle = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
} satisfies CSSProperties;

const inputStyle = {
  width: "100%",
  background: "#0a0a0a",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
  borderRadius: 4,
  padding: "11px 12px",
  fontSize: 14,
  outline: "none",
} satisfies CSSProperties;

const fileInputStyle = {
  ...inputStyle,
  paddingTop: 9,
  paddingBottom: 9,
} satisfies CSSProperties;

const helperTextStyle = {
  marginTop: 8,
  color: "var(--text-muted)",
  fontSize: 12,
  lineHeight: 1.6,
} satisfies CSSProperties;

const messageStyle = {
  marginTop: 18,
  fontSize: 13,
  lineHeight: 1.6,
} satisfies CSSProperties;

const resourceUrlBoxStyle = {
  background: "#0a0a0a",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 14,
  color: "var(--text-secondary)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  lineHeight: 1.6,
  overflowWrap: "anywhere",
} satisfies CSSProperties;

const actionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  marginTop: 24,
  flexWrap: "wrap",
} satisfies CSSProperties;

const primaryButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--accent)",
  color: "#000",
  border: "1px solid var(--accent)",
  borderRadius: 4,
  padding: "10px 16px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
  minWidth: 110,
} satisfies CSSProperties;

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
} satisfies CSSProperties;

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  background: "rgba(0, 0, 0, 0.72)",
} satisfies CSSProperties;

const modalPanelStyle = {
  width: "min(100%, 460px)",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 24,
  boxShadow: "0 24px 80px rgba(0, 0, 0, 0.42)",
} satisfies CSSProperties;

const modalTitleStyle = {
  fontSize: 22,
  lineHeight: 1.25,
  color: "var(--text-primary)",
  marginBottom: 10,
} satisfies CSSProperties;

const modalMetaLabelStyle = {
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 6,
} satisfies CSSProperties;

const modalMetaValueStyle = {
  color: "var(--text-secondary)",
  wordBreak: "break-all",
} satisfies CSSProperties;

const pendingPaymentStyle = {
  marginTop: 18,
  padding: 18,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "rgba(0,194,168,0.06)",
} satisfies CSSProperties;

const pendingPaymentTitleStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--accent)",
  marginBottom: 6,
} satisfies CSSProperties;

const pendingPaymentBodyStyle = {
  fontSize: 12,
  color: "var(--text-secondary)",
  lineHeight: 1.5,
  marginBottom: 12,
} satisfies CSSProperties;

const pendingPaymentActionRowStyle = {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: 12,
} satisfies CSSProperties;

const hashBlockStyle = {
  display: "grid",
  gap: 4,
  marginTop: 10,
  padding: 12,
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "#0a0a0a",
} satisfies CSSProperties;

const hashLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--text-muted)",
} satisfies CSSProperties;

const hashValueStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text-secondary)",
  wordBreak: "break-all",
} satisfies CSSProperties;
