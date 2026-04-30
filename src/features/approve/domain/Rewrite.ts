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

  let lifecycleIdx = -1;
  let lifecycleIndent = m.indent;
  let approvalIdx = -1;
  for (let i = 0; i < block.length; i++) {
    const line = block[i]!;
    const lc = /^(\s*)lifecycle\.status:/.exec(line);
    if (lifecycleIdx < 0 && lc !== null) {
      lifecycleIdx = i;
      lifecycleIndent = lc[1]!;
    }
    if (approvalIdx < 0 && /^\s*approval_record:/.test(line)) approvalIdx = i;
  }

  // Per INV-007 the status flip and approval_record write are atomic:
  // we never touch one without the other. If there is no lifecycle.status
  // anchor in this record we leave the block untouched.
  if (lifecycleIdx < 0) {
    return [...before, ...block, ...after];
  }

  block[lifecycleIdx] = `${lifecycleIndent}lifecycle.status: ${req.targetStatus}`;

  const approvalLines = approvalBlock(req, when, lifecycleIndent);
  if (approvalIdx >= 0) {
    block.splice(approvalIdx, 1, ...approvalLines);
  } else {
    // Source carried no approval_record (SDD §7.6 forbids it on
    // proposed records). Insert the block immediately after the
    // flipped status line so the two writes stay contiguous.
    block.splice(lifecycleIdx + 1, 0, ...approvalLines);
  }

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
