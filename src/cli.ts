#!/usr/bin/env node
import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { CliApproveHandler } from "./features/approve/adapters/inbound/CliApproveHandler.js";
import { NodeApproveFileSystem } from "./features/approve/adapters/outbound/NodeApproveFileSystem.js";
import { SystemApproveClock } from "./features/approve/adapters/outbound/SystemApproveClock.js";
import { VALID_TARGET_STATUS, type ApproveRequest, type TargetStatus } from "./features/approve/domain/ApproveRequest.js";
import { CliCheckHandler } from "./features/check/adapters/inbound/CliCheckHandler.js";
import { ChildProcessCheckGit } from "./features/check/adapters/outbound/ChildProcessCheckGit.js";
import { NodeCheckFileReader } from "./features/check/adapters/outbound/NodeCheckFileReader.js";
import { CliLintHandler } from "./features/lint/adapters/inbound/CliLintHandler.js";
import { NodeLintFileReader } from "./features/lint/adapters/outbound/NodeLintFileReader.js";
import { CliReadyHandler } from "./features/ready/adapters/inbound/CliReadyHandler.js";
import { ChildProcessReadyGit } from "./features/ready/adapters/outbound/ChildProcessReadyGit.js";
import { NodeReadyFileSystem } from "./features/ready/adapters/outbound/NodeReadyFileSystem.js";
import { CliRefreshHandler } from "./features/refresh/adapters/inbound/CliRefreshHandler.js";
import { ChildProcessRefreshGit } from "./features/refresh/adapters/outbound/ChildProcessRefreshGit.js";
import { NodeRefreshFileReader } from "./features/refresh/adapters/outbound/NodeRefreshFileReader.js";
import { SystemRefreshClock } from "./features/refresh/adapters/outbound/SystemRefreshClock.js";
import { CliTokenHandler } from "./features/token/adapters/inbound/CliTokenHandler.js";
import { ChildProcessTokenGit } from "./features/token/adapters/outbound/ChildProcessTokenGit.js";
import { NodeTokenConfigReader } from "./features/token/adapters/outbound/NodeTokenConfigReader.js";
import type { CommandResult, OutputFormat } from "./shared/domain/CliOutput.js";

type Subcommand = "token" | "check" | "refresh" | "lint" | "approve" | "ready";

interface ParsedArgv {
  mode: "command" | "help" | "version" | "error";
  subcommand?: Subcommand;
  format?: OutputFormat;
  approve?: ApproveArgs;
  ready?: ReadyArgs;
  message?: string;
}

interface ApproveArgs {
  id?: string;
  approver?: string;
  ownerRole?: string;
  changeRequest?: string;
  scope?: string;
  targetStatus?: string;
  reviewedTestOracle?: string;
}

interface ReadyArgs {
  partition?: string;
}

const TOP_LEVEL_HELP = `sdd

Usage:
  sdd token   [--format=json|human]
  sdd check   [--format=json|human]
  sdd refresh [--format=json|human|yaml]
  sdd lint    [--format=json|human]
  sdd approve --id <id-or-glob> --approver <human-id>
              --owner-role <role> --change-request <url>
              [--scope <scope>] [--target-status approved|deprecated|removed]
              [--reviewed-test-oracle <ref>] [--format=json|human]
  sdd ready   [--format=json|human] [--partition <name>]
  sdd --help
  sdd --version`;

const COMMAND_HELP: Record<Subcommand, string> = {
  token: "Usage: sdd token [--format=json|human]",
  check: "Usage: sdd check [--format=json|human]",
  refresh: "Usage: sdd refresh [--format=json|human|yaml]",
  lint: "Usage: sdd lint [--format=json|human]",
  approve: "Usage: sdd approve --id <id-or-glob> --approver <human-id> --owner-role <role> --change-request <url> [--scope <scope>] [--target-status approved|deprecated|removed] [--reviewed-test-oracle <ref>] [--format=json|human]",
  ready: "Usage: sdd ready [--format=json|human] [--partition <name>]",
};

