import { ok, type CommandResult, type OutputFormat } from "../../../../shared/domain/CliOutput.js";
import { runDoctor, type DoctorOutcome, type RunDoctorPorts } from "../../application/RunDoctor.js";
import type { DoctorCommand, DoctorRequest } from "../../ports/inbound/DoctorCommand.js";

export class CliDoctorHandler implements DoctorCommand {
  constructor(private readonly ports: RunDoctorPorts) {}

  async execute(_cwd: string, req: DoctorRequest, format: Exclude<OutputFormat, "yaml">): Promise<CommandResult> {
    if (!req.ruleVersion) {
      const env = { format_version: 1, ok: false, kind: "no-mode-selected" };
      return refusal(env, "doctor requires --rule-version (no other modes implemented in v0.4)", 2, format);
    }
    const outcome = await runDoctor(req.rulesPath, this.ports);
    return render(outcome, format);
  }
}

function render(outcome: DoctorOutcome, format: Exclude<OutputFormat, "yaml">): CommandResult {
  if (outcome.kind === "ok") {
    if (format === "json") {
      return ok(JSON.stringify({
        format_version: 1,
        ok: true,
        rule_version: outcome.ruleVersion,
        cli_version: outcome.cliVersion,
        compatible_range: outcome.compatibleRange,
        drift: [],
      }));
    }
    return ok([
      `doctor: ok (rule_version=${outcome.ruleVersion}, cli_version=${outcome.cliVersion}, compatible_range=${outcome.compatibleRange})`,
      `doctor: 0 drift entries.`,
    ].join("\n"));
  }
  if (outcome.kind === "drift") {
    if (format === "json") {
      return {
        exitCode: 1,
        stdout: `${JSON.stringify({
          format_version: 1,
          ok: false,
          rule_version: outcome.ruleVersion,
          cli_version: outcome.cliVersion,
          compatible_range: outcome.compatibleRange,
          drift: outcome.drift,
        })}\n`,
        stderr: "",
      };
    }
    const lines: string[] = [];
    lines.push(`doctor: drift detected (rule_version=${outcome.ruleVersion}, cli_version=${outcome.cliVersion}, compatible_range=${outcome.compatibleRange})`);
    for (const d of outcome.drift) {
      lines.push(`  - [${d.kind}] ${d.id}: ${d.remediation}`);
    }
    return { exitCode: 1, stdout: "", stderr: `${lines.join("\n")}\n` };
  }
  if (outcome.kind === "registry-not-found") {
    return refusal(
      { format_version: 1, ok: false, kind: "registry-not-found", path: outcome.path },
      `enforcement registry not found at ${outcome.path}`,
      2,
      format,
    );
  }
  return refusal(
    { format_version: 1, ok: false, kind: "invalid-registry", path: outcome.path, reason: outcome.reason },
    `enforcement registry at ${outcome.path} could not be parsed: ${outcome.reason}`,
    2,
    format,
  );
}

function refusal(envelope: object, human: string, exitCode: 1 | 2, format: Exclude<OutputFormat, "yaml">): CommandResult {
  if (format === "json") {
    return { exitCode, stdout: `${JSON.stringify(envelope)}\n`, stderr: "" };
  }
  return { exitCode, stdout: "", stderr: `doctor: ${human}\n` };
}
