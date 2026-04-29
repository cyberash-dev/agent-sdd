import { parseDocument } from "yaml";
import { configFailure } from "./Errors.js";

export interface SpecBlock {
  id: string;
  type: string;
  parsed: Record<string, unknown>;
  raw: string;
  line: number;
}

interface ParsedDocument {
  raw: string;
  line: number;
}

export function specBlocks(markdown: string): SpecBlock[] {
  return yamlDocuments(markdown).map((document) => specBlock(document));
}

export function blocksById(blocks: readonly SpecBlock[], id: string): SpecBlock[] {
  return blocks.filter((block) => block.id === id);
}

export function blocksByNeutralPrefix(blocks: readonly SpecBlock[], prefix: string): SpecBlock[] {
  return blocks.filter((block) => neutralId(block.id).startsWith(prefix));
}

export function typedBlock(blocks: readonly SpecBlock[], id: string, type: string, specPath: string): SpecBlock {
  const matches = blocksById(blocks, id).filter((block) => block.type === type);
  if (matches.length === 0) {
    throw configFailure("baseline-block-missing", `missing ${type} block: ${id}`, undefined, specPath);
  }
  if (matches.length > 1) {
    throw configFailure("baseline-block-duplicate", `duplicate ${type} block: ${id}`, undefined, specPath);
  }
  return matches[0]!;
}

export function stringValue(block: SpecBlock, field: string, specPath: string): string {
  const value = block.parsed[field];
  if (typeof value !== "string" || value.length === 0) {
    throw configFailure("config-invalid", `${block.id}.${field} must be a non-empty string`, undefined, specPath);
  }
  return value;
}

function specBlock(document: ParsedDocument): SpecBlock {
  const parsed = parseDocument(document.raw, { prettyErrors: false });
  if (parsed.errors.length > 0) {
    const message = parsed.errors.map((error) => error.message).join("; ");
    throw configFailure("config-invalid", `invalid YAML block at line ${document.line}`, message);
  }
  const value = parsed.toJS() as unknown;
  if (!isRecord(value)) {
    throw configFailure("config-invalid", `YAML block at line ${document.line} must be an object`);
  }
  const id = value.id;
  const type = value.type;
  if (typeof id !== "string" || typeof type !== "string") {
    throw configFailure("config-invalid", `YAML block at line ${document.line} must include string id and type`);
  }
  return { id, type, parsed: value, raw: document.raw, line: document.line };
}

function yamlDocuments(markdown: string): ParsedDocument[] {
  const lines = markdown.split(/\r?\n/);
  const documents: ParsedDocument[] = [];
  let isInsideYamlFence = false;
  let fenceLines: string[] = [];
  let fenceStartLine = 0;

  lines.forEach((line, index) => {
    if (!isInsideYamlFence && line.trim() === "```yaml") {
      isInsideYamlFence = true;
      fenceLines = [];
      fenceStartLine = index + 1;
      return;
    }
    if (isInsideYamlFence && line.trim() === "```") {
      documents.push(...documentsInFence(fenceLines, fenceStartLine + 1));
      isInsideYamlFence = false;
      fenceLines = [];
      return;
    }
    if (isInsideYamlFence) {
      fenceLines.push(line);
    }
  });

  return documents;
}

function documentsInFence(lines: readonly string[], firstLine: number): ParsedDocument[] {
  const documents: ParsedDocument[] = [];
  let startIndex: number | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] !== "---") {
      continue;
    }
    if (startIndex === undefined) {
      startIndex = index + 1;
      continue;
    }
    const raw = lines.slice(startIndex, index).join("\n").trim();
    if (raw.length > 0) {
      documents.push({ raw, line: firstLine + startIndex });
    }
    startIndex = undefined;
  }
  return documents;
}

function neutralId(id: string): string {
  return id.includes(":") ? id.split(":").at(-1)! : id;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
