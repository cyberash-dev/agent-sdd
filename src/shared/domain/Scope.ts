export function globScopeEntries(scope: readonly string[]): string[] {
  return scope.filter((entry) => /[*?\[]/.test(entry));
}
