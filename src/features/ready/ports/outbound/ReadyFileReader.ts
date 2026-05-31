export interface SpecFileEntry {
	path: string; /* posix-separated, repo-relative */
	content: string;
}

export interface TestFileEntry {
	path: string; /* posix-separated, repo-relative */
	content: string;
}

export interface ReadyFileReader {
	resolveSpecFiles(
		repoRoot: string,
		patterns: readonly string[],
	): Promise<SpecFileEntry[]>;
	resolveTestFiles(
		repoRoot: string,
		patterns: readonly string[],
	): Promise<TestFileEntry[]>;
}
