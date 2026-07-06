"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type {
  UnlockAdvisorResponse,
  UnlockAdvisorResult,
} from "@/types";

type Props = {
  resourceId: string;
  walletAddress?: string | null;
};

type AdvisorState =
  | { status: "loading" }
  | { status: "ready"; advisor: UnlockAdvisorResult }
  | { status: "unavailable"; message: string };

const FALLBACK_MESSAGE =
  "AI advisor unavailable. You can still unlock this resource normally.";

export function AIUnlockAdvisor({ resourceId, walletAddress }: Props) {
  const [state, setState] = useState<AdvisorState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    setState({ status: "loading" });

    fetch("/api/ai/unlock-advisor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resourceId,
        wallet: walletAddress ?? undefined,
      }),
    })
      .then(async (response) => {
        const data = (await response.json()) as UnlockAdvisorResponse;
        if (cancelled) {
          return;
        }

        if (response.ok && data.ok) {
          setState({ status: "ready", advisor: data.advisor });
          return;
        }

        setState({
          status: "unavailable",
          message: data.ok ? FALLBACK_MESSAGE : data.message,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: "unavailable",
            message: FALLBACK_MESSAGE,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resourceId, walletAddress]);

  if (state.status === "loading") {
    return (
      <section style={panelStyle}>
        <div style={headerStyle}>
          <div>
            <p style={eyebrowStyle}>AI Unlock Advisor</p>
            <h3 style={titleStyle}>Evaluating whether this unlock is worth it</h3>
          </div>
          <span style={loadingBadgeStyle}>Analyzing</span>
        </div>
        <div style={metricGridStyle}>
          <SkeletonBlock />
          <SkeletonBlock />
          <SkeletonBlock />
        </div>
        <div style={skeletonTextGroupStyle}>
          <SkeletonLine width="92%" />
          <SkeletonLine width="76%" />
          <SkeletonLine width="84%" />
        </div>
      </section>
    );
  }

  if (state.status === "unavailable") {
    return (
      <section style={panelStyle}>
        <div style={headerStyle}>
          <div>
            <p style={eyebrowStyle}>AI Unlock Advisor</p>
            <h3 style={titleStyle}>Advisor unavailable</h3>
          </div>
        </div>
        <p style={bodyStyle}>{state.message}</p>
      </section>
    );
  }

  const { advisor } = state;

  return (
    <section style={panelStyle}>
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>AI Unlock Advisor</p>
          <h3 style={titleStyle}>Recommendation: {advisor.recommendation}</h3>
        </div>
        <span
          style={{
            ...badgeStyle,
            ...recommendationBadgeStyles[advisor.recommendation],
          }}
        >
          {advisor.recommendation}
        </span>
      </div>

      <div style={metricGridStyle}>
        <MetricCard label="Value Score" value={`${advisor.valueScore}/100`} />
        <MetricCard label="Confidence" value={`${advisor.confidence}%`} />
        <MetricCard label="Difficulty" value={advisor.difficulty} />
      </div>

      <div style={copyGridStyle}>
        <InfoBlock label="Reason" value={advisor.reason} />
        <InfoBlock label="Price Assessment" value={advisor.priceAssessment} />
        <InfoBlock label="Possible Overlap" value={advisor.possibleOverlap} />
      </div>

      <div style={bestForSectionStyle}>
        <p style={sectionLabelStyle}>Best For</p>
        <div style={pillRowStyle}>
          {advisor.bestFor.map((item) => (
            <span key={item} style={pillStyle}>
              {item}
            </span>
          ))}
        </div>
      </div>

      <div style={summaryBoxStyle}>
        <p style={sectionLabelStyle}>Agent Summary</p>
        <p style={summaryTextStyle}>{advisor.agentDecisionSummary}</p>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricCardStyle}>
      <p style={sectionLabelStyle}>{label}</p>
      <p style={metricValueStyle}>{value}</p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoBlockStyle}>
      <p style={sectionLabelStyle}>{label}</p>
      <p style={bodyStyle}>{value}</p>
    </div>
  );
}

function SkeletonBlock() {
  return <div style={skeletonBlockStyle} />;
}

function SkeletonLine({ width }: { width: string }) {
  return <div style={{ ...skeletonLineStyle, width }} />;
}

const panelStyle = {
  background: "rgba(13, 15, 17, 0.96)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 20,
  display: "grid",
  gap: 16,
} satisfies CSSProperties;

const headerStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
} satisfies CSSProperties;

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
} satisfies CSSProperties;

const titleStyle = {
  fontSize: 18,
  lineHeight: 1.3,
  color: "var(--text-primary)",
} satisfies CSSProperties;

const badgeStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  borderRadius: 999,
  padding: "7px 10px",
  border: "1px solid transparent",
} satisfies CSSProperties;

const loadingBadgeStyle = {
  ...badgeStyle,
  color: "var(--text-secondary)",
  background: "rgba(255,255,255,0.04)",
  borderColor: "var(--border)",
} satisfies CSSProperties;

const recommendationBadgeStyles: Record<
  UnlockAdvisorResult["recommendation"],
  CSSProperties
> = {
  BUY: {
    color: "var(--accent)",
    background: "rgba(0, 194, 168, 0.09)",
    borderColor: "rgba(0, 194, 168, 0.28)",
  },
  CONSIDER: {
    color: "var(--warning)",
    background: "rgba(200, 151, 42, 0.1)",
    borderColor: "rgba(200, 151, 42, 0.26)",
  },
  SKIP: {
    color: "#ff8f8f",
    background: "rgba(224, 82, 82, 0.12)",
    borderColor: "rgba(224, 82, 82, 0.24)",
  },
};

const metricGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
} satisfies CSSProperties;

const metricCardStyle = {
  border: "1px solid var(--border-subtle)",
  borderRadius: 10,
  padding: 14,
  background: "rgba(255,255,255,0.02)",
} satisfies CSSProperties;

const metricValueStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 18,
  color: "var(--text-primary)",
} satisfies CSSProperties;

const copyGridStyle = {
  display: "grid",
  gap: 12,
} satisfies CSSProperties;

const infoBlockStyle = {
  border: "1px solid var(--border-subtle)",
  borderRadius: 10,
  padding: 14,
  background: "#0d0f11",
} satisfies CSSProperties;

const sectionLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
} satisfies CSSProperties;

const bodyStyle = {
  fontSize: 13,
  color: "var(--text-secondary)",
  lineHeight: 1.7,
} satisfies CSSProperties;

const bestForSectionStyle = {
  display: "grid",
  gap: 10,
} satisfies CSSProperties;

const pillRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
} satisfies CSSProperties;

const pillStyle = {
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-secondary)",
  padding: "8px 10px",
  fontSize: 12,
  lineHeight: 1.4,
} satisfies CSSProperties;

const summaryBoxStyle = {
  borderRadius: 10,
  border: "1px solid rgba(0, 194, 168, 0.18)",
  background: "rgba(0, 194, 168, 0.06)",
  padding: 14,
} satisfies CSSProperties;

const summaryTextStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text-secondary)",
  lineHeight: 1.7,
} satisfies CSSProperties;

const skeletonBlockStyle = {
  height: 68,
  borderRadius: 10,
  border: "1px solid var(--border-subtle)",
  background:
    "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.4s ease infinite",
} satisfies CSSProperties;

const skeletonTextGroupStyle = {
  display: "grid",
  gap: 8,
} satisfies CSSProperties;

const skeletonLineStyle = {
  height: 10,
  borderRadius: 999,
  background:
    "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.4s ease infinite",
} satisfies CSSProperties;
