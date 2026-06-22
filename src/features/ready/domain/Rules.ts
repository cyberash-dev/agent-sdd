import type { Partition } from "../../../shared/domain/Config.js";
import type { LintRecord } from "../../../shared/domain/SpecRecord.js";
import type { Marker } from "./MarkerParser.js";
import { fileInGlobs } from "./PartitionResolver.js";
import type { ReadyViolation } from "./ReadyViolation.js";
import {
	isNormative,
	isNotApplicableTestObligation,
	isObject,
	isTerminalStatus,
	readCompatibilityAction,
	readMembers,
	readVersion,
} from "./RulesHelpers.js";

/*
 * Per-partition parsed records and credited markers. Built by RunReady before
 * rule classifiers run; rules are pure over this view.
 */
export interface PartitionView {
	partition: Partition;
	records: LintRecord[]; /* records parsed from partition.spec_paths */
	recordsById: Map<
		string,
		LintRecord
	>; /* key = full id, e.g. "sdd-cli:BEH-001" */
	creditedMarkersById: Map<
		string,
		Marker[]
	>; /* markers in partition.test_paths whose prefix == partition.name */
}

/*
 * Surface is normative but exempt from individual coverage requirements; its
 * members carry the obligation. Matches lint's OBLIGATIONLESS_TEMPLATES.
 */
const COVERAGE_EXEMPT_TEMPLATES: ReadonlySet<string> = new Set(["Surface"]);

export function ruleUnapproved(view: PartitionView): ReadyViolation[] {
	const out: ReadyViolation[] = [];
	for (const rec of view.records) {
		if (!isNormative(rec)) {
			continue;
		}
		const status = rec.lifecycleStatus;
		if (status !== "draft" && status !== "proposed") {
			continue;
		}
		if (fileInGlobs(rec.file, view.partition.sandboxPaths)) {
			continue;
		}
		out.push({
			kind: "unapproved",
			id: rec.id,
			partition: view.partition.name,
			status,
			file: rec.file,
			line: rec.line,
			remediation: "promote via `sdd approve` or move into sandbox_paths",
		});
	}
	return out;
}

export function ruleUncovered(view: PartitionView): ReadyViolation[] {
	const out: ReadyViolation[] = [];
	for (const rec of view.records) {
		if (!isNormative(rec)) {
			continue;
		}
		if (rec.template !== null && COVERAGE_EXEMPT_TEMPLATES.has(rec.template)) {
			continue;
		}
		if (
			rec.lifecycleStatus !== "approved" &&
			rec.lifecycleStatus !== "deprecated"
		) {
			continue;
		}
		if (isNotApplicableTestObligation(rec)) {
			continue;
		}
		if ((view.creditedMarkersById.get(rec.id) ?? []).length > 0) {
			continue;
		}
		out.push({
			kind: "uncovered",
			id: rec.id,
			partition: view.partition.name,
			status: rec.lifecycleStatus,
			file: rec.file,
			line: rec.line,
			remediation:
				"add `@covers " +
				rec.id +
				"` next to a test for this ID, or set `Test obligation: not_applicable + reason`",
		});
	}
	return out;
}

export function ruleRemovedNoCompatTest(view: PartitionView): ReadyViolation[] {
	const out: ReadyViolation[] = [];
	for (const rec of view.records) {
		if (!isNormative(rec)) {
			continue;
		}
		if (rec.lifecycleStatus !== "removed") {
			continue;
		}
		const markers = view.creditedMarkersById.get(rec.id) ?? [];
		const hasCompat = markers.some(
			(m) => typeof m.tail.compatibility_action === "string",
		);
		if (hasCompat) {
			continue;
		}
		out.push({
			kind: "removed_no_compat_test",
			id: rec.id,
			partition: view.partition.name,
			status: rec.lifecycleStatus,
			file: rec.file,
			line: rec.line,
			remediation:
				"add a test with `@covers " +
				rec.id +
				" compatibility_action=<action>`",
		});
	}
	return out;
}

export function ruleRemovedCompatActionMismatch(
	view: PartitionView,
): ReadyViolation[] {
	const out: ReadyViolation[] = [];
	for (const rec of view.records) {
		if (!isNormative(rec)) {
			continue;
		}
		if (rec.lifecycleStatus !== "removed") {
			continue;
		}
		const expected = readCompatibilityAction(rec);
		if (expected === null) {
			continue;
		}
		const markers = view.creditedMarkersById.get(rec.id) ?? [];
		for (const m of markers) {
			const actual = m.tail.compatibility_action;
			if (typeof actual !== "string") {
				continue;
			}
			if (actual === expected) {
				continue;
			}
			out.push({
				kind: "removed_compat_action_mismatch",
				id: rec.id,
				partition: view.partition.name,
				status: rec.lifecycleStatus,
				file: m.file,
				line: m.line,
				expected,
				actual,
				remediation:
					"align marker's compatibility_action= with the spec's compatibility_action",
			});
		}
	}
	return out;
}

