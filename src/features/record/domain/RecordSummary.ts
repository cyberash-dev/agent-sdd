export interface RecordSummary {
	id: string;
	type: string | null;
	status: string | null;
	title: string | null;
	file: string;
	line: number;
}

/** Derive a one-line display title for a record. Fixed fallback chain:
 *  the `title` field, else the `name` field (Surface records), else null. */
export function titleOf(parsed: Record<string, unknown>): string | null {
	const title = parsed.title;
	if (typeof title === "string") {
		return title;
	}
	const name = parsed.name;
	if (typeof name === "string") {
		return name;
	}
	return null;
}
