import type {
	CommandResult,
	OutputFormat,
} from "../../../../shared/domain/CliOutput.js";

export interface DoctorRequest {
	rulesPath: string;
	ruleVersion: boolean;
}

export interface DoctorCommand {
	execute(
		cwd: string,
		req: DoctorRequest,
		format: Exclude<OutputFormat, "yaml">,
	): Promise<CommandResult>;
}
