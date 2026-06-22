import type { OutputFormat } from "./shared/domain/CliOutput.js";
import {
	parseApproveArgv,
	parseInstallArgv,
	parseRecordArgv,
} from "./cliParseApprove.js";
import {
	isFormat,
	type DoctorArgs,
	type FinalizeArgs,
	type ParsedArgv,
	type PlanArgs,
	type ReadyArgs,
	type ReportArgs,
	type Subcommand,
} from "./cliTypes.js";

export function parseArgv(argv: readonly string[]): ParsedArgv {
	if (argv.length === 0) {
		return { mode: "help" };
	}
	if (argv.length === 1 && argv[0] === "--help") {
		return { mode: "help" };
	}
	if (argv.length === 1 && argv[0] === "--version") {
		return { mode: "version" };
	}
	const subcommand = argv[0];
	if (!isSubcommand(subcommand)) {
		return { mode: "error", message: `unknown subcommand: ${subcommand}` };
	}
	if (argv.length === 2 && argv[1] === "--help") {
		return { mode: "help", subcommand };
	}

	const rest = argv.slice(1);
	if (subcommand === "approve") {
		return parseApproveArgv(rest);
	}
	if (subcommand === "ready") {
		return parseReadyArgv(rest);
	}
	if (subcommand === "finalize") {
		return parseFinalizeArgv(rest);
	}
	if (subcommand === "plan") {
		return parsePlanArgv(rest);
	}
	if (subcommand === "doctor") {
		return parseDoctorArgv(rest);
	}
	if (subcommand === "report") {
		return parseReportArgv(rest);
	}
	if (subcommand === "record") {
		return parseRecordArgv(rest);
	}
	if (subcommand === "install") {
		return parseInstallArgv(rest);
	}
	const defaultFormat = subcommand === "refresh" ? "yaml" : "human";
	let format: OutputFormat = defaultFormat;
	for (const arg of rest) {
		if (!arg.startsWith("--format=")) {
			return { mode: "error", message: `unknown flag: ${arg}` };
		}
		const value = arg.slice("--format=".length);
		if (!isFormat(value) || (subcommand !== "refresh" && value === "yaml")) {
			return { mode: "error", message: `invalid format: ${value}` };
		}
		format = value;
	}
	return { mode: "command", subcommand, format };
}

function parseReadyArgv(args: readonly string[]): ParsedArgv {
	const ready: ReadyArgs = {};
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
		if (arg === "--partition") {
			const next = args[i + 1];
			if (next === undefined || next.startsWith("--")) {
				return { mode: "error", message: "missing value for --partition" };
			}
			ready.partition = next;
			i++;
			continue;
		}
		if (arg === "--against") {
			const next = args[i + 1];
			if (next === undefined || next.startsWith("--")) {
				return { mode: "error", message: "missing value for --against" };
			}
			ready.against = next;
			i++;
			continue;
		}
		return { mode: "error", message: `unknown flag: ${arg}` };
	}
	return { mode: "command", subcommand: "ready", format, command: { ready } };
}

function parseFinalizeArgv(args: readonly string[]): ParsedArgv {
	const finalize: FinalizeArgs = {};
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
		if (arg === "--plan") {
			const next = args[i + 1];
			if (next === undefined || next.startsWith("--")) {
				return { mode: "error", message: "missing value for --plan" };
			}
			finalize.planId = next;
			i++;
			continue;
		}
		return { mode: "error", message: `unknown flag: ${arg}` };
	}
	return {
		mode: "command",
		subcommand: "finalize",
		format,
		command: { finalize },
	};
}

function parsePlanArgv(args: readonly string[]): ParsedArgv {
	if (args.length === 0 || args[0] !== "show") {
		return {
			mode: "error",
			message: "expected: sdd plan show [--plan <plan_id>]",
		};
	}
	const plan: PlanArgs = { subcommand: "show" };
	let format: OutputFormat = "human";
	for (let i = 1; i < args.length; i++) {
		const arg = args[i];
		if (arg.startsWith("--format=")) {
			const value = arg.slice("--format=".length);
			if (!isFormat(value) || value === "yaml") {
				return { mode: "error", message: `invalid format: ${value}` };
			}
			format = value;
			continue;
		}
		if (arg === "--plan") {
			const next = args[i + 1];
			if (next === undefined || next.startsWith("--")) {
				return { mode: "error", message: "missing value for --plan" };
			}
			plan.planId = next;
			i++;
			continue;
		}
		return { mode: "error", message: `unknown flag: ${arg}` };
	}
	return { mode: "command", subcommand: "plan", format, command: { plan } };
}

function parseReportArgv(args: readonly string[]): ParsedArgv {
	const report: ReportArgs = { prSummary: false };
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
		if (arg === "--pr-summary") {
			report.prSummary = true;
			continue;
		}
		if (arg === "--against") {
			const next = args[i + 1];
			if (next === undefined || next.startsWith("--")) {
				return { mode: "error", message: "missing value for --against" };
			}
			report.against = next;
			i++;
			continue;
		}
		return { mode: "error", message: `unknown flag: ${arg}` };
	}
	if (!report.prSummary) {
		return { mode: "error", message: "report requires --pr-summary" };
	}
	return {
		mode: "command",
		subcommand: "report",
		format,
		command: { report },
	};
}

function parseDoctorArgv(args: readonly string[]): ParsedArgv {
	const doctor: DoctorArgs = {
		ruleVersion: false,
		rulesPath: "rules/enforcement_registry.md",
	};
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
		if (arg === "--rule-version") {
			doctor.ruleVersion = true;
			continue;
		}
		if (arg === "--rules") {
			const next = args[i + 1];
			if (next === undefined || next.startsWith("--")) {
				return { mode: "error", message: "missing value for --rules" };
			}
			doctor.rulesPath = next;
			i++;
			continue;
		}
		return { mode: "error", message: `unknown flag: ${arg}` };
	}
	if (!doctor.ruleVersion) {
		return { mode: "error", message: "doctor requires --rule-version" };
	}
	return {
		mode: "command",
		subcommand: "doctor",
		format,
		command: { doctor },
	};
}

function isSubcommand(value: string | undefined): value is Subcommand {
	return (
		value === "token" ||
		value === "check" ||
		value === "refresh" ||
		value === "lint" ||
		value === "approve" ||
		value === "ready" ||
		value === "finalize" ||
		value === "plan" ||
		value === "doctor" ||
		value === "report" ||
		value === "record" ||
		value === "install"
	);
}
