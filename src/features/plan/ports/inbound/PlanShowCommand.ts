import type { CommandResult, OutputFormat } from "../../../../shared/domain/CliOutput.js";

export interface PlanShowRequest {
  planId?: string;
}

export interface PlanShowCommand {
  execute(cwd: string, req: PlanShowRequest, format: Exclude<OutputFormat, "yaml">): Promise<CommandResult>;
}
