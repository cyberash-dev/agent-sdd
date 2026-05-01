// Re-export shim — content lives in src/shared/domain/SpecApprovalRewrite.ts
// so both approve (inline) and finalize (plan materialisation) can use it
// without crossing feature boundaries.

export {
  matchId,
  rewriteApproval,
  type IdMatch,
  type RewriteResult,
  type ApprovalAttestation,
  type ApprovalTargetStatus,
} from "../../../shared/domain/SpecApprovalRewrite.js";
