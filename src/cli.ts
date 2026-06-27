#!/usr/bin/env node
import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgv } from "./cliParse.js";
import {
	dispatchApprove,
	dispatchCheck,
	dispatchDoctor,
	dispatchFinalize,
	dispatchInstall,
	dispatchLint,
	dispatchPlan,
	dispatchReady,
	dispatchRecord,
	dispatchRefresh,
	dispatchReport,
	dispatchToken,
} from "./cliDispatch.js";
import { COMMAND_HELP, TOP_LEVEL_HELP } from "./cliTypes.js";
import {
	failed,
	type CommandResult,
	type OutputFormat,
} from "./shared/domain/CliOutput.js";
import { CliFailure } from "./shared/domain/Errors.js";

export async function main(
	argv: readonly string[],
	cwd: string,
): Promise<CommandResult> {
	const parsed = parseArgv(argv);
	if (parsed.mode === "help") {
		return {
			exitCode: 0,
			stdout: `${parsed.subcommand ? COMMAND_HELP[parsed.subcommand] : TOP_LEVEL_HELP}\n`,
			stderr: "",
		};
	}
	if (parsed.mode === "version") {
		return { exitCode: 0, stdout: `${packageVersion()}\n`, stderr: "" };
	}
	if (parsed.mode === "error") {
		return {
			exitCode: 2,
			stdout: "",
			stderr: `${parsed.message ?? "invalid arguments"}\n${TOP_LEVEL_HELP}\n`,
		};
	}

	const errorFormat: Exclude<OutputFormat, "yaml"> =
		parsed.format === "json" ? "json" : "human";
	try {
		if (parsed.subcommand === "token") {
			return await dispatchToken(cwd, parsed.format);
		}
		if (parsed.subcommand === "check") {
			return await dispatchCheck(cwd, parsed.format);
		}
		if (parsed.subcommand === "lint") {
			return await dispatchLint(cwd, parsed.format);
		}
		if (parsed.subcommand === "approve") {
			return await dispatchApprove(parsed, cwd);
		}
		if (parsed.subcommand === "finalize") {
			return await dispatchFinalize(parsed, cwd);
		}
		if (parsed.subcommand === "plan") {
			return await dispatchPlan(parsed, cwd);
		}
		if (parsed.subcommand === "doctor") {
			return await dispatchDoctor(parsed, cwd);
		}
		if (parsed.subcommand === "report") {
			return await dispatchReport(parsed, cwd);
		}
		if (parsed.subcommand === "record") {
			return await dispatchRecord(parsed, cwd);
		}
		if (parsed.subcommand === "install") {
			return await dispatchInstall(parsed);
		}
		if (parsed.subcommand === "ready") {
			return await dispatchReady(parsed, cwd);
		}
		return await dispatchRefresh(parsed, cwd);
	} catch (error) {
		if (error instanceof CliFailure) {
			return failed(error, errorFormat);
		}
		throw error;
	}
}

function packageVersion(): string {
	const packagePath = join(
		dirname(fileURLToPath(import.meta.url)),
		"..",
		"package.json",
	);
	const value: unknown = JSON.parse(readFileSync(packagePath, "utf8"));
	if (!isRecord(value) || typeof value.version !== "string") {
		throw new Error("package.json version is missing");
	}
	return value.version;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (isEntrypoint()) {
	const result = await main(process.argv.slice(2), process.cwd());
	process.stdout.write(result.stdout);
	process.stderr.write(result.stderr);
	process.exitCode = result.exitCode;
}

function isEntrypoint(): boolean {
	if (process.argv[1] === undefined) {
		return false;
	}
	return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
}
