// Re-export shim — content lives in src/shared/domain/LintRules.ts.

export {
  approvalRecordRules,
  assumptionDowngradeApprovalRule,
  baselineVersionRequiredRule,
  deprecatedFieldsRequiredRule,
  fieldTypeRules,
  generatedArtifactSurfaceRefRule,
  lifecycleStatusRules,
  NORMATIVE_SECTIONS,
  partitionDefaultPolicySetRule,
  REQUIRED_PARTITION_SECTIONS,
  sectionViolations,
  testObligationRules,
  WEASEL_ABSOLUTE,
  WEASEL_MODAL_IN_NORMATIVE,
  WEASEL_WORDS,
  weaselFindings,
  type SectionViolation,
  type WeaselFinding,
} from "../../../shared/domain/LintRules.js";
