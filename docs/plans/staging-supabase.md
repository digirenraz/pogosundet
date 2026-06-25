# Staging / preview Supabase project (professionalisation report #2)

**Status:** not started · **Priority:** P0 (the single largest pre-launch risk) · **Cost:** free (Supabase free tier allows 2 projects)

## Why

Today **preview and production share one Supabase database**. Profiles, raids, and chat created on a Vercel *preview* deploy land in the *production* DB, so we can't safely test any data-writing flow, we're forced to apply migrations to the live DB before every merge, and logged-in e2e tests can't run in CI (they'd write into prod).

A free second Supabase project as a dedicated preview/staging DB dissolves **three** problems at once. It unblocks:
- **#6** migration-safety (apply + verify on preview before prod)
- **#9** logged-in e2e in CI (a test user that isn't a prod user)
- **#18** the friend-code column-RLS refactor (a safe place to test a schema change)

## Who does what

Most of this is **PM ops** in the Supabase + Vercel dashboards (account-owner actions Claude can't perform). Claude has already prepared the parts it can:
- ✅ `docs/staging-bootstrap.sql` — all 21 migrations concatenated in order, **one paste** into the new project's SQL editor.
- ✅ The storage-bucket + RLS SQL and the env-var list below.

---

## Runbook

### Step 1 — Create the project (PM, ~5 min)
Supabase dashboard → **New project**:
- Name: `pogosundet-preview`
- **Region: EU (Ireland) `eu-west-1`** — must match prod for GDPR.
- Save the new project's **Project URL**, **anon key**, and **service_role key** (Settings → API). You'll need all three in Step 5.

### Step 2 — Create the schema (PM, ~2 min)
Open the new project's **SQL editor** → paste the entire contents of **`docs/staging-bootstrap.sql`** → Run. That applies migrations `001`–`021` in order (tables, RLS, indexes, realtime publication). One paste, no per-file work.

> Sanity check: Table editor should now show ~16 tables (`profiles`, `raids`, `raid_attendees`, … `friend_scan_status`, `gyms`).

### Step 3 — Storage bucket + RLS (PM, ~3 min)
The `raid-images` bucket is **not** in the migrations (buckets are created outside SQL migrations). Create it, then add its two policies:

1. Dashboard → **Storage** → **New bucket** → name `raid-images` → **Public bucket: ON** → Create.
2. SQL editor → run:

```sql
-- raid-images: authenticated users can upload
create policy "raid-images insert (authenticated)"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'raid-images');

-- raid-images: anyone can read (public screenshots)
create policy "raid-images select (public)"
  on storage.objects for select to public
  using (bucket_id = 'raid-images');
```

### Step 4 — Seed gyms (optional, recommended, ~1 min)
So the raid-form autocomplete has real data on preview: SQL editor → paste `supabase/seeds/001_gyms_frederikssund_collect_dk.sql` → Run (152 gyms, idempotent `on conflict do nothing`).

### Step 5 — Point Vercel **Preview** at the new project (PM, ~5 min)
Vercel → Project → Settings → **Environment Variables**. For each of these three, add a value **scoped to the `Preview` environment only** (leave the existing `Production` values pointing at the prod project):

| Variable | Preview value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | preview project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | preview anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | preview service_role key |

Vercel supports per-environment values natively — Production stays untouched. Redeploy a preview to pick them up.

### Step 6 — Auth on the preview project (PM, ~5 min)
- **Email/password** works out of the box — enough for the e2e test user (#9) and most manual testing.
- **Google OAuth** is optional on preview and needs its own setup (a Google OAuth client + the preview deploy's `/auth/callback` URL in both Google's allowlist and Supabase → Auth → URL config). Skip unless you specifically need to test the Google flow on preview.
- Add the preview deploy domain(s) to the preview project's **Auth → URL Configuration → Redirect URLs** so email confirmation / OAuth redirects resolve.

### Step 7 — Verify (PM, ~5 min)
1. Open a **preview deploy** (any branch PR). Register a throwaway account / create a raid.
2. Confirm that data appears in the **preview** project's Table editor — and **does NOT** appear in the **prod** project. That proves the split.
3. Confirm prod (the live site) is unaffected.

### Step 8 — (Optional, enables #9) Point CI at preview
Repo → Settings → Secrets → update `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the **preview** project so CI's build + e2e no longer touch prod. Then add a preview-project test user and `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` secrets — the 17 env-gated specs will run in CI (that's report **#9**).

---

## The new apply-before-merge workflow (after this lands)
Instead of "apply the migration to the live prod DB before merge," it becomes:
1. Apply the migration to **preview** → verify on the preview deploy.
2. Apply to **prod** at merge time.

A real staging gate instead of editing the live DB. (Report #6 adds a CI guard on top of this.)

## Caveats to keep
- **Edge Functions + push webhooks stay wired to the prod project.** Push delivery still needs a prod spot-check; preview won't send pushes. (Splitting those is a larger, lower-value follow-up.)
- **Supabase Realtime cross-user delivery is flaky under `next dev`**, so realtime assertions stay prod-verified even after #9 — the bulk of the logged-in surface still becomes CI-covered.

## When done
- Tick report **#2** in `docs/professionalisation-report.html` (done badge + note), and update its scorecard "Environment separation" row.
- Update the two **Open questions** entries in `CLAUDE.md` (the no-staging one, and the auth-gated-e2e-in-CI one once #9 follows).
- Add a decisions-log entry.

## Regenerating `docs/staging-bootstrap.sql`
If migrations change, rebuild it. The `perl` step wraps every
`alter publication … add table …` in a `duplicate_object` guard — required
because `raid_messages` is added by **both** 003 and 005, which would abort
the one-paste run without it:
```bash
{ echo "-- (header)"; for f in supabase/migrations/*.sql; do
    printf '\n-- =====\n-- %s\n-- =====\n' "$(basename "$f")"
    perl -pe 's/^\s*(alter\s+publication\s+\S+\s+add\s+table\s+[^;]+;)\s*$/do \$\$ begin $1 exception when duplicate_object then null; end \$\$;\n/i' "$f"
    echo; done
} > docs/staging-bootstrap.sql
```
