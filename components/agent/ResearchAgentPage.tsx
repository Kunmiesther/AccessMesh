"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Navbar } from "@/components/Navbar";
import { AGENT_LOADING_STAGES, DEFAULT_AGENT_FORM, DEFAULT_AGENT_RESOURCE_LIMIT, type AgentComposerFields } from "./types";
import type { AgentBudgetPolicy } from "@/services/agent/types";
import { AgentGoalForm } from "./AgentGoalForm";
import { AgentBudgetCard } from "./AgentBudgetCard";
import { AgentResultSummary } from "./AgentResultSummary";
import { CandidateComparison } from "./CandidateComparison";
import { DecisionTimeline } from "./DecisionTimeline";
import {
  getSelectedCandidateId,
  reviewSelectedCandidate,
  sanitizeAgentRunResponse,
  validateAgentComposerFields,
} from "./agentUi";
import type { AgentRuntimeResultView } from "./types";

const DEFAULT_ERROR = "The agent request could not be completed.";

export function ResearchAgentPage() {
  const [values, setValues] = useState<AgentComposerFields>(DEFAULT_AGENT_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentRuntimeResultView | null>(null);
  const [submittedPolicy, setSubmittedPolicy] = useState<AgentBudgetPolicy | null>(null);
  const selectedCandidateRef = useRef<HTMLDivElement | null>(null);

  const validation = useMemo(() => validateAgentComposerFields(values), [values]);

  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    setStageIndex(0);
    const interval = window.setInterval(() => {
      setStageIndex((current) =>
        Math.min(current + 1, AGENT_LOADING_STAGES.length - 1),
      );
    }, 650);

    return () => window.clearInterval(interval);
  }, [isRunning]);

  const visibleErrors = submitted ? validation.errors : {};
  const selectedPriceUSDC = result?.decision === "BUY" ? result.selectedResource?.priceUSDC ?? 0 : 0;
  const selectedCandidateId = result ? getSelectedCandidateId(result) : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setError(null);

    if (!validation.ok) {
      setResult(null);
      setSubmittedPolicy(null);
      return;
    }

    setIsRunning(true);
    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          goal: values.goal.trim(),
          policy: validation.policy,
          resourceLimit: DEFAULT_AGENT_RESOURCE_LIMIT,
        }),
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        throw new Error("The agent API returned an unreadable response.");
      }

      const parsed = sanitizeAgentRunResponse(payload);
      if (!parsed) {
        throw new Error("The agent API returned an unexpected response shape.");
      }

      if (!response.ok || !parsed.ok) {
        throw new Error(parsed.ok ? DEFAULT_ERROR : parsed.error);
      }

      setResult(parsed.result);
      setSubmittedPolicy(validation.policy);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : DEFAULT_ERROR);
    } finally {
      setIsRunning(false);
    }
  }

  function handleChange<K extends keyof AgentComposerFields>(
    field: K,
    value: AgentComposerFields[K],
  ) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
    setError(null);
  }

  const stageLabel = AGENT_LOADING_STAGES[stageIndex];

  return (
    <div style={pageStyle}>
      <Navbar />

      <main className="page-main" style={mainStyle}>
        <section className="agent-hero" style={heroStyle}>
          <div style={heroCopyStyle}>
            <p style={eyebrowStyle}>Research Agent</p>
            <h1 style={titleStyle}>Research Agent</h1>
            <p style={leadStyle}>
              Describe what you need. AccessMesh compares premium resources,
              checks your budget and recommends the best purchase.
            </p>
            <div style={chipRowStyle}>
              <span style={chipStyle}>Recommendation only</span>
              <span style={chipStyle}>No payment execution</span>
              <span style={chipStyle}>Scans up to 50 resources</span>
            </div>
          </div>

          <aside style={heroAsideStyle}>
            <p style={asideLabelStyle}>Current scan</p>
            <p style={asideValueStyle}>
              {submittedPolicy
                ? `${submittedPolicy.remainingBudgetUSDC} USDC budget`
                : "Ready to run"}
            </p>
            <p style={asideCopyStyle}>
              The recommendation is derived from marketplace metadata only.
            </p>
          </aside>
        </section>

        <div className="agent-layout" style={layoutStyle}>
          <div className="agent-stack" style={stackStyle}>
            <section style={panelStyle}>
              <AgentGoalForm
                values={values}
                errors={visibleErrors}
                isRunning={isRunning}
                onChange={handleChange}
                onSubmit={handleSubmit}
              />
            </section>

            {isRunning ? (
              <section
                style={loadingPanelStyle}
                aria-live="polite"
                aria-label="Agent loading stages"
              >
                <div style={loadingHeaderStyle}>
                  <div>
                    <p style={eyebrowStyle}>Running agent</p>
                    <h2 style={loadingTitleStyle}>Working through the request</h2>
                  </div>
                  <span style={loadingPillStyle}>{stageLabel}</span>
                </div>
                <ol style={stageListStyle}>
                  {AGENT_LOADING_STAGES.map((stage, index) => (
                    <li
                      key={stage}
                      style={stageItemStyle(index <= stageIndex, index === stageIndex)}
                    >
                      <span style={stageIndexStyle}>{String(index + 1).padStart(2, "0")}</span>
                      <span style={stageTextStyle}>{stage}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {error ? (
              <section style={errorPanelStyle} role="alert">
                <p style={errorTitleStyle}>Request failed</p>
                <p style={errorCopyStyle}>{error}</p>
              </section>
            ) : null}

            {result && submittedPolicy ? (
              <AgentResultSummary
                result={result}
                policy={submittedPolicy}
                onReviewPurchase={() => reviewSelectedCandidate(selectedCandidateRef.current)}
              />
            ) : (
              <section style={emptyResultStyle}>
                <p style={emptyCopyStyle}>
                  Run the agent to see a recommendation, a comparison view and a
                  decision timeline.
                </p>
              </section>
            )}

            <CandidateComparison
              candidates={result?.candidates ?? []}
              selectedCandidateId={selectedCandidateId}
              selectedCandidateRef={selectedCandidateRef}
            />

            <DecisionTimeline trace={result?.trace ?? []} />
          </div>

          <aside className="agent-sidebar" style={sidebarStyle}>
            <div className="agent-sticky" style={stickyStyle}>
              <AgentBudgetCard
                startingBudgetUSDC={
                  submittedPolicy?.remainingBudgetUSDC ??
                  (Number(values.remainingBudgetUSDC) || 0)
                }
                maximumPurchaseUSDC={
                  submittedPolicy?.maxPurchaseUSDC ??
                  (Number(values.maxPurchaseUSDC) || 0)
                }
                selectedPriceUSDC={selectedPriceUSDC}
                minimumMatchScore={
                  submittedPolicy?.minimumMatchScore ??
                  (Number(values.minimumMatchScore) || 0)
                }
              />

              <section style={policyNoteStyle}>
                <p style={policyNoteLabelStyle}>Reminder</p>
                <p style={policyNoteCopyStyle}>
                  Review purchase only scrolls to the selected result. It does
                  not execute payment or call unlock endpoints.
                </p>
              </section>

              <section style={policyNoteStyle}>
                <p style={policyNoteLabelStyle}>Marketplace scope</p>
                <p style={policyNoteCopyStyle}>
                  Active published resources are compared in the order returned by
                  the API. No protected content is exposed here.
                </p>
              </section>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(0,194,168,0.12), transparent 28%), radial-gradient(circle at top right, rgba(0,194,168,0.08), transparent 24%), var(--bg)",
} as const;

const mainStyle = {
  display: "grid",
  gap: 24,
} as const;

const heroStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.6fr)",
  gap: 20,
  alignItems: "stretch",
} as const;

const heroCopyStyle = {
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.02)",
  padding: 22,
  display: "grid",
  gap: 16,
  minWidth: 0,
} as const;

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
} as const;

