"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Navbar } from "@/components/Navbar";
import { formatDateTime, formatUSDC } from "@/lib/ui";
import { AGENT_LOADING_STAGES, DEFAULT_AGENT_FORM, DEFAULT_AGENT_RESOURCE_LIMIT, type AgentComposerFields } from "./types";
import type { AgentBudgetPolicy } from "@/services/agent/types";
import { AgentGoalForm } from "./AgentGoalForm";
import { AgentBudgetCard } from "./AgentBudgetCard";
import { AgentResultSummary } from "./AgentResultSummary";
import { CandidateComparison } from "./CandidateComparison";
import { DecisionTimeline } from "./DecisionTimeline";
import { AgentPurchaseReview } from "./AgentPurchaseReview";
import {
  canReviewAgentPurchase,
  getSelectedCandidateId,
  sanitizeAgentRunResponse,
  validateAgentComposerFields,
} from "./agentUi";
import type { AgentPurchaseCompletionView, AgentRuntimeResultView } from "./types";
import { useAgentOwnerSession } from "@/hooks/useAgentOwnerSession";
import type { AgentPolicyRunOverrides, AgentPolicySummary } from "@/services/agent/AgentPolicyTypes";
import { validateAgentPolicyRunOverrides } from "@/services/agent/AgentPolicyValidation";

const DEFAULT_ERROR = "The agent request could not be completed.";

