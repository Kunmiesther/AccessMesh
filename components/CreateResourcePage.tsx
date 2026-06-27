"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { FormEvent, useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { postResource } from "@/lib/api";
import { useWallet } from "@/lib/ui/WalletContext";
import type { ResourceType } from "@/types";

const categories: ResourceType[] = ["CONTENT", "API", "TOOL", "DATASET"];

type PublishState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; resourceId: string }
  | { status: "error"; message: string };

export function CreateResourcePage() {
  const router = useRouter();
  const { connected, address } = useWallet();
  const [authReady, setAuthReady] = useState(false);
  const [state, setState] = useState<PublishState>({ status: "idle" });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ResourceType>("CONTENT");
  const [priceUSDC, setPriceUSDC] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setAuthReady(true), 200);
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

    if (!resourceUrl.trim() && !resourceFile) {
      setState({
        status: "error",
        message: "Add a resource URL or upload a resource file.",
      });
      return;
    }

    setState({ status: "submitting" });

    try {
      const fileDataUrl = resourceFile
        ? await readFileAsDataUrl(resourceFile)
        : undefined;
      const response = await postResource({
        creatorWallet: address,
        title,
        description,
        category,
        priceUSDC,
        resourceUrl: resourceUrl.trim() || undefined,
        fileName: resourceFile?.name,
        fileDataUrl,
        coverImage: coverImage.trim() || undefined,
        tags,
      });

      setState({ status: "success", resourceId: response.resource.id });
      window.setTimeout(() => {
        router.push(`/access/${response.resource.id}`);
      }, 900);
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Resource could not be published.",
      });
    }
  }

  const disabled = state.status === "submitting" || state.status === "success";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "44px 24px 80px" }}>
        <header style={{ marginBottom: 28 }}>
          <p style={eyebrowStyle}>Create resource</p>
          <h1 style={{ fontSize: 28, color: "var(--text-primary)", marginBottom: 10 }}>
            Publish premium access
          </h1>
          {connected && address ? (
            <p style={bodyStyle}>
              Publishing as{" "}
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                {address}
              </span>
            </p>
          ) : (
            <p style={bodyStyle}>Redirecting to wallet authentication...</p>
          )}
        </header>

        {authReady && connected && address ? (
          <form onSubmit={handleSubmit} style={panelStyle}>
            <div style={{ display: "grid", gap: 18 }}>
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

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 16,
                }}
              >
                <Field label="Category" htmlFor="category" required>
                  <select
                    id="category"
                    value={category}
                    disabled={disabled}
                    onChange={(event) => setCategory(event.target.value as ResourceType)}
                    required
                    style={inputStyle}
                  >
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
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
                    style={inputStyle}
                  />
                </Field>
              </div>

              <Field label="Resource URL" htmlFor="resourceUrl">
                <input
                  id="resourceUrl"
                  type="url"
                  value={resourceUrl}
                  disabled={disabled || Boolean(resourceFile)}
                  onChange={(event) => setResourceUrl(event.target.value)}
                  placeholder="https://"
                  style={inputStyle}
                />
              </Field>

              <Field label="Resource file" htmlFor="resourceFile">
                <input
                  id="resourceFile"
                  type="file"
                  disabled={disabled || Boolean(resourceUrl.trim())}
                  onChange={(event) =>
                    setResourceFile(event.target.files?.[0] ?? null)
                  }
                  style={inputStyle}
                />
              </Field>

              <Field label="Cover image" htmlFor="coverImage">
                <input
                  id="coverImage"
                  type="url"
                  value={coverImage}
                  disabled={disabled}
                  onChange={(event) => setCoverImage(event.target.value)}
                  placeholder="https://"
                  style={inputStyle}
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

            {state.status === "success" && (
              <p style={{ ...messageStyle, color: "var(--success)" }}>
                Resource published. Redirecting to the resource detail page...
              </p>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
                marginTop: 24,
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/dashboard"
                style={{
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: "10px 14px",
                  textDecoration: "none",
                  fontSize: 13,
                }}
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={disabled}
                style={{
                  background:
                    state.status === "submitting"
                      ? "var(--accent-dim)"
                      : "var(--accent)",
                  color: state.status === "submitting" ? "var(--text-secondary)" : "#000",
                  border: "none",
                  borderRadius: 4,
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: disabled ? "wait" : "pointer",
                }}
              >
                {state.status === "submitting" ? "Publishing..." : "Publish"}
              </button>
            </div>
          </form>
        ) : (
          <div style={panelStyle}>
            <p style={bodyStyle}>Connect a wallet before publishing resources.</p>
            <Link
              href="/wallet?next=/create"
              style={{
                display: "inline-block",
                marginTop: 16,
                background: "var(--accent)",
                color: "#000",
                borderRadius: 4,
                padding: "9px 13px",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Connect Wallet
            </Link>
          </div>
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

const messageStyle = {
  marginTop: 18,
  fontSize: 13,
  lineHeight: 1.6,
} satisfies CSSProperties;
