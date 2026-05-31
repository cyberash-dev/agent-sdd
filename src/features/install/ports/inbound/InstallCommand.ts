import type { CommandResult } from "../../../../shared/domain/CliOutput.js";
import type {
	InstallScope,
	InstallTarget,
} from "../../domain/InstallTarget.js";

export type { InstallScope, InstallTarget };

export interface InstallOptions {
	dryRun: boolean;
	scope: InstallScope;
}

export interface InstallCommand {
	execute(
		target: InstallTarget,
		options: InstallOptions,
		format: "json" | "human",
	): Promise<CommandResult>;
}
