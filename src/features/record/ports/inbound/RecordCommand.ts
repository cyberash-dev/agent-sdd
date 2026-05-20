import type { CommandResult, OutputFormat } from "../../../../shared/domain/CliOutput.js";

export type RecordAction =
  | { kind: "list"; partition?: string }
  | { kind: "get"; id: string }
  | { kind: "set"; id: string; body: string }
  | { kind: "add"; afterId: string; body: string };

export interface RecordCommand {
  execute(cwd: string, action: RecordAction, format: Exclude<OutputFormat, "yaml">): Promise<CommandResult>;
}
