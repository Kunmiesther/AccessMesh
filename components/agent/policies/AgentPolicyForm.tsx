"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AgentPolicyDetail, AgentPolicyInput } from "@/services/agent/AgentPolicyTypes";
import {
  validateAgentPolicyCreateInput,
  validateAgentPolicyUpdateInput,
  type AgentPolicyValidationErrors,
} from "@/services/agent/AgentPolicyValidation";

export type AgentPolicyFormValues = Readonly<{
  name: string;
  description: string;
  dailyBudgetUSDC: string;
  remainingBudgetUSDC: string;
  maxPurchaseUSDC: string;
  minimumScore: string;
  expiresAt: string;
}>;

const DEFAULT_VALUES: AgentPolicyFormValues = {
  name: "",
  description: "",
  dailyBudgetUSDC: "0",
  remainingBudgetUSDC: "0",
  maxPurchaseUSDC: "0",
  minimumScore: "70",
  expiresAt: "",
};

export function AgentPolicyForm({
  mode,
  initialValues,
  policy,
}: {
  mode: "create" | "edit";
  initialValues?: Partial<AgentPolicyFormValues>;
  policy?: AgentPolicyDetail;
}) {
  const router = useRouter();
  const [values, setValues] = useState<AgentPolicyFormValues>({
    ...DEFAULT_VALUES,
    ...initialValues,
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AgentPolicyFormValues, string>>>({});
  const [rootError, setRootError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);

  const policySummary = useMemo(
    () =>
      policy
        ? {
            id: policy.id,
            name: policy.name,
            description: policy.description,
            status: policy.status,
            isDefault: policy.isDefault,
            version: policy.version,
            dailyBudgetUSDC: policy.dailyBudgetUSDC,
            remainingBudgetUSDC: policy.remainingBudgetUSDC,
            maxPurchaseUSDC: policy.maxPurchaseUSDC,
            minimumScore: policy.minimumScore,
            manualApprovalRequired: policy.manualApprovalRequired,
            expiresAt: policy.expiresAt,
            createdAt: policy.createdAt,
            updatedAt: policy.updatedAt,
            archivedAt: policy.archivedAt,
          }
        : null,
    [policy],
  );

  function updateField<K extends keyof AgentPolicyFormValues>(field: K, value: AgentPolicyFormValues[K]) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setRootError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRootError(null);
    setSavedVersion(null);

    const validation =
      mode === "create"
        ? validateAgentPolicyCreateInput(values)
        : validateAgentPolicyUpdateInput(
            {
              ...values,
              expectedVersion: policy?.version ?? 1,
            },
            policySummary ?? {
              id: "policy",
              name: values.name,
              description: values.description || null,
              status: "ACTIVE",
              isDefault: false,
              version: policy?.version ?? 1,
              dailyBudgetUSDC: values.dailyBudgetUSDC,
              remainingBudgetUSDC: values.remainingBudgetUSDC,
              maxPurchaseUSDC: values.maxPurchaseUSDC,
              minimumScore: Number(values.minimumScore) || 0,
              manualApprovalRequired: true,
              expiresAt: values.expiresAt || null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              archivedAt: null,
            },
          );

    if (!validation.ok) {
      setFieldErrors(validation.errors as Partial<Record<keyof AgentPolicyFormValues, string>>);
      setRootError(validation.errors.root ?? "Please fix the policy fields and try again.");
      return;
    }

    const payload: AgentPolicyInput & { expectedVersion?: number } = {
      name: (mode === "create"
        ? validation.value.name
        : validation.value.name ?? values.name.trim()) as string,
      description: validation.value.description,
      dailyBudgetUSDC: String(validation.value.dailyBudgetUSDC),
      remainingBudgetUSDC: String(validation.value.remainingBudgetUSDC),
      maxPurchaseUSDC: String(validation.value.maxPurchaseUSDC),
      minimumScore: String(validation.value.minimumScore),
      expiresAt: validation.value.expiresAt ?? null,
      manualApprovalRequired: true,
      ...(mode === "edit" && policy ? { expectedVersion: policy.version } : {}),
    };

    setIsSubmitting(true);

    try {
      const response = await fetch(
        mode === "create" ? "/api/agent/policies" : `/api/agent/policies/${policy?.id ?? ""}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; policy?: { version?: number }; error?: { message?: string } | string }
        | null;

      if (!response.ok || !result?.ok) {
        const message =
          typeof result?.error === "string"
            ? result.error
            : result?.error?.message ?? "The policy could not be saved.";
        throw new Error(message);
      }

      setSavedVersion(result.policy?.version ?? null);
      if (mode === "create") {
        router.push("/agent/policies");
      } else {
        router.refresh();
      }
    } catch (submitError) {
      setRootError(submitError instanceof Error ? submitError.message : "The policy could not be saved.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <div style={fieldGroupStyle}>
        <label htmlFor="policy-name" style={labelStyle}>
          Policy name
        </label>
        <input
          id="policy-name"
          name="name"
          value={values.name}
          onChange={(event) => updateField("name", event.target.value)}
          style={inputStyle}
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? "policy-name-error" : undefined}
        />
        {fieldErrors.name ? (
          <p id="policy-name-error" style={errorStyle}>{fieldErrors.name}</p>
        ) : null}
      </div>

      <div style={fieldGroupStyle}>
        <label htmlFor="policy-description" style={labelStyle}>
          Description
        </label>
        <textarea
          id="policy-description"
          name="description"
          value={values.description}
          onChange={(event) => updateField("description", event.target.value)}
          rows={4}
          style={textareaStyle}
          aria-invalid={Boolean(fieldErrors.description)}
          aria-describedby={fieldErrors.description ? "policy-description-error" : undefined}
        />
        {fieldErrors.description ? (
          <p id="policy-description-error" style={errorStyle}>{fieldErrors.description}</p>
        ) : (
          <p style={helperStyle}>Optional short label for remembering why this policy exists.</p>
        )}
      </div>

      <div className="agent-goal-grid" style={gridStyle}>
        <Field
          id="policy-daily-budget"
          label="Daily budget"
          value={values.dailyBudgetUSDC}
          onChange={(value) => updateField("dailyBudgetUSDC", value)}
          error={fieldErrors.dailyBudgetUSDC}
        />
        <Field
          id="policy-remaining-budget"
          label="Remaining budget"
          value={values.remainingBudgetUSDC}
          onChange={(value) => updateField("remainingBudgetUSDC", value)}
          error={fieldErrors.remainingBudgetUSDC}
        />
        <Field
          id="policy-max-purchase"
          label="Maximum purchase"
          value={values.maxPurchaseUSDC}
          onChange={(value) => updateField("maxPurchaseUSDC", value)}
          error={fieldErrors.maxPurchaseUSDC}
        />
        <Field
          id="policy-minimum-score"
          label="Minimum score"
          value={values.minimumScore}
          onChange={(value) => updateField("minimumScore", value)}
          error={fieldErrors.minimumScore}
          step="1"
          min="0"
          max="100"
        />
        <Field
          id="policy-expires-at"
          label="Expiration"
          value={values.expiresAt}
          onChange={(value) => updateField("expiresAt", value)}
          error={fieldErrors.expiresAt}
          type="datetime-local"
          min={toLocalDateTimeInput(new Date().toISOString())}
        />
      </div>

      <div style={approvalRowStyle}>
        <label style={approvalLabelStyle}>
          <input type="checkbox" checked readOnly />
          <span>Manual approval required</span>
        </label>
        <p style={approvalCopyStyle}>
          Saved policies always require owner approval in this sprint.
        </p>
      </div>

      <div style={footerStyle}>
        <p style={noteStyle}>
          {mode === "create"
            ? "Create a reusable policy for future agent runs."
            : `Editing version ${policy?.version ?? 1}. Historical executions keep their original snapshot.`}
        </p>
        <button type="submit" disabled={isSubmitting} style={buttonStyle}>
          {isSubmitting
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
              ? "Create policy"
              : "Save changes"}
        </button>
      </div>

      {rootError ? (
        <p role="alert" style={rootErrorStyle}>
          {rootError}
        </p>
      ) : null}

      {savedVersion ? (
        <p aria-live="polite" style={successStyle}>
          Saved as version {savedVersion}.
        </p>
      ) : null}
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  step = "0.01",
  min = "0",
  max,
  type = "number",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  step?: string;
  min?: string;
  max?: string;
  type?: "number" | "datetime-local";
}) {
  return (
    <div style={fieldGroupStyle}>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        style={inputStyle}
      />
      {error ? (
        <p id={`${id}-error`} style={errorStyle}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function toLocalDateTimeInput(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - offset);
  return local.toISOString().slice(0, 16);
}

const formStyle = {
  display: "grid",
  gap: 18,
} as const;

const fieldGroupStyle = {
  display: "grid",
  gap: 8,
  minWidth: 0,
} as const;

const labelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--text-secondary)",
} as const;

const inputStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "#0d0f11",
  color: "var(--text-primary)",
  padding: "12px 14px",
  fontSize: 14,
  outline: "none",
} as const;

const textareaStyle = {
  ...inputStyle,
  resize: "vertical" as const,
  minHeight: 120,
  lineHeight: 1.7,
} as const;

const helperStyle = {
  color: "var(--text-muted)",
  fontSize: 12,
  lineHeight: 1.6,
} as const;

const errorStyle = {
  color: "var(--error)",
  fontSize: 12,
  lineHeight: 1.6,
} as const;

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
} as const;

const approvalRowStyle = {
  display: "grid",
  gap: 8,
  borderRadius: 14,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 14,
} as const;

const approvalLabelStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--text-primary)",
} as const;

const approvalCopyStyle = {
  color: "var(--text-muted)",
  fontSize: 12,
  lineHeight: 1.6,
} as const;

const footerStyle = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
} as const;

const noteStyle = {
  flex: "1 1 260px",
  color: "var(--text-secondary)",
  fontSize: 12,
  lineHeight: 1.6,
} as const;

const buttonStyle = {
  minWidth: 160,
  borderRadius: 12,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "#000",
  padding: "12px 18px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
} as const;

const rootErrorStyle = {
  color: "var(--error)",
  fontSize: 13,
  lineHeight: 1.6,
} as const;

const successStyle = {
  color: "var(--success)",
  fontSize: 13,
  lineHeight: 1.6,
} as const;
