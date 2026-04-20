# PoGoSundet — Design Tokens & UI Patterns

Extracted from Banani designs (April 2026).
Use this file to ensure every component matches the approved design exactly.
Do not invent colours, spacing, or patterns not listed here.

---

## Colour palette

Use these as Tailwind custom colours or CSS variables.
Map them to the closest Tailwind default where possible; use arbitrary values where needed.

| Token                | Hex       | Tailwind equivalent / usage                        |
|----------------------|-----------|----------------------------------------------------|
| `primary`            | `#2BBFAA` | Main brand teal — buttons, links, icons, active nav|
| `primary-light`      | `#E8F7F5` | Light teal — card backgrounds, badge fills         |
| `text-primary`       | `#111827` | `gray-900` — headings, labels, body text           |
| `text-secondary`     | `#6B7280` | `gray-500` — subtitles, real names, helper text    |
| `text-muted`         | `#9CA3AF` | `gray-400` — placeholders, disabled states         |
| `bg-page`            | `#F9FAFB` | `gray-50` — page background                       |
| `bg-card`            | `#FFFFFF` | White — cards, modals, input surfaces              |
| `bg-input`           | `#F3F4F6` | `gray-100` — input field backgrounds              |
| `border`             | `#E5E7EB` | `gray-200` — card borders, dividers               |
| `destructive`        | `#EF4444` | `red-500` — delete button only                    |

---

## Typography

Font: system sans-serif (no custom font observed — use `font-sans`).

| Role                  | Size  | Weight      | Tailwind                          |
|-----------------------|-------|-------------|-----------------------------------|
| App name / hero title | 28px  | Bold        | `text-2xl font-bold`              |
| Section heading       | 22px  | Bold        | `text-xl font-bold`               |
| Card heading          | 18px  | Bold        | `text-lg font-bold`               |
| Form label            | 14px  | Semibold    | `text-sm font-semibold`           |
| Body text             | 14px  | Regular     | `text-sm`                         |
| Helper / caption      | 12px  | Regular     | `text-xs text-[#6B7280]`          |
| Link text             | 14px  | Regular     | `text-sm text-[#2BBFAA]`          |

---

## Buttons

### Primary button (main CTA)
```tsx
<button className="w-full bg-[#2BBFAA] text-white font-semibold py-3 px-4 rounded-xl">
  Log In
</button>
```
- Full width on mobile
- Teal background, white text
- `rounded-xl`, `py-3`
- Used for: Log In, Save profile and continue, Save changes

### Destructive button (delete only)
```tsx
<button className="w-full bg-red-500 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2">
  <TrashIcon /> Delete profile permanently
</button>
```
- Same shape as primary, red background
- Always includes a trash icon
- Used ONLY for permanent account deletion

### Ghost / text button (secondary action)
```tsx
<button className="w-full text-[#2BBFAA] font-semibold py-3 px-4 rounded-xl">
  Back
</button>
```
- No background, teal text
- Used for: Back, Cancel

### Google OAuth button
```tsx
<button className="w-full bg-white border border-[#E5E7EB] font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-3">
  <GoogleIcon /> Continue with Google
</button>
```
- White background, gray border
- Google logo on left, centred text
- Same height as primary button

---

## Form inputs

```tsx
<div className="flex flex-col gap-1">
  <label className="text-sm font-semibold text-[#111827]">Username</label>
  <div className="flex items-center gap-2 bg-[#F3F4F6] rounded-xl px-3 py-3">
    <UserIcon className="text-[#9CA3AF] w-4 h-4" />
    <input
      className="bg-transparent flex-1 text-sm placeholder:text-[#9CA3AF] outline-none"
      placeholder="TrainerName123"
    />
  </div>
</div>
```
- Label always above the field
- Gray background (`#F3F4F6`), `rounded-xl`
- Optional left icon in muted color
- No visible border on inputs (background differentiates from page)
- Textarea (bio) follows same pattern, no icon, taller

### Optional field label
```tsx
<div className="flex items-center justify-between">
  <label className="text-sm font-semibold text-[#111827]">First name</label>
  <span className="text-xs bg-[#E8F7F5] text-[#2BBFAA] px-2 py-0.5 rounded-full">Optional</span>
</div>
```

---

## Badges and pills

### Level badge (player cards)
```tsx
<span className="bg-[#2BBFAA] text-white text-xs font-semibold px-2 py-0.5 rounded-full">
  Lvl 44
</span>
```

### Step indicator
```tsx
<span className="bg-[#E8F7F5] text-[#2BBFAA] text-xs font-semibold px-3 py-1 rounded-full">
  Step 2 of 3
</span>
```

