// Parsed enforcement-registry row + compatibility metadata.
//
// The methodology canonical ships an `enforcement_registry.md` file with a
// `## Compatibility metadata` table:
//
//   | Field | Value |
//   |---|---|
//   | compatible_sdd_cli | >=1.0 <2.0 |
//
// and a `## Registry` table whose columns include `id`, `requirement`,
// `diagnostic_id`, and `maturity` (among others):
//
//   | id | parent_id | requirement | ... | diagnostic_id | maturity | ... |
//   |----|-----------|-------------|-----|---------------|----------|-----|
//   | ENF-001 | — | weasel words | ... | sdd:weasel-word | implemented | ... |
//
// A diagnostic_id cell may carry multiple ids separated by ` | ` (escaped as
// `\|` in markdown), e.g. ENF-008's `version_mismatch \| missing_diagnostic \|
// stale_diagnostic`. `—` / `-` / empty means no diagnostic id.
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
  diagnosticIds: string[];
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
  for (const line of markdown.split(/\r?\n/)) {
    const row = parseTableRow(line);
    if (row === null) continue;
    if (row.length >= 2 && row[0] === "compatible_sdd_cli") {
      const value = row[1]!.replace(/^"|"$/g, "").trim();
      return value === "" ? null : value;
    }
  }
  return null;
}

function readRegistryRows(markdown: string): RegistryRow[] {
  const out: RegistryRow[] = [];
  const lines = markdown.split(/\r?\n/);
  let inTable = false;
  let cols: string[] = [];

  for (const line of lines) {
    if (!inTable) {
      const header = parseTableRow(line);
      if (header !== null && header.includes("id") && header.includes("requirement") && header.includes("maturity") && header.includes("diagnostic_id")) {
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
    // A trailing `:hybrid` marks rows mixing mechanical + human verdicts; the
    // base maturity drives reconciliation.
    const maturity = rec.maturity!.split(":")[0]!.trim() as RegistryMaturity;
    if (maturity !== "planned" && maturity !== "implemented" && maturity !== "deprecated" && maturity !== "out_of_scope") continue;
    const enfId = rec.id!;
    const ruleName = rec.requirement!;
    if (!enfId || !ruleName) continue;
    const diagnosticIds = parseDiagnosticIds(rec.diagnostic_id ?? "");
    out.push({ enfId, ruleName, maturity, diagnosticIds });
  }
  return out;
}

function parseDiagnosticIds(cell: string): string[] {
  return cell
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s !== "" && s !== "—" && s !== "-");
}

function parseTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  if (!trimmed.endsWith("|")) return null;
  const inner = trimmed.slice(1, -1);
  const cells = inner
    .split(/(?<!\\)\|/)
    .map((c) => c.replace(/\\\|/g, "|").trim());
  if (cells.length < 2) return null;
  return cells;
}
