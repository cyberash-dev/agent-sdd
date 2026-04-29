import { failed, ok, type CommandResult, type OutputFormat } from "../../../../shared/domain/CliOutput.js";
import { CliFailure } from "../../../../shared/domain/Errors.js";
import { computeToken, type ComputeTokenPorts } from "../../application/ComputeToken.js";
import type { TokenCommand } from "../../ports/inbound/TokenCommand.js";

export class CliTokenHandler implements TokenCommand {
  constructor(private readonly ports: ComputeTokenPorts) {}

  async execute(cwd: string, format: Exclude<OutputFormat, "yaml">): Promise<CommandResult> {
    try {
      const outcome = await computeToken(cwd, this.ports);
      if (outcome.kind === "dirty") {
        return dirtyResult(outcome.dirtyPaths, format);
      }
      if (format === "json") {
        return ok(JSON.stringify({
          format_version: 1,
          ok: true,
          token: outcome.token,
          commit_sha: outcome.commitSha,
          mechanism: outcome.mechanism,
          scope: outcome.scope,
        }));
      }
      return ok(`token ${outcome.token}\n  commit_sha: ${outcome.commitSha}\n  mechanism: ${outcome.mechanism}\n  scope: ${outcome.scope.join(", ")}`);
    } catch (error) {
      if (error instanceof CliFailure) {
        return failed(error, format);
      }
      throw error;
    }
  }
}

function dirtyResult(dirtyPaths: readonly string[], format: Exclude<OutputFormat, "yaml">): CommandResult {
  if (format === "json") {
    return {
      exitCode: 1,
      stdout: `${JSON.stringify({
        format_version: 1,
        ok: false,
        reason: "baseline-dirty",
        dirty_paths: dirtyPaths,
      })}\n`,
      stderr: "",
    };
  }
  return {
    exitCode: 1,
    stdout: "",
    stderr: `baseline-dirty: scope has uncommitted changes\n  ${dirtyPaths.join("\n  ")}\n`,
  };
}
