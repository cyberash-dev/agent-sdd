import { parseDocument } from "yaml";

/** Normalise a supplied record body to the bare YAML body (the form
 *  `sdd record get` emits): strip an enclosing ```yaml fence and any
 *  surrounding `---` document markers, then trim blank edges. */
export function normalizeBody(raw: string): string {
  let lines = raw.replace(/\r\n/g, "\n").split("\n");
  lines = trimBlankEdges(lines);

  if (lines.length > 0 && /^```yaml\s*$/.test(lines[0]!)) {
    const close = lines.findIndex((l, i) => i > 0 && /^```\s*$/.test(l));
    if (close !== -1) {
      lines = trimBlankEdges(lines.slice(1, close));
    }
  }

  if (lines.length > 0 && lines[0] === "---") {
    lines = lines.slice(1);
  }
  if (lines.length > 0 && lines[lines.length - 1] === "---") {
    lines = lines.slice(0, -1);
  }

  return trimBlankEdges(lines).join("\n");
}

export interface BodyFacts {
  id: string | null;
  status: string | null;
}

/** Best-effort parse of a record body to its id and lifecycle status.
 *  Unparseable input yields `{ id: null, status: null }` so callers treat
 *  it as an invalid body. */
export function inspectBody(body: string): BodyFacts {
  const doc = parseDocument(body, { prettyErrors: false });
  if (doc.errors.length > 0) return { id: null, status: null };
  const value = doc.toJS() as unknown;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { id: null, status: null };
  }
  const obj = value as Record<string, unknown>;
  const id = typeof obj.id === "string" ? obj.id : null;
  const status = lifecycleStatus(obj);
  return { id, status };
}

function lifecycleStatus(obj: Record<string, unknown>): string | null {
  const flat = obj["lifecycle.status"];
  if (typeof flat === "string") return flat;
  const lifecycle = obj.lifecycle;
  if (typeof lifecycle === "object" && lifecycle !== null && !Array.isArray(lifecycle)) {
    const status = (lifecycle as Record<string, unknown>).status;
    if (typeof status === "string") return status;
  }
  return null;
}

function trimBlankEdges(lines: readonly string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start]!.trim().length === 0) start++;
  while (end > start && lines[end - 1]!.trim().length === 0) end--;
  return lines.slice(start, end);
}
