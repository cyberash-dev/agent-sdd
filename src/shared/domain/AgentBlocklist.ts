/*
 * Identities that may never act as approvers (SDD §7.5 / ENF-010);
 * shared by the approve and lint slices.
 */

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

/** True when `approver` is forbidden as an approver — either listed in the
 *  built-in blocklist (case-insensitive), or starts with the `bot:` prefix,
 *  or is in the consumer-supplied `extraBlocklist`. */
export function isBlockedApprover(
	approver: string,
	extraBlocklist: readonly string[] = [],
): boolean {
	const lower = approver.toLowerCase();
	if (BUILTIN_AGENT_BLOCKLIST.has(lower)) {
		return true;
	}
	if (approver.startsWith("bot:")) {
		return true;
	}
	return extraBlocklist.map((s) => s.toLowerCase()).includes(lower);
}
