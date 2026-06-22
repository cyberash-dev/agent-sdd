import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	type ApproveRequest,
	type TargetStatus,
} from "./features/approve/domain/ApproveRequest.js";
import { isInstallTarget } from "./features/install/domain/InstallTarget.js";
import type { OutputFormat } from "./shared/domain/CliOutput.js";
import {
	isFormat,
	type ApproveArgs,
	type InstallArgs,
	type ParsedArgv,
	type RecordArgs,
} from "./cliTypes.js";

export function parseApproveArgv(args: readonly string[]): ParsedArgv {
	const approve: ApproveArgs = {};
	let format: OutputFormat = "human";
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg.startsWith("--format=")) {
			const value = arg.slice("--format=".length);
			if (!isFormat(value) || value === "yaml") {
				return { mode: "error", message: `invalid format: ${value}` };
			}
			format = value;
			continue;
		}
		if (arg === "--inline") {
			approve.inline = true;
			continue;
		}
		if (!arg.startsWith("--")) {
			return { mode: "error", message: `unknown positional: ${arg}` };
		}
		const key = arg.slice(2);
		const next = args[i + 1];
		if (next === undefined || next.startsWith("--")) {
			return { mode: "error", message: `missing value for --${key}` };
		}
		i++;
		switch (key) {
			case "id":
				approve.id = next;
				break;
			case "approver":
				approve.approver = next;
				break;
			case "owner-role":
				approve.ownerRole = next;
				break;
			case "change-request":
				approve.changeRequest = next;
				break;
			case "scope":
				approve.scope = next;
				break;
			case "target-status":
				approve.targetStatus = next;
				break;
			case "reviewed-test-oracle":
				approve.reviewedTestOracle = next;
				break;
			case "plan":
				approve.planId = next;
				break;
			default:
				return { mode: "error", message: `unknown flag: --${key}` };
		}
	}
	if (approve.inline === true && approve.planId !== undefined) {
		return {
			mode: "error",
			message: "--inline and --plan are mutually exclusive",
		};
	}
	return {
		mode: "command",
		subcommand: "approve",
		format,
		command: { approve },
	};
}

type ApproveRequestParse =
	| { mode: "ok"; value: ApproveRequest }
	| { mode: "error"; message: string };

export function approveRequest(args: ApproveArgs): ApproveRequestParse {
	if (args.id === undefined) {
		return { mode: "error", message: "--id required" };
	}
	if (args.approver === undefined) {
		return { mode: "error", message: "--approver required" };
	}
	if (args.ownerRole === undefined) {
		return { mode: "error", message: "--owner-role required" };
	}
	if (args.changeRequest === undefined) {
		return { mode: "error", message: "--change-request required" };
	}
	const targetStatus = args.targetStatus ?? "approved";
	if (!isTargetStatus(targetStatus)) {
		return {
			mode: "error",
			message: `invalid --target-status: ${targetStatus}`,
		};
	}
	return {
		mode: "ok",
		value: {
			id: args.id,
			approver: args.approver,
			ownerRole: args.ownerRole,
			changeRequest: args.changeRequest,
			scope: args.scope ?? "first-time-approval",
			targetStatus,
			reviewedTestOracle: args.reviewedTestOracle ?? null,
		},
	};
}

function isTargetStatus(value: string): value is TargetStatus {
	return value === "approved" || value === "deprecated" || value === "removed";
}

export function parseRecordArgv(args: readonly string[]): ParsedArgv {
	const sub = args[0];
	if (sub !== "list" && sub !== "get" && sub !== "set" && sub !== "add") {
		return {
			mode: "error",
			message:
				"expected: sdd record list | get <id> | set <id> | add --after <id>",
		};
	}

	const record: RecordArgs = { subcommand: sub };
	let rest = args.slice(1);
	if (sub === "get" || sub === "set") {
		const id = rest[0];
		if (id === undefined || id.startsWith("--")) {
			return { mode: "error", message: `expected: sdd record ${sub} <id>` };
		}
		record.id = id;
		rest = rest.slice(1);
	}

	const parsedFlags = parseRecordFlags(rest, record);
	if (parsedFlags.mode === "error") {
		return parsedFlags;
	}

	if (sub === "add" && record.afterId === undefined) {
		return { mode: "error", message: "sdd record add requires --after <id>" };
	}
	if (sub === "set" || sub === "add") {
		const hasContent = record.content !== undefined;
		const hasFile = record.fromFile !== undefined;
		if (hasContent === hasFile) {
			return {
				mode: "error",
				message:
					"provide exactly one of --from-file <path> or --content <body>",
			};
		}
	}
	return {
		mode: "command",
		subcommand: "record",
		format: parsedFlags.format,
		command: { record },
	};
}

