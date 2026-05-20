import { ok, type CommandResult } from "../../../../shared/domain/CliOutput.js";
import { installRules, type InstallOutcome, type InstallPorts } from "../../application/InstallRules.js";
import type { InstallCommand, InstallOptions, InstallTarget } from "../../ports/inbound/InstallCommand.js";

export class CliInstallHandler implements InstallCommand {
  constructor(private readonly ports: InstallPorts) {}

  async execute(target: InstallTarget, options: InstallOptions, format: "json" | "human"): Promise<CommandResult> {
    const outcome = await installRules(target, options.dryRun, this.ports);
    return format === "json" ? toJson(outcome) : toHuman(outcome);
  }
}

function toJson(outcome: InstallOutcome): CommandResult {
  if (!outcome.ok) {
    const body = JSON.stringify({ format_version: 1, ok: false, reason: outcome.reason, detail: outcome.message });
    return { exitCode: outcome.exitCode, stdout: `${body}\n`, stderr: "" };
  }
  return ok(JSON.stringify({
    format_version: 1,
    ok: true,
    dry_run: outcome.dryRun,
    targets: outcome.targets,
    actions: outcome.actions.map((a) => ({ target: a.target, kind: a.kind, op: a.op, path: a.path, note: a.note })),
  }));
}

function toHuman(outcome: InstallOutcome): CommandResult {
  if (!outcome.ok) {
    return { exitCode: outcome.exitCode, stdout: "", stderr: `${outcome.reason}: ${outcome.message}\n` };
  }
  const header = outcome.dryRun
    ? `sdd install (dry run) — ${outcome.targets.join(", ")}: ${outcome.actions.length} action(s) planned`
    : `sdd install — ${outcome.targets.join(", ")}: ${outcome.actions.length} action(s) applied`;
  const lines = outcome.actions.map((a) => {
    const note = a.note ? `  (${a.note})` : "";
    return `  ${a.op.padEnd(11)} ${a.target.padEnd(6)} ${a.path}${note}`;
  });
  return ok([header, ...lines].join("\n"));
}
