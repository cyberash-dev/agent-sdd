import type { AgentTarget, InstallScope } from "./InstallTarget.js";
import type { InstallAction } from "./InstallResult.js";
import { upsertManagedBlock } from "./ManagedBlock.js";
import { mergeHooks, type DesiredHook } from "./SettingsMerge.js";
import type { ManifestArtifact, RuleManifest } from "./RuleManifest.js";

export interface PlannedWrite {
	absPath: string;
	content: string;
	executable: boolean;
}

export interface ExistingTargetFiles {
	claudeMd: string | null;
	settingsJson: string | null;
	agentsMd: string | null;
}

export interface InstallPlanResult {
	writes: PlannedWrite[];
	actions: InstallAction[];
}

export interface InstallLayout {
	claudeMemoryRel: string;
	codexMemoryRel: string;
	claudeImportPrefix: string;
	codexRulePrefix: string;
	hookCommand(home: string, source: string): string;
}

export function installLayout(scope: InstallScope): InstallLayout {
	if (scope === "project") {
		return {
			claudeMemoryRel: "CLAUDE.md",
			codexMemoryRel: "AGENTS.md",
			claudeImportPrefix: "@.claude/sdd/",
			codexRulePrefix: ".codex/sdd/",
			hookCommand: (_home, source) =>
				`$CLAUDE_PROJECT_DIR/.claude/sdd/${source}`,
		};
	}
	return {
		claudeMemoryRel: ".claude/CLAUDE.md",
		codexMemoryRel: ".codex/AGENTS.md",
		claudeImportPrefix: "@sdd/",
		codexRulePrefix: "~/.codex/sdd/",
		hookCommand: (home, source) => homePath(home, `.claude/sdd/${source}`),
	};
}

export function buildPlan(
	manifest: RuleManifest,
	agent: AgentTarget,
	sources: ReadonlyMap<string, string>,
	existing: ExistingTargetFiles,
	home: string,
	scope: InstallScope = "user",
): InstallPlanResult {
	const layout = installLayout(scope);
	return agent === "claude"
		? planClaude(manifest, sources, existing, home, layout)
		: planCodex(manifest, sources, existing, home, layout);
}

function planClaude(
	manifest: RuleManifest,
	sources: ReadonlyMap<string, string>,
	existing: ExistingTargetFiles,
	home: string,
	layout: InstallLayout,
): InstallPlanResult {
	const writes: PlannedWrite[] = [];
	const actions: InstallAction[] = [];
	const contextSources: string[] = [];
	const desiredHooks: DesiredHook[] = [];

	for (const artifact of artifactsFor(manifest, "claude")) {
		const relPath =
			artifact.kind === "skill"
				? `.claude/skills/${skillName(artifact)}/SKILL.md`
				: `.claude/sdd/${artifact.source}`;
		writes.push({
			absPath: homePath(home, relPath),
			content: content(sources, artifact.source),
			executable: artifact.kind === "hook",
		});
		actions.push({
			target: "claude",
			kind: artifact.kind,
			op: "copy",
			path: relPath,
			note: null,
		});
		if (artifact.kind === "context") {
			contextSources.push(artifact.source);
		}
		if (artifact.kind === "hook" && artifact.event !== undefined) {
			const event = artifact.event;
			const command = layout.hookCommand(home, artifact.source);
			desiredHooks.push({ matcher: event, command });
			actions.push({
				target: "claude",
				kind: "hook",
				op: "merge_hook",
				path: ".claude/settings.json",
				note: event,
			});
		}
	}

	const claudeMdRel = layout.claudeMemoryRel;
	writes.push({
		absPath: homePath(home, claudeMdRel),
		content: upsertManagedBlock(
			existing.claudeMd,
			claudeImportBody(contextSources, layout.claudeImportPrefix),
		),
		executable: false,
	});
	actions.push({
		target: "claude",
		kind: "managed_block",
		op: "write_block",
		path: claudeMdRel,
		note: null,
	});

	if (desiredHooks.length > 0) {
		writes.push({
			absPath: homePath(home, ".claude/settings.json"),
			content: mergeHooks(existing.settingsJson, desiredHooks),
			executable: false,
		});
	}

	return { writes, actions };
}

function planCodex(
	manifest: RuleManifest,
	sources: ReadonlyMap<string, string>,
	existing: ExistingTargetFiles,
	home: string,
	layout: InstallLayout,
): InstallPlanResult {
	const writes: PlannedWrite[] = [];
	const actions: InstallAction[] = [];
	const contextSources: string[] = [];

	for (const artifact of artifactsFor(manifest, "codex")) {
		const relPath = `.codex/sdd/${artifact.source}`;
		writes.push({
			absPath: homePath(home, relPath),
			content: content(sources, artifact.source),
			executable: false,
		});
		actions.push({
			target: "codex",
			kind: artifact.kind,
			op: "copy",
			path: relPath,
			note: null,
		});
		if (artifact.kind === "context") {
			contextSources.push(artifact.source);
		}
	}

	for (const artifact of manifest.artifacts) {
		if (artifact.kind === "hook" && !artifact.targets.includes("codex")) {
			actions.push({
				target: "codex",
				kind: "hook",
				op: "skip",
				path: artifact.source,
				note: "codex has no PreToolUse host",
			});
		}
	}

	const agentsMdRel = layout.codexMemoryRel;
	writes.push({
		absPath: homePath(home, agentsMdRel),
		content: upsertManagedBlock(
			existing.agentsMd,
			codexReferenceBody(contextSources, layout.codexRulePrefix),
		),
		executable: false,
	});
	actions.push({
		target: "codex",
		kind: "managed_block",
		op: "write_block",
		path: agentsMdRel,
		note: null,
	});

	return { writes, actions };
}

function artifactsFor(
	manifest: RuleManifest,
	agent: AgentTarget,
): ManifestArtifact[] {
	return manifest.artifacts.filter((a) => a.targets.includes(agent));
}

function content(sources: ReadonlyMap<string, string>, source: string): string {
	const value = sources.get(source);
	if (value === undefined) {
		throw new Error(`missing source content for ${source}`);
	}
	return value;
}

function claudeImportBody(
	contextSources: readonly string[],
	prefix: string,
): string {
	const imports = contextSources.map((s) => `${prefix}${s}`).join("\n");
	return `SDD methodology rules (installed by \`sdd install\`). Loaded into context every session:\n\n${imports}`;
}

function codexReferenceBody(
	contextSources: readonly string[],
	prefix: string,
): string {
	const bullets = contextSources.map((s) => `- ${prefix}${s}`).join("\n");
	return [
		`SDD methodology rules installed by \`sdd install\` at ${prefix}.`,
		"Read these before working in a project that carries .sdd/config.json:",
		"",
		bullets,
		"",
		`On-demand reference (read when needed): ${prefix}skills/spec-driven-development/SKILL.md, ${prefix}enforcement_registry.md`,
	].join("\n");
}

function skillName(artifact: ManifestArtifact): string {
	if (artifact.skillName !== undefined) {
		return artifact.skillName;
	}
	const segments = artifact.source.split("/");
	return segments.length >= 2 ? segments[segments.length - 2] : segments[0];
}

export function homePath(home: string, relPath: string): string {
	return `${home.replace(/\/+$/, "")}/${relPath}`;
}
