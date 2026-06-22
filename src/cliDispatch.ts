import { CliApproveHandler } from "./features/approve/adapters/inbound/CliApproveHandler.js";
import { NodeApproveFileSystem } from "./features/approve/adapters/outbound/NodeApproveFileSystem.js";
import { NodePlanFileWriter } from "./features/approve/adapters/outbound/NodePlanFileWriter.js";
import { SystemApproveClock } from "./features/approve/adapters/outbound/SystemApproveClock.js";
import { CliCheckHandler } from "./features/check/adapters/inbound/CliCheckHandler.js";
import { ChildProcessCheckGit } from "./features/check/adapters/outbound/ChildProcessCheckGit.js";
import { NodeCheckFileReader } from "./features/check/adapters/outbound/NodeCheckFileReader.js";
import { CliDoctorHandler } from "./features/doctor/adapters/inbound/CliDoctorHandler.js";
import { NodeRegistryReader } from "./features/doctor/adapters/outbound/NodeRegistryReader.js";
import { CliFinalizeHandler } from "./features/finalize/adapters/inbound/CliFinalizeHandler.js";
import { NodeFinalizeFileSystem } from "./features/finalize/adapters/outbound/NodeFinalizeFileSystem.js";
import { NodePlanRepo } from "./features/finalize/adapters/outbound/NodePlanRepo.js";
import { SystemFinalizeClock } from "./features/finalize/adapters/outbound/SystemFinalizeClock.js";
import { CliInstallHandler } from "./features/install/adapters/inbound/CliInstallHandler.js";
import { NodeInstallSource } from "./features/install/adapters/outbound/NodeInstallSource.js";
import { NodeInstallTargetFs } from "./features/install/adapters/outbound/NodeInstallTargetFs.js";
import { CliLintHandler } from "./features/lint/adapters/inbound/CliLintHandler.js";
import { NodeLintFileReader } from "./features/lint/adapters/outbound/NodeLintFileReader.js";
import { CliPlanShowHandler } from "./features/plan/adapters/inbound/CliPlanShowHandler.js";
import { NodePlanReader } from "./features/plan/adapters/outbound/NodePlanReader.js";
import { CliReadyHandler } from "./features/ready/adapters/inbound/CliReadyHandler.js";
import { ChildProcessReadyGit } from "./features/ready/adapters/outbound/ChildProcessReadyGit.js";
import { NodeReadyFileSystem } from "./features/ready/adapters/outbound/NodeReadyFileSystem.js";
import { CliRecordHandler } from "./features/record/adapters/inbound/CliRecordHandler.js";
import { NodeRecordFileSystem } from "./features/record/adapters/outbound/NodeRecordFileSystem.js";
import type { RecordAction } from "./features/record/ports/inbound/RecordCommand.js";
import { CliRefreshHandler } from "./features/refresh/adapters/inbound/CliRefreshHandler.js";
import { ChildProcessRefreshGit } from "./features/refresh/adapters/outbound/ChildProcessRefreshGit.js";
import { NodeRefreshFileReader } from "./features/refresh/adapters/outbound/NodeRefreshFileReader.js";
import { SystemRefreshClock } from "./features/refresh/adapters/outbound/SystemRefreshClock.js";
import { CliReportHandler } from "./features/report/adapters/inbound/CliReportHandler.js";
import { NodeReportFileSystem } from "./features/report/adapters/outbound/NodeReportFileSystem.js";
import { CliTokenHandler } from "./features/token/adapters/inbound/CliTokenHandler.js";
import { ChildProcessTokenGit } from "./features/token/adapters/outbound/ChildProcessTokenGit.js";
import { NodeTokenConfigReader } from "./features/token/adapters/outbound/NodeTokenConfigReader.js";
import type { CommandResult, OutputFormat } from "./shared/domain/CliOutput.js";
import { approveRequest, resolveRecordBody } from "./cliParseApprove.js";
import { COMMAND_HELP, type ParsedArgv } from "./cliTypes.js";

