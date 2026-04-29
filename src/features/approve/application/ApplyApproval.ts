import { classifyRefusal, type ApproveRefusal, type ApproveRequest } from "../domain/ApproveRequest.js";
import { rewriteApproval } from "../domain/Rewrite.js";

export type { ApproveRefusal };
import type { ApproveClock } from "../ports/outbound/ApproveClock.js";
import type { ApproveConfigPort } from "../ports/outbound/ApproveConfigPort.js";
import type { ApproveFileSystem } from "../ports/outbound/ApproveFileSystem.js";

export interface ApplyApprovalPorts {
  clock: ApproveClock;
  config: ApproveConfigPort;
  files: ApproveFileSystem;
}

export type ApplyApprovalOutcome =
  | { kind: "refused"; refusal: ApproveRefusal }
  | { kind: "applied"; matchedIds: string[]; filesChanged: string[] };

export async function applyApproval(
  cwd: string,
  req: ApproveRequest,
  ports: ApplyApprovalPorts,
): Promise<ApplyApprovalOutcome> {
  const config = await ports.config.config(cwd);
  const refusal = classifyRefusal(req, config.lint.approverBlocklist);
  if (refusal !== null) {
    return { kind: "refused", refusal };
  }

  const entries = await ports.files.resolveSpecFiles(cwd, config.lint.specFiles);
  const matchedIds: string[] = [];
  const filesChanged: string[] = [];
  const when = ports.clock.now();

  for (const entry of entries) {
    const result = rewriteApproval(entry.content, req, when);
    if (result.matched.length === 0) continue;
    if (result.newContent !== entry.content) {
      await ports.files.writeSpecFile(cwd, entry.path, result.newContent);
      filesChanged.push(entry.path);
    }
    for (const m of result.matched) matchedIds.push(m.id);
  }

  if (matchedIds.length === 0) {
    return { kind: "refused", refusal: { kind: "no-id-match", id: req.id } };
  }
  return { kind: "applied", matchedIds, filesChanged };
}
