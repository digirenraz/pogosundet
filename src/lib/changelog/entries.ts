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
    date: '2026-06-23',
    text: 'Når du tilføjer venner via QR-scanning på computeren, husker appen nu hvem du allerede har markeret som tilføjet — også efter du genindlæser eller kommer tilbage senere. Spillere du har tilføjet, får et lille "Allerede tilføjet"-mærke. Det er kun synligt for dig.',
  },
  {
    date: '2026-06-22',
    text: 'Ny "Kom i gang"-guide! Find den i menuen (☰) eller i sidepanelet på computer. Den viser trin for trin, hvordan du installerer appen på din telefon, og hvordan du tilføjer venner lynhurtigt med QR-koder direkte fra Pokémon GO.',
  },
  {
    date: '2026-06-18',
    text: 'Ny hjælpeside! Tryk på menuen (☰) og vælg "Hjælp" for at se en oversigt over alle appens funktioner — fra raids og chat til notifikationer og profilindstillinger.',
  },
  {
    date: '2026-06-15',
    text: 'Toppen af appen viser nu app-ikonet og navnet "PoGoSundet" med skærmens titel i stor skrift nedenunder, så det tydeligt fremgår, hvilken app du er i.',
  },
  {
    date: '2026-06-15',
    text: 'Rettet: Hvis du geninstallerede appen på din hjemmeskærm, blev du ikke spurgt om at tillade notifikationer igen, så de holdt op med at virke. Nu dukker spørgsmålet op igen, så du kan slå dem til på ny.',
  },
  {
    date: '2026-06-15',
    text: 'Når du har oprettet et raid, er der nu et tydeligt "Afslut"-kort til at markere raidet som gennemført — det lukker for nye tilmeldinger, men folk kan stadig reagere. Du kan også kopiere alle deltageres spillernavne på én gang og inviter dem i Pokémon GO, og en lille boble nudger dig ned til chatten, hvis der kommer nye beskeder, mens du er scrollet op.',
  },
  {
    date: '2026-06-15',
    text: 'Nyt app-ikon og ny indlæsningsskærm: broen over Sundet som et lille medaljon-mærke i stedet for den gamle Poké Ball. Har du appen på hjemmeskærmen, opdateres ikonet næste gang du åbner den.',
  },
  {
    date: '2026-06-12',
    text: 'Du kan nu skjule din vennekode under "Rediger profil", hvis du ikke leder efter nye venner lige nu. Andre ser så "Ønsker ikke nye venner lige nu" i stedet for din kode.',
  },
  {
    date: '2026-06-11',
    text: 'Raid-formularen foreslår nu gyms i nærheden (hvis du deler din placering) og dine senest brugte gyms, før du overhovedet begynder at skrive.',
  },
  {
    date: '2026-06-11',
    text: '"Vis på kort"-knappen på et raid åbner nu gym\'ens præcise placering — før søgte den kun efter navnet.',
  },
  {
    date: '2026-06-11',
    text: 'Gym-forslagene i raid-formularen kender nu over 150 gyms i hele Frederikssund kommune — fra Jægerspris til Slangerup. Tak til collect.dk for data!',
  },
  {
    date: '2026-06-10',
    text: 'Fejlrapport-formularen fortæller nu tydeligt, hvis titlen eller beskrivelsen er for kort til at kunne sendes.',
  },
  {
    date: '2026-06-10',
    text: 'Rettet: Send-knappen i fejlrapport-formularen var skjult bag bundmenuen på mobil.',
  },
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
