import Link from "next/link";
import { headers } from "next/headers";
import { getAddress } from "viem";
import { Navbar } from "@/components/Navbar";
import { AgentExecutionDetailPanel } from "@/components/agent/history/AgentExecutionDetailView";
import { getAgentOwnerFromCookieHeader } from "@/lib/auth/requireAgentOwner";
import { prisma } from "@/lib/prisma";
import { AgentApprovalRepository } from "@/services/agent/AgentApprovalRepository";
import { AgentExecutionRepository } from "@/services/agent/AgentExecutionRepository";
import { buildAgentExecutionDetailView } from "@/services/agent/AgentExecutionViews";

export const dynamic = "force-dynamic";

export default async function AgentExecutionPage({
  params,
}: {
  params: { id: string };
}) {
  const headerStore = await headers();
  const owner = getAgentOwnerFromCookieHeader(headerStore.get("cookie"));
  const executionId = params.id?.trim();

  return (
    <div style={pageStyle}>
      <Navbar />
      <main className="page-main" style={mainStyle}>
        {!owner ? (
          <StatePanel
            title="Authentication required"
            copy="Connect your Circle Smart Account to view execution details."
            actionHref="/wallet?next=/agent/history"
            actionLabel="Connect Wallet"
          />
        ) : !executionId ? (
          <StatePanel
            title="Malformed execution ID"
            copy="The requested execution identifier is invalid."
            actionHref="/agent/history"
            actionLabel="Back to history"
          />
        ) : (
          <ExecutionContent
            ownerId={owner.ownerId}
            ownerWallet={owner.walletAddress}
            executionId={executionId}
          />
        )}
      </main>
    </div>
  );
}

async function ExecutionContent({
  ownerId,
  ownerWallet,
  executionId,
}: {
  ownerId: string;
  ownerWallet: string;
  executionId: string;
}) {
  const repository = new AgentExecutionRepository();
  const execution = await repository.getExecutionById(executionId);

  if (!execution) {
    return (
      <StatePanel
        title="Execution not found"
        copy="No execution record was found for this identifier."
        actionHref="/agent/history"
        actionLabel="Back to history"
      />
    );
  }

  const agent = await prisma.agent.findUnique({
    where: { id: execution.agentId },
    select: { ownerWallet: true },
  });

  if (!agent || !sameAddress(agent.ownerWallet, ownerWallet)) {
    return (
      <StatePanel
        title="No access"
        copy="This execution is not available to the connected owner."
        actionHref="/agent/history"
        actionLabel="Back to history"
      />
    );
  }

  const approval = await new AgentApprovalRepository().getApprovalForExecution(
    ownerId,
    executionId,
  );

  return <AgentExecutionDetailPanel execution={buildAgentExecutionDetailView(execution, approval)} />;
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
      <h1 style={stateTitleStyle}>{title}</h1>
      <p style={stateCopyStyle}>{copy}</p>
      <Link href={actionHref} style={actionStyle}>
        {actionLabel}
      </Link>
    </section>
  );
}

function sameAddress(left: string, right: string) {
  try {
    return getAddress(left) === getAddress(right);
  } catch {
    return left.toLowerCase() === right.toLowerCase();
  }
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

const statePanelStyle = {
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 22,
  display: "grid",
  gap: 12,
} as const;

const stateTitleStyle = {
  fontSize: 22,
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
