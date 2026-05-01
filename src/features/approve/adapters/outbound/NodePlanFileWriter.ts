import { promises as fs } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { parse as yamlParse } from "yaml";

import {
  generatePlanId,
  isoBasicUtc,
  parsePlanFile,
  serialisePlanFile,
  type PendingAttestation,
  type PlanFileShape,
} from "../../../../shared/domain/PlanFile.js";
import type { AppendAttestationResult, PlanFileWriter } from "../../ports/outbound/PlanFileWriter.js";

export class NodePlanFileWriter implements PlanFileWriter {
  async appendAttestation(
    repoRoot: string,
    plansDir: string,
    planId: string | undefined,
    attestation: PendingAttestation,
  ): Promise<AppendAttestationResult> {
    const dirAbs = resolve(repoRoot, plansDir);
    await fs.mkdir(dirAbs, { recursive: true });

    const resolvedPlanId = await resolveOrMintPlanId(dirAbs, planId);
    const planPathAbs = join(dirAbs, `${resolvedPlanId.id}.yaml`);
    const planPathRel = relative(repoRoot, planPathAbs).split("\\").join("/");

    let plan: PlanFileShape;
    let isNewPlan = false;
    if (await pathExists(planPathAbs)) {
      const raw = await fs.readFile(planPathAbs, "utf8");
      plan = parsePlanFile(yamlParse(raw));
    } else {
      plan = {
        planId: resolvedPlanId.id,
        createdAt: new Date().toISOString(),
        pendingAttestations: [],
      };
      isNewPlan = true;
    }

    plan.pendingAttestations.push(attestation);
    await writeAtomic(planPathAbs, serialisePlanFile(plan));

    if (isNewPlan && resolvedPlanId.shouldUpdateActive) {
      await fs.writeFile(join(dirAbs, ".active"), `${plan.planId}\n`, "utf8");
    }

    return {
      planId: plan.planId,
      planPath: planPathRel,
      isNewPlan,
      pendingAfter: plan.pendingAttestations.length,
    };
  }

  async readPlan(repoRoot: string, plansDir: string, planId: string): Promise<PlanFileShape | null> {
    const planPathAbs = resolve(repoRoot, plansDir, `${planId}.yaml`);
    if (!(await pathExists(planPathAbs))) return null;
    const raw = await fs.readFile(planPathAbs, "utf8");
    return parsePlanFile(yamlParse(raw));
  }
}

async function resolveOrMintPlanId(
  dirAbs: string,
  explicit: string | undefined,
): Promise<{ id: string; shouldUpdateActive: boolean }> {
  if (explicit !== undefined) return { id: explicit, shouldUpdateActive: false };
  const active = await readActive(dirAbs);
  if (active !== null) return { id: active, shouldUpdateActive: false };
  // Mint: ensure no collision against existing plan files.
  for (let attempt = 0; attempt < 20; attempt++) {
    const id = generatePlanId(new Date());
    const planPath = join(dirAbs, `${id}.yaml`);
    if (!(await pathExists(planPath))) return { id, shouldUpdateActive: true };
  }
  // Fallback — extremely unlikely; suffix with a counter to break the tie.
  const id = `${generatePlanId(new Date())}-fallback`;
  void isoBasicUtc; // keep import
  return { id, shouldUpdateActive: true };
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

async function writeAtomic(path: string, content: string): Promise<void> {
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(tmp, content, "utf8");
  await fs.rename(tmp, path);
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
