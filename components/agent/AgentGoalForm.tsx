"use client";

import type { FormEvent } from "react";
import type { AgentComposerFields } from "./types";

export function AgentGoalForm({
  values,
  errors,
  isRunning,
  onChange,
  onSubmit,
}: {
  values: AgentComposerFields;
  errors: Partial<Record<keyof AgentComposerFields, string>>;
  isRunning: boolean;
  onChange: <K extends keyof AgentComposerFields>(
    field: K,
    value: AgentComposerFields[K],
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} style={formStyle}>
      <div style={fieldGroupStyle}>
        <label htmlFor="agent-goal" style={labelStyle}>
          Goal
        </label>
        <textarea
          id="agent-goal"
          name="goal"
          value={values.goal}
          onChange={(event) => onChange("goal", event.target.value)}
          placeholder="Find the best Circle CCTP implementation guide under 0.20 USDC"
          rows={6}
          aria-invalid={Boolean(errors.goal)}
          aria-describedby={errors.goal ? "agent-goal-error" : undefined}
          style={textareaStyle}
        />
        {errors.goal ? (
          <p id="agent-goal-error" style={errorStyle}>
            {errors.goal}
          </p>
        ) : (
          <p style={helperStyle}>
            Describe the research task in plain language. The agent compares
            active published marketplace resources only.
          </p>
        )}
      </div>

      <div className="agent-goal-grid" style={gridStyle}>
        <Field
          id="agent-remaining-budget"
          label="Remaining budget"
          value={values.remainingBudgetUSDC}
          onChange={(value) => onChange("remainingBudgetUSDC", value)}
          error={errors.remainingBudgetUSDC}
        />
        <Field
          id="agent-max-purchase"
          label="Maximum single purchase"
          value={values.maxPurchaseUSDC}
          onChange={(value) => onChange("maxPurchaseUSDC", value)}
          error={errors.maxPurchaseUSDC}
        />
        <Field
          id="agent-match-score"
          label="Minimum match score"
          value={values.minimumMatchScore}
          onChange={(value) => onChange("minimumMatchScore", value)}
          error={errors.minimumMatchScore}
          step="1"
          min="0"
          max="100"
        />
      </div>

      <div style={footerStyle}>
        <p style={noteStyle}>
          The agent scans up to 50 active published resources and returns a
          recommendation only. It does not execute payment.
        </p>
        <button type="submit" disabled={isRunning} style={buttonStyle}>
          {isRunning ? "Running agent..." : "Run Agent"}
        </button>
      </div>
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
  min = "0.01",
  max,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  step?: string;
  min?: string;
  max?: string;
}) {
  return (
    <div style={fieldGroupStyle}>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="number"
        inputMode="decimal"
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
  minHeight: 180,
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
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
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