export function ResearchAgentPage() {
  const [values, setValues] = useState<AgentComposerFields>(DEFAULT_AGENT_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentRuntimeResultView | null>(null);
  const [submittedPolicy, setSubmittedPolicy] = useState<AgentBudgetPolicy | null>(null);
  const [availablePolicies, setAvailablePolicies] = useState<AgentPolicySummary[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>("");
  const [policyOverrides, setPolicyOverrides] = useState<AgentPolicyRunOverrides>({
    remainingBudgetUSDC: "",
    maxPurchaseUSDC: "",
    minimumScore: "",
  });
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [purchaseReviewOpen, setPurchaseReviewOpen] = useState(false);
  const [purchaseCompletion, setPurchaseCompletion] =
    useState<AgentPurchaseCompletionView | null>(null);
  const selectedCandidateRef = useRef<HTMLDivElement | null>(null);
  const { status: ownerSessionStatus, ensureAgentOwnerSession } = useAgentOwnerSession();

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

  useEffect(() => {
    let cancelled = false;

    if (ownerSessionStatus === "unauthenticated") {
      setAvailablePolicies([]);
      setSelectedPolicyId("");
      setPolicyOverrides({
        remainingBudgetUSDC: "",
        maxPurchaseUSDC: "",
        minimumScore: "",
      });
      setPolicyLoading(false);
      setPolicyError(null);
      return undefined;
    }

    if (ownerSessionStatus !== "authenticated") {
      return undefined;
    }

    async function loadPolicies() {
      setPolicyLoading(true);
      setPolicyError(null);

      try {
        const response = await fetch("/api/agent/policies", {
          headers: {
            "content-type": "application/json",
          },
        });

        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              policies?: AgentPolicySummary[];
              defaultPolicyId?: string | null;
              error?: { message?: string } | string;
            }
          | null;

        if (!response.ok || !payload?.ok || !Array.isArray(payload.policies)) {
          const message =
            typeof payload?.error === "string"
              ? payload.error
              : payload?.error?.message ?? "Saved policies could not be loaded.";
          throw new Error(message);
        }

        if (cancelled) {
          return;
        }

        const policies = payload.policies ?? [];
        setAvailablePolicies(policies);

        const activePolicies = policies.filter((policy) => policy.status === "ACTIVE");
        const defaultPolicyId =
          payload.defaultPolicyId ??
          policies.find((policy) => policy.isDefault)?.id ??
          activePolicies[0]?.id ??
          "";

        setSelectedPolicyId((current) => {
          if (current && policies.some((policy) => policy.id === current)) {
            return current;
          }

          return defaultPolicyId;
        });
      } catch (loadError) {
        if (!cancelled) {
          setPolicyError(loadError instanceof Error ? loadError.message : "Saved policies could not be loaded.");
          setAvailablePolicies([]);
          setSelectedPolicyId("");
        }
      } finally {
        if (!cancelled) {
          setPolicyLoading(false);
        }
      }
    }

    void loadPolicies();

    return () => {
      cancelled = true;
    };
  }, [ownerSessionStatus]);

  const visibleErrors = submitted ? validation.errors : {};
  const activePolicies = useMemo(
    () => availablePolicies.filter((policy) => policy.status === "ACTIVE"),
    [availablePolicies],
  );
  const selectedPolicy = useMemo(() => {
    if (selectedPolicyId) {
      const exactMatch = availablePolicies.find((policy) => policy.id === selectedPolicyId);
      if (exactMatch) {
        return exactMatch;
      }
    }

    return activePolicies.find((policy) => policy.isDefault) ?? activePolicies[0] ?? null;
  }, [activePolicies, availablePolicies, selectedPolicyId]);
  const selectedPriceUSDC = result?.decision === "BUY" ? result.selectedResource?.priceUSDC ?? 0 : 0;
  const selectedCandidateId = result ? getSelectedCandidateId(result) : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setError(null);
    setPolicyError(null);
    setPurchaseReviewOpen(false);
    setPurchaseCompletion(null);

    if (!validation.ok) {
      setResult(null);
      setSubmittedPolicy(null);
      return;
    }

    try {
      await ensureAgentOwnerSession();
      setIsRunning(true);

      const overrideInput = buildPolicyOverrideInput(policyOverrides);
      let validatedOverrides: AgentPolicyRunOverrides | undefined;

      if (selectedPolicy && Object.keys(overrideInput).length > 0) {
        const overrideValidation = validateAgentPolicyRunOverrides(
          overrideInput,
          selectedPolicy,
        );

        if (!overrideValidation.ok) {
          setPolicyError(
            Object.values(overrideValidation.errors).filter(Boolean).join("; ") ||
              "Policy overrides could not be applied.",
          );
          return;
        }

        validatedOverrides = overrideValidation.value;
      } else if (Object.keys(overrideInput).length > 0) {
        validatedOverrides = overrideInput as AgentPolicyRunOverrides;
      }

      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          goal: values.goal.trim(),
          selectedPolicyId: selectedPolicy?.id ?? undefined,
          policyOverrides: validatedOverrides,
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

      setResult({
        ...parsed.result,
        executionId: parsed.executionId,
      });
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

  function handleOpenReview() {
    if (!canReviewAgentPurchase(result)) {
      return;
    }

    setPurchaseReviewOpen(true);
  }

  function handleCloseReview() {
    setPurchaseReviewOpen(false);
  }

  function handlePurchaseComplete(completion: AgentPurchaseCompletionView) {
    setPurchaseCompletion(completion);
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
            <div style={heroActionRowStyle}>
              <Link href="/agent/history" style={secondaryActionButtonStyle}>
                View agent history
              </Link>
              <Link href="/agent/inbox" style={secondaryActionButtonStyle}>
                View inbox
              </Link>
              <Link href="/agent/notifications" style={secondaryActionButtonStyle}>
                View notifications
              </Link>
              <Link href="/agent/analytics" style={secondaryActionButtonStyle}>
                View analytics
              </Link>
              <Link href="/agent/policies" style={secondaryActionButtonStyle}>
                View policies
              </Link>
              <Link href="/agent/budgets" style={secondaryActionButtonStyle}>
                View budgets
              </Link>
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
                onReviewPurchase={handleOpenReview}
                purchaseCompletion={purchaseCompletion}
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

              <section style={policyPanelStyle}>
                <div style={policyPanelHeaderStyle}>
                  <div>
                    <p style={policyPanelEyebrowStyle}>Saved policy</p>
                    <h2 style={policyPanelTitleStyle}>Research Agent policy</h2>
                  </div>
                  <Link href="/agent/policies" style={policyPanelLinkStyle}>
                    Manage policies
                  </Link>
                </div>

                {policyLoading ? <p style={policyPanelCopyStyle}>Loading saved policies...</p> : null}
                {policyError ? <p style={policyPanelErrorStyle}>{policyError}</p> : null}

                <label style={policyFieldStyle}>
                  <span style={policyLabelStyle}>Selected policy</span>
                  <select
                    value={selectedPolicyId}
                    onChange={(event) => setSelectedPolicyId(event.target.value)}
                    disabled={policyLoading || activePolicies.length === 0}
                    style={policySelectStyle}
                  >
                    <option value="">Use default policy</option>
                    {activePolicies.map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy.isDefault ? `${policy.name} (default)` : policy.name}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedPolicy ? (
                  <dl style={policyDetailsGridStyle}>
                    <PolicyMetric label="Status" value={selectedPolicy.status === "ACTIVE" ? "Active" : "Archived"} />
                    <PolicyMetric label="Version" value={`v${selectedPolicy.version}`} />
                    <PolicyMetric label="Daily budget" value={formatUSDC(Number(selectedPolicy.dailyBudgetUSDC))} />
                    <PolicyMetric label="Remaining budget" value={formatUSDC(Number(selectedPolicy.remainingBudgetUSDC))} />
                    <PolicyMetric label="Maximum purchase" value={formatUSDC(Number(selectedPolicy.maxPurchaseUSDC))} />
                    <PolicyMetric label="Minimum score" value={`${selectedPolicy.minimumScore}/100`} />
                    <PolicyMetric
                      label="Expiration"
                      value={selectedPolicy.expiresAt ? formatDateTime(selectedPolicy.expiresAt) : "None"}
                    />
                  </dl>
                ) : (
                  <p style={policyPanelCopyStyle}>
                    A default policy will be used if none is selected yet.
                  </p>
                )}

                <div style={policyOverrideGridStyle}>
                  <OverrideField
                    id="policy-override-remaining"
                    label="Run remaining budget"
                    value={String(policyOverrides.remainingBudgetUSDC ?? "")}
                    disabled={!selectedPolicy || policyLoading}
                    onChange={(value) =>
                      setPolicyOverrides((current) => ({
                        ...current,
                        remainingBudgetUSDC: value,
                      }))
                    }
                  />
                  <OverrideField
                    id="policy-override-max-purchase"
                    label="Run maximum purchase"
                    value={String(policyOverrides.maxPurchaseUSDC ?? "")}
                    disabled={!selectedPolicy || policyLoading}
                    onChange={(value) =>
                      setPolicyOverrides((current) => ({
                        ...current,
                        maxPurchaseUSDC: value,
                      }))
                    }
                  />
                  <OverrideField
                    id="policy-override-minimum-score"
                    label="Run minimum score"
                    value={String(policyOverrides.minimumScore ?? "")}
                    disabled={!selectedPolicy || policyLoading}
                    onChange={(value) =>
                      setPolicyOverrides((current) => ({
                        ...current,
                        minimumScore: value,
                      }))
                    }
                    step="1"
                    min="0"
                    max="100"
                  />
                </div>

                <p style={policyPanelCopyStyle}>
                  Per-run overrides can only make the policy more restrictive. Manual approval stays required.
                </p>
              </section>

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

        <AgentPurchaseReview
          open={purchaseReviewOpen}
          result={result}
          policy={submittedPolicy}
          onClose={handleCloseReview}
          onPurchaseComplete={handlePurchaseComplete}
        />
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

const heroActionRowStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
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

const secondaryActionButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-secondary)",
  padding: "10px 14px",
  textDecoration: "none",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
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

const policyPanelStyle = {
  background: "rgba(13, 15, 17, 0.96)",
  border: "1px solid var(--border)",
  borderRadius: 18,
  padding: 18,
  display: "grid",
  gap: 14,
} as const;

const policyPanelHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
} as const;

const policyPanelEyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 6,
} as const;

