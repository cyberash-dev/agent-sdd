export interface SpecFileEntry {
  /** Path relative to repoRoot. */
  path: string;
  /** UTF-8 markdown content. */
  content: string;
}

export interface LintFileReader {
  /** Resolve glob patterns to a deduplicated list of {path, content} entries. */
  resolveSpecFiles(repoRoot: string, patterns: readonly string[]): Promise<SpecFileEntry[]>;
}
