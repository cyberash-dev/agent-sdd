import { promises as fs } from "node:fs";
import { resolve, join } from "node:path";

import { parse as yamlParse } from "yaml";

import {
	configFromJson,
	type SddConfig,
} from "../../../../shared/domain/Config.js";
import { errorMessage } from "../../../../shared/domain/Errors.js";
import { parsePlanFile } from "../../../../shared/domain/PlanFile.js";
import type { PlanConfigPort } from "../../ports/outbound/PlanConfigPort.js";
import type {
	PlanLookup,
	PlanReader,
} from "../../ports/outbound/PlanReader.js";

export class NodePlanReader implements PlanReader, PlanConfigPort {
	async config(repoRoot: string): Promise<SddConfig> {
		const configPath = join(repoRoot, ".sdd", "config.json");
		const text = await fs.readFile(configPath, "utf8");
		return configFromJson(JSON.parse(text), configPath);
	}

	async read(
		repoRoot: string,
		plansDir: string,
		planId: string | undefined,
	): Promise<PlanLookup> {
		const dir = resolve(repoRoot, plansDir);
		const id = planId ?? (await readActiveMarker(dir));
		if (id === null) {
			return { kind: "no-active-plan" };
		}
		const sourcePath = join(plansDir, `${id}.yaml`);
		const absolute = resolve(repoRoot, sourcePath);
		let raw: string;
		try {
			raw = await fs.readFile(absolute, "utf8");
		} catch {
			return {
				kind: "invalid-plan-file",
				planId: id,
				sourcePath,
				reason: "plan file not found",
			};
		}
		let parsed: unknown;
		try {
			parsed = yamlParse(raw);
		} catch (e) {
			return {
				kind: "invalid-plan-file",
				planId: id,
				sourcePath,
				reason: `YAML parse error: ${errorMessage(e)}`,
			};
		}
		try {
			const plan = parsePlanFile(parsed);
			return { kind: "found", planId: plan.planId, plan, sourcePath };
		} catch (e) {
			return {
				kind: "invalid-plan-file",
				planId: id,
				sourcePath,
				reason: errorMessage(e),
			};
		}
	}
}

async function readActiveMarker(dir: string): Promise<string | null> {
	try {
		const raw = await fs.readFile(join(dir, ".active"), "utf8");
		const id = raw.trim();
		return id.length > 0 ? id : null;
	} catch {
		return null;
	}
}
