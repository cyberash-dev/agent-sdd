// Glob-matching primitives moved to the shared kernel (used by both ready and
// lint). Re-exported here for the ready feature's existing import sites.

export { matchesGlob, fileInGlobs } from "../../../shared/domain/GlobMatch.js";
