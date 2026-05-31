export interface InstallTargetFs {
	homeRoot(): string;
	projectRoot(): string;
	readText(absPath: string): Promise<string | null>;
	writeText(
		absPath: string,
		content: string,
		executable: boolean,
	): Promise<void>;
}
