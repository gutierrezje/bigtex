## Issue tracker

This repo tracks work in **GitHub Issues** for `gutierrezje/bigtex`.

### Creating issues

- Use the GitHub UI, or the `gh` CLI.
- The canonical issue body should include: **summary**, **acceptance criteria**, and a **test plan** when applicable.

Example with `gh`:

```bash
gh issue create \
  --title "Short, specific title" \
  --body "## Summary\n...\n\n## Acceptance criteria\n- [ ] ...\n\n## Test plan\n- [ ] ..."
```

### Linking PRs

- Reference issues in PR descriptions (e.g. “Fixes #123”) so GitHub auto-closes on merge.

