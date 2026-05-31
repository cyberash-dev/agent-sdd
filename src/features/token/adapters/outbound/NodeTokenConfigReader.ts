import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	configFromJson,
	type SddConfig,
} from "../../../../shared/domain/Config.js";
import { configFailure } from "../../../../shared/domain/Errors.js";
import type { TokenConfigPort } from "../../ports/outbound/TokenConfigPort.js";

export class NodeTokenConfigReader implements TokenConfigPort {
	async config(repoRoot: string): Promise<SddConfig> {
		const configPath = join(repoRoot, ".sdd", "config.json");
		const text = await readConfig(configPath);
		const config = configFromJson(
			parseConfigJson(text, configPath),
			configPath,
		);
		await assertSpecReadable(repoRoot, config);
		return config;
	}
}

async function readConfig(path: string): Promise<string> {
	try {
		return await readFile(path, "utf8");
	} catch (error) {
		throw configFailure(
			"config-missing",
			".sdd/config.json is missing or unreadable",
			errorMessage(error),
			path,
		);
	}
}

function parseConfigJson(text: string, path: string): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch (error) {
		throw configFailure(
			"config-invalid",
			".sdd/config.json is not valid JSON",
			errorMessage(error),
			path,
		);
	}
}

async function assertSpecReadable(
	repoRoot: string,
	config: SddConfig,
): Promise<void> {
	const specPath = join(repoRoot, config.specFile);
	try {
		await readFile(specPath, "utf8");
	} catch (error) {
		throw configFailure(
			"config-invalid",
			`spec_file is not readable: ${config.specFile}`,
			errorMessage(error),
			specPath,
		);
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
