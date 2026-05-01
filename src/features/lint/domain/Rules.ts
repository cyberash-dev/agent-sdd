// Re-export shim — content lives in src/shared/domain/LintRules.ts.

export {
  approvalRecordRules,
  fieldTypeRules,
  lifecycleStatusRules,
  NORMATIVE_SECTIONS,
  REQUIRED_PARTITION_SECTIONS,
  sectionViolations,
  testObligationRules,
  WEASEL_WORDS,
  weaselFindings,
  type SectionViolation,
  type WeaselFinding,
} from "../../../shared/domain/LintRules.js";
