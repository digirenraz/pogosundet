# Plan: Automated PR code review via the Claude Code GitHub Action

Status: implemented (`chore/automated-pr-review`). Decided 2026-06-16; built 2026-06-20.

## Goal
A *fresh* Claude (no shared context with the Claude that wrote the code) reviews
every pull request and posts inline comments **before merge** — a genuine
second-opinion reviewer. Complements, doesn't replace:
- **CI** (`ci.yml`) — lint + Vitest + Playwright, i.e. tests, not review.
- **`/code-review` + `/pr-review`** — only run when invoked in-session.

## Approach
`anthropics/claude-code-action@v1` on `pull_request`, in a new
`.github/workflows/claude-review.yml`. Chose the GitHub Action over the
considered alternatives (Vercel Agent dashboard toggle; GitHub Copilot review)
because it can be **primed with our own CLAUDE.md invariants**, so it flags
project-specific rules, not just generic bugs.

### Workflow decisions
- **Triggers:** `opened, synchronize, ready_for_review`. Draft PRs are skipped
  (`if: draft == false`) and get their first review when marked ready — avoids
  spending a review on WIP.
- **Concurrency:** `cancel-in-progress` keyed on the PR number, so a rapid push
  sequence costs one review, not one per push.
- **Model:** default (no `--model` in `claude_args`) — matches the canonical
  example and keeps per-review cost low (the PM noted diffs are small). Bump to
  Opus later via `claude_args: --model …` if review depth proves insufficient.
- **Permissions:** `contents: read`, `pull-requests: write`, `id-token: write`.
- **Output:** inline comments via `mcp__github_inline_comment__create_inline_comment`
  + a short top-level `gh pr comment` summary. `--allowedTools` is scoped to
  exactly those tools plus read-only `gh pr diff/view`.
- **Prompt:** instructs the reviewer to read CLAUDE.md, then enumerates the
  invariants worth flagging (`preferredRegion = "dub1"`, next-intl strings, the
  three Supabase clients, GDPR/Privacy on new personal-data fields,
  apply-migration-before-merge, SW cache-version bump, the `WEBHOOK_SECRET`
  Edge-Function gate, changelog entries).

### Not a required check
The workflow is informational — it is **not** added as a required status check,
so a missing/failed review never blocks a merge. (Pre-launch the flow is
squash-to-main; a hard gate would be friction.)

## Remaining ops (PM)
Add an **`ANTHROPIC_API_KEY`** repo secret (Settings → Secrets and variables →
Actions). Billed per review (small for our diff sizes). Until it's set the job
fails fast on the auth step and posts nothing — merges are unaffected. Tracked
in `docs/launch-checklist.md`.

## Verification
- YAML structure sanity-checked locally (top-level keys, action ref, secret ref).
- End-to-end can only be confirmed once the secret exists: open a test PR and
  confirm the review comments appear. No unit/e2e coverage (it's a CI workflow,
  outside the app's test scope) — same class as `ci.yml` itself.
