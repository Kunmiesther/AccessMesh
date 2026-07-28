import type { AgentPolicyStatus, AgentPolicyTemplateId } from "@/services/agent/AgentPolicyTypes";
import { AGENT_POLICY_TEMPLATES } from "@/services/agent/AgentPolicyTypes";

export const POLICY_STATUS_PRESENTATION: Record<
  AgentPolicyStatus,
  {
    label: string;
    description: string;
    tone: "neutral" | "positive" | "warning";
  }
> = {
  ACTIVE: {
    label: "Active",
    description: "The policy can be selected for new agent runs.",
    tone: "positive",
  },
  ARCHIVED: {
    label: "Archived",
    description: "The policy is preserved for history but cannot be used for new runs.",
    tone: "warning",
  },
};

export const POLICY_TEMPLATE_PRESENTATION = AGENT_POLICY_TEMPLATES;

export function getAgentPolicyStatusPresentation(status: AgentPolicyStatus) {
  return POLICY_STATUS_PRESENTATION[status];
}

export function getAgentPolicyTemplate(templateId: AgentPolicyTemplateId) {
  return AGENT_POLICY_TEMPLATES[templateId];
}

