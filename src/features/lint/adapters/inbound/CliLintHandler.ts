import {
	failed,
	ok,
	type CommandResult,
	type OutputFormat,
} from "../../../../shared/domain/CliOutput.js";
import { CliFailure } from "../../../../shared/domain/Errors.js";
import {
	runLint,
	type Diagnostic,
	type LintReport,
	type RunLintPorts,
} from "../../application/RunLint.js";
import type { LintCommand } from "../../ports/inbound/LintCommand.js";

export class CliLintHandler implements LintCommand {
	constructor(private readonly ports: RunLintPorts) {}

	async execute(
		cwd: string,
		format: Exclude<OutputFormat, "yaml">,
	): Promise<CommandResult> {
		try {
			const report = await runLint(cwd, this.ports);
			if (format === "json") {
				return jsonResult(report);
			}
			return humanResult(report);
		} catch (error) {
			if (error instanceof CliFailure) {
				return failed(error, format);
			}
			throw error;
		}
	}
}

function jsonResult(report: LintReport): CommandResult {
	const body = JSON.stringify({
		format_version: 1,
		ok: report.errorCount === 0,
		error_count: report.errorCount,
		warn_count: report.warnCount,
		diagnostics: report.diagnostics.map((d) => ({
			severity: d.severity,
			rule: d.rule,
			file: d.file,
			line: d.line ?? null,
			message: d.message,
		})),
	});
	if (report.errorCount === 0) {
		return ok(body);
	}
	return { exitCode: 1, stdout: `${body}\n`, stderr: "" };
}

function humanResult(report: LintReport): CommandResult {
	const lines: string[] = [];
	for (const d of report.diagnostics) {
		lines.push(formatDiagnostic(d));
	}
	lines.push("");
	lines.push(
		`spec-lint: ${report.errorCount} error(s), ${report.warnCount} warning(s).`,
	);
	const stdout = `${lines.join("\n")}\n`;
	if (report.errorCount === 0) {
		return { exitCode: 0, stdout, stderr: "" };
	}
	return { exitCode: 1, stdout, stderr: "" };
}

function formatDiagnostic(d: Diagnostic): string {
	const where = d.line !== undefined ? `${d.file}:${d.line}` : d.file;
	const tag = d.severity === "error" ? "ERROR" : "warn";
	return `[${tag}] ${where}  ${d.rule}: ${d.message}`;
}
