import {
  DOCTOR_DRIFT_KINDS,
  LINT_DIAGNOSTIC_IDS,
  READY_VIOLATION_KINDS,
} from "../../../shared/domain/DiagnosticRegistry.js";
import { parseRegistry, type RegistryDocument } from "../domain/RegistryRow.js";
import { rangeIncludes } from "../domain/SemverRange.js";
import type { RegistryReader } from "../ports/outbound/RegistryReader.js";

export interface RunDoctorPorts {
  registry: RegistryReader;
}

export type DriftKind = "version_mismatch" | "missing_diagnostic" | "stale_diagnostic";

export interface DriftEntry {
  kind: DriftKind;
  id: string;
  remediation: string;
}

export type DoctorOutcome =
  | {
      kind: "ok";
      ruleVersion: string;
      cliVersion: string;
      compatibleRange: string;
    }
  | {
      kind: "drift";
      ruleVersion: string;
      cliVersion: string;
      compatibleRange: string;
      drift: DriftEntry[];
    }
  | {
      kind: "registry-not-found";
      path: string;
    }
  | {
      kind: "invalid-registry";
      path: string;
      reason: string;
    };

export async function runDoctor(rulesPath: string, ports: RunDoctorPorts): Promise<DoctorOutcome> {
  const file = await ports.registry.readRegistry(rulesPath);
  if (file.kind === "not-found") {
    return { kind: "registry-not-found", path: file.path };
  }
  const parsed = parseRegistry(file.content);
  if (!parsed.ok) {
    return { kind: "invalid-registry", path: file.path, reason: parsed.error.reason };
  }
  const cliVersion = await ports.registry.cliVersion();
  const drift = computeDrift(parsed.doc, cliVersion);
  const ruleVersion = parsed.doc.compatibleSddCli;

  if (drift.length === 0) {
    return { kind: "ok", ruleVersion, cliVersion, compatibleRange: parsed.doc.compatibleSddCli };
  }
  return {
    kind: "drift",
    ruleVersion,
    cliVersion,
    compatibleRange: parsed.doc.compatibleSddCli,
    drift,
  };
}

function computeDrift(doc: RegistryDocument, cliVersion: string): DriftEntry[] {
  const out: DriftEntry[] = [];
  if (!rangeIncludes(doc.compatibleSddCli, cliVersion)) {
    out.push({
      kind: "version_mismatch",
      id: cliVersion,
      remediation: `cli version ${cliVersion} is outside the registry range "${doc.compatibleSddCli}" — bump the registry's compatible_sdd_cli or downgrade the CLI`,
    });
  }

  const declared = new Set<string>();
  for (const row of doc.rows) {
    if (row.maturity !== "implemented") continue;
    for (const id of row.diagnosticIds) declared.add(id);
  }

  const known = new Set<string>([
    ...(LINT_DIAGNOSTIC_IDS as readonly string[]),
    ...(READY_VIOLATION_KINDS as readonly string[]),
    ...(DOCTOR_DRIFT_KINDS as readonly string[]),
  ]);

  for (const id of declared) {
    if (!known.has(id)) {
      out.push({
        kind: "missing_diagnostic",
        id,
        remediation: `registry declares "${id}" as implemented but the running CLI's DiagnosticRegistry does not contain it — add it to LINT_DIAGNOSTIC_IDS or READY_VIOLATION_KINDS, or change registry maturity to planned`,
      });
    }
  }

  for (const id of known) {
    if (!declared.has(id)) {
      out.push({
        kind: "stale_diagnostic",
        id,
        remediation: `DiagnosticRegistry contains "${id}" but no registry row claims it as implemented — add a registry row or remove the constant`,
      });
    }
  }

  return out;
}
