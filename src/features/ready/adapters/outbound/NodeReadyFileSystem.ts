import type { Dirent } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { configFromJson, type SddConfig } from "../../../../shared/domain/Config.js";
import { configFailure } from "../../../../shared/domain/Errors.js";
import type { ReadyConfigPort } from "../../ports/outbound/ReadyConfigPort.js";
import type { ReadyFileReader, SpecFileEntry, TestFileEntry } from "../../ports/outbound/ReadyFileReader.js";

export class NodeReadyFileSystem implements ReadyConfigPort, ReadyFileReader {
  async config(repoRoot: string): Promise<SddConfig> {
    const configPath = join(repoRoot, ".sdd", "config.json");
    const text = await readConfig(configPath);
    return configFromJson(parseConfigJson(text, configPath), configPath);
  }

  async resolveSpecFiles(repoRoot: string, patterns: readonly string[]): Promise<SpecFileEntry[]> {
    return readMatched(repoRoot, patterns);
  }

  async resolveTestFiles(repoRoot: string, patterns: readonly string[]): Promise<TestFileEntry[]> {
    return readMatched(repoRoot, patterns);
  }
}

async function readMatched(repoRoot: string, patterns: readonly string[]): Promise<SpecFileEntry[]> {
  const matched = new Set<string>();
  for (const pattern of patterns) {
    for (const abs of await expandGlob(repoRoot, pattern)) {
      matched.add(abs);
    }
  }
  const list = [...matched].sort();
  const out: SpecFileEntry[] = [];
  for (const abs of list) {
    const text = await readFile(abs, "utf8");
    const rel = relative(repoRoot, abs);
    out.push({ path: rel.split("\\").join("/"), content: text });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Minimal glob expander — duplicated from features/lint to avoid a cross-slice
// import (CST-003 / INV-004). Same semantics as
// src/features/lint/adapters/outbound/NodeLintFileReader.ts; CST-006 holds
// because no third-party glob library enters the runtime dependency tree.
// ---------------------------------------------------------------------------

async function expandGlob(repoRoot: string, pattern: string): Promise<string[]> {
  const normalised = pattern.split("\\").join("/");
  if (!hasGlob(normalised)) {
    const abs = resolve(repoRoot, normalised);
    return (await isFile(abs)) ? [abs] : [];
  }
  const segments = normalised.split("/");
  const literalSegments: string[] = [];
  let firstGlobIndex = -1;
  for (let i = 0; i < segments.length; i++) {
    if (hasGlob(segments[i]!)) {
      firstGlobIndex = i;
      break;
    }
    literalSegments.push(segments[i]!);
  }
  const baseDir = resolve(repoRoot, ...literalSegments);
  const remaining = segments.slice(firstGlobIndex);
  const out: string[] = [];
  await walkAndMatch(baseDir, remaining, out);
  return out;
}

async function walkAndMatch(dir: string, remaining: string[], acc: string[]): Promise<void> {
  if (remaining.length === 0) return;
  const head = remaining[0]!;
  const rest = remaining.slice(1);
  let entries: Dirent[];
  try {
    entries = (await readdir(dir, { withFileTypes: true })) as Dirent[];
  } catch {
    return;
  }
  if (head === "**") {
    if (rest.length === 0) {
      for (const entry of entries) {
        const abs = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walkAndMatch(abs, ["**"], acc);
        } else if (entry.isFile()) {
          acc.push(abs);
        }
      }
      return;
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkAndMatch(abs, remaining, acc);
      }
    }
    await walkAndMatch(dir, rest, acc);
    return;
  }
  for (const entry of entries) {
    if (!matchSegment(head, entry.name)) continue;
    const abs = join(dir, entry.name);
    if (rest.length === 0) {
      if (entry.isFile()) acc.push(abs);
      continue;
    }
    if (entry.isDirectory()) {
      await walkAndMatch(abs, rest, acc);
    }
  }
}

function matchSegment(pattern: string, name: string): boolean {
  if (!hasGlob(pattern)) return pattern === name;
  const re = new RegExp(`^${pattern
    .split("")
    .map((c) => {
      if (c === "*") return "[^/]*";
      if (c === "?") return "[^/]";
      return c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    })
    .join("")}$`);
  return re.test(name);
}

function hasGlob(value: string): boolean {
  return /[*?[\]]/.test(value);
}

async function isFile(abs: string): Promise<boolean> {
  try {
    const s = await stat(abs);
    return s.isFile();
  } catch {
    return false;
  }
}

async function readConfig(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    throw configFailure("config-missing", ".sdd/config.json is missing or unreadable", errorMessage(error), path);
  }
}

function parseConfigJson(text: string, path: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw configFailure("config-invalid", ".sdd/config.json is not valid JSON", errorMessage(error), path);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
