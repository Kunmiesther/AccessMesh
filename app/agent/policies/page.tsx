import Link from "next/link";
import { headers } from "next/headers";
import { Navbar } from "@/components/Navbar";
import { AgentPoliciesHeader } from "@/components/agent/policies/AgentPoliciesHeader";
import { AgentPolicyEmptyState } from "@/components/agent/policies/AgentPolicyEmptyState";
import { AgentPolicyList } from "@/components/agent/policies/AgentPolicyList";
import { AgentPolicyTemplatePicker } from "@/components/agent/policies/AgentPolicyTemplatePicker";
import { getAgentOwnerFromCookieHeader } from "@/lib/auth/requireAgentOwner";
import { AgentPolicyRepository } from "@/services/agent/AgentPolicyRepository";

export const dynamic = "force-dynamic";

export default async function AgentPoliciesPage() {
  const headerStore = await headers();
  const cookieHeader = headerStore.get("cookie");
  const owner = getAgentOwnerFromCookieHeader(cookieHeader);

  return (
    <div style={pageStyle}>
      <Navbar />
      <main className="page-main" style={mainStyle}>
        <AgentPoliciesHeader />

        {!owner ? (
          <StatePanel
            title="Authentication required"
            copy="Connect your Circle Smart Account to view saved agent policies."
            actionHref="/wallet?next=/agent/policies"
            actionLabel="Connect Wallet"
          />
        ) : (
          <PoliciesContent ownerId={owner.ownerId} />
        )}
      </main>
    </div>
  );
}

async function PoliciesContent({ ownerId }: { ownerId: string }) {
  const repository = new AgentPolicyRepository();
  await repository.getDefaultPolicyForOwner(ownerId);
  const policies = await repository.listPoliciesForOwner(ownerId);

  return (
    <div style={stackStyle}>
      <AgentPolicyTemplatePicker />
      {policies.length > 0 ? <AgentPolicyList policies={policies} /> : <AgentPolicyEmptyState />}
    </div>
  );
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

const stackStyle = {
  display: "grid",
  gap: 20,
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

