export type RecordWriteResult =
	| {
			ok: true;
			action: "set" | "add";
			id: string;
			file: string;
			startLine: number;
			endLine: number;
	  }
	| { ok: false; exitCode: 1 | 2; reason: string; message: string };

const PROTECTED_STATUSES: ReadonlySet<string> = new Set([
	"approved",
	"deprecated",
	"removed",
]);

export function isProtectedStatus(status: string | null): boolean {
	return status !== null && PROTECTED_STATUSES.has(status);
}
