import type { CommandResult, OutputFormat } from "../../../../shared/domain/CliOutput.js";

export interface LintCommand {
  execute(cwd: string, format: Exclude<OutputFormat, "yaml">): Promise<CommandResult>;
}
