// Pure rewriter: given a markdown file and an approval action, returns the
// modified markdown text with `lifecycle.status` flipped to the target status
// and the `approval_record` placeholder replaced by a typed record block.
// No I/O — the adapter handles read/write.

import type { ApproveRequest } from "./ApproveRequest.js";

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

export function rewriteApproval(content: string, req: ApproveRequest, when: Date): RewriteResult {
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

function applyOne(lines: string[], m: IdMatch, req: ApproveRequest, when: Date): string[] {
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
  let statusIndent = m.indent;     // indent of `lifecycle.status:` (flat) or of `status:` line (nested)
  let approvalIndent = m.indent;   // where to write approval_record — same family as the status field
  let nestedHeaderIdx = -1;        // index of the `lifecycle:` header line (nested only)
  let approvalIdx = -1;
  let approvalIsNested = false;    // whether the existing approval_record is the nested or flat shape

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
          // anything that breaks out of the nested mapping (different indent
          // or empty line) ends the search; nested form requires status to
          // be the immediate or near child of `lifecycle:`.
          if (child.length > 0 && !child.startsWith(headerIndent)) break;
          if (child.length > 0 && child.startsWith(headerIndent) && !child.startsWith(childIndent)) break;
        }
      }
    }
    if (approvalIdx < 0) {
      // Match approval_record at any indent (covers both shapes); we record
      // its indent to know whether to replace or insert later.
      const ar = /^(\s*)approval_record:/.exec(line);
      if (ar !== null) {
        approvalIdx = i;
        approvalIsNested = ar[1]!.length >= statusIndent.length && statusKind === "nested";
      }
    }
  }

  if (statusKind === null) {
    // No anchor in either shape — leave block untouched (atomic contract).
    return [...before, ...block, ...after];
  }

  // Flip the status line in its native shape.
  if (statusKind === "flat") {
    block[statusIdx] = `${statusIndent}lifecycle.status: ${req.targetStatus}`;
  } else {
    block[statusIdx] = `${statusIndent}status: ${req.targetStatus}`;
  }

  const approvalLines = approvalBlock(req, when, approvalIndent);
  if (approvalIdx >= 0) {
    // Source had a placeholder/old approval_record — replace it in place.
    // For nested form the existing approval_record may have lived under
    // `lifecycle:` (nested) or as a top-level sibling (flat sibling); we
    // replace at its existing position with the indent we've chosen.
    void approvalIsNested; // intent documented; replacement uses approvalIndent uniformly
    block.splice(approvalIdx, 1, ...approvalLines);
  } else {
    // Source carried no approval_record (SDD §7.6 forbids it on proposed
    // records). Insert immediately after the flipped status line so the two
    // writes stay contiguous.
    block.splice(statusIdx + 1, 0, ...approvalLines);
  }
  void nestedHeaderIdx; // reserved for future shape-preserving edits

  return [...before, ...block, ...after];
}

function approvalBlock(req: ApproveRequest, when: Date, indent: string): string[] {
  const out = [
    `${indent}approval_record:`,
    `${indent}  owner_role: ${req.ownerRole}`,
    `${indent}  approver_identity: ${req.approver}`,
    `${indent}  timestamp: ${when.toISOString()}`,
    `${indent}  change_request: ${req.changeRequest}`,
    `${indent}  scope: ${req.scope}`,
  ];
  if (req.reviewedTestOracle !== null) {
    out.push(`${indent}  reviewed_test_oracle: ${req.reviewedTestOracle}`);
  }
  return out;
}

function findMatches(lines: readonly string[], idOrGlob: string): IdMatch[] {
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

    // `---` separator OR `- id: foo` start OR top-level `id: foo`.
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
      // top-level id of a single-document YAML block
      closeRecord(i);
      recStart = i;
      recId = flatM[2]!;
      recIndent = flatM[1]!;
      continue;
    }
    if (flatM !== null && recStart < 0) {
      // standalone post-separator block in a multi-doc fence
      recStart = i;
      recId = flatM[2]!;
      recIndent = flatM[1]!;
      continue;
    }
  }
  // Any lingering record at EOF — already handled by fence close.
  return out;
}

export function matchId(pattern: string, candidate: string): boolean {
  if (pattern === candidate) return true;
  if (!pattern.includes("*")) return false;
  const re = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
  return re.test(candidate);
}
