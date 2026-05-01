export interface ReadyInput {
  partitionFilter?: string;
  /** When set, ready additionally runs the P2.3 semver-cascade diff against
   *  this git ref (e.g. "HEAD~5", a tag, or a commit SHA). Off by default. */
  against?: string;
}
