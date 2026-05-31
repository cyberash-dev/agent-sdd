import {
	failed,
	ok,
	type CommandResult,
	type OutputFormat,
} from "../../../../shared/domain/CliOutput.js";
import { CliFailure } from "../../../../shared/domain/Errors.js";
import {
	buildRefreshStubs,
	type BuildRefreshStubsPorts,
} from "../../application/BuildRefreshStubs.js";
import type { RefreshCommand } from "../../ports/inbound/RefreshCommand.js";

export class CliRefreshHandler implements RefreshCommand {
	constructor(private readonly ports: BuildRefreshStubsPorts) {}

	async execute(cwd: string, format: OutputFormat): Promise<CommandResult> {
		try {
			const outcome = await buildRefreshStubs(cwd, format, this.ports);
			if (outcome.kind === "json") {
				return ok(JSON.stringify(outcome.body));
			}
			return ok(outcome.text);
		} catch (error) {
			if (error instanceof CliFailure) {
				return failed(error, format);
			}
			throw error;
		}
	}
}
