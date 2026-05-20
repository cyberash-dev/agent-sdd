export type AgentTarget = "claude" | "codex";
export type InstallTarget = AgentTarget | "all";

export const AGENT_TARGETS: readonly AgentTarget[] = ["claude", "codex"];

export function isInstallTarget(value: string): value is InstallTarget {
  return value === "all" || value === "claude" || value === "codex";
}

export function agentsFor(target: InstallTarget): readonly AgentTarget[] {
  return target === "all" ? AGENT_TARGETS : [target];
}
