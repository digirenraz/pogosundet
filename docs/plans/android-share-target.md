# Android share target — share a Pokémon GO screenshot into PoGoSundet

**Goal:** On Android, let a user share a raid screenshot from Pokémon GO (or any app)
straight into PoGoSundet via the OS share sheet, landing on the new-raid form with the
image already attached. Removes the "open app → Post raid → pick from gallery" steps.

**Platform reality:** Web Share Target is Android-only. iOS Safari does not support it
(WebKit bug #194593, still open in 2026). iOS users are unaffected — they keep today's
gallery-pick flow, which already leads with the screenshot. No iOS regression.

**Requires:** the PWA to be installed to the home screen (share targets only register for
installed PWAs). Already the recommended path for push.

## Mechanism

1. **Manifest** (`public/manifest.json`) — add `share_target`:
   - `action: "/raids/share"`, `method: "POST"`, `enctype: "multipart/form-data"`
   - `params.files: [{ name: "image", accept: ["image/jpeg","image/png","image/*"] }]`
   The OS POSTs the shared image to `/raids/share`.

2. **Service worker** (`public/sw.js`, bump v12→v13):
   - New `SHARE_CACHE = 'pogosundet-share'`; add it to the `activate` cleanup allowlist
     so a pending share survives SW activation.
   - In `fetch`, **before** the GET-only guard: intercept `POST /raids/share`, pull the
     `image` file from `formData`, `cache.put` it under a fixed key, then 303-redirect to
     `/raids/new?shared=1`. Wrapped in try/catch so a parse failure still lands on the form.

3. **New-raid form** (`src/app/[locale]/raids/new/page.tsx`):
   - On mount (`useEffect`), open `SHARE_CACHE`, `match` the stashed image, rebuild a
     `File`, set `imageFile` + `imagePreview`, then `cache.delete` it (consume once).
   - Unconditional read (cheap cache miss otherwise) — no `useSearchParams`, so no Suspense
     bailout. Existing manual-upload + submit/upload-to-`raid-images` path is untouched.

Cache name + key are shared magic strings between sw.js and the page — comment both sides.

## Out of scope / accepted limitations
- No auto-detect of boss/gym from the image (just attaches the screenshot).
- If the user isn't logged in when the share lands, the form's submit redirects to /login
  and the pre-fill is lost. Rare for an installed PWA (usually logged in). Accepted for v1.
- First-load race (SW not yet active) would 404 the POST. Installed PWAs always have an
  active SW by the time they can be shared into. Accepted; no server fallback route.

## Verification
- `tsc` + `eslint` + `next build` green.
- Local: simulate the consuming half — inject a blob into `caches.open('pogosundet-share')`
  under the key, load `/raids/new`, confirm the image preview pre-fills. (Auth-gated page.)
- The share-sheet half is OS-level — verify on a **real installed Android PWA on prod**
  (same constraint as push). Add to launch checklist.

## Files
- `public/manifest.json`, `public/sw.js`, `src/app/[locale]/raids/new/page.tsx`
- Docs: `CLAUDE.md` (decisions log + SW version → v13), this plan.
