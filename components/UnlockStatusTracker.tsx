type Props = {
  accessToken: string;
  resourceId: string;
  txHash: string;
  expiresAt?: string;
};

export function UnlockStatusTracker({
  accessToken,
  resourceId,
  txHash,
  expiresAt,
}: Props) {
  const expiry = expiresAt ? new Date(expiresAt).toLocaleString() : null;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid #4caf7d30",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* Status header */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid #4caf7d30",
          background: "#4caf7d0d",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--success)",
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--success)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Unlocked Successfully
        </span>
      </div>

      {/* Token info */}
      <div style={{ padding: "20px" }}>
        <div style={{ marginBottom: 16 }}>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            Verified on Arc
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--success)",
            }}
          >
            Settlement verified
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            Transaction Hash
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-secondary)",
              wordBreak: "break-all",
              lineHeight: 1.5,
            }}
          >
            {txHash}
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            Resource
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-secondary)",
              wordBreak: "break-all",
            }}
          >
            {resourceId}
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            Access token
          </p>
          <div
            style={{
              background: "#0a0a0a",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "10px 12px",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-secondary)",
              wordBreak: "break-all",
              lineHeight: 1.6,
              maxHeight: 80,
              overflow: "auto",
            }}
          >
            {accessToken}
          </div>
        </div>

        {expiry && (
          <p
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
            }}
          >
            Token expires: <span style={{ color: "var(--text-secondary)" }}>{expiry}</span>
          </p>
        )}

        <div
          style={{
            marginTop: 16,
            padding: "12px",
            background: "var(--accent-dim)",
            borderRadius: 4,
            border: "1px solid var(--border)",
          }}
        >
          <p
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            Use this token as a{" "}
            <span style={{ fontFamily: "var(--font-mono)" }}>Bearer</span> header when
            accessing the resource endpoint. Your access history is recorded in your{" "}
            <a
              href="/dashboard"
              style={{
                color: "var(--accent)",
                textDecoration: "none",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.textDecoration = "underline")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.textDecoration = "none")
              }
            >
              activity dashboard
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
