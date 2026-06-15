# Raid host view redesign — "Raid Afsluttet (Option B)"

Claude Design handoff (`pogosundet-raid-coordination`, Option B). Refines the raid
**detail** screen — primarily the **poster/host** experience — so that marking a
raid completed reads as a deliberate, owner-only action that ends sign-ups, while
reactions stay live. Plus a copy-player-names helper and an unread-chat nudge.

## Source of truth
- `Raid Afsluttet (Option B).html` → `option-b.jsx` + `raid-complete-shared.jsx`
- Chat intent (chat1.md): lift "Marker som gennemført" out of the reaction chips;
  give it a tick animation; once completed, RSVP locks but reactions stay live;
  add "Kopiér spillernavne"; remove the host's "Jeg er med" (host is always in);
  add an unread-chat nudge; translate the shiny/hundo reaction labels to Danish.

## Changes (all in `src/components/RaidDetail.tsx` + i18n)

1. **Owner completion card (poster-only)** — replaces the small inline
   "Marker som gennemført" button. A distinct teal-tinted card with a large
   circular animated tick, "Du er vært · Er raidet ovre?" + an **Afslut** button.
   Completed → solid teal card, "Afsluttet · HH.MM · Raid gennemført", **Fortryd**
   button, animated tick (CSS `tickPop`). Uses the existing `handleToggleCompleted`.

2. **Reactions get their own labelled "Reaktioner" group** — visually separated
   from the completion action (which moved into the owner card). Reactions stay
   tappable on completed raids (unchanged behaviour). Fix labels:
   `reactionShiny` → "Jeg fik en shiny!", `reactionHundo` → "Jeg fik en hundo!".

3. **Deltagere section** (replaces the old RSVP + attendees block):
   - Header "Deltagere · {n}" + a "Tilmelding lukket" lock pill when completed.
   - Vertical attendee rows: avatar initials, name ("Dig" for self), a **VÆRT**
     badge on the poster's row, "+N ekstra" badge. The current user's own row,
     when they are the host and not completed, gets an inline ± stepper to set
     their own extra count.
   - **Non-posters** keep the existing join/leave button + extra stepper
     (unchanged behaviour) — shown only when not completed. Posters never see it
     (auto-joined host).
   - **"Kopiér spillernavne"** button — copies every attendee trainer name (one
     per line) to the clipboard, shows "Spillernavne kopieret" for 1.8s, helper
     "Find dem i Pokémon GO og inviter til raid-lobbyen". Available to everyone,
     including on completed raids.

4. **Unread-chat nudge** — a floating "{n} nye beskeder ↓" pill above the
   composer that appears when a new realtime message arrives while the chat is
   scrolled out of view; tapping smooth-scrolls to the chat and clears it. Driven
   by a scroll container ref + a chat anchor ref + an `unseen` counter. Own sent
   messages never nudge.

## Scope decisions
- The design is the **host** view; non-poster RSVP behaviour is preserved exactly
  (join/leave + extra), just restyled into the new participants list.
- "Kopiér spillernavne" is shown to all viewers (any attendee may invite remotely),
  matching the design's placement in the participants section.
- No DB/schema change — `completed_at`, `raid_attendees`, reactions all exist.
- Animation via a scoped `<style>` block in the component (CSS keyframes), like
  `LoadingScreen`. No new deps.

## Tests / verification
- Pure helper `buildPlayerNamesText(attendees)` extracted + unit-tested.
- `tsc` / `eslint` / `build` / unit tests green.
- Browser-verify the host view (Playwright): owner card toggle + tick, reactions
  stay live, participants list + copy-names, unread nudge; add an e2e where
  feasible (auth-gated).
- Changelog entry; CLAUDE.md decisions log.
