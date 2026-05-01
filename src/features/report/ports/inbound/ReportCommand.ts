import type { CommandResult, OutputFormat } from "../../../../shared/domain/CliOutput.js";

export interface ReportRequest {
  prSummary: boolean;
  against?: string;
}

export interface ReportCommand {
  execute(cwd: string, req: ReportRequest, format: Exclude<OutputFormat, "yaml">): Promise<CommandResult>;
}
