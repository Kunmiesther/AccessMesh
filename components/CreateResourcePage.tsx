"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { FormEvent, useEffect, useState } from "react";
import { CoverImageUpload } from "@/components/CoverImageUpload";
import { Navbar } from "@/components/Navbar";
import { postResource } from "@/lib/api";
import { useWallet } from "@/lib/ui/WalletContext";
import type { PublishedResourceType } from "@/types";

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
  | { status: "submitting" }
  | { status: "error"; message: string };

export function CreateResourcePage() {
  const router = useRouter();
  const { connected, address } = useWallet();
  const [authReady, setAuthReady] = useState(false);
  const [state, setState] = useState<PublishState>({ status: "idle" });
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
    const timer = window.setTimeout(() => setAuthReady(true), 150);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (authReady && !connected) {
      router.replace("/wallet?next=/create");
    }
  }, [authReady, connected, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!address) {
      router.push("/wallet?next=/create");
      return;
    }

    setState({ status: "submitting" });

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

      const response = await postResource(
        {
          creatorWallet: address,
          title,
          description,
          category,
          priceUSDC,
          resourceType,
          coverImage,
          tags,
          ...resourceData,
        },
        { wallet: address },
      );

      router.replace(`/resource/${response.resource.id}?published=1`);
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Resource could not be published.",
      });
    }
  }

  const disabled = state.status === "submitting";
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

        {authReady && connected && address ? (
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

            <div style={actionsStyle}>
              <Link href="/dashboard" style={secondaryButtonStyle}>
                Cancel
              </Link>
              <button
                type="submit"
                disabled={disabled}
                style={{
                  ...primaryButtonStyle,
                  background: disabled ? "var(--accent-dim)" : "var(--accent)",
                  color: disabled ? "var(--text-secondary)" : "#000",
                  cursor: disabled ? "wait" : "pointer",
                }}
              >
                {state.status === "submitting" ? "Publishing..." : "Publish"}
              </button>
            </div>
          </form>
        ) : (
          <section style={panelStyle}>
            <p style={bodyStyle}>Connect your authenticated wallet before publishing.</p>
            <Link href="/wallet?next=/create" style={{ ...primaryButtonStyle, marginTop: 16 }}>
              Connect Wallet
            </Link>
          </section>
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
