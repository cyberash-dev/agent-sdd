import type { SpecBlock } from "../../../shared/domain/SpecBlocks.js";
import { blocksByNeutralPrefix } from "../../../shared/domain/SpecBlocks.js";

export interface FootprintEntry {
  impId: string;
  targetIds: string[];
  paths: string[];
}

export interface Footprint {
  entries: FootprintEntry[];
}

export function footprint(blocks: readonly SpecBlock[], bindingIdPrefix: string, bindingField: string): Footprint {
  const entries = blocksByNeutralPrefix(blocks, bindingIdPrefix).map((block) => {
    return {
      impId: block.id,
      targetIds: stringArray(block.parsed.target_ids),
      paths: stringLeaves(block.parsed[bindingField]),
    };
  });
  return { entries };
}

/** ENF/OQ-004 — IDs of binding-prefixed (IMP-*) blocks that carry no
 *  `bindingField`. An empty result means every such block declares a binding. */
export function impsMissingBinding(blocks: readonly SpecBlock[], bindingIdPrefix: string, bindingField: string): string[] {
  return blocksByNeutralPrefix(blocks, bindingIdPrefix)
    .filter((block) => block.parsed[bindingField] === undefined)
    .map((block) => block.id);
}

export function footprintEntriesForPath(footprint: Footprint, path: string): FootprintEntry[] {
  return footprint.entries.filter((entry) => entry.paths.some((boundPath) => covers(boundPath, path)));
}

function covers(boundPath: string, path: string): boolean {
  return path === boundPath || path.startsWith(`${boundPath}/`);
}

function stringLeaves(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => stringLeaves(entry));
  }
  if (isRecord(value)) {
    return Object.values(value).flatMap((entry) => stringLeaves(entry));
  }
  return [];
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
