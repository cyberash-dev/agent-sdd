/*
 * ENF-004A — Semver cascade diff engine. Classifies per-ID changes and
 * computes the required Surface bump (rationale lives in the spec record).
 * Pure logic — no I/O.
 */

import type { LintRecord } from "../../../shared/domain/SpecRecord.js";
import {
	changedTopLevelKeys,
	isAppendOnlySchemaChange,
} from "./SpecDiffSchema.js";

export type DiffClassification = "predicate_change" | "content_change" | "none";

const PREDICATE_FIELDS: ReadonlySet<string> = new Set([
	"always",
	"never",
	"when",
	"then",
	"predicate",
	"schema",
	"preconditions",
	"postconditions",
	"error_taxonomy",
	"compatibility_rules",
	"rule" /* Constraint, Policy */,
	"metric" /* NFR */,
	"target" /* NFR */,
	"given" /* Behavior */,
]);

export interface ClassifiedDiff {
	id: string;
	template: string | null;
	classification: DiffClassification;
	changedFields: string[];
}

/** Per-ID diff: classify each ID present in `curr` against `prev`. IDs new to
 *  `curr` are classified as "content_change" (additive). IDs removed in
 *  `curr` are not returned (the consumer detects removal separately via
 *  lifecycle.status flips, which lint already covers). */
export function classifyDiff(
	prev: ReadonlyArray<LintRecord>,
	curr: ReadonlyArray<LintRecord>,
): ClassifiedDiff[] {
	const prevById = new Map(prev.map((r) => [r.id, r]));
	const out: ClassifiedDiff[] = [];
	for (const c of curr) {
		const p = prevById.get(c.id);
		if (p === undefined) {
			out.push({
				id: c.id,
				template: c.template,
				classification: "content_change",
				changedFields: ["__new__"],
			});
			continue;
		}
		const changed = changedTopLevelKeys(p.parsed, c.parsed);
		if (changed.length === 0) {
			out.push({
				id: c.id,
				template: c.template,
				classification: "none",
				changedFields: [],
			});
			continue;
		}
		const isPredicate = changed.some((k) => {
			/*
			 * CTR-016 / CTR-012: append-only schema additions are content, not
			 * predicate (see spec record for the full rule).
			 */
			if (
				k === "schema" &&
				isAppendOnlySchemaChange(p.parsed.schema, c.parsed.schema)
			) {
				return false;
			}
			return PREDICATE_FIELDS.has(k);
		});
		out.push({
			id: c.id,
			template: c.template,
			classification: isPredicate ? "predicate_change" : "content_change",
			changedFields: changed,
		});
	}
	return out;
}

/** Required bump for a single Surface, computed by walking reachable IDs. */
export type RequiredBump = "patch" | "minor" | "major";

export interface SurfaceBumpAnalysis {
	surfaceId: string;
	declaredVersion: string | null;
	prevDeclaredVersion: string | null;
	required: RequiredBump;
	drivenBy: ClassifiedDiff[];
}

export function requiredSurfaceBumps(
	prev: ReadonlyArray<LintRecord>,
	curr: ReadonlyArray<LintRecord>,
	diffs: ReadonlyArray<ClassifiedDiff>,
): SurfaceBumpAnalysis[] {
	const prevById = new Map(prev.map((r) => [r.id, r]));
	const diffById = new Map(diffs.map((d) => [d.id, d]));
	const currSurfaces = curr.filter((r) => r.template === "Surface");

	const out: SurfaceBumpAnalysis[] = [];
	for (const sur of currSurfaces) {
		const reachable = reachableFrom(sur, curr);
		const drivenBy: ClassifiedDiff[] = [];
		for (const id of reachable) {
			const d = diffById.get(id);
			if (d !== undefined && d.classification !== "none") {
				drivenBy.push(d);
			}
		}
		const required = drivenBy.some(
			(d) => d.classification === "predicate_change",
		)
			? "major"
			: drivenBy.some((d) => d.classification === "content_change")
				? "minor"
				: "patch";
		const declaredVersion = readVersion(sur);
		const prevSur = prevById.get(sur.id);
		const prevDeclaredVersion =
			prevSur !== undefined ? readVersion(prevSur) : null;
		out.push({
			surfaceId: sur.id,
			declaredVersion,
			prevDeclaredVersion,
			required,
			drivenBy,
		});
	}
	return out;
}

