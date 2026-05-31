import type {
	CommandResult,
	OutputFormat,
} from "../../../../shared/domain/CliOutput.js";

export interface ReadyCommand {
	execute(
		cwd: string,
		format: OutputFormat,
		partition?: string,
		against?: string,
	): Promise<CommandResult>;
}
