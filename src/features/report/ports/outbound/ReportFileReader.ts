export interface SpecFileEntry {
  path: string;
  content: string;
}

export interface ReportFileReader {
  resolveSpecFiles(repoRoot: string, patterns: readonly string[]): Promise<SpecFileEntry[]>;
}
