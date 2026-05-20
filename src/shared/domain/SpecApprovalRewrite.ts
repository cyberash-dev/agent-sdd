// Pure rewriter: given a markdown file and an approval action, returns the
// modified markdown text with `lifecycle.status` flipped to the target status
// and the `approval_record` placeholder replaced by a typed record block.
// No I/O — the adapter handles read/write.
//
// Lives under shared/domain so that both the approve slice (inline path) and
// the finalize slice (plan-materialisation path) can call it without
// crossing feature boundaries (CST-003 / INV-004).

export type ApprovalTargetStatus = "approved" | "deprecated" | "removed";

export interface ApprovalAttestation {
  id: string;                        // exact ID or glob with `*`
  approver: string;
  ownerRole: string;
  changeRequest: string;
  scope: string;
  targetStatus: ApprovalTargetStatus;
  reviewedTestOracle: string | null;
}

export interface IdMatch {
  id: string;
  startLine: number;       // 1-based, line containing `- id:` or `id:`
  endLine: number;         // 1-based, exclusive end (next record start or end-of-fence)
  indent: string;          // leading whitespace before the field-level keys
}

export interface RewriteResult {
  newContent: string;
  matched: IdMatch[];
}

export function rewriteApproval(content: string, req: ApprovalAttestation, when: Date): RewriteResult {
  const lines = content.split(/\r?\n/);
  const matches = findMatches(lines, req.id);
  if (matches.length === 0) {
    return { newContent: content, matched: [] };
  }

  // Apply matches from last to first so line indices stay stable.
  const sorted = [...matches].sort((a, b) => b.startLine - a.startLine);
  let buf = [...lines];
  for (const m of sorted) {
    buf = applyOne(buf, m, req, when);
  }
  return { newContent: buf.join("\n"), matched: matches };
}

function applyOne(lines: string[], m: IdMatch, req: ApprovalAttestation, when: Date): string[] {
  const sliceStart = m.startLine - 1;
  const sliceEndExclusive = m.endLine - 1;
  const before = lines.slice(0, sliceStart);
  const block = lines.slice(sliceStart, sliceEndExclusive);
  const after = lines.slice(sliceEndExclusive);

  // The lifecycle anchor exists in two YAML shapes (CLAUDE.md: "the parser
  // also accepts a top-level form. Both work"):
  //   (i)  flat:    `lifecycle.status: <value>`                — one line.
  //   (ii) nested:  `lifecycle:` then `<indent>  status: <value>` — two lines.
  // Per INV-007 the status flip and approval_record write are atomic
  // regardless of shape. We pick whichever anchor we find first, then write
  // back in the same shape.
  let statusKind: "flat" | "nested" | null = null;
  let statusIdx = -1;
  let statusIndent = m.indent;
  let approvalIndent = m.indent;
  let nestedHeaderIdx = -1;
  let approvalIdx = -1;
  let approvalIsNested = false;

  for (let i = 0; i < block.length; i++) {
    const line = block[i]!;
    if (statusKind === null) {
      const flat = /^(\s*)lifecycle\.status:/.exec(line);
      if (flat !== null) {
        statusKind = "flat";
        statusIdx = i;
        statusIndent = flat[1]!;
        approvalIndent = flat[1]!;
        continue;
      }
      const nestedHeader = /^(\s*)lifecycle:\s*$/.exec(line);
      if (nestedHeader !== null) {
        const headerIndent = nestedHeader[1]!;
        const childIndent = `${headerIndent}  `;
        for (let j = i + 1; j < block.length; j++) {
          const child = block[j]!;
          if (new RegExp(`^${childIndent}status:\\s*\\S`).test(child)) {
            statusKind = "nested";
            statusIdx = j;
            statusIndent = childIndent;
            approvalIndent = childIndent;
            nestedHeaderIdx = i;
            break;
          }
          if (child.length > 0 && !child.startsWith(headerIndent)) break;
          if (child.length > 0 && child.startsWith(headerIndent) && !child.startsWith(childIndent)) break;
        }
      }
    }
    if (approvalIdx < 0) {
      const ar = /^(\s*)approval_record:/.exec(line);
      if (ar !== null) {
        approvalIdx = i;
        approvalIsNested = ar[1]!.length >= statusIndent.length && statusKind === "nested";
      }
    }
  }

  if (statusKind === null) {
    return [...before, ...block, ...after];
  }

  if (statusKind === "flat") {
    block[statusIdx] = `${statusIndent}lifecycle.status: ${req.targetStatus}`;
  } else {
    block[statusIdx] = `${statusIndent}status: ${req.targetStatus}`;
  }

  const approvalLines = approvalBlock(req, when, approvalIndent);
  if (approvalIdx >= 0) {
    void approvalIsNested;
    // Strip the existing block: the `approval_record:` header line AND every
    // subsequent line that is indented strictly deeper than the header (its
    // child mapping). Stop at the first sibling-or-shallower line. Without
    // this, repeated approvals against the same record would interleave a
    // new approval_record block on top of the prior one (regression observed
    // when batch-finalising an already-approved record).
    const headerMatch = /^(\s*)approval_record:/.exec(block[approvalIdx] ?? "");
    const headerIndent = headerMatch !== null ? headerMatch[1]!.length : 0;
    let endExclusive = approvalIdx + 1;
    while (endExclusive < block.length) {
      const line = block[endExclusive]!;
      if (line.trim().length === 0) break;
      const indentMatch = /^(\s*)/.exec(line);
      const lineIndent = indentMatch !== null ? indentMatch[1]!.length : 0;
      if (lineIndent <= headerIndent) break;
      endExclusive++;
    }
    block.splice(approvalIdx, endExclusive - approvalIdx, ...approvalLines);
  } else {
    block.splice(statusIdx + 1, 0, ...approvalLines);
  }
  void nestedHeaderIdx;

  return [...before, ...block, ...after];
}

