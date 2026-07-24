import { planAgentGoal } from "./GoalPlanner";
import { selectAgentResourceCandidate } from "./ResourceSelector";
import type {
  AgentBudgetPolicy,
  AgentResourceCandidate,
  AgentRuntimeResult,
} from "./types";

type RunAgentRuntimeInput = {
  goal: string;
  policy: AgentBudgetPolicy;
  resources: readonly AgentResourceCandidate[];
  referenceDate?: Date;
};

export function runAgentRuntime(
  input: RunAgentRuntimeInput,
): AgentRuntimeResult {
  const goal = planAgentGoal(input.goal);
  const selection = selectAgentResourceCandidate({
    goal,
    policy: input.policy,
    resources: input.resources,
    referenceDate: input.referenceDate,
  });

  const trace: AgentRuntimeResult["trace"] = [
    {
      step: "goal_planned",
      status: "SUCCESS",
      message: `Normalized goal into ${goal.keywords.length} keyword(s).`,
    },
    {
      step: "resource_evaluation",
      status: selection.candidates.length > 0 ? "SUCCESS" : "SKIPPED",
      message:
        selection.candidates.length > 0
          ? `Evaluated ${selection.candidates.length} resource candidate(s).`
          : "No resource candidates were supplied.",
    },
    {
      step: "decision",
      status: selection.decision === "BUY" ? "SUCCESS" : "SKIPPED",
      message:
        selection.decision === "BUY" && selection.selectedEvaluation
          ? `Selected "${selection.selectedEvaluation.resource.title}" with score ${selection.selectedEvaluation.matchScore}.`
          : selection.candidates.length > 0
            ? "No candidate met the budget and score threshold."
            : "Skipped because there were no candidates.",
    },
  ];

  return {
    goal,
    decision: selection.decision,
    selectedResource: selection.selectedResource,
    selectedEvaluation: selection.selectedEvaluation,
    candidates: selection.candidates,
    trace,
  };
}
