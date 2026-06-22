/*
 * Schema-diff helpers for the semver cascade (extracted from SpecDiff,
 * ready/domain). Pure logic — no I/O. CTR-016 / CTR-012 / CTR-014 rationale
 * lives in the spec records.
 */

function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

/* CTR-016 / CTR-012 / CTR-014 — schema sub-trees that are append-only at minor
 * (see spec records). */
const APPEND_ONLY_ZONE_KEYS: ReadonlySet<string> = new Set([
	"members",
	"fields",
	"json",
]);

/* True when a `schema` change is confined to pure additions inside an
 * append-only zone; any removal or modification stays a predicate change. */
export function isAppendOnlySchemaChange(
	prev: unknown,
	curr: unknown,
): boolean {
	if (!isPlainObject(prev) || !isPlainObject(curr)) {
		return false;
	}
	return appendOnlyWithinZones(prev, curr, false) && !deepEqual(prev, curr);
}

function appendOnlyWithinZones(
	prev: unknown,
	curr: unknown,
	inZone: boolean,
): boolean {
	if (deepEqual(prev, curr)) {
		return true;
	}
	if (Array.isArray(prev) && Array.isArray(curr)) {
		if (!inZone) {
			return false;
		}
		return prev.every((e) => curr.some((c) => deepEqual(c, e)));
	}
	if (isPlainObject(prev) && isPlainObject(curr)) {
		if (inZone) {
			return Object.keys(prev).every(
				(k) => k in curr && appendOnlyWithinZones(prev[k], curr[k], true),
			);
		}
		const prevKeys = Object.keys(prev);
		const currKeys = Object.keys(curr);
		if (prevKeys.length !== currKeys.length) {
			return false;
		}
		return prevKeys.every(
			(k) =>
				k in curr &&
				appendOnlyWithinZones(prev[k], curr[k], APPEND_ONLY_ZONE_KEYS.has(k)),
		);
	}
	return false;
}

export function changedTopLevelKeys(
	prev: Record<string, unknown>,
	curr: Record<string, unknown>,
): string[] {
	const out: string[] = [];
	const keys = new Set([...Object.keys(prev), ...Object.keys(curr)]);
	/*
	 * Skip metadata keys that don't affect semver: id, type, partition_id,
	 * lifecycle (status flips are governed separately), approval_record.
	 */
	const SKIP = new Set([
		"id",
		"type",
		"partition_id",
		"lifecycle",
		"approval_record",
		"version",
	]);
	for (const k of keys) {
		if (SKIP.has(k)) {
			continue;
		}
		if (!deepEqual(prev[k], curr[k])) {
			out.push(k);
		}
	}
	return out;
}

function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) {
		return true;
	}
	if (a === null || b === null) {
		return false;
	}
	if (typeof a !== typeof b) {
		return false;
	}
	if (typeof a !== "object") {
		return false;
	}
	if (Array.isArray(a) !== Array.isArray(b)) {
		return false;
	}
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) {
			return false;
		}
		for (let i = 0; i < a.length; i++) {
			if (!deepEqual(a[i], b[i])) {
				return false;
			}
		}
		return true;
	}
	if (!isPlainObject(a) || !isPlainObject(b)) {
		return false;
	}
	const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
	for (const k of keys) {
		if (!deepEqual(a[k], b[k])) {
			return false;
		}
	}
	return true;
}
