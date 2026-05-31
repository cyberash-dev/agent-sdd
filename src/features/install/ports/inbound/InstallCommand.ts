import type { CommandResult } from "../../../../shared/domain/CliOutput.js";
import type { InstallTarget } from "../../domain/InstallTarget.js";

export type { InstallTarget };

export interface InstallOptions {
	dryRun: boolean;
}

export interface InstallCommand {
	execute(
		target: InstallTarget,
		options: InstallOptions,
		format: "json" | "human",
	): Promise<CommandResult>;
}
