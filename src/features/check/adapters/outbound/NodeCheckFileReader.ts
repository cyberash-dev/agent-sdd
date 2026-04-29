import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { configFromJson, type SddConfig } from "../../../../shared/domain/Config.js";
import { configFailure } from "../../../../shared/domain/Errors.js";
import { specBlocks } from "../../../../shared/domain/SpecBlocks.js";
import type { CheckConfigPort } from "../../ports/outbound/CheckConfigPort.js";
import type { CheckSpec, CheckSpecPort } from "../../ports/outbound/CheckSpecPort.js";

export class NodeCheckFileReader implements CheckConfigPort, CheckSpecPort {
  async config(repoRoot: string): Promise<SddConfig> {
    const configPath = join(repoRoot, ".sdd", "config.json");
    const text = await readConfig(configPath);
    const config = configFromJson(parseConfigJson(text, configPath), configPath);
    await this.spec(repoRoot, config);
    return config;
  }

  async spec(repoRoot: string, config: SddConfig): Promise<CheckSpec> {
    const path = join(repoRoot, config.specFile);
    let text: string;
    try {
      text = await readFile(path, "utf8");
    } catch (error) {
      throw configFailure("config-invalid", `spec_file is not readable: ${config.specFile}`, errorMessage(error), path);
    }
    return { path, blocks: specBlocks(text) };
  }
}

async function readConfig(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    throw configFailure("config-missing", ".sdd/config.json is missing or unreadable", errorMessage(error), path);
  }
}

function parseConfigJson(text: string, path: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw configFailure("config-invalid", ".sdd/config.json is not valid JSON", errorMessage(error), path);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
