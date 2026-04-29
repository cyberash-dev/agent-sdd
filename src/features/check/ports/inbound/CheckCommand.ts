import type { CommandResult, OutputFormat } from "../../../../shared/domain/CliOutput.js";

export interface CheckCommand {
  execute(cwd: string, format: Exclude<OutputFormat, "yaml">): Promise<CommandResult>;
}
