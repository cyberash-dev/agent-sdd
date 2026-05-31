import type {
	CommandResult,
	OutputFormat,
} from "../../../../shared/domain/CliOutput.js";

export interface RefreshCommand {
	execute(cwd: string, format: OutputFormat): Promise<CommandResult>;
}
