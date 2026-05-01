import { failed, ok, type CommandResult, type OutputFormat } from "../../../../shared/domain/CliOutput.js";
import { CliFailure } from "../../../../shared/domain/Errors.js";
import { checkBaseline, type CheckBaselinePorts } from "../../application/CheckBaseline.js";
import type { CheckCommand } from "../../ports/inbound/CheckCommand.js";

export class CliCheckHandler implements CheckCommand {
  constructor(private readonly ports: CheckBaselinePorts) {}

  async execute(cwd: string, format: Exclude<OutputFormat, "yaml">): Promise<CommandResult> {
    try {
      const outcome = await checkBaseline(cwd, this.ports);
      if (outcome.kind === "dirty") {
        return driftResult(format, "baseline-dirty", "", null, "", outcome.currentCommitSha, outcome.dirtyPaths);
      }
      if (outcome.kind === "stale") {
        return driftResult(format, "baseline-stale", outcome.recordedToken, outcome.recomputedToken, outcome.baselineCommitSha, outcome.currentCommitSha, []);
      }
      if (format === "json") {
        return ok(JSON.stringify({
          format_version: 1,
          ok: true,
          recorded_token: outcome.recordedToken,
          recomputed_token: outcome.recomputedToken,
          baseline_commit_sha: outcome.baselineCommitSha,
          current_commit_sha: outcome.currentCommitSha,
          mechanism: outcome.mechanism,
        }));
      }
      return ok(`ok true\n  recorded_token: ${outcome.recordedToken}\n  recomputed_token: ${outcome.recomputedToken}\n  baseline_commit_sha: ${outcome.baselineCommitSha}\n  current_commit_sha: ${outcome.currentCommitSha}`);
    } catch (error) {
      if (error instanceof CliFailure) {
        return failed(error, format);
      }
      throw error;
    }
  }
}

function driftResult(
  format: Exclude<OutputFormat, "yaml">,
  reason: "baseline-dirty" | "baseline-stale",
  recordedToken: string,
  recomputedToken: string | null,
  baselineCommitSha: string,
  currentCommitSha: string,
  dirtyPaths: readonly string[],
): CommandResult {
  if (format === "json") {
    return {
      exitCode: 1,
      stdout: `${JSON.stringify({
        format_version: 1,
        ok: false,
        reason,
        recorded_token: recordedToken,
        recomputed_token: recomputedToken,
        baseline_commit_sha: baselineCommitSha,
        current_commit_sha: currentCommitSha,
        dirty_paths: dirtyPaths,
      })}\n`,
      stderr: "",
    };
  }
  const dirtyText = dirtyPaths.length > 0 ? `\n  dirty_paths: ${dirtyPaths.join(", ")}` : "";
  return {
    exitCode: 1,
    stdout: "",
    stderr: `${reason}: token baseline is not current${dirtyText}\n`,
  };
}