export function dispatchToken(
	cwd: string,
	format: OutputFormat | undefined,
): Promise<CommandResult> {
	const command = new CliTokenHandler({
		config: new NodeTokenConfigReader(),
		git: new ChildProcessTokenGit(),
	});
	return command.execute(cwd, format === "json" ? "json" : "human");
}

export function dispatchCheck(
	cwd: string,
	format: OutputFormat | undefined,
): Promise<CommandResult> {
	const files = new NodeCheckFileReader();
	const command = new CliCheckHandler({
		config: files,
		git: new ChildProcessCheckGit(),
		spec: files,
	});
	return command.execute(cwd, format === "json" ? "json" : "human");
}

export function dispatchLint(
	cwd: string,
	format: OutputFormat | undefined,
): Promise<CommandResult> {
	const files = new NodeLintFileReader();
	const command = new CliLintHandler({ config: files, files });
	return command.execute(cwd, format === "json" ? "json" : "human");
}

export function dispatchApprove(
	parsed: ParsedArgv,
	cwd: string,
): Promise<CommandResult> {
	const approve = parsed.command?.approve;
	const req = approveRequest(approve ?? {});
	if (req.mode === "error") {
		return Promise.resolve({
			exitCode: 2,
			stdout: "",
			stderr: `${req.message}\n${COMMAND_HELP.approve}\n`,
		});
	}
	const files = new NodeApproveFileSystem();
	const plans = new NodePlanFileWriter();
	const command = new CliApproveHandler({
		clock: new SystemApproveClock(),
		config: files,
		files,
		plans,
	});
	return command.execute(
		cwd,
		req.value,
		parsed.format === "json" ? "json" : "human",
		{
			inline: approve?.inline === true,
			planId: approve?.planId,
		},
	);
}

export function dispatchFinalize(
	parsed: ParsedArgv,
	cwd: string,
): Promise<CommandResult> {
	const finalizeFs = new NodeFinalizeFileSystem();
	const command = new CliFinalizeHandler({
		clock: new SystemFinalizeClock(),
		config: finalizeFs,
		files: finalizeFs,
		plans: new NodePlanRepo(),
	});
	return command.execute(
		cwd,
		{ planId: parsed.command?.finalize?.planId },
		parsed.format === "json" ? "json" : "human",
	);
}

export function dispatchPlan(
	parsed: ParsedArgv,
	cwd: string,
): Promise<CommandResult> {
	const plan = parsed.command?.plan;
	if (plan?.subcommand !== "show") {
		return Promise.resolve({
			exitCode: 2,
			stdout: "",
			stderr: `${COMMAND_HELP.plan}\n`,
		});
	}
	const reader = new NodePlanReader();
	const command = new CliPlanShowHandler({ config: reader, reader });
	return command.execute(
		cwd,
		{ planId: plan.planId },
		parsed.format === "json" ? "json" : "human",
	);
}

export function dispatchDoctor(
	parsed: ParsedArgv,
	cwd: string,
): Promise<CommandResult> {
	const doctor = parsed.command?.doctor;
	if (doctor === undefined) {
		return Promise.resolve({
			exitCode: 2,
			stdout: "",
			stderr: `${COMMAND_HELP.doctor}\n`,
		});
	}
	const command = new CliDoctorHandler({
		registry: new NodeRegistryReader(),
	});
	return command.execute(
		cwd,
		{
			ruleVersion: doctor.ruleVersion,
			rulesPath: doctor.rulesPath,
		},
		parsed.format === "json" ? "json" : "human",
	);
}

