// P2.4 — `sdd report --pr-summary`. Emits a 5-section markdown block per
// upstream Plan 2 §P2.4. Read-only on the working tree.
//
// Sections:
//   1. Closed Test obligations (ENF-007A) — placeholder, listing the
//      IDs that declare a test_obligation. Cross-marker scanning is left
//      as a follow-up enhancement (the markdown emits a clear TODO if
//      the @covers verification step is non-empty).
//   2. Internal decisions (ENF-007B) — placeholder TODO block; the agent
//      fills in the items by hand from PR diff context.
//   3. ASSUMPTIONs (ENF-007C) — every ASSUMPTION record's id + review_by.
//   4. Open-Q residuals (ENF-007D) — every Open-Q with status
//      proposed/draft.
//   5. Debt budget delta (ENF-007E) — diff Partition.unmodeled_budget.current
//      between HEAD and --against; emits a placeholder when --against is
//      omitted or no Partition records carry unmodeled_budget.

import { lintRecordsFromMarkdown, type LintRecord } from "../../../shared/domain/SpecRecord.js";
import type { ReportConfigPort } from "../ports/outbound/ReportConfigPort.js";
import type { ReportFileReader } from "../ports/outbound/ReportFileReader.js";

export interface RunReportPorts {
  config: ReportConfigPort;
  files: ReportFileReader;
  /** Optional git-at-ref reader for the debt-budget delta section. When
   *  omitted, debt-budget delta is rendered as "(--against not provided
   *  or git unavailable)". */
  readAtRef?: (repoRoot: string, ref: string, relativePath: string) => Promise<string | null>;
  repoRoot?: (cwd: string) => Promise<string>;
}

export interface RunReportInput {
  prSummary: boolean;
  against?: string;
}

export interface RunReportOutput {
  markdown: string;
}

export async function runReport(cwd: string, input: RunReportInput, ports: RunReportPorts): Promise<RunReportOutput> {
  const config = await ports.config.config(cwd);
  const entries = await ports.files.resolveSpecFiles(cwd, config.lint.specFiles);

  const records: LintRecord[] = [];
  for (const e of entries) records.push(...lintRecordsFromMarkdown(e.path, e.content));

  const lines: string[] = [];
  lines.push("## SDD PR Report");
  lines.push("");

  // 1. Closed Test obligations
  lines.push("### Closed Test obligations");
  lines.push("");
  const withObligations = records.filter((r) => r.testObligations.length > 0 || r.hasAliasedObligations);
  if (withObligations.length === 0) {
    lines.push("- _No records with `test_obligation` in scope._");
  } else {
    lines.push("<!-- TODO(agent): cross-reference against `@covers <id>` markers under tests/** to confirm closure. -->");
    for (const r of withObligations) {
      lines.push(`- [${r.id}] (${r.template}) — declares test_obligation`);
    }
  }
  lines.push("");

  // 2. Internal decisions
  lines.push("### Internal decisions (candidates for new Constraint/Policy/ASSUMPTION)");
  lines.push("");
  lines.push("<!-- TODO(agent): list internal decisions taken in this PR — names, structures, libraries — that are not yet codified. Examples:");
  lines.push("       - chose <X> over <Y>, rationale: ...");
  lines.push("       - introduced module <foo>, no Constraint binding yet");
  lines.push("     Each becomes a candidate for a new Constraint / Policy / ASSUMPTION in a follow-up PR. -->");
  lines.push("");

  // 3. ASSUMPTIONs
  lines.push("### ASSUMPTIONs");
  lines.push("");
  const assumptions = records.filter((r) => r.template === "ASSUMPTION");
  if (assumptions.length === 0) {
    lines.push("- _No ASSUMPTION records in scope._");
  } else {
    for (const r of assumptions) {
      const reviewBy = typeof r.parsed.review_by === "string" ? r.parsed.review_by : "(no review_by)";
      const blocking = typeof r.parsed.blocking === "string" ? r.parsed.blocking : "?";
      lines.push(`- [${r.id}] blocking=${blocking}, review_by=${reviewBy}`);
    }
  }
  lines.push("");

  // 4. Open-Q residuals
  lines.push("### Open-Q residuals");
  lines.push("");
  const openQs = records.filter((r) => r.template === "Open-Q" && (r.lifecycleStatus === "proposed" || r.lifecycleStatus === "draft"));
  if (openQs.length === 0) {
    lines.push("- _No open Open-Q records in scope._");
  } else {
    for (const r of openQs) {
      const blocking = typeof r.parsed.blocking === "string" ? r.parsed.blocking : "?";
      lines.push(`- [${r.id}] blocking=${blocking}`);
    }
  }
  lines.push("");

  // 5. Debt budget delta
  lines.push("### Debt budget delta");
  lines.push("");
  const debt = await debtBudgetDelta(cwd, input, records, entries, ports);
  for (const l of debt) lines.push(l);
  lines.push("");

  return { markdown: lines.join("\n") };
}

