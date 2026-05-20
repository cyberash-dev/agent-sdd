// Two-stage scanner for `@covers <partition>:<id> [key=value]*` markers
// (CST-007). Pure: takes a string + filename, returns Marker[] with 1-based
// line numbers. Language-agnostic: byte/string scan, no AST.

import { ID_TAIL_RE_SRC, PARTITION_PREFIX_RE_SRC } from "../../../shared/domain/PartitionGrammar.js";

export interface Marker {
  partition: string;
  id: string;
  tail: Record<string, string>;
  file: string;
  line: number;
}

export const ALLOWED_MARKER_KEYS: ReadonlySet<string> = new Set(["compatibility_action"]);

// Tail stops at `@` so a second `@covers` on the same line is reachable. The
// `compatibility_action=…` whitelist tokens never contain `@`, so this is a
// safe boundary in practice. Partition + id grammar is shared with Config
// validation via `PartitionGrammar`.
const MARKER_RE = new RegExp(
  `@covers\\s+(${PARTITION_PREFIX_RE_SRC}:${ID_TAIL_RE_SRC})([^@\\n\\r]*)`,
  "g",
);

export interface NearMissMarker {
  text: string;
  file: string;
  line: number;
}

// Loose recogniser for `@covers`-shaped tokens that end in a valid id tail
// (`<TYPE>-<num>`) but whose prefix violates the strict partition grammar
// (e.g. uppercase segment). Used to surface near-miss advisories (OQ-017).
const NEAR_MISS_RE = new RegExp(`@covers\\s+([A-Za-z0-9_:-]+:[A-Z]+-\\d+)`, "g");
const STRICT_TARGET_RE = new RegExp(`^${PARTITION_PREFIX_RE_SRC}:${ID_TAIL_RE_SRC}$`);

/** `@covers`-shaped tokens that look like a marker attempt (valid id tail) but
 *  fail the strict partition grammar. Strictly-valid markers are excluded. */
export function parseNearMisses(text: string, file: string): NearMissMarker[] {
  const out: NearMissMarker[] = [];
  const lineStarts = lineStartOffsets(text);
  NEAR_MISS_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = NEAR_MISS_RE.exec(text)) !== null) {
    const target = match[1]!;
    if (STRICT_TARGET_RE.test(target)) continue;
    out.push({ text: target, file, line: lineNumberOf(lineStarts, match.index) });
  }
  return out;
}

export function parseMarkers(text: string, file: string): Marker[] {
  const out: Marker[] = [];
  const lineStarts = lineStartOffsets(text);

  // Reset regex state in case a stale lastIndex leaks across calls.
  MARKER_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MARKER_RE.exec(text)) !== null) {
    const target = match[1]!;
    const rawTail = match[2] ?? "";
    // Split at the LAST `:` (CST-007). The id tail `[A-Z]+-\d+` contains no
    // `:`, so the rightmost `:` is unambiguous; everything before it is the
    // (possibly multi-segment) partition prefix. For single-segment markers
    // this is equivalent to `indexOf(":")`.
    const colon = target.lastIndexOf(":");
    const partition = target.slice(0, colon);
    const id = target.slice(colon + 1);
    const tail = parseTail(rawTail);
    const offset = match.index;
    const line = lineNumberOf(lineStarts, offset);
    out.push({ partition, id, tail, file, line });
  }
  return out;
}

function parseTail(rawTail: string): Record<string, string> {
  const tail: Record<string, string> = {};
  for (const token of rawTail.split(/\s+/)) {
    if (token.length === 0) continue;
    const eq = token.indexOf("=");
    if (eq < 1) continue;
    const key = token.slice(0, eq);
    const value = token.slice(eq + 1);
    if (!ALLOWED_MARKER_KEYS.has(key)) continue;
    tail[key] = value;
  }
  return tail;
}

function lineStartOffsets(text: string): number[] {
  const starts: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function lineNumberOf(lineStarts: readonly number[], offset: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (lineStarts[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}
