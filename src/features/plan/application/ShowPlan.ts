import type { PlanConfigPort } from "../ports/outbound/PlanConfigPort.js";
import type { PlanLookup, PlanReader } from "../ports/outbound/PlanReader.js";

export interface ShowPlanPorts {
  config: PlanConfigPort;
  reader: PlanReader;
}

export async function showPlan(cwd: string, planId: string | undefined, ports: ShowPlanPorts): Promise<PlanLookup> {
  const config = await ports.config.config(cwd);
  return ports.reader.read(cwd, config.plansDir, planId);
}