export function ruleSurfaceUnapprovedRef(
	view: PartitionView,
): ReadyViolation[] {
	const out: ReadyViolation[] = [];
	for (const rec of view.records) {
		if (rec.template !== "Surface") {
			continue;
		}
		const status = rec.lifecycleStatus;
		if (
			status !== "approved" &&
			status !== "deprecated" &&
			status !== "removed"
		) {
			continue;
		}
		const members = readMembers(rec);
		for (const memberId of members) {
			const member = view.recordsById.get(memberId);
			if (member === undefined) {
				continue;
			}
			const ms = member.lifecycleStatus;
			if (ms === "approved" || ms === "deprecated" || ms === "removed") {
				continue;
			}
			out.push({
				kind: "surface_unapproved_ref",
				id: rec.id,
				partition: view.partition.name,
				status,
				file: rec.file,
				line: rec.line,
				remediation: `member ${memberId} is ${ms ?? "missing-status"}; approve it before approving Surface ${rec.id}`,
			});
		}
	}
	return out;
}

/*
 * BEH-075: surface_ref/members drift and unapplied surface_impact — the
 * back-walking complement of ruleSurfaceUnapprovedRef; also checks an approved
 * Delta's declared surface_impact bump was applied to the target Surface.
 */
export function ruleSurfaceMemberDrift(view: PartitionView): ReadyViolation[] {
	const out: ReadyViolation[] = [];

	for (const rec of view.records) {
		const ref = rec.parsed.surface_ref;
		if (typeof ref !== "string" || !isTerminalStatus(rec.lifecycleStatus)) {
			continue;
		}
		const surface = view.recordsById.get(ref);
		if (
			surface === undefined ||
			surface.template !== "Surface" ||
			!isTerminalStatus(surface.lifecycleStatus)
		) {
			continue;
		}
		if (readMembers(surface).includes(rec.id)) {
			continue;
		}
		out.push({
			kind: "surface_member_drift",
			id: surface.id,
			partition: view.partition.name,
			status: surface.lifecycleStatus ?? undefined,
			file: surface.file,
			line: surface.line,
			remediation: `record ${rec.id} declares surface_ref ${surface.id} but is absent from its members; finalise the Delta that adds it`,
		});
	}

	for (const rec of view.records) {
		if (rec.template !== "Delta" || !isTerminalStatus(rec.lifecycleStatus)) {
			continue;
		}
		const impact = rec.parsed.surface_impact;
		if (!Array.isArray(impact)) {
			continue;
		}
		for (const entry of impact) {
			if (!isObject(entry) || typeof entry.id !== "string") {
				continue;
			}
			const intended = entry.intended_version;
			if (typeof intended !== "string") {
				continue;
			}
			const surface = view.recordsById.get(entry.id);
			if (surface === undefined || surface.template !== "Surface") {
				continue;
			}
			const actual = readVersion(surface);
			if (actual === intended) {
				continue;
			}
			out.push({
				kind: "surface_member_drift",
				id: surface.id,
				partition: view.partition.name,
				status: surface.lifecycleStatus ?? undefined,
				file: rec.file,
				line: rec.line,
				expected: intended,
				actual: actual ?? undefined,
				remediation: `Delta ${rec.id} declares surface_impact ${surface.id}@${intended} but the surface is at ${actual ?? "unset"}; finalise the Delta to apply the bump`,
			});
		}
	}

	return out;
}

export interface ScannedMarker {
	marker: Marker;
	isPartitionConfigured: boolean;
	hasMatchingRecord: boolean;
}

export function ruleOrphanCovers(
	scanned: readonly ScannedMarker[],
): ReadyViolation[] {
	const out: ReadyViolation[] = [];
	for (const s of scanned) {
		if (!s.isPartitionConfigured) {
			continue;
		} /* covered by ruleUnknownPartitionCovers */
		if (s.hasMatchingRecord) {
			continue;
		}
		out.push({
			kind: "orphan_covers",
			id: `${s.marker.partition}:${s.marker.id}`,
			partition: s.marker.partition,
			file: s.marker.file,
			line: s.marker.line,
			remediation:
				"marker references an ID not present in that partition's spec; remove the marker or add the ID",
		});
	}
	return out;
}

export function ruleUnknownPartitionCovers(
	scanned: readonly ScannedMarker[],
): ReadyViolation[] {
	const out: ReadyViolation[] = [];
	for (const s of scanned) {
		if (s.isPartitionConfigured) {
			continue;
		}
		out.push({
			kind: "unknown_partition_covers",
			id: `${s.marker.partition}:${s.marker.id}`,
			partition: s.marker.partition,
			file: s.marker.file,
			line: s.marker.line,
			remediation:
				"configure the partition in `.sdd/config.json#partitions` or fix the marker prefix",
		});
	}
	return out;
}