export async function main(argv: readonly string[], cwd: string): Promise<CommandResult> {
  const parsed = parseArgv(argv);
  if (parsed.mode === "help") {
    return { exitCode: 0, stdout: `${parsed.subcommand ? COMMAND_HELP[parsed.subcommand] : TOP_LEVEL_HELP}\n`, stderr: "" };
  }
  if (parsed.mode === "version") {
    return { exitCode: 0, stdout: `${packageVersion()}\n`, stderr: "" };
  }
  if (parsed.mode === "error") {
    return { exitCode: 2, stdout: "", stderr: `${parsed.message ?? "invalid arguments"}\n${TOP_LEVEL_HELP}\n` };
  }

  if (parsed.subcommand === "token") {
    const command = new CliTokenHandler({
      config: new NodeTokenConfigReader(),
      git: new ChildProcessTokenGit(),
    });
    return command.execute(cwd, parsed.format === "json" ? "json" : "human");
  }
  if (parsed.subcommand === "check") {
    const files = new NodeCheckFileReader();
    const command = new CliCheckHandler({
      config: files,
      git: new ChildProcessCheckGit(),
      spec: files,
    });
    return command.execute(cwd, parsed.format === "json" ? "json" : "human");
  }
  if (parsed.subcommand === "lint") {
    const files = new NodeLintFileReader();
    const command = new CliLintHandler({ config: files, files });
    return command.execute(cwd, parsed.format === "json" ? "json" : "human");
  }
  if (parsed.subcommand === "approve") {
    const req = approveRequest(parsed.approve ?? {});
    if (req.mode === "error") {
      return { exitCode: 2, stdout: "", stderr: `${req.message}\n${COMMAND_HELP.approve}\n` };
    }
    const files = new NodeApproveFileSystem();
    const command = new CliApproveHandler({ clock: new SystemApproveClock(), config: files, files });
    return command.execute(cwd, req.value, parsed.format === "json" ? "json" : "human");
  }
  if (parsed.subcommand === "ready") {
    const fs = new NodeReadyFileSystem();
    const command = new CliReadyHandler({ config: fs, files: fs, git: new ChildProcessReadyGit() });
    return command.execute(cwd, parsed.format === "json" ? "json" : "human", parsed.ready?.partition);
  }
  const refreshFiles = new NodeRefreshFileReader();
  const refreshCommand = new CliRefreshHandler({
    clock: new SystemRefreshClock(),
    config: refreshFiles,
    git: new ChildProcessRefreshGit(),
    spec: refreshFiles,
  });
  return refreshCommand.execute(cwd, parsed.format ?? "yaml");
}

function parseArgv(argv: readonly string[]): ParsedArgv {
  if (argv.length === 0) return { mode: "help" };
  if (argv.length === 1 && argv[0] === "--help") return { mode: "help" };
  if (argv.length === 1 && argv[0] === "--version") return { mode: "version" };
  const subcommand = argv[0];
  if (!isSubcommand(subcommand)) return { mode: "error", message: `unknown subcommand: ${subcommand}` };
  if (argv.length === 2 && argv[1] === "--help") return { mode: "help", subcommand };

  const rest = argv.slice(1);
  if (subcommand === "approve") {
    return parseApproveArgv(rest);
  }
  if (subcommand === "ready") {
    return parseReadyArgv(rest);
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
    const arg = args[i]!;
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
    return { mode: "error", message: `unknown flag: ${arg}` };
  }
  return { mode: "command", subcommand: "ready", format, ready };
}

function parseApproveArgv(args: readonly string[]): ParsedArgv {
  const approve: ApproveArgs = {};
  let format: OutputFormat = "human";
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith("--format=")) {
      const value = arg.slice("--format=".length);
      if (!isFormat(value) || value === "yaml") {
        return { mode: "error", message: `invalid format: ${value}` };
      }
      format = value;
      continue;
    }
    if (!arg.startsWith("--")) return { mode: "error", message: `unknown positional: ${arg}` };
    const key = arg.slice(2);
    const next = args[i + 1];
    if (next === undefined || next.startsWith("--")) {
      return { mode: "error", message: `missing value for --${key}` };
    }
    i++;
    switch (key) {
      case "id": approve.id = next; break;
      case "approver": approve.approver = next; break;
      case "owner-role": approve.ownerRole = next; break;
      case "change-request": approve.changeRequest = next; break;
      case "scope": approve.scope = next; break;
      case "target-status": approve.targetStatus = next; break;
      case "reviewed-test-oracle": approve.reviewedTestOracle = next; break;
      default: return { mode: "error", message: `unknown flag: --${key}` };
    }
  }
  return { mode: "command", subcommand: "approve", format, approve };
}

type ApproveRequestParse =
  | { mode: "ok"; value: ApproveRequest }
  | { mode: "error"; message: string };

function approveRequest(args: ApproveArgs): ApproveRequestParse {
  if (args.id === undefined) return { mode: "error", message: "--id required" };
  if (args.approver === undefined) return { mode: "error", message: "--approver required" };
  if (args.ownerRole === undefined) return { mode: "error", message: "--owner-role required" };
  if (args.changeRequest === undefined) return { mode: "error", message: "--change-request required" };
  const targetStatus = args.targetStatus ?? "approved";
  if (!(VALID_TARGET_STATUS as Set<string>).has(targetStatus)) {
    return { mode: "error", message: `invalid --target-status: ${targetStatus}` };
  }
  return {
    mode: "ok",
    value: {
      id: args.id,
      approver: args.approver,
      ownerRole: args.ownerRole,
      changeRequest: args.changeRequest,
      scope: args.scope ?? "first-time-approval",
      targetStatus: targetStatus as TargetStatus,
      reviewedTestOracle: args.reviewedTestOracle ?? null,
    },
  };
}

function packageVersion(): string {
  const packagePath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  const value = JSON.parse(readFileSync(packagePath, "utf8")) as { version?: unknown };
  if (typeof value.version !== "string") {
    throw new Error("package.json version is missing");
  }
  return value.version;
}

function isSubcommand(value: string | undefined): value is Subcommand {
  return value === "token" || value === "check" || value === "refresh" || value === "lint" || value === "approve" || value === "ready";
}

function isFormat(value: string): value is OutputFormat {
  return value === "json" || value === "human" || value === "yaml";
}

if (isEntrypoint()) {
  const result = await main(process.argv.slice(2), process.cwd());
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}

function isEntrypoint(): boolean {
  if (process.argv[1] === undefined) return false;
  return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
}
