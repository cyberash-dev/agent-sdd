import {
	lintRecordsFromMarkdown,
	type LintRecord,
} from "../../../shared/domain/SpecRecord.js";
import { parseMarkers, parseNearMisses, type Marker } from "./MarkerParser.js";
import type { ReadyAdvisory } from "./ReadyViolation.js";

/* Structural shape of a resolved spec/test file; mirrors the port's
 * SpecFileEntry/TestFileEntry without importing it (domain must not depend on
 * ports). */
interface SpecFile {
	path: string;
	content: string;
}

export type RecordsParse =
	| { kind: "ok"; records: LintRecord[] }
	| { kind: "error"; file: string; message: string };

export function parsePartitionRecords(
	entries: readonly SpecFile[],
): RecordsParse {
	const records: LintRecord[] = [];
	for (const entry of entries) {
		try {
			records.push(...lintRecordsFromMarkdown(entry.path, entry.content));
		} catch (error) {
			return {
				kind: "error",
				file: entry.path,
				message: error instanceof Error ? error.message : String(error),
			};
		}
	}
	return { kind: "ok", records };
}

export function scanPartitionMarkers(entries: readonly SpecFile[]): {
	markers: Marker[];
	nearMisses: ReadyAdvisory[];
} {
	const markers: Marker[] = [];
	const nearMisses: ReadyAdvisory[] = [];
	for (const entry of entries) {
		markers.push(...parseMarkers(entry.content, entry.path));
		for (const nm of parseNearMisses(entry.content, entry.path)) {
			nearMisses.push({
				kind: "covers_near_miss",
				file: nm.file,
				line: nm.line,
				text: nm.text,
				remediation: `\`@covers ${nm.text}\` looks like a marker but fails the partition grammar (lowercase segments only); fix the prefix or remove the stray @covers text`,
			});
		}
	}
	return { markers, nearMisses };
}
