/*
 * Tiny semver-range tester. Supports only the form sdd-cli's enforcement
 * registry actually uses: `">=A.B <C.D"` (whitespace-separated comparators).
 * No prerelease, no caret/tilde, no logical OR.
 *
 * Pure logic. No node:* imports.
 */

interface Comparator {
	op: ">=" | ">" | "<=" | "<" | "=";
	version: { major: number; minor: number; patch: number };
}

export interface ParsedVersion {
	major: number;
	minor: number;
	patch: number;
}

export function parseVersion(s: string): ParsedVersion | null {
	const m = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(s.trim());
	if (m === null) {
		return null;
	}
	return {
		major: Number.parseInt(m[1], 10),
		minor: Number.parseInt(m[2], 10),
		patch: m[3] !== undefined ? Number.parseInt(m[3], 10) : 0,
	};
}

export function rangeIncludes(range: string, version: string): boolean {
	const parsed = parseVersion(version);
	if (parsed === null) {
		return false;
	}
	const comparators = parseRange(range);
	if (comparators === null) {
		return false;
	}
	return comparators.every((c) => satisfies(parsed, c));
}

function parseRange(range: string): Comparator[] | null {
	const parts = range.trim().split(/\s+/);
	const out: Comparator[] = [];
	for (const part of parts) {
		const m = /^(>=|<=|>|<|=)?(\d+)\.(\d+)(?:\.(\d+))?$/.exec(part);
		if (m === null) {
			return null;
		}
		const rawOp = m[1] ?? "=";
		if (!isComparatorOp(rawOp)) {
			return null;
		}
		const op = rawOp;
		const version = {
			major: Number.parseInt(m[2], 10),
			minor: Number.parseInt(m[3], 10),
			patch: m[4] !== undefined ? Number.parseInt(m[4], 10) : 0,
		};
		out.push({ op, version });
	}
	return out;
}

function isComparatorOp(value: string): value is Comparator["op"] {
	return (
		value === ">=" ||
		value === ">" ||
		value === "<=" ||
		value === "<" ||
		value === "="
	);
}

function satisfies(v: ParsedVersion, c: Comparator): boolean {
	const cmp = compare(v, c.version);
	switch (c.op) {
		case ">=":
			return cmp >= 0;
		case ">":
			return cmp > 0;
		case "<=":
			return cmp <= 0;
		case "<":
			return cmp < 0;
		case "=":
			return cmp === 0;
	}
}

function compare(a: ParsedVersion, b: ParsedVersion): number {
	if (a.major !== b.major) {
		return a.major - b.major;
	}
	if (a.minor !== b.minor) {
		return a.minor - b.minor;
	}
	return a.patch - b.patch;
}