async function debtBudgetDelta(
  cwd: string,
  input: RunReportInput,
  records: ReadonlyArray<LintRecord>,
  entries: ReadonlyArray<{ path: string; content: string }>,
  ports: RunReportPorts,
): Promise<string[]> {
  const partitions = records.filter((r) => r.template === "Partition");
  if (partitions.length === 0) {
    return ["- _No Partition records in scope (debt budget not tracked)._"];
  }
  const out: string[] = [];

  const prevByPath = new Map<string, ReadonlyArray<LintRecord>>();
  if (input.against !== undefined && ports.readAtRef !== undefined && ports.repoRoot !== undefined) {
    let root: string;
    try {
      root = await ports.repoRoot(cwd);
    } catch {
      out.push(`- _Unable to resolve repo root for --against=${input.against}._`);
      return out;
    }
    for (const e of entries) {
      const prev = await ports.readAtRef(root, input.against, e.path);
      if (prev !== null) prevByPath.set(e.path, lintRecordsFromMarkdown(e.path, prev));
    }
  }

  for (const p of partitions) {
    const budget = p.parsed.unmodeled_budget;
    if (typeof budget !== "object" || budget === null) {
      out.push(`- [${p.id}] _no \`unmodeled_budget\` declared (P3.1)._`);
      continue;
    }
    const current = (budget as Record<string, unknown>).current;
    const trend = (budget as Record<string, unknown>).trend;
    const baselineAt = (budget as Record<string, unknown>).baseline_at;
    if (typeof current !== "number") {
      out.push(`- [${p.id}] _\`unmodeled_budget.current\` is not a number._`);
      continue;
    }

    let delta = "";
    if (input.against !== undefined) {
      const prevRecs = prevByPath.get(p.file);
      const prevPart = prevRecs?.find((r) => r.id === p.id);
      const prevBudget = prevPart !== undefined && typeof prevPart.parsed.unmodeled_budget === "object" && prevPart.parsed.unmodeled_budget !== null
        ? (prevPart.parsed.unmodeled_budget as Record<string, unknown>)
        : null;
      const prevCurrent = prevBudget !== null && typeof prevBudget.current === "number" ? prevBudget.current : null;
      if (prevCurrent !== null) {
        const diff = current - prevCurrent;
        const sign = diff > 0 ? "+" : "";
        delta = ` (was ${prevCurrent} at ${input.against}, ${sign}${diff})`;
      } else {
        delta = ` (no comparable budget at ${input.against})`;
      }
    }
    const baselineLabel = typeof baselineAt === "string" ? `, baseline_at ${baselineAt}` : "";
    const trendLabel = typeof trend === "string" ? `, trend=${trend}` : "";
    out.push(`- [${p.id}] current=${current}${delta}${baselineLabel}${trendLabel}`);
  }
  return out;
}
