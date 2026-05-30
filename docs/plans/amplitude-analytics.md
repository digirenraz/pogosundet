# Plan: Amplitude product analytics (opt-in consent)

**Branch:** `slice/amplitude-analytics`
**Date:** 2026-05-30

## Decisions (from PM)
- **Consent:** opt-in banner. Amplitude initializes ONLY after the user actively accepts. Choice persisted; no re-prompt.
- **Account:** PM provides an **EU-region** API key (`app.eu.amplitude.com`). Wired from `NEXT_PUBLIC_AMPLITUDE_API_KEY`; no key committed.
- **Scope:** richer engagement — `page_view`, `account_created`, `profile_completed`, `raid_created`, `raid_joined`, `dm_sent`, `channel_message_sent`, `reaction_added`, `player_search`, `profile_viewed`, `channel_opened`.

## GDPR posture
- `serverZone: 'EU'` (mandatory — EU data residency).
- No PII to Amplitude: do NOT send email/trainer name. Optional pseudonymous `user_id` = Supabase auth uid (set only after consent).
- `trackingOptions: { ipAddress: false }`; disable `defaultTracking.formInteractions` + `fileDownloads` (avoid capturing field contents). Keep pageViews/sessions minimal.
- Amplitude bundle must NOT load/run before consent === 'granted'.
- Privacy Policy: rewrite §9 (currently "no analytics cookies"), add a dedicated analytics section (what, EU, consent, how to withdraw), bump `lastUpdated`. Update CLAUDE.md GDPR section — the "No third-party analytics or tracking" line is no longer literally true; reword to "analytics via Amplitude, opt-in only".

## Architecture
- `@amplitude/analytics-browser`.
- `src/lib/analytics/consent.ts` — localStorage-backed consent state (`'granted' | 'denied' | null`), `useMounted`-safe hook, getter/setter.
- `src/lib/analytics/amplitude.ts` — lazy `initAnalytics()` (guards: key present + consent granted), `track(event, props?)` no-op until ready, typed event-name union.
- `src/components/ConsentBanner.tsx` — Danish banner (Afvis / Acceptér), shown when consent is null. Sets consent; on accept, inits Amplitude.
- `src/components/AnalyticsProvider.tsx` — mounts banner, runs init on grant, fires `page_view` on route change (`usePathname`). Mounted in `src/app/[locale]/layout.tsx`.
- Event call sites wired across raid/dm/chat/profile/player surfaces.

## Files (estimate ~15)
SDK dep; analytics lib (2); banner + provider (2); layout wire; event call sites (~6); `messages/{da,en}.json`; privacy page section keys; `.env.local.example`; tests (unit consent + e2e banner); CLAUDE.md (GDPR + decisions log + Next up).

## Verification
- Build + lint + unit + e2e green.
- Browser (Playwright MCP): banner appears first visit; **Amplitude network request only fires AFTER Acceptér**; Afvis → no Amplitude requests ever; choice persists across reload.
- Confirm EU endpoint (`api.eu.amplitude.com`) in network tab.

## Open items needing PM
1. EU-region API key.
2. Confirm pseudonymous `user_id` (Supabase uid) is acceptable, or keep fully anonymous.
