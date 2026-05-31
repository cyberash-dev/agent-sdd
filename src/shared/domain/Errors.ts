export type ExitCode = 0 | 1 | 2 | 3;

export type FailureReason =
	| "baseline-dirty"
	| "baseline-stale"
	| "config-missing"
	| "config-invalid"
	| "baseline-block-missing"
	| "baseline-block-duplicate"
	| "git-not-on-path"
	| "not-a-git-repo"
	| "head-unborn";

export class CliFailure extends Error {
	readonly exitCode: ExitCode;
	readonly reason: FailureReason;
	readonly path?: string;
	readonly detail?: string;

	constructor(
		exitCode: ExitCode,
		reason: FailureReason,
		message: string,
		detail?: string,
		path?: string,
	) {
		super(message);
		this.name = "CliFailure";
		this.exitCode = exitCode;
		this.reason = reason;
		this.detail = detail;
		this.path = path;
	}
}

export function configFailure(
	reason: FailureReason,
	message: string,
	detail?: string,
	path?: string,
): CliFailure {
	return new CliFailure(2, reason, message, detail, path);
}

export function environmentFailure(
	reason: FailureReason,
	message: string,
	detail?: string,
): CliFailure {
	return new CliFailure(3, reason, message, detail);
}

export function errorMessage(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}
