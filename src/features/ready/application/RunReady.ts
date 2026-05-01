import type { Partition, SddConfig } from "../../../shared/domain/Config.js";
import { CliFailure } from "../../../shared/domain/Errors.js";
import {
  appendDiagnostic,
  emptyReport,
  type Diagnostic,
  type LintReport,
} from "../../../shared/domain/LintReport.js";
import {
  applicabilityRequiredRule,
  approvalRecordRules,
  assumptionDowngradeApprovalRule,
  baselineVersionRequiredRule,
  boundaryConcurrencyModelRule,
  boundaryPolicyRefRule,
  dataScopeRequiredRule,
  deprecatedFieldsRequiredRule,
  fieldTypeRules,
  generatedArtifactSurfaceRefRule,
  lifecycleStatusRules,
  partitionDefaultPolicySetRule,
  REQUIRED_PARTITION_SECTIONS,
  sectionViolations,
  testObligationRules,
  weaselFindings,
} from "../../../shared/domain/LintRules.js";
import { reachableBoundaryIds } from "../../../shared/domain/BoundaryReachability.js";
import { lintRecordsFromMarkdown, type LintRecord } from "../../../shared/domain/SpecRecord.js";
import { TOKEN_MECHANISM, token as computeToken } from "../../../shared/domain/Token.js";
import {
  aggregatedCheckViolations,
  aggregatedLintViolations,
  type AggregatedCheckOutcome,
} from "../domain/AggregatedRules.js";
import { parseMarkers, type Marker } from "../domain/MarkerParser.js";
import {
  ruleOrphanCovers,
  ruleRemovedCompatActionMismatch,
  ruleRemovedNoCompatTest,
  ruleSurfaceUnapprovedRef,
  ruleUnapproved,
  ruleUncovered,
  ruleUnknownPartitionCovers,
  type PartitionView,
  type ScannedMarker,
} from "../domain/Rules.js";
import type { ReadyInput } from "../domain/ReadyInput.js";
import {
  emptyEnvelope,
  envelopeFromError,
  type ReadyEnvelope,
  type ReadyError,
  type ReadyViolation,
} from "../domain/ReadyViolation.js";
import type { ReadyConfigPort } from "../ports/outbound/ReadyConfigPort.js";
import type { ReadyFileReader, SpecFileEntry, TestFileEntry } from "../ports/outbound/ReadyFileReader.js";
import type { ReadyGitPort } from "../ports/outbound/ReadyGitPort.js";

// Re-export domain types that adapters consume via the application boundary.
export type { ReadyEnvelope, ReadyError, ReadyViolation };

export interface RunReadyPorts {
  config: ReadyConfigPort;
  files: ReadyFileReader;
  git: ReadyGitPort;
}

