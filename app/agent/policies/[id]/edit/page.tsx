import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { AgentPoliciesHeader } from "@/components/agent/policies/AgentPoliciesHeader";
import { AgentPolicyForm } from "@/components/agent/policies/AgentPolicyForm";
import { getAgentOwnerFromCookieHeader } from "@/lib/auth/requireAgentOwner";
import { AgentPolicyRepository } from "@/services/agent/AgentPolicyRepository";

export const dynamic = "force-dynamic";

export default async function EditAgentPolicyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const headerStore = await headers();
  const owner = getAgentOwnerFromCookieHeader(headerStore.get("cookie"));
  const { id } = await params;

  if (!owner) {
    return (
      <Shell>
        <StatePanel
          title="Authentication required"
          copy="Connect your Circle Smart Account to edit saved agent policies."
          actionHref={`/wallet?next=/agent/policies/${id}/edit`}
          actionLabel="Connect Wallet"
        />
      </Shell>
    );
  }

  const repository = new AgentPolicyRepository();
  const policy = await repository.getPolicyForOwner(owner.ownerId, id);

  if (!policy) {
    return (
      <Shell>
        <StatePanel
          title="Policy not found"
          copy="The requested policy is not available for this owner."
          actionHref="/agent/policies"
          actionLabel="Back to policies"
        />
      </Shell>
    );
  }

  if (policy.status === "ARCHIVED") {
    return (
      <Shell>
        <StatePanel
          title="Restore before editing"
          copy="Archived policies cannot be edited until they are restored."
          actionHref="/agent/policies"
          actionLabel="Back to policies"
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <section style={panelStyle}>
        <div style={copyStyle}>
          <p style={eyebrowStyle}>Edit policy</p>
          <h2 style={titleStyle}>Update {policy.name}</h2>
          <p style={leadStyle}>
            Editing this saved policy creates a new version. Historical executions keep their original snapshot.
          </p>
        </div>
        <AgentPolicyForm mode="edit" policy={policy} initialValues={policyToFormValues(policy)} />
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div style={pageStyle}>
      <Navbar />
      <main className="page-main" style={mainStyle}>
        <AgentPoliciesHeader />
        {children}
      </main>
    </div>
  );
}

function policyToFormValues(policy: Awaited<ReturnType<AgentPolicyRepository["getPolicyForOwner"]>>) {
  if (!policy) {
    return undefined;
  }

  return {
    name: policy.name,
    description: policy.description ?? "",
    dailyBudgetUSDC: policy.dailyBudgetUSDC,
    remainingBudgetUSDC: policy.remainingBudgetUSDC,
    maxPurchaseUSDC: policy.maxPurchaseUSDC,
    minimumScore: String(policy.minimumScore),
    expiresAt: policy.expiresAt ? toDateTimeInput(policy.expiresAt) : "",
  };
}

function toDateTimeInput(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
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
