/*
 * BEH-073: materialise an approved Delta's surface_impact into the target
 * Surface. Pure module (no I/O): given the parsed records, the set of IDs that
 * are >=approved after the plan, and spec content, it rewrites the Surface's
 * `version` to the declared `intended_version` and unions `members` with the
 * >=approved records that declare `surface_ref` to that Surface.
 *
 * Mutating an already-approved Surface is the privileged finalize operation
 * authorised by the approved Delta — `sdd record set` deliberately refuses it,
 * so this is the only legal path to evolve an approved Surface.
 */

import type { LintRecord } from "../../../shared/domain/SpecRecord.js";
import { findMatches } from "../../../shared/domain/SpecApprovalRewrite.js";

export interface SurfaceMutation {
	surfaceId: string;
	version: string | null;
	addMembers: string[];
}

export function computeSurfaceMutations(
	records: ReadonlyArray<LintRecord>,
	approvedIds: ReadonlySet<string>,
): SurfaceMutation[] {
	const surfacesById = new Map<string, LintRecord>();
	for (const r of records) {
		if (r.template === "Surface") {
			surfacesById.set(r.id, r);
		}
	}

	const childrenBySurface = new Map<string, string[]>();
	for (const r of records) {
		const ref = r.parsed.surface_ref;
		if (typeof ref !== "string" || !approvedIds.has(r.id)) {
			continue;
		}
		const list = childrenBySurface.get(ref) ?? [];
		list.push(r.id);
		childrenBySurface.set(ref, list);
	}

	const intendedVersionBySurface = new Map<string, string>();
	for (const r of records) {
		if (r.template !== "Delta" || !approvedIds.has(r.id)) {
			continue;
		}
		const impact = r.parsed.surface_impact;
		if (!Array.isArray(impact)) {
			continue;
		}
		for (const entry of impact) {
			if (!isObject(entry) || typeof entry.id !== "string") {
				continue;
			}
			const version = entry.intended_version;
			if (typeof version === "string") {
				intendedVersionBySurface.set(entry.id, version);
			}
		}
	}

	const mutations: SurfaceMutation[] = [];
	for (const [surfaceId, version] of intendedVersionBySurface) {
		const surface = surfacesById.get(surfaceId);
		if (surface === undefined) {
			continue;
		}
		const existing = readMembers(surface);
		const addMembers = (childrenBySurface.get(surfaceId) ?? []).filter(
			(id) => !existing.includes(id),
		);
		mutations.push({ surfaceId, version, addMembers });
	}
	return mutations;
}

export function applySurfaceMutations(
	content: string,
	mutations: ReadonlyArray<SurfaceMutation>,
): string {
	let result = content;
	for (const mutation of mutations) {
		result = applyOne(result, mutation);
	}
	return result;
}

function applyOne(content: string, mutation: SurfaceMutation): string {
	const lines = content.split(/\r?\n/);
	const matches = findMatches(lines, mutation.surfaceId);
	if (matches.length === 0) {
		return content;
	}
	const match = matches[0];
	const start = match.startLine - 1;
	const end = match.endLine - 1;
	const block = lines.slice(start, end);

	rewriteVersion(block, match.indent, mutation.version);
	appendMembers(block, match.indent, mutation.addMembers);

	return [...lines.slice(0, start), ...block, ...lines.slice(end)].join("\n");
}

function rewriteVersion(
	block: string[],
	fieldIndent: string,
	version: string | null,
): void {
	if (version === null) {
		return;
	}
	const re = new RegExp(`^${fieldIndent}version:\\s*`);
	for (let i = 0; i < block.length; i++) {
		if (re.test(block[i])) {
			block[i] = `${fieldIndent}version: "${version}"`;
			return;
		}
	}
}

function appendMembers(
	block: string[],
	fieldIndent: string,
	addMembers: readonly string[],
): void {
	if (addMembers.length === 0) {
		return;
	}
	const headerIdx = block.findIndex((l) =>
		new RegExp(`^${fieldIndent}members:`).test(l),
	);
	if (headerIdx < 0) {
		return;
	}

	const flow = /^(\s*)members:\s*\[(.*)\]\s*$/.exec(block[headerIdx]);
	if (flow !== null) {
		const inner = flow[2].trim();
		const additions = addMembers.join(", ");
		block[headerIdx] =
			`${fieldIndent}members: [${inner.length > 0 ? `${inner}, ${additions}` : additions}]`;
		return;
	}

	let lastItemIdx = headerIdx;
	let itemIndent: string | null = null;
	for (let j = headerIdx + 1; j < block.length; j++) {
		const item = /^(\s*)-\s+\S/.exec(block[j]);
		if (item === null || item[1].length <= fieldIndent.length) {
			break;
		}
		lastItemIdx = j;
		itemIndent = item[1];
	}
	const indent = itemIndent ?? `${fieldIndent}  `;
	const newItems = addMembers.map((id) => `${indent}- ${id}`);
	block.splice(lastItemIdx + 1, 0, ...newItems);
}

function readMembers(record: LintRecord): string[] {
	const members = record.parsed.members;
	if (!Array.isArray(members)) {
		return [];
	}
	return members.filter((v): v is string => typeof v === "string");
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
