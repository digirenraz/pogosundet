// User-facing changelog ("Nyheder") — Danish-only content, like the raid boss
// list. NOT in messages/da.json: the messages payload ships on every page,
// while this module is lazy-loaded via dynamic import() the first time the
// changelog sheet opens, so it never affects initial page load.
//
// PROCESS RULE: every merge to main with user-facing changes must PREPEND an
// entry here (newest first) — 1–2 Danish sentences, plain language, no jargon,
// no PR/issue numbers in the text.

export interface ChangelogEntry {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** 1–2 Danish sentences describing the change for end users. */
  text: string;
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    date: '2026-06-10',
    text: 'Du kan nu rapportere fejl direkte fra appen: Tryk på menuen øverst til venstre og vælg "Rapportér en fejl".',
  },
  {
    date: '2026-06-10',
    text: 'Appen har fået denne nyhedslog! Tryk på menuen øverst til venstre og vælg "Nyheder" for at se, hvad der er nyt.',
  },
  {
    date: '2026-06-10',
    text: 'Gym-navne foreslås nu automatisk, når du opretter et raid. Forslagene kommer fra vores fælles gym-liste, som vokser, hver gang nogen poster et raid med et nyt gym.',
  },
  {
    date: '2026-06-10',
    text: 'Appen føles hurtigere: Skift mellem faner giver nu øjeblikkelig feedback, og flere skærme viser en skitse, mens indholdet hentes.',
  },
  {
    date: '2026-06-09',
    text: 'Raid-oversigten viser nu altid friske oplysninger, når du går tilbage fra et raid — fx gennemførte raids og ulæste beskeder.',
  },
  {
    date: '2026-06-09',
    text: 'Tilbage-pilen på et raid virker nu også, når du har åbnet raidet fra en notifikation.',
  },
  {
    date: '2026-06-09',
    text: 'Du får nu en notifikation, når en ny spiller melder sig til et raid, du deltager i.',
  },
  {
    date: '2026-06-09',
    text: 'Raid-chatten har fået notifikationer og ulæst-tællere — du kan se nye beskeder på Raids-fanen og på hvert raid-kort.',
  },
  {
    date: '2026-06-08',
    text: 'Rettet: Notifikationer om nye beskeder kunne udeblive på Android, når appen lige var lagt i baggrunden.',
  },
  {
    date: '2026-06-08',
    text: 'Log ud-knappen er flyttet til Rediger profil-siden, sammen med de andre konto-handlinger.',
  },
  {
    date: '2026-06-08',
    text: 'Raids, Chat og Profil har nu et rigtigt desktop-layout med sidemenu, ligesom spilleroversigten.',
  },
  {
    date: '2026-06-08',
    text: 'Rettet: Appen kunne vise "Noget gik galt", efter en ny version var udgivet — den henter nu altid den nyeste version.',
  },
];
