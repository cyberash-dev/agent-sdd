// IS_NORMATIVE table per typed normative template (rules/spec-driven-development.md
// §"What spec MUST fix" / §"What spec MUST NOT fix" + the per-template typed
// field sections of spec/spec.md). Used by the field-aware pass of
// `weaselFindings` (P0.5): modal verbs ("may be", "might be") trigger as
// `sdd:weasel-word` only inside fields whose entry here is `true`.
//
// Convention:
// - The template-level fields `id`, `type`, `lifecycle`, `partition_id` are
//   structural metadata. They are not normative content (they identify the
//   record); the lifecycle status and approval are governed by §7.
// - `title`, `notes`, `description` are descriptive free-text. Their content
//   is for humans, not for verification — `false`.
// - `test_obligation` describes how the contract is tested, not the contract
//   itself. Modal verbs in test design are acceptable — `false`.
// - All other typed fields (predicate, schema, scope/applicability/concurrency,
//   policy_refs, etc.) are normative — `true`.
//
// Unknown templates → empty mapping → all fields default `false` (fail-safe:
// modal weasel never blocks where we are not certain).

export const IS_NORMATIVE: Readonly<Record<string, Readonly<Record<string, boolean>>>> = {
  Behavior: {
    title: false,
    notes: false,
    test_obligation: false,
    given: true,
    when: true,
    then: true,
    negative_cases: true,
    out_of_scope: true,
    applicability: true,
    concurrency_model: true,
    data_scope: true,
    policy_refs: true,
  },
  Contract: {
    title: false,
    notes: false,
    test_obligation: false,
    test_obligations: false,
    surface_ref: true,
    schema: true,
    preconditions: true,
    postconditions: true,
    external_identifiers: true,
    compatibility_rules: true,
    error_taxonomy: true,
    applicability: true,
    concurrency_model: true,
    data_scope: true,
    policy_refs: true,
  },
  Invariant: {
    title: false,
    notes: false,
    test_obligation: false,
    always: true,
    never: true,
    when: true,
    then: true,
    scope: true,
    evidence: true,
    stability: true,
    negative_cases: true,
    out_of_scope: true,
    applicability: true,
    concurrency_model: true,
    data_scope: true,
    policy_refs: true,
  },
  Scenario: {
    title: false,
    notes: false,
    test_obligation: false,
    given: true,
    when: true,
    then: true,
    applicability: true,
    data_scope: true,
  },
  NFR: {
    title: false,
    notes: false,
    test_obligation: false,
    metric: true,
    target: true,
    verification_obligation: true,
    applicability: true,
    data_scope: true,
    policy_refs: true,
  },
  Constraint: {
    title: false,
    notes: false,
    test_obligations: false,
    rule: true,
    rationale: true,
    scope: true,
    applicability: true,
    data_scope: true,
    policy_refs: true,
  },
  Policy: {
    title: false,
    notes: false,
    test_obligation: false,
    rule: true,
    rationale: true,
    scope: true,
    applicability: true,
    data_scope: true,
  },
  Migration: {
    title: false,
    notes: false,
    test_obligation: false,
    direction: true,
    mode: true,
    runtime_state: true,
    enforcement_stage: true,
    target_ids: true,
    baseline_version: true,
    partition_slice: true,
    applicability: true,
    data_scope: true,
    policy_refs: true,
  },
  Delta: {
    title: false,
    notes: false,
    test_obligation: false,
    kind: true,
    compatibility_action: true,
    target_ids: true,
    baseline_version: true,
    tests_old_behavior: false,
    tests_new_behavior: false,
    applicability: true,
    data_scope: true,
  },
  GeneratedArtifact: {
    title: false,
    notes: false,
    test_obligation: false,
    generator: true,
    inputs: true,
    outputs: true,
    published_surface: true,
    surface_ref: true,
    applicability: true,
    data_scope: true,
  },
  ExternalDependency: {
    title: false,
    notes: false,
    test_obligation: false,
    provider: true,
    interface: true,
    failure_modes: true,
    fallback_policy: true,
    applicability: true,
    data_scope: true,
    policy_refs: true,
  },
  LocalizationContract: {
    title: false,
    notes: false,
    test_obligation: false,
    text_id: true,
    fallback_locale: true,
    contract: true,
    applicability: true,
  },
  Surface: {
    name: false,
    notes: false,
    title: false,
    test_obligation: false,
    test_obligations: false,
    version: true,
    boundary_type: true,
    members: true,
    consumer_compat_policy: true,
  },
};

export function isFieldNormative(template: string | null | undefined, field: string): boolean {
  if (template === null || template === undefined) return false;
  return IS_NORMATIVE[template]?.[field] === true;
}