### Page breadcrumb badge
```tsx
<span className="bg-[#E8F7F5] text-[#2BBFAA] text-xs font-semibold px-3 py-1 rounded-full">
  Profile settings
</span>
```

---

## Cards

### Page / section card
```tsx
<div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E5E7EB]">
  {/* content */}
</div>
```

### Profile photo card (teal tint)
```tsx
<div className="bg-[#E8F7F5] rounded-2xl p-4 flex items-center gap-4">
  <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
    <CameraIcon className="text-[#9CA3AF]" />
  </div>
  <div>
    <p className="text-sm font-semibold">Profile picture is optional</p>
    <p className="text-xs text-[#6B7280]">You can continue without a photo…</p>
    <button className="mt-2 text-sm text-[#2BBFAA] border border-[#2BBFAA] px-3 py-1 rounded-lg">
      Add photo later
    </button>
  </div>
</div>
```

### Player card (directory)
```tsx
<div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E5E7EB]">
  <div className="flex items-center gap-3 mb-2">
    <img className="w-12 h-12 rounded-full object-cover" src={avatar} alt="" />
    <div>
      <div className="flex items-center gap-2">
        <span className="font-bold text-[#111827]">{trainerName}</span>
        <LevelBadge level={level} />
      </div>
      <span className="text-xs text-[#6B7280]">{firstName} ({pronouns})</span>
    </div>
  </div>
  <p className="text-sm text-[#111827] mb-3">{bio}</p>
  <div className="flex items-center justify-between bg-[#F3F4F6] rounded-xl px-4 py-2">
    <span className="text-sm text-[#9CA3AF] font-mono">{friendCode}</span>
    <button className="bg-[#2BBFAA] text-white text-sm font-semibold px-3 py-1 rounded-lg flex items-center gap-1">
      <CopyIcon className="w-4 h-4" /> Copy
    </button>
  </div>
</div>
```

---

## GDPR consent checkboxes

Each consent item is a card-style row with a teal checkbox and description text.

```tsx
<div className="flex items-start gap-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-3">
  <input
    type="checkbox"
    className="mt-0.5 accent-[#2BBFAA] w-4 h-4 flex-shrink-0"
    required
  />
  <div>
    <p className="text-sm font-semibold text-[#111827]">I agree to the Privacy Policy</p>
    <p className="text-xs text-[#6B7280]">
      Read how PoGoSundet handles personal data…{' '}
      <a href="/privacy" className="text-[#2BBFAA]">View policy</a>
    </p>
  </div>
</div>
```
- Three checkboxes required at registration (see Slice 1 / GDPR requirements)
- All must be unticked by default — never pre-ticked
- Teal `accent-[#2BBFAA]` for the checkbox colour

---

## App header (authenticated screens)

```tsx
<header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-[#E5E7EB]">
  <button><MenuIcon className="text-[#111827]" /></button>
  <div className="w-9 h-9 bg-[#2BBFAA] rounded-xl flex items-center justify-center">
    <AppIcon className="text-white w-5 h-5" />
  </div>
  <div>
    <p className="text-sm font-bold text-[#111827]">PoGoSundet</p>
    <p className="text-xs text-[#6B7280]">Manage your trainer profile</p>
  </div>
</header>
```

---

## Bottom navigation

4 tabs: Players, Raids, Chat, Profile

```tsx
<nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] flex">
  {tabs.map(tab => (
    <button
      key={tab.name}
      className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium
        ${isActive ? 'text-[#2BBFAA]' : 'text-[#9CA3AF]'}`}
    >
      <tab.Icon className="w-5 h-5" />
      {tab.label}
    </button>
  ))}
</nav>
```
- Active tab: teal icon + teal label
- Inactive: muted gray icon + gray label
- No background change on active — colour only

---

## Login / auth screen layout

- Full-screen hero image at top (~40% of viewport height) — Pokémon GO map style
- App icon overlapping hero bottom edge, centred
- App name below icon, bold large
- Subtitle in secondary text colour
- Form below with white/light background
- "OR" divider between password login and Google OAuth
- Footer link at bottom: "New trainer? **Create an account**"

---

## Spacing conventions

- Page horizontal padding: `px-4` (16px)
- Card inner padding: `p-4` (16px)
- Gap between form fields: `gap-4`
- Gap between sections: `gap-6` or `mt-6`
- Button height: `py-3` (~48px total — meets 44px tap target minimum)

---

## What is NOT in the design (do not add)

- Dark mode — not designed, do not implement
- Animations or transitions beyond defaults
- Custom illustrations or icons beyond what Banani shows
- Desktop-specific layouts — mobile-first only in Phase 1