export function dispatchReport(
	parsed: ParsedArgv,
	cwd: string,
): Promise<CommandResult> {
	const report = parsed.command?.report;
	if (report === undefined) {
		return Promise.resolve({
			exitCode: 2,
			stdout: "",
			stderr: `${COMMAND_HELP.report}\n`,
		});
	}
	const reportFs = new NodeReportFileSystem();
	const git = new ChildProcessReadyGit();
	const command = new CliReportHandler({
		config: reportFs,
		files: reportFs,
		readAtRef: (root, ref, path) => git.readAtRef(root, ref, path),
		repoRoot: (cwdInner) => git.repoRoot(cwdInner),
	});
	return command.execute(
		cwd,
		{
			prSummary: report.prSummary,
			against: report.against,
		},
		parsed.format === "json" ? "json" : "human",
	);
}

export function dispatchRecord(
	parsed: ParsedArgv,
	cwd: string,
): Promise<CommandResult> {
	if (parsed.command?.record === undefined) {
		return Promise.resolve({
			exitCode: 2,
			stdout: "",
			stderr: `${COMMAND_HELP.record}\n`,
		});
	}
	const record = parsed.command.record;
	const fs = new NodeRecordFileSystem();
	const command = new CliRecordHandler({ config: fs, files: fs, writer: fs });
	const format = parsed.format === "json" ? "json" : "human";
	const sub = record.subcommand;

	if (sub === "list") {
		return command.execute(
			cwd,
			{ kind: "list", partition: record.partition },
			format,
		);
	}
	if (sub === "get") {
		const id = record.id;
		if (id === undefined) {
			return Promise.resolve({
				exitCode: 2,
				stdout: "",
				stderr: `${COMMAND_HELP.record}\n`,
			});
		}
		return command.execute(cwd, { kind: "get", id }, format);
	}

	const bodyResult = resolveRecordBody(record, cwd);
	if (bodyResult.error !== undefined) {
		return Promise.resolve({
			exitCode: 2,
			stdout: "",
			stderr: `${bodyResult.error}\n`,
		});
	}
	if (sub === "set") {
		const id = record.id;
		if (id === undefined) {
			return Promise.resolve({
				exitCode: 2,
				stdout: "",
				stderr: `${COMMAND_HELP.record}\n`,
			});
		}
		return command.execute(
			cwd,
			{ kind: "set", id, body: bodyResult.body },
			format,
		);
	}
	const afterId = record.afterId;
	if (afterId === undefined) {
		return Promise.resolve({
			exitCode: 2,
			stdout: "",
			stderr: `${COMMAND_HELP.record}\n`,
		});
	}
	const action: RecordAction = {
		kind: "add",
		afterId,
		body: bodyResult.body,
	};
	return command.execute(cwd, action, format);
}

export function dispatchInstall(parsed: ParsedArgv): Promise<CommandResult> {
	const install = parsed.command?.install;
	if (install === undefined) {
		return Promise.resolve({
			exitCode: 2,
			stdout: "",
			stderr: `${COMMAND_HELP.install}\n`,
		});
	}
	const command = new CliInstallHandler({
		source: new NodeInstallSource(),
		fs: new NodeInstallTargetFs(),
	});
	return command.execute(
		install.target,
		{ dryRun: install.dryRun, scope: install.scope },
		parsed.format === "json" ? "json" : "human",
	);
}

export function dispatchReady(
	parsed: ParsedArgv,
	cwd: string,
): Promise<CommandResult> {
	const fs = new NodeReadyFileSystem();
	const command = new CliReadyHandler({
		config: fs,
		files: fs,
		git: new ChildProcessReadyGit(),
	});
	return command.execute(
		cwd,
		parsed.format === "json" ? "json" : "human",
		parsed.command?.ready?.partition,
		parsed.command?.ready?.against,
	);
}

export function dispatchRefresh(
	parsed: ParsedArgv,
	cwd: string,
): Promise<CommandResult> {
	const refreshFiles = new NodeRefreshFileReader();
	const refreshCommand = new CliRefreshHandler({
		clock: new SystemRefreshClock(),
		config: refreshFiles,
		git: new ChildProcessRefreshGit(),
		spec: refreshFiles,
	});
	return refreshCommand.execute(cwd, parsed.format ?? "yaml");
}
