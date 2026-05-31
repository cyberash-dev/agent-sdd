import type { Footprint } from "./Footprint.js";
import { footprintEntriesForPath } from "./Footprint.js";

export type Stub = DeltaStub | OpenQStub;

export interface DeltaStub {
	kind: "Delta";
	path: string;
	target_imp_ids: string[];
	target_ids: string[];
	emitted_at: string;
	compatibility_action: "TODO";
	kind_of_change: "TODO";
	tests_old_behavior: "TODO";
	tests_new_behavior: "TODO";
}

export interface OpenQStub {
	kind: "Open-Q";
	path: string;
	question: string;
	options: string[];
	blocking: "TODO";
	emitted_at: string;
}

export function stubs(
	paths: readonly string[],
	footprint: Footprint,
	emittedAt: string,
): Stub[] {
	return [...new Set(paths)]
		.sort((left, right) => left.localeCompare(right, "en"))
		.map((path) => {
			const entries = footprintEntriesForPath(footprint, path);
			if (entries.length === 0) {
				return openQStub(path, emittedAt);
			}
			const targetImpIds = entries.map((entry) => entry.impId).sort();
			const targetIds = [
				...new Set(entries.flatMap((entry) => entry.targetIds)),
			].sort();
			return {
				kind: "Delta",
				path,
				target_imp_ids: targetImpIds,
				target_ids: targetIds,
				emitted_at: emittedAt,
				compatibility_action: "TODO",
				kind_of_change: "TODO",
				tests_old_behavior: "TODO",
				tests_new_behavior: "TODO",
			};
		});
}

export function yamlStubStream(stubs: readonly Stub[]): string {
	if (stubs.length === 0) {
		return "";
	}
	return stubs.map((stub) => `---\n${yamlStub(stub)}`).join("\n");
}

export function humanStubText(stubs: readonly Stub[]): string {
	return stubs
		.map((stub) => {
			if (stub.kind === "Delta") {
				return `Delta ${stub.path} -> ${stub.target_imp_ids.join(",")}`;
			}
			return `Open-Q ${stub.path} -> -`;
		})
		.join("\n");
}

function openQStub(path: string, emittedAt: string): OpenQStub {
	return {
		kind: "Open-Q",
		path,
		question: `Should ${path} be bound to a normative ID?`,
		options: ["bind_to_existing_or_new_id", "leave_unmodeled"],
		blocking: "TODO",
		emitted_at: emittedAt,
	};
}

function yamlStub(stub: Stub): string {
	if (stub.kind === "Delta") {
		return [
			"kind: Delta",
			`path: ${quoted(stub.path)}`,
			"target_imp_ids:",
			...stub.target_imp_ids.map((id) => `  - ${quoted(id)}`),
			"target_ids:",
			...stub.target_ids.map((id) => `  - ${quoted(id)}`),
			`emitted_at: ${quoted(stub.emitted_at)}`,
			"compatibility_action: TODO",
			"kind_of_change: TODO",
			"tests_old_behavior: TODO",
			"tests_new_behavior: TODO",
		].join("\n");
	}
	return [
		"kind: Open-Q",
		`path: ${quoted(stub.path)}`,
		`question: ${quoted(stub.question)}`,
		"options:",
		...stub.options.map((option) => `  - ${quoted(option)}`),
		"blocking: TODO",
		`emitted_at: ${quoted(stub.emitted_at)}`,
	].join("\n");
}

function quoted(value: string): string {
	return JSON.stringify(value);
}