function approvalBlock(req: ApprovalAttestation, when: Date, indent: string): string[] {
  const out = [
    `${indent}approval_record:`,
    `${indent}  owner_role: ${yamlScalar(req.ownerRole)}`,
    `${indent}  approver_identity: ${yamlScalar(req.approver)}`,
    `${indent}  timestamp: ${when.toISOString()}`,
    `${indent}  change_request: ${yamlScalar(req.changeRequest)}`,
    `${indent}  scope: ${yamlScalar(req.scope)}`,
  ];
  if (req.reviewedTestOracle !== null) {
    out.push(`${indent}  reviewed_test_oracle: ${yamlScalar(req.reviewedTestOracle)}`);
  }
  return out;
}

/** Emit a value as a YAML scalar — quoted only when the raw string would
 *  parse differently as plain YAML. The trigger we actually need to handle
 *  is `:` followed by whitespace (which YAML reads as a nested mapping).
 *  Plain URLs (`https://example.com/x`) keep `:` but never have `: ` and so
 *  stay unquoted — preserving v0.3.x output bytes for consumers that grep
 *  the rewritten approval_record for URL prefixes. */
function yamlScalar(value: string): string {
  if (value.length === 0) return '""';
  const needsQuoting = /:\s/.test(value)
    || /^[\s?\-#&*!|>'"%@`]/.test(value)
    || /\s$/.test(value);
  if (!needsQuoting) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function findMatches(lines: readonly string[], idOrGlob: string): IdMatch[] {
  const out: IdMatch[] = [];
  let inFence = false;
  let fenceStart = -1;
  let recStart = -1;
  let recId = "";
  let recIndent = "";

  const closeRecord = (endLine: number): void => {
    if (recStart < 0) return;
    if (matchId(idOrGlob, recId)) {
      out.push({ id: recId, startLine: recStart + 1, endLine: endLine + 1, indent: recIndent });
    }
    recStart = -1;
    recId = "";
    recIndent = "";
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!inFence && /^```yaml\s*$/.test(line)) {
      inFence = true;
      fenceStart = i;
      continue;
    }
    if (inFence && /^```\s*$/.test(line)) {
      closeRecord(i);
      inFence = false;
      fenceStart = -1;
      continue;
    }
    if (!inFence) continue;

    if (line === "---") {
      closeRecord(i);
      continue;
    }
    const listM = /^(\s*)-\s+id:\s*(\S+)/.exec(line);
    if (listM !== null) {
      closeRecord(i);
      recStart = i;
      recId = listM[2]!;
      recIndent = `${listM[1]!}  `;
      continue;
    }
    const flatM = /^(\s*)id:\s*(\S+)/.exec(line);
    if (flatM !== null && fenceStart >= 0 && i === fenceStart + 1) {
      closeRecord(i);
      recStart = i;
      recId = flatM[2]!;
      recIndent = flatM[1]!;
      continue;
    }
    if (flatM !== null && recStart < 0) {
      recStart = i;
      recId = flatM[2]!;
      recIndent = flatM[1]!;
      continue;
    }
  }
  return out;
}

export function matchId(pattern: string, candidate: string): boolean {
  if (pattern === candidate) return true;
  if (!pattern.includes("*")) return false;
  const re = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
  return re.test(candidate);
}
