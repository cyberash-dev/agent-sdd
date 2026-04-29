import type { CommandResult, OutputFormat } from "../../../../shared/domain/CliOutput.js";
import type { ApproveRequest } from "../../domain/ApproveRequest.js";

export type { ApproveRequest, TargetStatus } from "../../domain/ApproveRequest.js";

export interface ApproveCommand {
  execute(cwd: string, req: ApproveRequest, format: Exclude<OutputFormat, "yaml">): Promise<CommandResult>;
}