type RecordFlagsParse =
	| { mode: "ok"; format: OutputFormat }
	| { mode: "error"; message: string };

function parseRecordFlags(
	rest: readonly string[],
	record: RecordArgs,
): RecordFlagsParse {
	const sub = record.subcommand;
	let format: OutputFormat = "human";
	for (let i = 0; i < rest.length; i++) {
		const arg = rest[i];
		if (arg.startsWith("--format=")) {
			const value = arg.slice("--format=".length);
			if (!isFormat(value) || value === "yaml") {
				return { mode: "error", message: `invalid format: ${value}` };
			}
			format = value;
			continue;
		}
		if (arg === "--partition" && sub === "list") {
			const next = rest[i + 1];
			if (next === undefined || next.startsWith("--")) {
				return { mode: "error", message: "missing value for --partition" };
			}
			record.partition = next;
			i++;
			continue;
		}
		if (arg === "--after" && sub === "add") {
			const next = rest[i + 1];
			if (next === undefined || next.startsWith("--")) {
				return { mode: "error", message: "missing value for --after" };
			}
			record.afterId = next;
			i++;
			continue;
		}
		if (arg === "--content" && (sub === "set" || sub === "add")) {
			const next = rest[i + 1];
			if (next === undefined) {
				return { mode: "error", message: "missing value for --content" };
			}
			record.content = next;
			i++;
			continue;
		}
		if (arg === "--from-file" && (sub === "set" || sub === "add")) {
			const next = rest[i + 1];
			if (next === undefined || next.startsWith("--")) {
				return { mode: "error", message: "missing value for --from-file" };
			}
			record.fromFile = next;
			i++;
			continue;
		}
		return { mode: "error", message: `unknown flag: ${arg}` };
	}
	return { mode: "ok", format };
}

export function resolveRecordBody(
	record: RecordArgs,
	cwd: string,
): { body: string; error?: undefined } | { error: string } {
	if (record.content !== undefined) {
		return { body: record.content };
	}
	const fromFile = record.fromFile;
	if (fromFile === undefined) {
		return { error: "provide --from-file or --content" };
	}
	try {
		return { body: readFileSync(resolve(cwd, fromFile), "utf8") };
	} catch {
		return { error: `cannot read --from-file: ${fromFile}` };
	}
}

export function parseInstallArgv(args: readonly string[]): ParsedArgv {
	const target = args[0];
	if (target === undefined || !isInstallTarget(target)) {
		return {
			mode: "error",
			message: "expected: sdd install <all|claude|codex>",
		};
	}
	const install: InstallArgs = { target, dryRun: false, scope: "user" };
	let format: OutputFormat = "human";
	const rest = args.slice(1);
	for (let i = 0; i < rest.length; i++) {
		const arg = rest[i];
		if (arg.startsWith("--format=")) {
			const value = arg.slice("--format=".length);
			if (!isFormat(value) || value === "yaml") {
				return { mode: "error", message: `invalid format: ${value}` };
			}
			format = value;
			continue;
		}
		if (arg === "--dry-run") {
			install.dryRun = true;
			continue;
		}
		if (arg === "--scope" || arg.startsWith("--scope=")) {
			const value = arg.startsWith("--scope=")
				? arg.slice("--scope=".length)
				: rest[++i];
			if (value !== "user" && value !== "project") {
				return {
					mode: "error",
					message: `invalid scope: ${value ?? "(missing)"}`,
				};
			}
			install.scope = value;
			continue;
		}
		return { mode: "error", message: `unknown flag: ${arg}` };
	}
	return {
		mode: "command",
		subcommand: "install",
		format,
		command: { install },
	};
}
