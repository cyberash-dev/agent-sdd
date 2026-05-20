#!/bin/bash
# PreToolUse guard. Matcher: Read|Bash|Grep|Glob.
# Stdin: JSON with tool_name, tool_input, cwd.
# Purpose: in an SDD project (a tree carrying .sdd/config.json), DENY any
# attempt to read spec/*.md directly. The spec is navigated via
# `sdd record list` / `sdd record get <id>`, not by reading the whole file.
# Heuristic Bash/Grep/Glob matching is intentional — false positives are
# preferred over letting a raw spec read through.
input=$(cat)
tool=$(printf '%s' "$input" | jq -r '.tool_name // empty')
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')

[ -n "$cwd" ] || exit 0

# Only guard inside an SDD project: walk up from cwd looking for .sdd/config.json.
dir="$cwd"
found=
while [ -n "$dir" ] && [ "$dir" != "/" ]; do
  if [ -f "$dir/.sdd/config.json" ]; then found=1; break; fi
  dir="$(dirname "$dir")"
done
[ -n "$found" ] || exit 0

# True (0) when $1 names/contains a spec markdown path or a glob over one.
# Boundary before `spec/` is start-of-string, slash, whitespace, or a quote
# so it matches absolute paths, relative paths, and tokens inside a command.
is_spec_md() {
  printf '%s' "$1" | grep -Eq '(^|[/[:space:]"'"'"'])spec/[^[:space:]"'"'"']*\.md' && return 0
  printf '%s' "$1" | grep -Eq '(^|[/[:space:]"'"'"'])spec/(\*\*|\*)' && return 0
  return 1
}

deny=
case "$tool" in
  Read)
    p=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty')
    is_spec_md "$p" && deny=1
    ;;
  Glob)
    pat=$(printf '%s' "$input" | jq -r '.tool_input.pattern // empty')
    base=$(printf '%s' "$input" | jq -r '.tool_input.path // empty')
    { is_spec_md "$pat" || is_spec_md "$base/$pat"; } && deny=1
    ;;
  Grep)
    gp=$(printf '%s' "$input" | jq -r '.tool_input.path // empty')
    gg=$(printf '%s' "$input" | jq -r '.tool_input.glob // empty')
    if printf '%s' "$gp" | grep -Eq '(^|/)spec($|/)' || is_spec_md "$gg"; then deny=1; fi
    ;;
  Bash)
    cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
    # read verb anywhere in the command, plus a spec/*.md reference
    if printf '%s' "$cmd" | grep -Eq '(^|[^[:alnum:]_-])(cat|bat|less|more|head|tail|nl|sed|awk|grep|egrep|fgrep|rg|ag|view|vi|vim|nano|open)([[:space:]]|$)' \
       && is_spec_md "$cmd"; then
      deny=1
    fi
    ;;
  *) exit 0 ;;
esac

[ -n "$deny" ] || exit 0

jq -n '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: "Spec files in an SDD project are read via `sdd record list` and `sdd record get <id>`, not by reading spec/*.md directly. See @sdd/sdd-cli-usage.md."
  }
}'
