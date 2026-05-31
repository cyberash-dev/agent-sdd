export interface SpecFileEntry {
	path: string; /* relative to repoRoot */
	content: string; /* UTF-8 markdown */
}

export interface ApproveFileSystem {
	resolveSpecFiles(
		repoRoot: string,
		patterns: readonly string[],
	): Promise<SpecFileEntry[]>;
	writeSpecFile(
		repoRoot: string,
		relativePath: string,
		content: string,
	): Promise<void>;
}
