#!/usr/bin/env sh
set -eu

pnpm exec biome check --write --staged --no-errors-on-unmatched

staged=$(git diff --cached --name-only --diff-filter=ACMR)
if [ -n "$staged" ]; then
  printf '%s\n' "$staged" | while IFS= read -r file; do
    if [ -e "$file" ]; then
      git add "$file"
    fi
  done
fi

pnpm test
