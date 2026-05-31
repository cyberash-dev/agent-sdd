export interface InstallSource {
	manifestText(): Promise<string | null>;
	readArtifact(source: string): Promise<string | null>;
}
