import {
	ok,
	type CommandResult,
	type OutputFormat,
} from "../../../../shared/domain/CliOutput.js";
import {
	runFinalize,
	type RunFinalizePorts,
	type RunFinalizeOutcome,
} from "../../application/RunFinalize.js";
import type {
	FinalizeCommand,
	FinalizeRequest,
} from "../../ports/inbound/FinalizeCommand.js";

export class CliFinalizeHandler implements FinalizeCommand {
	constructor(private readonly ports: RunFinalizePorts) {}

	async execute(
		cwd: string,
		req: FinalizeRequest,
		format: Exclude<OutputFormat, "yaml">,
	): Promise<CommandResult> {
		const outcome = await runFinalize(cwd, req.planId, this.ports);
		return render(outcome, format);
	}
}

function render(
	outcome: RunFinalizeOutcome,
	format: Exclude<OutputFormat, "yaml">,
): CommandResult {
	if (outcome.kind === "finalized") {
		return renderFinalized(outcome, format);
	}
	return renderRefusal(outcome, format);
}

function renderFinalized(
	outcome: Extract<RunFinalizeOutcome, { kind: "finalized" }>,
	format: Exclude<OutputFormat, "yaml">,
): CommandResult {
	if (format === "json") {
		return ok(
			JSON.stringify({
				format_version: 1,
				ok: true,
				plan_id: outcome.planId,
				finalized_ids: outcome.finalizedIds,
				files_changed: outcome.filesChanged,
				archived_path: outcome.archivedPath,
			}),
		);
	}
	const lines: string[] = [];
	lines.push(
		`finalize: ${outcome.finalizedIds.length} record(s) flipped in ${outcome.filesChanged.length} file(s).`,
	);
	for (const id of outcome.finalizedIds) {
		lines.push(`  - ${id}`);
	}
	lines.push("");
	lines.push(`finalize: plan archived at ${outcome.archivedPath}`);
	return ok(lines.join("\n"));
}

function renderRefusal(
	outcome: Exclude<RunFinalizeOutcome, { kind: "finalized" }>,
	format: Exclude<OutputFormat, "yaml">,
): CommandResult {
	if (outcome.kind === "no-active-plan") {
		return refusal(
			{ format_version: 1, ok: false, kind: "no-active-plan" },
			"no active plan",
			2,
			format,
		);
	}
	if (outcome.kind === "invalid-plan") {
		return refusal(
			{
				format_version: 1,
				ok: false,
				kind: "invalid-plan-file",
				plan_id: outcome.planId,
				source: outcome.sourcePath,
				reason: outcome.reason,
			},
			`invalid plan file at ${outcome.sourcePath}: ${outcome.reason}`,
			2,
			format,
		);
	}
	if (outcome.kind === "graph-violation") {
		return refusal(
			{
				format_version: 1,
				ok: false,
				reason: "proposed-references",
				plan_id: outcome.planId,
				offending: outcome.violations.map((v) => ({
					id: v.flippedId,
					references_id: v.referencesId,
					references_status: v.referencesStatus,
					via: v.via,
				})),
			},
			`${outcome.violations.length} proposed-reference violation(s) — re-run after the referenced IDs are approved or added to the plan`,
			1,
			format,
		);
	}
	if (outcome.kind === "unflippable") {
		return refusal(
			{
				format_version: 1,
				ok: false,
				kind: "unflippable",
				plan_id: outcome.planId,
				unflippable_ids: outcome.unflippableIds,
			},
			`${outcome.unflippableIds.length} attestation id(s) matched a record with no rewritable lifecycle anchor`,
			1,
			format,
		);
	}
	return refusal(
		{
			format_version: 1,
			ok: false,
			kind: "no-id-match",
			plan_id: outcome.planId,
			missing_ids: outcome.missingIds,
		},
		`${outcome.missingIds.length} attestation id(s) did not match any spec record`,
		1,
		format,
	);
}

function refusal(
	envelope: object,
	human: string,
	exitCode: 1 | 2,
	format: Exclude<OutputFormat, "yaml">,
): CommandResult {
	if (format === "json") {
		return { exitCode, stdout: `${JSON.stringify(envelope)}\n`, stderr: "" };
	}
	return { exitCode, stdout: "", stderr: `finalize: ${human}\n` };
}
