// Re-export shim — content lives in src/shared/domain/SpecRecord.ts so the
// ready slice can consume the same shape without crossing the cross-feature
// import boundary (INV-004 / CST-003). Existing lint callers keep their import
// paths unchanged.

export {
  NORMATIVE_TEMPLATES,
  VALID_LIFECYCLE_STATUS,
  type LifecycleStatus,
  type LintRecord,
  type LintTemplate,
} from "../../../shared/domain/SpecRecord.js";
