# Decisions archive

Older decisions log entries, archived from `CLAUDE.md` to keep that file scannable. Most of these are now reflected in the codebase or in the architecture/strategy sections of `CLAUDE.md`. Kept here for historical context.

The active log lives in `CLAUDE.md` and contains roughly the last 4 weeks of decisions.

---

| Date       | Decision                                              | Reason                              |
|------------|-------------------------------------------------------|--------------------------------------|
| 2026-03-29 | Supabase EU/Ireland region selected                   | GDPR compliance                      |
| 2026-03-29 | Facebook Login deferred post-Phase 1                  | App review complexity                |
| 2026-03-29 | Location = manual text entry, no GPS                  | Simplicity for Phase 1               |
| 2026-03-29 | "Add Friends" = display Trainer Code only             | No in-app social graph in Phase 1    |
| 2026-03-29 | Profile photo storage approach not yet resolved       | Open question — decide before Slice 2|
| 2026-04-11 | Profile photos stored in Supabase Storage             | Keeps stack simple; free tier sufficient for Phase 1 |
| 2026-04-11 | Slice 1 implemented on branch slice/1-registration    | Awaiting Supabase + Google OAuth setup before testing |
| 2026-04-11 | GitHub repo created at github.com/digirenraz/pogosundet | Private repo; main + slice/1-registration pushed     |
| 2026-04-11 | Next.js 16 uses proxy.ts instead of middleware.ts     | Framework renamed middleware convention in v16        |
| 2026-04-11 | Password reset included in Slice 1                    | Keeps "Forgot password?" link in Banani design honest |
| 2026-04-11 | GDPR consent checkbox + /privacy stub in Slice 1      | Non-negotiable before any registration can go live    |
| 2026-04-11 | Mint theme applied (teal #00b09f, Inter font)         | Locked design from original Claude Design handoff     |
| 2026-04-14 | Profile fields: trainer name, friend code, first name, bio | Level/Team/Area not in original design — deferred |
| 2026-04-14 | No second GDPR consent on profile setup screen        | Consent already collected at registration (Slice 1)   |
| 2026-04-14 | TDD with Vitest introduced in Slice 2                 | Core logic tested: validation + Supabase helpers      |
| 2026-04-14 | Slice 2 implemented on branch slice/2-profile         | profiles table + RLS created in Supabase manually     |
| 2026-04-14 | Slices 3+4 merged — Player Directory is the main screen | Design combines profile display + community browser |
| 2026-04-14 | Bottom nav added: Players + Profile active, Raids/Chat placeholder | Phase 2 features; nav hints at future scope |
| 2026-04-14 | Home page is now logged-out only; logged-in → /players | Clean routing model for bottom nav active states |
| 2026-04-14 | Server-only helpers in server-helpers.ts (separate from helpers.ts) | Prevents server imports leaking into client bundles |
| 2026-04-14 | Logout accessible via dropdown on green icon in DirectoryHeader | No dedicated logout page; keeps UI clean |
| 2026-04-17 | Privacy Policy written in Danish, data controller: René Rasmussen (renraz@gmail.com) | GDPR Art. 13 requirement |
| 2026-04-17 | Account deletion via POST /api/account/delete using service role key | Client SDK cannot delete auth users; server route required |
| 2026-04-17 | Profile row deleted via ON DELETE CASCADE (already on FK) — no extra migration needed | Cascade was set up in Slice 2 migration |
| 2026-04-17 | SUPABASE_SERVICE_ROLE_KEY required in .env.local for account deletion | Must be added to Vercel env vars before deploy |
