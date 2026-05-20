import { buildPlan, homePath, type ExistingTargetFiles, type PlannedWrite } from "../domain/InstallPlan.js";
import type { InstallAction, InstallOutcome } from "../domain/InstallResult.js";
import { agentsFor, type InstallTarget } from "../domain/InstallTarget.js";
import { ManifestError, parseManifest } from "../domain/RuleManifest.js";
import type { InstallSource } from "../ports/outbound/InstallSource.js";
import type { InstallTargetFs } from "../ports/outbound/InstallTargetFs.js";

export type { InstallAction, InstallOutcome };

export interface InstallPorts {
  source: InstallSource;
  fs: InstallTargetFs;
}

export async function installRules(target: InstallTarget, dryRun: boolean, ports: InstallPorts): Promise<InstallOutcome> {
  const manifestText = await ports.source.manifestText();
  if (manifestText === null) {
    return { ok: false, exitCode: 1, reason: "manifest-missing", message: "packaged rules/manifest.json was not found" };
  }

  let manifest;
  try {
    manifest = parseManifest(manifestText);
  } catch (error) {
    if (error instanceof ManifestError) {
      return { ok: false, exitCode: 1, reason: "manifest-invalid", message: error.message };
    }
    throw error;
  }

  const agents = agentsFor(target);
  const sources = new Map<string, string>();
  for (const artifact of manifest.artifacts) {
    if (!artifact.targets.some((t) => agents.includes(t)) || sources.has(artifact.source)) {
      continue;
    }
    const content = await ports.source.readArtifact(artifact.source);
    if (content === null) {
      return { ok: false, exitCode: 1, reason: "artifact-missing", message: `packaged rule file was not found: ${artifact.source}` };
    }
    sources.set(artifact.source, content);
  }

  const home = ports.fs.homeRoot();
  const writes: PlannedWrite[] = [];
  const actions: InstallAction[] = [];
  for (const agent of agents) {
    const existing: ExistingTargetFiles = {
      claudeMd: agent === "claude" ? await ports.fs.readText(homePath(home, ".claude/CLAUDE.md")) : null,
      settingsJson: agent === "claude" ? await ports.fs.readText(homePath(home, ".claude/settings.json")) : null,
      agentsMd: agent === "codex" ? await ports.fs.readText(homePath(home, ".codex/AGENTS.md")) : null,
    };
    const plan = buildPlan(manifest, agent, sources, existing, home);
    writes.push(...plan.writes);
    actions.push(...plan.actions);
  }

  if (!dryRun) {
    for (const write of writes) {
      await ports.fs.writeText(write.absPath, write.content, write.executable);
    }
  }

  return { ok: true, dryRun, targets: [...agents], actions };
}
