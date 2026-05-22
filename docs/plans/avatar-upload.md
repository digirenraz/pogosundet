# Avatar upload from PoGo screenshot

Design: Claude Design handoff `I0Z4RCymEPqfrYhP2EC7CA`, `profile/Profile prototype.html`.
Primary design file for the upload flow: `EditScreen.jsx` — `PoGoScreenshotUpload` component.
Started: 2026-05-22.

## User story
User taps "Vælg billede" on their profile form → bottom sheet with step-by-step instructions
→ picks a PoGo screenshot → canvas auto-crops the circular avatar from ~top-center of the
screenshot → preview → "Brug billede" → uploads to Supabase Storage → saves URL to profiles.

## Supabase Storage bucket (manual step)
Create bucket `avatars` in Supabase dashboard (Storage → New bucket → Name: `avatars`, Public: true).
Add two RLS policies:
- INSERT: `auth.uid() is not null` (authenticated users can upload)
- SELECT: `true` (public read)
File path per upload: `{userId}/avatar.png` (upsert overwrites on re-upload).

## Data model change — `validation.ts`
Add `avatar_url?: string | null` to `ProfileInput`. No validation rule needed.
`validateProfile` ignores unknown optional fields so no test changes required.
`updateProfile` and `createProfile` already do `update(input)` / `insert(input)` so
`avatar_url` will be saved automatically once it's in the payload.

## New files

### `src/lib/profile/avatar-helpers.ts`
- `dataUrlToBlob(dataUrl: string): Blob` — pure, converts canvas output
- `uploadAvatar(userId: string, dataUrl: string): Promise<{ publicUrl: string | null; error: unknown }>`
  - Converts dataUrl to Blob
  - Uploads to `avatars` bucket at `${userId}/avatar.png` with `upsert: true`
  - Gets public URL, appends `?t=${Date.now()}` cache-buster
  - Returns `{ publicUrl, error }`

### `src/components/AvatarUploadSheet.tsx`
Port the design's `PoGoScreenshotUpload` component to TSX with Tailwind. Three stages:

**`intro`** — bottom sheet (fixed, inset-0 backdrop):
- Drag handle
- Title: `t('uploadTitle')` "Brug dit PoGo avatar"
- Body text: `t('uploadSubtitle')`
- How-to illustration (inline canvas-drawn mockup — see `PoGoScreenshotIllustration` in design)
- Numbered steps: 1. Åbn Pokémon GO → 2. Tryk på din profil-knap → 3. Tryk på "Friends → Add friend" → 4. Tag et screenshot → 5. Upload det her ↓
- "Upload screenshot" primary button → triggers hidden `<input type="file" accept="image/*">`
- "Annuller" link button

**`cropping`** — scan animation:
- "Finder dit avatar…" heading
- Show the picked image in a phone-aspect container with a green circle overlay (the scan target), positioned at `top: 29%` centered
- "Genkender Pokémon GO layout…" caption
- Auto-crop fires after 1600ms via `cropFromImage()`

**`cropFromImage(url)`** — canvas logic (matches design exactly):
```ts
const cw = img.width * 0.32;
const cx = img.width / 2 - cw / 2;
const cy = img.height * 0.18;
const canvas = document.createElement('canvas');
canvas.width = 200; canvas.height = 200;
const ctx = canvas.getContext('2d');
ctx.beginPath(); ctx.arc(100, 100, 100, 0, Math.PI * 2); ctx.clip();
ctx.drawImage(img, cx, cy, cw, cw, 0, 0, 200, 200);
```
Fallback: if canvas fails, use the raw dataUrl.

**`done`** — preview + confirm:
- "Sådan! Sådan ser du ud." heading
- Cropped avatar in gradient ring
- "Prøv igen" (secondary) → back to intro
- "Brug billede" (primary) → calls `onPick(croppedDataUrl)`; parent handles upload

Props: `{ userId: string; onCancel(): void; onPick(dataUrl: string): Promise<void> }`
`onPick` is `async` — sheet shows a loading state while uploading, then closes.

## Edited files

### `src/components/ProfileForm.tsx`
- Add `currentUserId` prop (required, needed for upload path)
- Add `avatar` state: `useState<string | null>(initialValues?.avatar_url ?? null)`
- Add `showUploadSheet` boolean state
- Add `uploadError` string state
- Replace the stubbed photo block:
  - Show `<Avatar>` component (from `@/components/Avatar`) if `avatar` set, else the camera placeholder
  - Teal background block like the design
  - Button label: `avatar ? t('photoChange') : t('photoAdd')`
- When `showUploadSheet` is true, render `<AvatarUploadSheet userId={currentUserId} onCancel={...} onPick={async (dataUrl) => { const { publicUrl, error } = await uploadAvatar(currentUserId, dataUrl); if (error) setUploadError(...); else { setAvatar(publicUrl); setShowUploadSheet(false); } }} />`
- In `handleSubmit`, include `avatar_url: avatar ?? undefined` in the `onSubmit(...)` call

### `src/app/[locale]/profile/edit/page.tsx`
- Pass `currentUserId={userId}` to `ProfileForm`
- Pass `avatar_url: profile.avatar_url` in `initialValues`

### `src/app/[locale]/profile/setup/page.tsx`
- Pass `currentUserId={userId}` to `ProfileForm`

### `messages/da.json` (ProfileForm namespace)
Add:
- `photoAdd` = "Tilføj PoGo avatar"
- `photoChange` = "Skift billede"
- `photoHasAvatar` = "Pænt billede!"
- `photoNoAvatar` = "Brug dit Pokémon GO avatar"
- `photoHasAvatarSub` = "Du kan altid udskifte det senere."
- `photoNoAvatarSub` = "Tag et screenshot af din profil og lad os klippe det ud."
- `uploadTitle` = "Brug dit PoGo avatar"
- `uploadSubtitle` = "Tag et screenshot af din profil i Pokémon GO. Vi finder selv det runde avatar-billede og bruger det her."
- `uploadStep1` = "Åbn Pokémon GO"
- `uploadStep2` = "Tryk på din profil-knap"
- `uploadStep3` = "Tryk på \"Friends → Add friend\""
- `uploadStep4` = "Tag et screenshot"
- `uploadStep5` = "Upload det her ↓"
- `uploadButton` = "Upload screenshot"
- `uploadCancel` = "Annuller"
- `uploadScanning` = "Finder dit avatar…"
- `uploadScanCaption` = "Genkender Pokémon GO layout…"
- `uploadDoneTitle` = "Sådan! Sådan ser du ud."
- `uploadRetry` = "Prøv igen"
- `uploadConfirm` = "Brug billede"
- `uploadError` = "Noget gik galt. Prøv igen."
- `uploadHowTo` = "Sådan gør du"

Also add English equivalents to `messages/en.json`.

### `src/lib/profile/validation.ts`
Add `avatar_url?: string | null` to `ProfileInput`.

## Files summary
New: `src/lib/profile/avatar-helpers.ts`, `src/components/AvatarUploadSheet.tsx`
Edited: `src/lib/profile/validation.ts`, `src/components/ProfileForm.tsx`,
        `src/app/[locale]/profile/edit/page.tsx`, `src/app/[locale]/profile/setup/page.tsx`,
        `messages/da.json`, `messages/en.json`

## Verification
`npx tsc --noEmit`, `npm run lint`, `npm run test`
Do NOT run build or e2e.

## Manual step after merge
Create `avatars` bucket in Supabase Storage dashboard + the two RLS policies above.
