import type { AgentTarget } from "./InstallTarget.js";

export type ArtifactKind = "context" | "skill" | "reference" | "data" | "hook";

const ARTIFACT_KINDS: readonly ArtifactKind[] = [
	"context",
	"skill",
	"reference",
	"data",
	"hook",
];

export interface ManifestArtifact {
	source: string;
	kind: ArtifactKind;
	targets: readonly AgentTarget[];
	event?: string;
	skillName?: string;
}

export interface RuleManifest {
	formatVersion: 1;
	artifacts: readonly ManifestArtifact[];
}

export class ManifestError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ManifestError";
	}
}

export function parseManifest(text: string): RuleManifest {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch (error) {
		throw new ManifestError(
			`manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	if (!isObject(raw)) {
		throw new ManifestError("manifest must be a JSON object");
	}
	if (raw.format_version !== 1) {
		throw new ManifestError("manifest format_version must be 1");
	}
	if (!Array.isArray(raw.artifacts)) {
		throw new ManifestError("manifest artifacts must be an array");
	}
	const artifacts = raw.artifacts.map((entry, index) =>
		parseArtifact(entry, index),
	);
	return { formatVersion: 1, artifacts };
}

function parseArtifact(entry: unknown, index: number): ManifestArtifact {
	if (!isObject(entry)) {
		throw new ManifestError(`artifact #${index} must be an object`);
	}
	const { source, kind, targets, event, skill_name: skillName } = entry;
	if (typeof source !== "string" || source.length === 0) {
		throw new ManifestError(`artifact #${index} has a missing or empty source`);
	}
	if (typeof kind !== "string" || !isArtifactKind(kind)) {
		throw new ManifestError(
			`artifact ${source} has an unknown kind: ${String(kind)}`,
		);
	}
	if (
		!Array.isArray(targets) ||
		targets.length === 0 ||
		!targets.every(isAgentTarget)
	) {
		throw new ManifestError(
			`artifact ${source} must declare a non-empty targets array of claude|codex`,
		);
	}
	if (kind === "hook" && (typeof event !== "string" || event.length === 0)) {
		throw new ManifestError(
			`hook artifact ${source} must declare an event matcher`,
		);
	}
	return {
		source,
		kind,
		targets: targets,
		event: typeof event === "string" ? event : undefined,
		skillName: typeof skillName === "string" ? skillName : undefined,
	};
}

function isArtifactKind(value: string): value is ArtifactKind {
	return (ARTIFACT_KINDS as readonly string[]).includes(value);
}

function isAgentTarget(value: unknown): value is AgentTarget {
	return value === "claude" || value === "codex";
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
