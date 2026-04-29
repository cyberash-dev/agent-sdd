// Normalised representation of a single normative ID record extracted from a
// spec markdown file. Bridges the two YAML conventions we accept:
//
//   1. sdd-cli's canonical form — `---`-separated documents inside a ```yaml
//      fence, each with `id` + `type` strings.
//   2. The list-of-objects form — a single fence containing
//      `- id: foo\n  template: Bar\n  ...` items.
//
// The lint and approve features consume `LintRecord`, not raw YAML.

export type LintTemplate =
  | "Behavior"
  | "Invariant"
  | "Contract"
  | "Scenario"
  | "NFR"
  | "Constraint"
  | "Policy"
  | "Migration"
  | "Delta"
  | "GeneratedArtifact"
  | "ExternalDependency"
  | "LocalizationContract"
  | "Surface"
  | "BrownfieldBaseline"
  | "Partition"
  | "ImplementationBinding";

export const NORMATIVE_TEMPLATES: ReadonlySet<LintTemplate> = new Set<LintTemplate>([
  "Behavior",
  "Invariant",
  "Contract",
  "Scenario",
  "NFR",
  "Constraint",
  "Policy",
  "Migration",
  "Delta",
  "GeneratedArtifact",
  "ExternalDependency",
  "LocalizationContract",
  "Surface",
]);

export type LifecycleStatus = "draft" | "proposed" | "approved" | "deprecated" | "removed";

export const VALID_LIFECYCLE_STATUS: ReadonlySet<LifecycleStatus> = new Set<LifecycleStatus>([
  "draft",
  "proposed",
  "approved",
  "deprecated",
  "removed",
]);

export interface LintRecord {
  id: string;
  template: string | null;        // raw `template` or `type` field; may be non-normative
  lifecycleStatus: string | null;
  approvalRecord: string | null;  // "not_applicable_for_proposed" | <object-tag> | null
  testObligations: string[];
  hasAliasedObligations: boolean; // Policy.negative_test_obligations / Migration.tests_post / Delta.tests_old_behavior etc.
  parsed: Record<string, unknown>;
  file: string;                   // relative to repo root
  line: number;                   // 1-based, line of `id:` or `- id:`
  rawBlock: string;               // raw YAML text of the record (for field-level scans)
}
