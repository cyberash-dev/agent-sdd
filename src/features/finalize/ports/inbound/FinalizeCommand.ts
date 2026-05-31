import type {
	CommandResult,
	OutputFormat,
} from "../../../../shared/domain/CliOutput.js";

export interface FinalizeRequest {
	planId?: string;
}

export interface FinalizeCommand {
	execute(
		cwd: string,
		req: FinalizeRequest,
		format: Exclude<OutputFormat, "yaml">,
	): Promise<CommandResult>;
}
