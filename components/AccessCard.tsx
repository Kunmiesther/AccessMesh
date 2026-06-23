import type { ResourceMeta } from "@/types";

const TYPE_LABELS: Record<string, string> = {
  API: "API endpoint",
  CONTENT: "Content",
  TOOL: "Tool",
  DATASET: "Dataset",
};

const TYPE_IMAGES: Record<string, string> = {
  API: "/images/resource-api.jpg",
  CONTENT: "/images/resource-content.jpg",
  TOOL: "/images/resource-tool.jpg",
  DATASET: "/images/resource-dataset.jpg",
};

type Props = {
  resource: ResourceMeta;
  amountUSDC: number;
  recipientWallet: string;
  expiresAt: string;
};

export function AccessCard({
  resource,
  amountUSDC,
  recipientWallet,
  expiresAt,
}: Props) {
  const expiry = new Date(expiresAt);
  const minutesLeft = Math.max(
    0,
    Math.floor((expiry.getTime() - Date.now()) / 60000),
  );

  const visualSrc = TYPE_IMAGES[resource.type] ?? "/images/resource-content.jpg";

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* Visual header */}
      <div style={{ position: "relative", height: 180, overflow: "hidden" }}>
        <img
          src={visualSrc}
          alt=""
          aria-hidden="true"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            display: "block",
          }}
        />
        {/* Fade to surface */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 80,
            background: "linear-gradient(to bottom, transparent, var(--surface))",
          }}
        />
        {/* Type badge */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 16,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            background: "rgba(10,10,10,0.72)",
            padding: "3px 8px",
            borderRadius: 3,
            border: "1px solid var(--border)",
            backdropFilter: "blur(6px)",
          }}
        >
          {TYPE_LABELS[resource.type] ?? resource.type}
        </div>
        {/* Expiry badge */}
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: minutesLeft < 5 ? "var(--error)" : "var(--text-muted)",
            background: "rgba(10,10,10,0.72)",
            padding: "3px 8px",
            borderRadius: 3,
            border: "1px solid var(--border)",
            backdropFilter: "blur(6px)",
          }}
        >
          expires in {minutesLeft}m
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "0 20px 24px" }}>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 8,
            lineHeight: 1.3,
          }}
        >
          {resource.name}
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          {resource.description}
        </p>

        {/* Data rows */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            borderTop: "1px solid var(--border-subtle)",
            paddingTop: 16,
          }}
        >
          <DataRow label="Resource ID" value={resource.id} mono />
          <DataRow
            label="Provider"
            value={`${recipientWallet.slice(0, 8)}...${recipientWallet.slice(-6)}`}
            mono
          />
          <DataRow
            label="Required payment"
            value={`${amountUSDC.toFixed(2)} USDC`}
            mono
            accent
          />
        </div>
      </div>
    </div>
  );
}

function DataRow({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          fontFamily: mono ? "var(--font-mono)" : undefined,
          color: accent ? "var(--accent)" : "var(--text-secondary)",
          fontWeight: accent ? 500 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}
