export interface SpecFileEntry {
  path: string;        // relative to repoRoot
  content: string;     // UTF-8 markdown
}

export interface FinalizeFileSystem {
  resolveSpecFiles(repoRoot: string, patterns: readonly string[]): Promise<SpecFileEntry[]>;
  /** Atomic batch write: either every (path, content) pair lands or none.
   *  Implementations write to .tmp files and then rename in a deterministic
   *  order so a mid-flight failure leaves the working tree byte-stable. */
  writeBatch(repoRoot: string, entries: ReadonlyArray<{ path: string; content: string }>): Promise<void>;
}
