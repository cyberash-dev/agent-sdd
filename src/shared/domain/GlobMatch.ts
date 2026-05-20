// Pattern-match a posix-style file path against a glob pattern (the CST-006
// dialect: `*` = any chars within a segment, `?` = single char, `**` =
// zero-or-more directory levels, literal segments). Pure; no I/O.

export function matchesGlob(pattern: string, path: string): boolean {
  const patternSegments = pattern.split("/").filter((s) => s.length > 0);
  const pathSegments = path.split("/").filter((s) => s.length > 0);
  return matchSegments(patternSegments, 0, pathSegments, 0);
}

function matchSegments(p: readonly string[], pi: number, x: readonly string[], xi: number): boolean {
  if (pi === p.length) return xi === x.length;
  const head = p[pi]!;
  if (head === "**") {
    if (pi === p.length - 1) return true;
    for (let k = xi; k <= x.length; k++) {
      if (matchSegments(p, pi + 1, x, k)) return true;
    }
    return false;
  }
  if (xi === x.length) return false;
  if (!segmentMatches(head, x[xi]!)) return false;
  return matchSegments(p, pi + 1, x, xi + 1);
}

function segmentMatches(pattern: string, name: string): boolean {
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

export function fileInGlobs(file: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => matchesGlob(p, file));
}
