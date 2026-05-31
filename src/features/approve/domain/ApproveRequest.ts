import { isBlockedApprover } from "../../../shared/domain/AgentBlocklist.js";

export type TargetStatus = "approved" | "deprecated" | "removed";

export const VALID_TARGET_STATUS: ReadonlySet<TargetStatus> =
	new Set<TargetStatus>(["approved", "deprecated", "removed"]);

export const VALID_OWNER_ROLES: ReadonlySet<string> = new Set([
	"tech-lead",
	"architect",
	"security-owner",
	"platform-runtime-lead",
	"product-owner",
	"compliance",
]);

/*
 * ENF-010: re-export of the built-in agent-approver blocklist (SDD §7.5)
 * so approve and lint share one list; config extends it. See spec record.
 */
export { BUILTIN_AGENT_BLOCKLIST } from "../../../shared/domain/AgentBlocklist.js";

export interface ApproveRequest {
	id: string; /* exact ID or glob with `*` */
	approver: string;
	ownerRole: string;
	changeRequest: string;
	scope: string; /* e.g. "first-time-approval" */
	targetStatus: TargetStatus;
	reviewedTestOracle: string | null; /* required for major-bump Surface */
}

export type ApproveRefusal =
	| { kind: "agent-approver"; approver: string }
	| { kind: "invalid-owner-role"; ownerRole: string }
	| { kind: "no-id-match"; id: string };

export function classifyRefusal(
	req: ApproveRequest,
	extraBlocklist: readonly string[],
): ApproveRefusal | null {
	if (isBlockedApprover(req.approver, extraBlocklist)) {
		return { kind: "agent-approver", approver: req.approver };
	}
	if (!VALID_OWNER_ROLES.has(req.ownerRole)) {
		return { kind: "invalid-owner-role", ownerRole: req.ownerRole };
	}
	return null;
}
