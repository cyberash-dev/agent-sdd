export interface RecordFileWriter {
	/** Atomically write `content` to the spec file at `relativePath` (relative
	 *  to repoRoot). Must be a temp-write + rename so a crash never leaves a
	 *  partial file. */
	writeSpecFile(
		repoRoot: string,
		relativePath: string,
		content: string,
	): Promise<void>;
}
