// Parsed enforcement-registry row + compatibility metadata.
//
// The methodology canonical (Plan 1, in code-aget-config) ships an
// `enforcement_registry.md` file containing:
//
//   ## Compatibility
//
//   compatible_sdd_cli: ">=0.4 <0.5"
//   ...
//
//   ## Registry
//
//   | enf_id | rule_id | maturity | diagnostic_id |
//   |--------|---------|----------|---------------|
//   | ENF-001 | weasel words | implemented | sdd:weasel-word |
//   | ENF-003 | baseline-version-required | planned | sdd:baseline-version-required |
//
// `sdd doctor --rule-version` parses this file, compares the declared
// compatible_sdd_cli range against the running CLI, and compares the rows
// with maturity=implemented against the local DiagnosticRegistry constants.
//
// Pure parser — no node:* imports.

export type RegistryMaturity =
  | "planned"
  | "implemented"
  | "deprecated"
  | "out_of_scope";

export interface RegistryRow {
  enfId: string;
  ruleName: string;
  maturity: RegistryMaturity;
  diagnosticId: string | null;
}

export interface RegistryDocument {
  compatibleSddCli: string;
  rows: RegistryRow[];
}

export interface RegistryParseError {
  reason: string;
}

/** Parse a methodology enforcement-registry markdown blob into a typed
 *  RegistryDocument. Returns a discriminated outcome — never throws. */
export function parseRegistry(markdown: string): { ok: true; doc: RegistryDocument } | { ok: false; error: RegistryParseError } {
  const compat = readCompatibilityRange(markdown);
  if (compat === null) {
    return { ok: false, error: { reason: "missing or invalid compatible_sdd_cli in ## Compatibility section" } };
  }
  const rows = readRegistryRows(markdown);
  return { ok: true, doc: { compatibleSddCli: compat, rows } };
}

function readCompatibilityRange(markdown: string): string | null {
  const re = /^\s*compatible_sdd_cli\s*:\s*"?([^"\n]+?)"?\s*$/im;
  const m = re.exec(markdown);
  if (m === null) return null;
  return m[1]!.trim();
}

function readRegistryRows(markdown: string): RegistryRow[] {
  const out: RegistryRow[] = [];
  const lines = markdown.split(/\r?\n/);
  let inTable = false;
  let cols: string[] = [];

  for (const line of lines) {
    if (!inTable) {
      const header = parseTableRow(line);
      if (header !== null && header.includes("enf_id") && header.includes("rule_id") && header.includes("maturity")) {
        cols = header;
        inTable = true;
      }
      continue;
    }
    // skip the |---|---| separator immediately after the header
    if (/^\s*\|?\s*-+/.test(line)) continue;
    const row = parseTableRow(line);
    if (row === null) {
      inTable = false;
      continue;
    }
    if (row.length !== cols.length) continue;
    const rec: Record<string, string> = {};
    for (let i = 0; i < cols.length; i++) rec[cols[i]!] = row[i]!.trim();
    const maturity = rec.maturity!;
    if (maturity !== "planned" && maturity !== "implemented" && maturity !== "deprecated" && maturity !== "out_of_scope") continue;
    const enfId = rec.enf_id!;
    const ruleName = rec.rule_id!;
    if (!enfId || !ruleName) continue;
    const did = rec.diagnostic_id ?? "";
    const diagnosticId = did === "" || did === "—" || did === "-" ? null : did;
    out.push({ enfId, ruleName, maturity, diagnosticId });
  }
  return out;
}

function parseTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  if (!trimmed.endsWith("|")) return null;
  const inner = trimmed.slice(1, -1);
  const cells = inner.split("|").map((c) => c.trim());
  if (cells.length < 2) return null;
  return cells;
}