function reachableFrom(
	surface: LintRecord,
	all: ReadonlyArray<LintRecord>,
): Set<string> {
	const out = new Set<string>([surface.id]);
	const byId = new Map(all.map((r) => [r.id, r]));
	const queue: string[] = [surface.id];
	while (queue.length > 0) {
		const id = queue[0];
		queue.shift();
		const r = byId.get(id);
		if (r === undefined) {
			continue;
		}
		const members = r.parsed.members;
		if (Array.isArray(members)) {
			for (const m of members) {
				if (typeof m === "string" && !out.has(m)) {
					out.add(m);
					queue.push(m);
				}
			}
		}
		const policyRefs = r.parsed.policy_refs;
		if (Array.isArray(policyRefs)) {
			for (const p of policyRefs) {
				if (typeof p === "string" && !out.has(p)) {
					out.add(p);
					queue.push(p);
				}
			}
		}
	}
	return out;
}

function readVersion(rec: LintRecord): string | null {
	const v = rec.parsed.version;
	return typeof v === "string" ? v : null;
}

/* ENF-019 — picks out reachable published GeneratedArtifacts with a structural
 * diff (which force a major Surface bump); see spec record for the full rule. */
export interface GAStructuralDiff {
	surfaceId: string;
	generatedArtifactId: string;
	classification: Exclude<DiffClassification, "none">;
}

export function generatedArtifactStructuralDiffs(
	prev: ReadonlyArray<LintRecord>,
	curr: ReadonlyArray<LintRecord>,
	diffs: ReadonlyArray<ClassifiedDiff>,
): GAStructuralDiff[] {
	const byId = new Map(curr.map((r) => [r.id, r]));
	const diffById = new Map(diffs.map((d) => [d.id, d]));
	void prev;

	const out: GAStructuralDiff[] = [];
	const surfaces = curr.filter((r) => r.template === "Surface");

	for (const sur of surfaces) {
		const reachable = reachableFrom(sur, curr);
		for (const id of reachable) {
			if (id === sur.id) {
				continue;
			}
			const rec = byId.get(id);
			if (rec === undefined) {
				continue;
			}
			if (rec.template !== "GeneratedArtifact") {
				continue;
			}
			if (rec.parsed.published_surface !== "yes") {
				continue;
			}
			const d = diffById.get(id);
			if (d === undefined || d.classification === "none") {
				continue;
			}
			out.push({
				surfaceId: sur.id,
				generatedArtifactId: id,
				classification: d.classification,
			});
		}
	}
	return out;
}

/** Compare two semver strings ("0.3.0" vs "0.4.0") and return the actual bump.
 *  Returns null if either string is unparseable. */
export function actualBump(
	prev: string | null,
	curr: string | null,
): RequiredBump | null {
	if (prev === null || curr === null) {
		return null;
	}
	const p = parseSemver(prev);
	const c = parseSemver(curr);
	if (p === null || c === null) {
		return null;
	}
	if (c.major > p.major) {
		return "major";
	}
	if (c.major === p.major && c.minor > p.minor) {
		return "minor";
	}
	if (c.major === p.major && c.minor === p.minor && c.patch > p.patch) {
		return "patch";
	}
	return "patch"; /* unchanged or downgrade — treat as patch (no cascade triggered) */
}

interface ParsedSemver {
	major: number;
	minor: number;
	patch: number;
}

function parseSemver(v: string): ParsedSemver | null {
	const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
	if (m === null) {
		return null;
	}
	return {
		major: Number.parseInt(m[1], 10),
		minor: Number.parseInt(m[2], 10),
		patch: Number.parseInt(m[3], 10),
	};
}

const BUMP_RANK: Record<RequiredBump, number> = {
	patch: 0,
	minor: 1,
	major: 2,
};

export function bumpAtLeast(
	actual: RequiredBump | null,
	required: RequiredBump,
): boolean {
	if (actual === null) {
		return false;
	}
	return BUMP_RANK[actual] >= BUMP_RANK[required];
}