const policyPanelTitleStyle = {
  color: "var(--text-primary)",
  fontSize: 15,
  lineHeight: 1.35,
} as const;

const policyPanelLinkStyle = {
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-secondary)",
  padding: "8px 10px",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textDecoration: "none",
  whiteSpace: "nowrap" as const,
} as const;

const policyPanelCopyStyle = {
  color: "var(--text-secondary)",
  fontSize: 12,
  lineHeight: 1.6,
} as const;

const policyPanelErrorStyle = {
  color: "var(--error)",
  fontSize: 12,
  lineHeight: 1.6,
} as const;

const policyFieldStyle = {
  display: "grid",
  gap: 8,
} as const;

const policyLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const policySelectStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "#0d0f11",
  color: "var(--text-primary)",
  padding: "11px 12px",
  fontSize: 14,
  outline: "none",
} as const;

const policyDetailsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 10,
} as const;

const policyMetricStyle = {
  borderRadius: 12,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 12,
  minWidth: 0,
} as const;

const policyMetricLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 6,
} as const;

const policyMetricValueStyle = {
  color: "var(--text-primary)",
  fontSize: 13,
  lineHeight: 1.5,
  overflowWrap: "anywhere" as const,
} as const;

const policyOverrideGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
} as const;

function PolicyMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={policyMetricStyle}>
      <p style={policyMetricLabelStyle}>{label}</p>
      <p style={policyMetricValueStyle}>{value}</p>
    </div>
  );
}

function OverrideField({
  id,
  label,
  value,
  onChange,
  disabled = false,
  step = "0.01",
  min = "0",
  max,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  step?: string;
  min?: string;
  max?: string;
}) {
  return (
    <label style={policyFieldStyle}>
      <span style={policyLabelStyle}>{label}</span>
      <input
        id={id}
        name={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={policySelectStyle}
      />
    </label>
  );
}

function buildPolicyOverrideInput(values: AgentPolicyRunOverrides) {
  const input: Record<string, unknown> = {};

  if (values.remainingBudgetUSDC !== undefined && values.remainingBudgetUSDC !== "") {
    input.remainingBudgetUSDC = values.remainingBudgetUSDC;
  }

  if (values.maxPurchaseUSDC !== undefined && values.maxPurchaseUSDC !== "") {
    input.maxPurchaseUSDC = values.maxPurchaseUSDC;
  }

  if (values.minimumScore !== undefined && values.minimumScore !== "") {
    input.minimumScore = values.minimumScore;
  }

  return input;
}
