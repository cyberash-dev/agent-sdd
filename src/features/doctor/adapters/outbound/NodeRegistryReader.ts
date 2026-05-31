import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
	RegistryFile,
	RegistryReader,
} from "../../ports/outbound/RegistryReader.js";

export class NodeRegistryReader implements RegistryReader {
	async readRegistry(rulesPath: string): Promise<RegistryFile> {
		const resolved = resolveRulesPath(rulesPath);
		try {
			const content = await readFile(resolved, "utf8");
			return { kind: "found", path: resolved, content };
		} catch {
			return { kind: "not-found", path: resolved };
		}
	}

	async cliVersion(): Promise<string> {
		const packagePath = resolve(
			fileURLToPath(import.meta.url),
			"..",
			"..",
			"..",
			"..",
			"..",
			"..",
			"package.json",
		);
		const text = await readFile(packagePath, "utf8");
		const parsed: unknown = JSON.parse(text);
		if (!isRecord(parsed) || typeof parsed.version !== "string") {
			throw new Error("package.json#version missing");
		}
		return parsed.version;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveRulesPath(p: string): string {
	if (p.startsWith("~/")) {
		return resolve(homedir(), p.slice(2));
	}
	if (p === "~") {
		return homedir();
	}
	if (isAbsolute(p)) {
		return p;
	}
	return resolve(process.cwd(), p);
}
