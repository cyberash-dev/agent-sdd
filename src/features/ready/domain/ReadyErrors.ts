import { CliFailure } from "../../../shared/domain/Errors.js";
import type { ReadyError } from "./ReadyViolation.js";

export function toReadyError(
	error: unknown,
	fallback: ReadyError["kind"],
): ReadyError {
	if (error instanceof CliFailure) {
		if (
			error.reason === "config-missing" ||
			error.reason === "config-invalid"
		) {
			return {
				kind: "config_invalid",
				message: error.message,
				file: error.path,
			};
		}
	}
	return {
		kind: fallback,
		message: error instanceof Error ? error.message : String(error),
	};
}
