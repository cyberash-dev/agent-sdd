import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { InstallSource } from "../../ports/outbound/InstallSource.js";

const DEFAULT_RULES_ROOT = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"..",
	"..",
	"..",
	"rules",
);

export class NodeInstallSource implements InstallSource {
	constructor(private readonly rulesRoot: string = DEFAULT_RULES_ROOT) {}

	manifestText(): Promise<string | null> {
		return readTextOrNull(resolve(this.rulesRoot, "manifest.json"));
	}

	readArtifact(source: string): Promise<string | null> {
		return readTextOrNull(resolve(this.rulesRoot, source));
	}
}

async function readTextOrNull(absPath: string): Promise<string | null> {
	try {
		return await readFile(absPath, "utf8");
	} catch {
		return null;
	}
}