const titleStyle = {
  fontSize: "clamp(34px, 5vw, 56px)",
  lineHeight: 1.05,
  color: "var(--text-primary)",
} as const;

const leadStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.75,
  fontSize: 15,
  maxWidth: 700,
} as const;

const chipRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
} as const;

const chipStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-secondary)",
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  padding: "8px 10px",
} as const;

const heroAsideStyle = {
  borderRadius: 20,
  border: "1px solid rgba(0,194,168,0.25)",
  background: "linear-gradient(180deg, rgba(0,194,168,0.1), rgba(13, 15, 17, 0.98))",
  padding: 22,
  display: "grid",
  gap: 12,
  alignContent: "start",
  minWidth: 0,
} as const;

const asideLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const asideValueStyle = {
  color: "var(--text-primary)",
  fontSize: 22,
  lineHeight: 1.25,
} as const;

const asideCopyStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  fontSize: 13,
} as const;

const layoutStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.45fr) minmax(320px, 0.75fr)",
  gap: 20,
  alignItems: "start",
} as const;

const stackStyle = {
  display: "grid",
  gap: 20,
  minWidth: 0,
} as const;

const panelStyle = {
  background: "rgba(13, 15, 17, 0.96)",
  border: "1px solid var(--border)",
  borderRadius: 18,
  padding: 20,
} as const;

