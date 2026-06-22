import type { Partition, SddConfig } from "../../../shared/domain/Config.js";
import type { LintRecord } from "../../../shared/domain/SpecRecord.js";
import type { Marker } from "./MarkerParser.js";
import {
	ruleOrphanCovers,
	ruleRemovedCompatActionMismatch,
	ruleRemovedNoCompatTest,
	ruleSurfaceMemberDrift,
	ruleSurfaceUnapprovedRef,
	ruleUnapproved,
	ruleUncovered,
	ruleUnknownPartitionCovers,
	type PartitionView,
	type ScannedMarker,
} from "./Rules.js";
import type { ReadyViolation } from "./ReadyViolation.js";

export function perPartitionViolations(
	evaluatedPartitions: readonly Partition[],
	recordsByPartition: ReadonlyMap<string, LintRecord[]>,
	markersByPartition: ReadonlyMap<string, Marker[]>,
): ReadyViolation[] {
	const violations: ReadyViolation[] = [];
	for (const partition of evaluatedPartitions) {
		const records = recordsByPartition.get(partition.name) ?? [];
		const recordsById = new Map<string, LintRecord>();
		for (const r of records) {
			recordsById.set(r.id, r);
		}

		const credited = new Map<string, Marker[]>();
		const ownMarkers = markersByPartition.get(partition.name) ?? [];
		for (const m of ownMarkers) {
			if (m.partition !== partition.name) {
				continue;
			}
			const id = `${m.partition}:${m.id}`;
			const list = credited.get(id) ?? [];
			list.push(m);
			credited.set(id, list);
		}

		const view: PartitionView = {
			partition,
			records,
			recordsById,
			creditedMarkersById: credited,
		};

		violations.push(
			...ruleUnapproved(view),
			...ruleUncovered(view),
			...ruleRemovedNoCompatTest(view),
			...ruleRemovedCompatActionMismatch(view),
			...ruleSurfaceUnapprovedRef(view),
			...ruleSurfaceMemberDrift(view),
		);
	}
	return violations;
}

/* Phase 4 dedups markers by (file, line, partition, id) — a file listed in
 * multiple partitions' test_paths must not be double-counted — then surfaces
 * unknown_partition_covers and orphan_covers globally regardless of --partition. */
export function markerLevelViolations(
	partitions: readonly Partition[],
	recordsByPartition: ReadonlyMap<string, LintRecord[]>,
	markersByPartition: ReadonlyMap<string, Marker[]>,
): ReadyViolation[] {
	const partitionsByName = new Map(partitions.map((p) => [p.name, p] as const));
	const seen = new Set<string>();
	const allMarkers: Marker[] = [];
	for (const ms of markersByPartition.values()) {
		for (const m of ms) {
			const key = `${m.file}:${m.line}:${m.partition}:${m.id}`;
			if (seen.has(key)) {
				continue;
			}
			seen.add(key);
			allMarkers.push(m);
		}
	}
	const scanned: ScannedMarker[] = [];
	for (const m of allMarkers) {
		const fullId = `${m.partition}:${m.id}`;
		const partition = partitionsByName.get(m.partition);
		const isPartitionConfigured = partition !== undefined;
		const records = isPartitionConfigured
			? (recordsByPartition.get(m.partition) ?? [])
			: [];
		const hasMatchingRecord = records.some((r) => r.id === fullId);
		scanned.push({ marker: m, isPartitionConfigured, hasMatchingRecord });
	}
	return [...ruleUnknownPartitionCovers(scanned), ...ruleOrphanCovers(scanned)];
}

export function uniqueSpecPaths(
	evaluated: readonly Partition[],
	config: SddConfig,
): string[] {
	const all =
		evaluated.length > 0
			? evaluated.flatMap((p) => p.specPaths)
			: config.lint.specFiles;
	return [...new Set(all)];
}
