import type { CliFailure, ExitCode } from "./Errors.js";

export type OutputFormat = "human" | "json" | "yaml";

export interface CommandResult {
  exitCode: ExitCode;
  stdout: string;
  stderr: string;
}

export function ok(stdout: string): CommandResult {
  return { exitCode: 0, stdout: withLf(stdout), stderr: "" };
}

export function failed(failure: CliFailure, format: OutputFormat): CommandResult {
  if (format === "json") {
    return {
      exitCode: failure.exitCode,
      stdout: `${JSON.stringify({
        format_version: 1,
        ok: false,
        reason: failure.reason,
        path: failure.path,
        detail: failure.detail ?? failure.message,
      })}\n`,
      stderr: "",
    };
  }
  return {
    exitCode: failure.exitCode,
    stdout: "",
    stderr: `${failure.reason}: ${failure.message}${failure.detail ? ` (${failure.detail})` : ""}\n`,
  };
}

export function withLf(value: string): string {
  if (value.length === 0 || value.endsWith("\n")) {
    return value;
  }
  return `${value}\n`;
}