const loadingPanelStyle = {
  background: "rgba(13, 15, 17, 0.96)",
  border: "1px solid var(--border)",
  borderRadius: 18,
  padding: 20,
  display: "grid",
  gap: 16,
} as const;

const loadingHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
} as const;

const loadingTitleStyle = {
  fontSize: 18,
  lineHeight: 1.3,
  color: "var(--text-primary)",
  marginTop: 6,
} as const;

const loadingPillStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  borderRadius: 999,
  border: "1px solid rgba(0,194,168,0.28)",
  background: "rgba(0,194,168,0.08)",
  padding: "7px 10px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  whiteSpace: "nowrap" as const,
} as const;

const stageListStyle = {
  listStyle: "none",
  display: "grid",
  gap: 10,
} as const;

const stageItemStyle = (completed: boolean, active: boolean) =>
  ({
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: 10,
    alignItems: "center",
    borderRadius: 14,
    border: active
      ? "1px solid rgba(0,194,168,0.45)"
      : "1px solid var(--border-subtle)",
    background: active
      ? "rgba(0,194,168,0.08)"
      : completed
        ? "rgba(255,255,255,0.03)"
        : "rgba(255,255,255,0.015)",
    padding: 14,
  }) as const;

const stageIndexStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-muted)",
  letterSpacing: "0.08em",
} as const;

const stageTextStyle = {
  color: "var(--text-primary)",
  fontSize: 14,
  lineHeight: 1.5,
} as const;

const errorPanelStyle = {
  background: "rgba(224,82,82,0.08)",
  border: "1px solid rgba(224,82,82,0.24)",
  borderRadius: 18,
  padding: 18,
  display: "grid",
  gap: 8,
} as const;

const errorTitleStyle = {
  color: "var(--error)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const errorCopyStyle = {
  color: "var(--text-primary)",
  lineHeight: 1.7,
} as const;

const emptyResultStyle = {
  background: "rgba(13, 15, 17, 0.96)",
  border: "1px solid var(--border)",
  borderRadius: 18,
  padding: 20,
} as const;

const emptyCopyStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
} as const;

const sidebarStyle = {
  minWidth: 0,
} as const;

const stickyStyle = {
  position: "sticky",
  top: 76,
  display: "grid",
  gap: 16,
  minWidth: 0,
} as const;

const policyNoteStyle = {
  background: "rgba(13, 15, 17, 0.96)",
  border: "1px solid var(--border)",
  borderRadius: 18,
  padding: 18,
  display: "grid",
  gap: 10,
} as const;

const policyNoteLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const policyNoteCopyStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  fontSize: 13,
} as const;
