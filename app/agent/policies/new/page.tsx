import Link from "next/link";
import { headers } from "next/headers";
import { Navbar } from "@/components/Navbar";
import { AgentPoliciesHeader } from "@/components/agent/policies/AgentPoliciesHeader";
import { AgentPolicyForm } from "@/components/agent/policies/AgentPolicyForm";
import { AGENT_POLICY_TEMPLATES, type AgentPolicyTemplateId } from "@/services/agent/AgentPolicyTypes";
import { getAgentOwnerFromCookieHeader } from "@/lib/auth/requireAgentOwner";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function NewAgentPolicyPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const headerStore = await headers();
  const owner = getAgentOwnerFromCookieHeader(headerStore.get("cookie"));
  const templateId = firstValue(searchParams?.template);
  const template = templateId ? AGENT_POLICY_TEMPLATES[templateId as AgentPolicyTemplateId] : null;

  return (
    <div style={pageStyle}>
      <Navbar />
      <main className="page-main" style={mainStyle}>
        <AgentPoliciesHeader />

        {!owner ? (
          <StatePanel
            title="Authentication required"
            copy="Connect your Circle Smart Account to create a saved agent policy."
            actionHref="/wallet?next=/agent/policies/new"
            actionLabel="Connect Wallet"
          />
        ) : templateId && !template ? (
          <StatePanel
            title="Invalid template"
            copy="The selected policy template is not available."
            actionHref="/agent/policies"
            actionLabel="Back to policies"
          />
        ) : (
          <section style={panelStyle}>
            <div style={copyStyle}>
              <p style={eyebrowStyle}>Create policy</p>
              <h2 style={titleStyle}>Start a reusable policy</h2>
              <p style={leadStyle}>
                Manual approval stays required. Historical executions keep the values they used at runtime.
              </p>
            </div>
            <AgentPolicyForm
              mode="create"
              initialValues={template ? buildTemplateValues(templateId as AgentPolicyTemplateId) : undefined}
            />
          </section>
        )}
      </main>
    </div>
  );
}

function buildTemplateValues(templateId: AgentPolicyTemplateId) {
  const template = AGENT_POLICY_TEMPLATES[templateId];

  return {
    name: template.name,
    description: template.description,
    dailyBudgetUSDC: template.dailyBudgetUSDC,
    remainingBudgetUSDC: template.remainingBudgetUSDC,
    maxPurchaseUSDC: template.maxPurchaseUSDC,
    minimumScore: String(template.minimumScore),
    expiresAt: "",
  };
}

function StatePanel({
  title,
  copy,
  actionHref,
  actionLabel,
}: {
  title: string;
  copy: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <section style={statePanelStyle}>
      <h2 style={stateTitleStyle}>{title}</h2>
      <p style={stateCopyStyle}>{copy}</p>
      <Link href={actionHref} style={actionStyle}>
        {actionLabel}
      </Link>
    </section>
  );
}

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

const pageStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(0,194,168,0.12), transparent 28%), radial-gradient(circle at top right, rgba(0,194,168,0.08), transparent 24%), var(--bg)",
} as const;

const mainStyle = {
  display: "grid",
  gap: 20,
} as const;

const panelStyle = {
  display: "grid",
  gap: 16,
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 20,
} as const;

const copyStyle = {
  display: "grid",
  gap: 10,
} as const;

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
} as const;

const titleStyle = {
  fontSize: 18,
  lineHeight: 1.3,
  color: "var(--text-primary)",
} as const;

const leadStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  fontSize: 14,
  maxWidth: 760,
} as const;

const statePanelStyle = {
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 22,
  display: "grid",
  gap: 12,
} as const;

const stateTitleStyle = {
  fontSize: 20,
  lineHeight: 1.25,
  color: "var(--text-primary)",
} as const;

const stateCopyStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  fontSize: 14,
} as const;

const actionStyle = {
  width: "fit-content",
  borderRadius: 12,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "#000",
  padding: "11px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  textDecoration: "none",
} as const;
