import type {
	InstallScope,
	InstallTarget,
} from "./features/install/domain/InstallTarget.js";
import type { OutputFormat } from "./shared/domain/CliOutput.js";

export type Subcommand =
	| "token"
	| "check"
	| "refresh"
	| "lint"
	| "approve"
	| "ready"
	| "finalize"
	| "plan"
	| "doctor"
	| "report"
	| "record"
	| "install";

export interface ParsedArgv {
	mode: "command" | "help" | "version" | "error";
	subcommand?: Subcommand;
	format?: OutputFormat;
	message?: string;
	command?: CommandArgs;
}

export interface CommandArgs {
	approve?: ApproveArgs;
	ready?: ReadyArgs;
	finalize?: FinalizeArgs;
	plan?: PlanArgs;
	doctor?: DoctorArgs;
	report?: ReportArgs;
	record?: RecordArgs;
	install?: InstallArgs;
}

export interface InstallArgs {
	target: InstallTarget;
	dryRun: boolean;
	scope: InstallScope;
}

export interface RecordArgs {
	subcommand: "list" | "get" | "set" | "add";
	id?: string;
	afterId?: string;
	partition?: string;
	content?: string;
	fromFile?: string;
}

export interface ReportArgs {
	prSummary: boolean;
	against?: string;
}

export interface DoctorArgs {
	ruleVersion: boolean;
	rulesPath: string;
}

export interface ApproveArgs {
	id?: string;
	approver?: string;
	ownerRole?: string;
	changeRequest?: string;
	scope?: string;
	targetStatus?: string;
	reviewedTestOracle?: string;
	inline?: boolean;
	planId?: string;
}

export interface ReadyArgs {
	partition?: string;
	against?: string;
}

export interface FinalizeArgs {
	planId?: string;
}

export interface PlanArgs {
	subcommand: "show";
	planId?: string;
}

export function isFormat(value: string): value is OutputFormat {
	return value === "json" || value === "human" || value === "yaml";
}

export const TOP_LEVEL_HELP = `sdd

Usage:
  sdd token    [--format=json|human]
  sdd check    [--format=json|human]
  sdd refresh  [--format=json|human|yaml]
  sdd lint     [--format=json|human]
  sdd approve  --id <id-or-glob> --approver <human-id>
               --owner-role <role> --change-request <url>
               [--scope <scope>] [--target-status approved|deprecated|removed]
               [--reviewed-test-oracle <ref>]
               [--inline | --plan <plan_id>] [--format=json|human]
  sdd plan show [--plan <plan_id>] [--format=json|human]
  sdd finalize  [--plan <plan_id>] [--format=json|human]
  sdd doctor    --rule-version [--rules <path>] [--format=json|human]
  sdd report    --pr-summary [--against <ref>] [--format=json|human]
  sdd ready    [--format=json|human] [--partition <name>]
  sdd record list           [--partition <name>] [--format=json|human]
  sdd record get <id>       [--format=json|human]
  sdd record set <id>       (--from-file <p> | --content <s>) [--format=json|human]
  sdd record add --after <id> (--from-file <p> | --content <s>) [--format=json|human]
  sdd install <all|claude|codex> [--scope user|project] [--dry-run] [--format=json|human]
  sdd --help
  sdd --version`;

export const COMMAND_HELP: Record<Subcommand, string> = {
	token: "Usage: sdd token [--format=json|human]",
	check: "Usage: sdd check [--format=json|human]",
	refresh: "Usage: sdd refresh [--format=json|human|yaml]",
	lint: "Usage: sdd lint [--format=json|human]",
	approve:
		"Usage: sdd approve --id <id-or-glob> --approver <human-id> --owner-role <role> --change-request <url> [--scope <scope>] [--target-status approved|deprecated|removed] [--reviewed-test-oracle <ref>] [--inline | --plan <plan_id>] [--format=json|human]",
	ready: "Usage: sdd ready [--format=json|human] [--partition <name>]",
	finalize: "Usage: sdd finalize [--plan <plan_id>] [--format=json|human]",
	plan: "Usage: sdd plan show [--plan <plan_id>] [--format=json|human]",
	doctor:
		"Usage: sdd doctor --rule-version [--rules <path>] [--format=json|human]",
	report:
		"Usage: sdd report --pr-summary [--against <ref>] [--format=json|human]",
	record:
		"Usage: sdd record list [--partition <name>] | get <id> | set <id> (--from-file <p>|--content <s>) | add --after <id> (--from-file <p>|--content <s>) [--format=json|human]",
	install:
		"Usage: sdd install <all|claude|codex> [--scope user|project] [--dry-run] [--format=json|human]",
};
