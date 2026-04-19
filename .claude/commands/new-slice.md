# /new-slice

Start a new vertical slice for PoGoSundet.

## What to do

1. Ask me: "Which slice are we starting?" and wait for my answer before proceeding.
2. Confirm the slice name and number match the ordered list in CLAUDE.md. If I try to skip a slice, flag it and ask for confirmation.
3. Create a new git branch using the convention: `slice/N-short-name`
   - Example: `slice/1-registration`, `slice/2-profile`
4. Remind me of the slice's scope based on CLAUDE.md — what is in, and what is explicitly out.
5. Check the Open Questions section of CLAUDE.md. If any open question is relevant to this slice, raise it now before writing any code.
6. Read `.claude/skills/design-tokens.md` before writing any UI component. All colours, typography, spacing, and component patterns must follow that file exactly. Do not invent styles.
7. Scaffold the minimum folder/file structure needed for this slice — no more.
8. Confirm with me before writing any implementation code.

## Rules

- Never start a slice if the previous one has not been merged to `main` via PR.
- Never pre-build Phase 2 features, even if they seem related.
- If this slice touches personal data, run the GDPR checklist (see `/gdpr-check`).
