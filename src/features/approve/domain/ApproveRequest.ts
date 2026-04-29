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
// `.sdd/config.json#lint.approver_blocklist` extends this set.
export const BUILTIN_AGENT_BLOCKLIST: ReadonlySet<string> = new Set([
  "agent",
  "claude",
  "claude-code",
  "code-gen-agent",
  "codex",
  "pipeline-driver",
  "spec-author-bot",
  "spec-lint",
  "sdd-cli",
]);

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
  const lower = req.approver.toLowerCase();
  if (BUILTIN_AGENT_BLOCKLIST.has(lower) || req.approver.startsWith("bot:") ||
      extraBlocklist.map((s) => s.toLowerCase()).includes(lower)) {
    return { kind: "agent-approver", approver: req.approver };
  }
  if (!VALID_OWNER_ROLES.has(req.ownerRole)) {
    return { kind: "invalid-owner-role", ownerRole: req.ownerRole };
  }
  return null;
}
