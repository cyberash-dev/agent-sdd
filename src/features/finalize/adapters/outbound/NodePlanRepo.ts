import { promises as fs } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { parse as yamlParse } from "yaml";

import { errorMessage } from "../../../../shared/domain/Errors.js";
import { parsePlanFile } from "../../../../shared/domain/PlanFile.js";
import type { PlanLoad, PlanRepo } from "../../ports/outbound/PlanRepo.js";

export class NodePlanRepo implements PlanRepo {
	async load(
		repoRoot: string,
		plansDir: string,
		planId: string | undefined,
	): Promise<PlanLoad> {
		const dirAbs = resolve(repoRoot, plansDir);
		const id = planId ?? (await readActive(dirAbs));
		if (id === null) {
			return { kind: "no-active-plan" };
		}
		const sourceRel = join(plansDir, `${id}.yaml`).split("\\").join("/");
		const sourceAbs = resolve(repoRoot, sourceRel);
		let raw: string;
		try {
			raw = await fs.readFile(sourceAbs, "utf8");
		} catch {
			return {
				kind: "invalid-plan-file",
				planId: id,
				sourcePath: sourceRel,
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
				sourcePath: sourceRel,
				reason: `YAML parse error: ${errorMessage(e)}`,
			};
		}
		try {
			const plan = parsePlanFile(parsed);
			return { kind: "found", plan, sourcePath: sourceRel };
		} catch (e) {
			return {
				kind: "invalid-plan-file",
				planId: id,
				sourcePath: sourceRel,
				reason: errorMessage(e),
			};
		}
	}

	async archive(
		repoRoot: string,
		plansDir: string,
		planId: string,
	): Promise<{ archivedPath: string }> {
		const dirAbs = resolve(repoRoot, plansDir);
		const finalizedDirAbs = join(dirAbs, "finalized");
		await fs.mkdir(finalizedDirAbs, { recursive: true });

		const fromAbs = join(dirAbs, `${planId}.yaml`);
		const toAbs = join(finalizedDirAbs, `${planId}.yaml`);
		await fs.rename(fromAbs, toAbs);

		const active = await readActive(dirAbs);
		if (active === planId) {
			try {
				await fs.unlink(join(dirAbs, ".active"));
			} catch {
				/* missing is fine */
			}
		}

		const rel = relative(repoRoot, toAbs).split("\\").join("/");
		return { archivedPath: rel };
	}
}

async function readActive(dirAbs: string): Promise<string | null> {
	try {
		const raw = await fs.readFile(join(dirAbs, ".active"), "utf8");
		const id = raw.trim();
		return id.length > 0 ? id : null;
	} catch {
		return null;
	}
}

void dirname; /* reserved */
