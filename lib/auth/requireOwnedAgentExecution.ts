import { getAddress } from "viem";
import { prisma } from "@/lib/prisma";
import { AgentExecutionRepository } from "@/services/agent/AgentExecutionRepository";
import { getAgentOwnerFromRequest } from "./requireAgentOwner";

type OwnedAgentExecutionDeps = {
  getAgentOwnerWalletByExecution?: (executionId: string) => Promise<string | null>;
};

export async function getOwnedAgentExecution(
  request: Request,
  executionId: string,
  executionRepository = new AgentExecutionRepository(),
  deps: OwnedAgentExecutionDeps = {},
) {
  const owner = getAgentOwnerFromRequest(request);
  if (!owner) {
    return null;
  }

  const execution = await executionRepository.getExecutionById(executionId);
  if (!execution) {
    return null;
  }

  const agentWallet =
    (await deps.getAgentOwnerWalletByExecution?.(executionId)) ??
    (await getAgentWalletByExecution(execution.agentId));

  if (!agentWallet) {
    return null;
  }

  if (getAddress(agentWallet) !== getAddress(owner.walletAddress)) {
    return null;
  }

  return {
    owner,
    execution,
  };
}

async function getAgentWalletByExecution(agentId: string) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { ownerWallet: true },
  });

  return agent?.ownerWallet ?? null;
}
