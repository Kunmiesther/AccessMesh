"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { Navbar } from "@/components/Navbar";
import { getResourceDetail } from "@/lib/api";
import { formatDate, formatUSDC, shortAddress } from "@/lib/ui";
import { useWallet } from "@/lib/ui/WalletContext";
import type { PublishedResourceType, ResourceDetail } from "@/types";

type PageState =
  | { status: "loading" }
  | { status: "done"; resource: ResourceDetail }
  | { status: "error"; message: string };

export default function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address } = useWallet();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const published = searchParams.get("published") === "1";
  const currentKey = `${id}:${address ?? ""}`;

  useEffect(() => {
    let cancelled = false;

    getResourceDetail(id, address)
      .then((response) => {
        if (!cancelled) {
          setState({ status: "done", resource: response.resource });
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setState({ status: "error", message: error.message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentKey, address, id]);

  const isStale = state.status === "done" && state.resource.id !== id;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <main style={{ maxWidth: 1024, margin: "0 auto", padding: "44px 24px 80px" }}>
        <Link href="/explore" style={backLinkStyle}>
          Back to marketplace
        </Link>

        {(state.status === "loading" || isStale) && (
          <section style={panelStyle}>
            <p style={{ color: "var(--text-muted)" }}>Loading resource...</p>
          </section>
        )}

        {state.status === "error" && !isStale && (
          <section style={panelStyle}>
            <p style={{ color: "var(--error)", lineHeight: 1.6 }}>{state.message}</p>
          </section>
        )}

        {state.status === "done" && !isStale && (
          <div style={{ display: "grid", gap: 18 }}>
            {published && <PublishedSuccessPanel resource={state.resource} />}
            <ResourceHeader resource={state.resource} />
            {state.resource.owned ? (
              <UnlockedContent resource={state.resource} />
            ) : (
              <LockedContent
                onUnlock={() => {
                  if (address) {
                    router.push(`/access/${state.resource.id}`);
                  } else {
                    router.push(`/wallet?next=/resource/${state.resource.id}`);
                  }
                }}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ResourceHeader({ resource }: { resource: ResourceDetail }) {
  const categoryLabel = resource.resourceCategory ?? resource.category;
  const creatorLabel = resource.creatorDisplayName ?? shortAddress(resource.creatorWallet);

  return (
    <section style={headerPanelStyle}>
      <div style={heroGridStyle}>
        <div style={coverShellStyle}>
          <div
            style={{
              ...coverStyle,
              backgroundImage: resource.coverImage
                ? `linear-gradient(180deg, rgba(6, 8, 10, 0.1), rgba(6, 8, 10, 0.72)), url("${encodeURI(resource.coverImage)}")`
                : "linear-gradient(135deg, rgba(0,194,168,0.18), rgba(255,255,255,0.03))",
            }}
          >
            <span style={coverTagStyle}>{categoryLabel}</span>
          </div>
        </div>

        <div style={heroCopyStyle}>
          <p style={eyebrowStyle}>Resource</p>
          <h1 style={titleStyle}>{resource.title || resource.name}</h1>
          <p style={descriptionStyle}>{resource.description}</p>

          <div style={metaGridStyle}>
            <MetaItem label="Creator" value={creatorLabel} />
            <MetaItem label="Category" value={categoryLabel} />
            <MetaItem label="Publish date" value={formatDate(resource.createdAt)} />
            <MetaItem label="Price" value={formatUSDC(resource.priceUSDC)} />
            <MetaItem label="Unlock count" value={String(resource.unlockCount)} />
          </div>
        </div>
      </div>
    </section>
  );
}

function PublishedSuccessPanel({ resource }: { resource: ResourceDetail }) {
  const shareUrl = `/resource/${resource.id}`;

  async function handleCopyLink() {
    const url = new URL(shareUrl, window.location.origin).toString();
    try {
      await window.navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  function handleShareOnX() {
    const url = new URL(shareUrl, window.location.origin).toString();
    const shareText = encodeURIComponent(
      `I just published "${resource.title || resource.name}" on AccessMesh.`,
    );
    window.open(
      `https://x.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <section style={panelStyle}>
      <p style={eyebrowStyle}>Published</p>
      <h2 style={sectionTitleStyle}>Resource published successfully</h2>
      <p style={bodyStyle}>
        Your public resource page is live. Copy the link below or share it on X.
      </p>
      <div style={linkBoxStyle}>
        <span style={{ overflowWrap: "anywhere" }}>{shareUrl}</span>
      </div>
      <div style={shareActionsStyle}>
        <button type="button" onClick={handleCopyLink} style={primaryButtonStyle}>
          Copy Link
        </button>
        <button type="button" onClick={handleShareOnX} style={secondaryButtonStyle}>
          Share on X
        </button>
      </div>
    </section>
  );
}

function LockedContent({
  onUnlock,
}: {
  onUnlock: () => void;
}) {
  return (
    <section style={panelStyle}>
      <p style={eyebrowStyle}>Locked Preview</p>
      <h2 style={sectionTitleStyle}>Locked Preview</h2>
      <p style={bodyStyle}>
        This resource is locked. Protected content is hidden until access is unlocked.
      </p>
      <div style={previewStyle}>
        <div style={{ height: 10, width: "82%", background: "var(--border)" }} />
        <div style={{ height: 10, width: "64%", background: "var(--border)" }} />
        <div style={{ height: 10, width: "74%", background: "var(--border)" }} />
      </div>
      <button
        type="button"
        onClick={onUnlock}
        style={{
          ...primaryButtonStyle,
          marginTop: 18,
        }}
      >
        Unlock
      </button>
    </section>
  );
}

function UnlockedContent({ resource }: { resource: ResourceDetail }) {
  const contentType = resolvePublishedResourceType(resource);

  return (
    <section style={panelStyle}>
      <p style={eyebrowStyle}>Unlocked content</p>
      <h2 style={sectionTitleStyle}>Resource access</h2>
      {contentType === "ARTICLE" && <ArticleContent resource={resource} />}
      {contentType === "FILE_UPLOAD" && <FileContent resource={resource} />}
      {contentType === "EXTERNAL_LINK" && <ExternalLinkContent resource={resource} />}
    </section>
  );
}

function ArticleContent({ resource }: { resource: ResourceDetail }) {
  const markdown = getMarkdownContent(resource);

  return (
    <div style={{ marginTop: 16 }}>
      <div
        className="resource-markdown"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(markdown) }}
      />
      <style jsx>{`
        .resource-markdown {
          color: var(--text-secondary);
          line-height: 1.75;
        }

        .resource-markdown h1,
        .resource-markdown h2,
        .resource-markdown h3 {
          color: var(--text-primary);
          line-height: 1.25;
          margin: 1.25em 0 0.6em;
        }

        .resource-markdown h1 {
          font-size: 28px;
        }

        .resource-markdown h2 {
          font-size: 22px;
        }

        .resource-markdown h3 {
          font-size: 18px;
        }

        .resource-markdown p,
        .resource-markdown ul,
        .resource-markdown ol,
        .resource-markdown blockquote,
        .resource-markdown pre {
          margin: 0 0 1em;
        }

        .resource-markdown ul,
        .resource-markdown ol {
          padding-left: 1.25rem;
        }

        .resource-markdown li {
          margin: 0.35em 0;
        }

        .resource-markdown blockquote {
          border-left: 3px solid var(--border);
          padding-left: 1rem;
          color: var(--text-muted);
        }

        .resource-markdown code {
          font-family: var(--font-mono);
          font-size: 0.95em;
          background: rgba(255, 255, 255, 0.05);
          padding: 0.08em 0.35em;
          border-radius: 4px;
        }

        .resource-markdown pre {
          overflow-x: auto;
          background: #0a0a0a;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 14px;
        }

        .resource-markdown pre code {
          background: transparent;
          padding: 0;
        }

        .resource-markdown a {
          color: var(--accent);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
      `}</style>
    </div>
  );
}

function FileContent({ resource }: { resource: ResourceDetail }) {
  const asset = parseFileAsset(resource);

  return (
    <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
      <div style={resourceUrlBoxStyle}>
        <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {asset.fileName}
        </p>
        {asset.fileMimeType ? (
          <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
            {asset.fileMimeType}
          </p>
        ) : null}
      </div>
      <a href={asset.downloadUrl} download={asset.fileName} style={primaryButtonStyle}>
        Download
      </a>
    </div>
  );
}

function ExternalLinkContent({ resource }: { resource: ResourceDetail }) {
  const url = resource.resourceUrl ?? resource.endpoint ?? "";

  return (
    <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
      <div style={resourceUrlBoxStyle}>
        <span style={{ overflowWrap: "anywhere" }}>{url}</span>
      </div>
      <a href={url} target="_blank" rel="noreferrer" style={primaryButtonStyle}>
        Open Resource
      </a>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={metaItemStyle}>
      <p style={metaLabelStyle}>{label}</p>
      <p style={metaValueStyle}>{value}</p>
    </div>
  );
}

function resolvePublishedResourceType(resource: ResourceDetail): PublishedResourceType {
  if (resource.resourceType) {
    return resource.resourceType;
  }

  const content = resource.resourceContent ?? "";
  const url = resource.resourceUrl ?? resource.endpoint ?? "";
  const decoded = url.startsWith("data:") ? decodeDataUrl(url) : "";

  if (content || decoded) {
    if (looksLikeFileAsset(content) || looksLikeFileAsset(decoded)) {
      return "FILE_UPLOAD";
    }

    if (url.startsWith("data:text/markdown") || decoded.trim().length > 0) {
      return "ARTICLE";
    }
  }

  return "EXTERNAL_LINK";
}

function getMarkdownContent(resource: ResourceDetail) {
  const content = resource.resourceContent ?? "";
  if (content.trim().length > 0) {
    return content;
  }

  const url = resource.resourceUrl ?? resource.endpoint ?? "";
  return url.startsWith("data:") ? decodeDataUrl(url) : "";
}

function parseFileAsset(resource: ResourceDetail) {
  const candidates = [resource.resourceContent, resource.resourceUrl, resource.endpoint];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      const parsed = JSON.parse(candidate);
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.fileDataUrl === "string"
      ) {
        return {
          fileName:
            typeof parsed.fileName === "string" && parsed.fileName.trim().length > 0
              ? parsed.fileName
              : `${resource.title || resource.name}.bin`,
          fileMimeType:
            typeof parsed.fileMimeType === "string" && parsed.fileMimeType.trim().length > 0
              ? parsed.fileMimeType
              : undefined,
          downloadUrl: parsed.fileDataUrl,
        };
      }
    } catch {
      // ignore parse failures
    }
  }

  const fallbackUrl = resource.resourceUrl ?? resource.endpoint ?? "";
  return {
    fileName: `${resource.title || resource.name}.bin`,
    fileMimeType: undefined,
    downloadUrl: fallbackUrl,
  };
}

function looksLikeFileAsset(value: string | undefined) {
  if (!value) {
    return false;
  }

  try {
    const parsed = JSON.parse(value);
    return Boolean(parsed && typeof parsed === "object" && typeof parsed.fileDataUrl === "string");
  } catch {
    return false;
  }
}

function decodeDataUrl(value: string) {
  const commaIndex = value.indexOf(",");
  if (!value.startsWith("data:") || commaIndex === -1) {
    return value;
  }

  const meta = value.slice(5, commaIndex);
  const payload = value.slice(commaIndex + 1);

  if (meta.includes(";base64")) {
    return atob(payload);
  }

  try {
    return decodeURIComponent(payload);
  } catch {
    return payload;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatInlineMarkdown(value: string) {
  const escaped = escapeHtml(value);

  return escaped
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
}

function markdownToHtml(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let listOpen = false;
  let codeOpen = false;
  let codeLines: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      html.push(`<p>${paragraph.map(formatInlineMarkdown).join(" ")}</p>`);
      paragraph = [];
    }
  };

  const closeList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  const closeCode = () => {
    if (codeOpen) {
      html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      codeOpen = false;
      codeLines = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      flushParagraph();
      closeList();
      if (codeOpen) {
        closeCode();
      } else {
        codeOpen = true;
      }
      continue;
    }

    if (codeOpen) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${formatInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    const quoteMatch = line.match(/^>\s+(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      closeList();
      html.push(`<blockquote>${formatInlineMarkdown(quoteMatch[1])}</blockquote>`);
      continue;
    }

    const listMatch = line.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${formatInlineMarkdown(listMatch[1])}</li>`);
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  closeList();
  closeCode();

  return html.join("");
}

const backLinkStyle = {
  display: "inline-block",
  color: "var(--text-secondary)",
  textDecoration: "none",
  marginBottom: 18,
  fontSize: 13,
} satisfies CSSProperties;

const panelStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 24,
} satisfies CSSProperties;

const headerPanelStyle = {
  ...panelStyle,
  padding: 0,
  overflow: "hidden",
} satisfies CSSProperties;

const heroGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(320px, 0.9fr) minmax(0, 1.1fr)",
} satisfies CSSProperties;

const coverShellStyle = {
  minHeight: 320,
  borderRight: "1px solid var(--border)",
} satisfies CSSProperties;

const coverStyle = {
  height: "100%",
  minHeight: 320,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  backgroundSize: "cover",
  backgroundPosition: "center",
  padding: 18,
} satisfies CSSProperties;

const coverTagStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "#fff",
  background: "rgba(0,0,0,0.45)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 999,
  padding: "6px 10px",
  backdropFilter: "blur(8px)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} satisfies CSSProperties;

const heroCopyStyle = {
  padding: 28,
} satisfies CSSProperties;

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: 10,
} satisfies CSSProperties;

const titleStyle = {
  fontSize: 34,
  lineHeight: 1.12,
  color: "var(--text-primary)",
  marginBottom: 12,
} satisfies CSSProperties;

const sectionTitleStyle = {
  fontSize: 20,
  lineHeight: 1.25,
  color: "var(--text-primary)",
  marginBottom: 10,
} satisfies CSSProperties;

const descriptionStyle = {
  fontSize: 14,
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  marginBottom: 18,
} satisfies CSSProperties;

const bodyStyle = {
  fontSize: 14,
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  marginBottom: 16,
} satisfies CSSProperties;

const metaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
} satisfies CSSProperties;

const metaItemStyle = {
  border: "1px solid var(--border-subtle)",
  borderRadius: 8,
  padding: 14,
  minWidth: 0,
} satisfies CSSProperties;

const metaLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 7,
} satisfies CSSProperties;

const metaValueStyle = {
  color: "var(--text-secondary)",
  fontSize: 13,
  fontFamily: "var(--font-mono)",
  overflowWrap: "anywhere",
  lineHeight: 1.5,
} satisfies CSSProperties;

const previewStyle = {
  display: "grid",
  gap: 10,
  background: "#0a0a0a",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 16,
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
} satisfies CSSProperties;

const linkBoxStyle = {
  ...resourceUrlBoxStyle,
  marginBottom: 16,
} satisfies CSSProperties;

const shareActionsStyle = {
  display: "flex",
  gap: 12,
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
  padding: "10px 14px",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  minWidth: 120,
} satisfies CSSProperties;

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
} satisfies CSSProperties;
