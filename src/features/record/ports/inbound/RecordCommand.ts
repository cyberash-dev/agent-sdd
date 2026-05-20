import type { CommandResult, OutputFormat } from "../../../../shared/domain/CliOutput.js";

export type RecordAction =
  | { kind: "list"; partition?: string }
  | { kind: "get"; id: string };

export interface RecordCommand {
  execute(cwd: string, action: RecordAction, format: Exclude<OutputFormat, "yaml">): Promise<CommandResult>;
}
