import { isBlockedApprover } from "../../../shared/domain/AgentBlocklist.js";

export type TargetStatus = "approved" | "deprecated" | "removed";

export const VALID_TARGET_STATUS: ReadonlySet<TargetStatus> = new Set<TargetStatus>([
  "approved",
  "deprecated",
  "removed",
]);

export const VALID_OWNER_ROLES: ReadonlySet<string> = new Set([
  "tech-lead",
  "architect",
  "security-owner",
  "platform-runtime-lead",
  "product-owner",
  "compliance",
]);

// Built-in agent identities that are forbidden as approvers per SDD §7.5.
// Re-exported from src/shared/domain/AgentBlocklist.ts so both the approve
// slice and the lint slice (P1.3 / ENF-010) can consult the same list.
// `.sdd/config.json#lint.approver_blocklist` extends this set.
export { BUILTIN_AGENT_BLOCKLIST } from "../../../shared/domain/AgentBlocklist.js";

export interface ApproveRequest {
  id: string;                        // exact ID or glob with `*`
  approver: string;
  ownerRole: string;
  changeRequest: string;
  scope: string;                     // e.g. "first-time-approval"
  targetStatus: TargetStatus;
  reviewedTestOracle: string | null; // required for major-bump Surface
}

export type ApproveRefusal =
  | { kind: "agent-approver"; approver: string }
  | { kind: "invalid-owner-role"; ownerRole: string }
  | { kind: "no-id-match"; id: string };

export function classifyRefusal(req: ApproveRequest, extraBlocklist: readonly string[]): ApproveRefusal | null {
  if (isBlockedApprover(req.approver, extraBlocklist)) {
    return { kind: "agent-approver", approver: req.approver };
  }
  if (!VALID_OWNER_ROLES.has(req.ownerRole)) {
    return { kind: "invalid-owner-role", ownerRole: req.ownerRole };
  }
  return null;
}