export async function runReady(cwd: string, input: ReadyInput, ports: RunReadyPorts): Promise<ReadyEnvelope> {
  let config: SddConfig;
  try {
    config = await ports.config.config(cwd);
  } catch (error) {
    return envelopeFromError(toReadyError(error, "config_invalid"));
  }

  const filterName = input.partitionFilter;
  if (filterName !== undefined && !config.partitions.some((p) => p.name === filterName)) {
    return envelopeFromError({
      kind: "config_invalid",
      message: `unknown partition: ${filterName} (configured: ${config.partitions.map((p) => p.name).join(", ") || "<none>"})`,
    });
  }

  const partitions = config.partitions;
  const evaluatedPartitions = filterName === undefined ? partitions : partitions.filter((p) => p.name === filterName);

  // 1. Parse spec files for every configured partition (orphan_covers needs
  // global record knowledge even when --partition filters evaluation).
  const recordsByPartition = new Map<string, LintRecord[]>();
  for (const p of partitions) {
    let entries: SpecFileEntry[];
    try {
      entries = await ports.files.resolveSpecFiles(cwd, p.specPaths);
    } catch (error) {
      return envelopeFromError(toReadyError(error, "config_invalid"));
    }
    const records: LintRecord[] = [];
    for (const entry of entries) {
      try {
        records.push(...lintRecordsFromMarkdown(entry.path, entry.content));
      } catch (error) {
        return envelopeFromError({
          kind: "spec_parse_failed",
          message: error instanceof Error ? error.message : String(error),
          file: entry.path,
        });
      }
    }
    recordsByPartition.set(p.name, records);
  }

  // 2. Scan test files for every configured partition. A unique file is read
  // once per partition that lists it; markers carry the file path, so the
  // partition->credited mapping is computed lazily during rule evaluation.
  const markersByPartition = new Map<string, Marker[]>();
  for (const p of partitions) {
    if (p.testPaths.length === 0) {
      markersByPartition.set(p.name, []);
      continue;
    }
    let entries: TestFileEntry[];
    try {
      entries = await ports.files.resolveTestFiles(cwd, p.testPaths);
    } catch (error) {
      return envelopeFromError({
        kind: "unreadable_test_paths",
        message: error instanceof Error ? error.message : String(error),
      });
    }
    const markers: Marker[] = [];
    for (const entry of entries) {
      markers.push(...parseMarkers(entry.content, entry.path));
    }
    markersByPartition.set(p.name, markers);
  }

  // 3. Per-partition rule evaluation.
  const violations: ReadyViolation[] = [];
  const partitionsByName = new Map(partitions.map((p) => [p.name, p] as const));
  for (const partition of evaluatedPartitions) {
    const records = recordsByPartition.get(partition.name) ?? [];
    const recordsById = new Map<string, LintRecord>();
    for (const r of records) recordsById.set(r.id, r);

    const credited = new Map<string, Marker[]>();
    const ownMarkers = markersByPartition.get(partition.name) ?? [];
    for (const m of ownMarkers) {
      if (m.partition !== partition.name) continue;
      const id = `${m.partition}:${m.id}`;
      const list = credited.get(id) ?? [];
      list.push(m);
      credited.set(id, list);
    }

    const view: PartitionView = {
      partition,
      records,
      recordsById,
      creditedMarkersById: credited,
    };

    violations.push(
      ...ruleUnapproved(view),
      ...ruleUncovered(view),
      ...ruleRemovedNoCompatTest(view),
      ...ruleRemovedCompatActionMismatch(view),
      ...ruleSurfaceUnapprovedRef(view),
    );
  }

  // 4. Marker-level checks (orphan_covers, unknown_partition_covers) over
  // every scanned marker. Deduplicate markers by (file, line, partition, id)
  // so a file listed in multiple partitions' test_paths is not double-counted.
  const seen = new Set<string>();
  const allMarkers: Marker[] = [];
  for (const ms of markersByPartition.values()) {
    for (const m of ms) {
      const key = `${m.file}:${m.line}:${m.partition}:${m.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allMarkers.push(m);
    }
  }
  const scanned: ScannedMarker[] = [];
  for (const m of allMarkers) {
    const fullId = `${m.partition}:${m.id}`;
    const partition = partitionsByName.get(m.partition);
    const isPartitionConfigured = partition !== undefined;
    const records = isPartitionConfigured ? recordsByPartition.get(m.partition) ?? [] : [];
    const hasMatchingRecord = records.some((r) => r.id === fullId);
    scanned.push({ marker: m, isPartitionConfigured, hasMatchingRecord });
  }

  // When --partition filters evaluation, we still surface unknown_partition
  // and orphan_covers globally — a misconfigured marker is a misconfigured
  // marker regardless of which partition CI is gating right now.
  violations.push(...ruleUnknownPartitionCovers(scanned), ...ruleOrphanCovers(scanned));

  // 5. Aggregated lint over the union of evaluated partitions' spec files
  // (matches CTR-015's "partitions[*].spec_paths" precedence over
  // lint.spec_files).
  const lintSpecPaths = uniqueSpecPaths(evaluatedPartitions, config);
  const lintReport = await aggregatedLintReport(cwd, ports.files, lintSpecPaths, config.lint.approverBlocklist);
  violations.push(...aggregatedLintViolations(lintReport.diagnostics));

  // 6. Aggregated check (only when git is available). Skipped silently if
  // the working tree is not a git repository — adopters running ready in a
  // tarball-extracted CI workspace are not penalised for the missing repo.
  const checkOutcome = await aggregatedCheckOutcome(cwd, config, recordsByPartition, ports.git);
  if (checkOutcome.kind === "error") {
    return envelopeFromError(checkOutcome.error);
  }
  violations.push(...aggregatedCheckViolations(checkOutcome.outcome));

  if (violations.length === 0) return emptyEnvelope();
  return { ok: false, error: null, violations };
}

function uniqueSpecPaths(evaluated: readonly Partition[], config: SddConfig): string[] {
  const all = evaluated.length > 0 ? evaluated.flatMap((p) => p.specPaths) : config.lint.specFiles;
  return [...new Set(all)];
}

async function aggregatedLintReport(
  cwd: string,
  files: ReadyFileReader,
  specPaths: readonly string[],
  approverBlocklist: readonly string[],
): Promise<LintReport> {
  let report = emptyReport();
  if (specPaths.length === 0) return report;
  let entries: SpecFileEntry[];
  try {
    entries = await files.resolveSpecFiles(cwd, specPaths);
  } catch {
    return report;
  }
  for (const entry of entries) {
    report = lintFileInto(report, entry, approverBlocklist);
  }
  return report;
}

function lintFileInto(report: LintReport, entry: SpecFileEntry, approverBlocklist: readonly string[]): LintReport {
  let next = report;
  if (looksLikePartitionFile(entry.content)) {
    for (const v of sectionViolations(entry.content)) {
      next = appendDiagnostic(next, {
        severity: "error",
        rule: v.rule,
        file: entry.path,
        message: v.message,
      });
    }
  }
  const records = lintRecordsFromMarkdown(entry.path, entry.content);
  const boundaryIds = reachableBoundaryIds(records);
  for (const w of weaselFindings(entry.content, records)) {
    const where = w.field !== undefined ? `normative field ${w.field}` : `normative section "${w.section}"`;
    next = appendDiagnostic(next, {
      severity: "error",
      rule: "sdd:weasel-word",
      file: entry.path,
      line: w.line,
      message: `Banned phrase "${w.word}" in ${where} (SDD §5.1).`,
    });
  }
  for (const rec of records) {
    for (const d of [
      ...lifecycleStatusRules(rec),
      ...approvalRecordRules(rec),
      ...testObligationRules(rec),
      ...fieldTypeRules(rec),
      ...baselineVersionRequiredRule(rec),
      ...deprecatedFieldsRequiredRule(rec),
      ...assumptionDowngradeApprovalRule(rec, approverBlocklist),
      ...partitionDefaultPolicySetRule(rec),
      ...generatedArtifactSurfaceRefRule(rec),
      ...boundaryPolicyRefRule(rec, boundaryIds),
      ...boundaryConcurrencyModelRule(rec, boundaryIds),
      ...applicabilityRequiredRule(rec, boundaryIds),
      ...dataScopeRequiredRule(rec, boundaryIds),
    ]) {
      next = appendDiagnostic(next, d);
    }
  }
  return next;
}

function looksLikePartitionFile(markdown: string): boolean {
  const firstNumberedHeading = REQUIRED_PARTITION_SECTIONS[0]!;
  const re = new RegExp(`^##\\s+${firstNumberedHeading.replace(/\./g, "\\.").replace(/ /g, "\\s+")}`, "m");
  return re.test(markdown);
}

interface CheckOutcomeResult {
  kind: "outcome";
  outcome: AggregatedCheckOutcome;
}

interface CheckErrorResult {
  kind: "error";
  error: ReadyError;
}

async function aggregatedCheckOutcome(
  cwd: string,
  config: SddConfig,
  recordsByPartition: ReadonlyMap<string, readonly LintRecord[]>,
  git: ReadyGitPort,
): Promise<CheckOutcomeResult | CheckErrorResult> {
  const inRepo = await git.isGitRepo(cwd).catch(() => false);
  if (!inRepo) return { kind: "outcome", outcome: { kind: "skipped" } };

  const baseline = findBaseline(config.baselineId, recordsByPartition);
  if (baseline === null) {
    // Baseline-id pattern is enforced by config; absence of the block in spec
    // is itself a baseline-stale-equivalent. We surface it via aggregated
    // check rather than treating it as evaluate-failure, to match `sdd lint`'s
    // tolerance of unparseable BL blocks (it just doesn't lint them).
    return { kind: "outcome", outcome: { kind: "skipped" } };
  }
  if (baseline.freshnessToken === "TODO" || baseline.freshnessToken.length === 0) {
    return { kind: "outcome", outcome: { kind: "skipped" } };
  }

  let repoRoot: string;
  try {
    repoRoot = await git.repoRoot(cwd);
  } catch {
    return { kind: "outcome", outcome: { kind: "skipped" } };
  }

  let dirty: string[];
  try {
    dirty = await git.dirtyPaths(repoRoot, config.discoveryScope);
  } catch (error) {
    return { kind: "error", error: { kind: "internal", message: error instanceof Error ? error.message : String(error) } };
  }
  if (dirty.length > 0) {
    return { kind: "outcome", outcome: { kind: "dirty", dirtyPaths: dirty } };
  }

  let bytes: Uint8Array;
  try {
    bytes = await git.treeBytes(repoRoot, config.discoveryScope);
  } catch (error) {
    return { kind: "error", error: { kind: "internal", message: error instanceof Error ? error.message : String(error) } };
  }
  const recomputed = computeToken(bytes);
  if (recomputed === baseline.freshnessToken) {
    return { kind: "outcome", outcome: { kind: "match" } };
  }
  return { kind: "outcome", outcome: { kind: "stale", recordedToken: baseline.freshnessToken, recomputedToken: recomputed } };
}

function findBaseline(
  baselineId: string,
  recordsByPartition: ReadonlyMap<string, readonly LintRecord[]>,
): { freshnessToken: string } | null {
  for (const records of recordsByPartition.values()) {
    for (const rec of records) {
      if (rec.id !== baselineId) continue;
      const ft = rec.parsed.freshness_token;
      if (typeof ft === "string") return { freshnessToken: ft };
    }
  }
  return null;
}

function toReadyError(error: unknown, fallback: ReadyError["kind"]): ReadyError {
  if (error instanceof CliFailure) {
    if (error.reason === "config-missing" || error.reason === "config-invalid") {
      return { kind: "config_invalid", message: error.message, file: error.path };
    }
  }
  return {
    kind: fallback,
    message: error instanceof Error ? error.message : String(error),
  };
}

// Side-effect-free public helper for tests/unit symmetry.
export function appendLintDiagnostic(report: LintReport, d: Diagnostic): LintReport {
  return appendDiagnostic(report, d);
}

export { TOKEN_MECHANISM };
