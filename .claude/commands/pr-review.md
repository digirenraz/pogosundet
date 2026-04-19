# /pr-review

Review the current slice branch before opening a Pull Request to `main`.

## What to do

Work through each section below. Give a clear verdict at the end.

---

## 1. Scope check

- Does this PR contain only the work for the current slice?
- Are there any Phase 2 features or speculative additions that snuck in?
- Are there any TODOs or commented-out code that should be resolved first?

## 2. Code standards (from CLAUDE.md)

- [ ] All files in `src/` use TypeScript (no `.js` files)
- [ ] All styling uses Tailwind CSS (no unexpected CSS files)
- [ ] Components are in `src/components/`, pages in `src/app/`
- [ ] Supabase logic is in `src/lib/supabase/`
- [ ] Non-obvious functions have a short comment explaining *why*, not just *what*
- [ ] No hardcoded UI strings — all text goes through next-intl
- [ ] Translation keys exist in `/messages/da.json`

## 3. GDPR check

Run `/gdpr-check` on any new feature that touches personal data.
Paste the result here before proceeding.

## 4. Mobile-first check

- Does the UI work at 375px width (iPhone SE)?
- Are tap targets at least 44px tall?
- Is there anything that only works on desktop?

## 5. Branch and commit hygiene

- Branch name follows the convention: `slice/N-short-name`
- Commit messages are short, imperative, and in English
- No merge commits from `main` into the feature branch (rebase if needed)

---

## Output

Summarise as:
- ✅ Ready to merge — open the PR
- ⚠️ Minor issues — list them, your call whether to fix before or after merge
- ❌ Blocking issues — list them, fix before opening PR
