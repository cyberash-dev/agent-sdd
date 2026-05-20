import type { AgentTarget } from "./InstallTarget.js";

export type ActionKind = "context" | "skill" | "reference" | "data" | "hook" | "managed_block";
export type InstallOp = "copy" | "write_block" | "merge_hook" | "skip";

export interface InstallAction {
  target: AgentTarget;
  kind: ActionKind;
  op: InstallOp;
  path: string;
  note: string | null;
}

export type InstallFailureReason = "manifest-missing" | "manifest-invalid" | "artifact-missing";

export type InstallOutcome =
  | { ok: true; dryRun: boolean; targets: AgentTarget[]; actions: InstallAction[] }
  | { ok: false; exitCode: 1; reason: InstallFailureReason; message: string };
