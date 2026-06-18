// In-app help articles ("Hjælp") — Danish-only content, like the changelog
// and raid boss list. NOT in messages/da.json: the messages payload ships on
// every page, while this module is lazy-loaded via dynamic import() the first
// time the help sheet opens, so it never affects initial page load.
//
// PROCESS RULE: update these entries whenever a feature changes, is added, or
// is removed — this is the user-facing documentation of the app.

export interface HelpEntry {
  /** Stable id for React key + anchor linking. */
  id: string;
  /** Short feature name shown as the section heading. */
  title: string;
  /** Plain-language Danish description of the feature. */
  body: string;
}

export const HELP_ENTRIES: HelpEntry[] = [
  {
    id: 'players',
    title: 'Spilleroversigt',
    body: 'Under "Spillere"-fanen kan du se alle lokale trænere i Frederikssund-området. Brug søgefeltet til at finde en bestemt spiller, eller filtrer efter team (Mystic, Valor, Instinct) og hvem der er online lige nu. Tryk på en spiller for at se deres vennekode og QR-kode, som du kan scanne direkte i Pokémon GO.',
  },
  {
    id: 'friend-code',
    title: 'Vennekode og QR-kode',
    body: 'Din Pokémon GO-vennekode vises på din profil og som en scanbar QR-kode. Andre kan kopiere koden eller scanne QR-koden i Pokémon GO → Venner → Tilføj ven → QR CODE. Du kan skjule din vennekode under "Rediger profil", hvis du ikke ønsker nye venner lige nu — andre ser så "Ønsker ikke nye venner lige nu" i stedet.',
  },
  {
    id: 'raids',
    title: 'Raids',
    body: 'Under "Raids"-fanen kan du se aktive raids i området. Tryk på "+" for at poste et nyt raid — vælg gym, boss, starttid og evt. et screenshot. Andre trænere kan melde sig til med "Jeg er med". Hvert raid har sin egen chat, hvor I kan koordinere. Som vært kan du markere raidet som gennemført med "Afslut"-knappen, og du kan kopiere alle deltageres spillernavne for at invitere dem i Pokémon GO.',
  },
  {
    id: 'raid-reactions',
    title: 'Raid-reaktioner',
    body: 'Når et raid er i gang eller afsluttet, kan du reagere med "TfR!" (Thanks for Raid), "Jeg fik en shiny!" eller "Jeg fik en hundo!". Du kan se hvem der har reageret under reaktions-knapperne.',
  },
  {
    id: 'chat',
    title: 'Community chat',
    body: 'Under "Chat"-fanen finder du fælles kanaler for hele community\'et: #generelt til snak og #app-feedback til forslag og fejl. Hold en besked nede for at svare, reagere med emoji eller kopiere teksten.',
  },
  {
    id: 'dm',
    title: 'Direkte beskeder',
    body: 'Du kan sende private beskeder til andre trænere. Tryk på en online-spiller i toppen af chat-siden, eller find "Direkte beskeder" længere nede. Kun du og modtageren kan se samtalen.',
  },
  {
    id: 'profile',
    title: 'Din profil',
    body: 'Under "Profil"-fanen kan du se, hvordan andre ser dig. Tryk "Rediger profil" for at ændre dit trænernavn, vennekode, team, level, bio eller profilbillede. Du kan uploade et screenshot fra Pokémon GO som profilbillede — appen finder selv dit avatar-billede.',
  },
  {
    id: 'notifications',
    title: 'Notifikationer',
    body: 'PoGoSundet kan sende dig push-notifikationer, så du aldrig misser et raid. Du får besked, når: et nyt raid postes, nogen skriver i en raid-chat du deltager i, du modtager en direkte besked, eller en ny spiller melder sig til et raid du er med i. Slå notifikationer til ved at trykke "Tillad" på raids-siden. På iPhone skal appen installeres på hjemmeskærmen via Safari først (se "Installer appen" nedenfor).',
  },
  {
    id: 'install',
    title: 'Installer appen',
    body: 'PoGoSundet er en webapp, der kan installeres på din hjemmeskærm som en rigtig app. På Android: tryk på "Installer" eller "Føj til startskærm" i Chrome-menuen. På iPhone: åbn i Safari → tryk Del (firkant-og-pil) → "Føj til hjemmeskærm". Når appen er installeret, får du push-notifikationer og et app-ikon med ulæst-badge.',
  },
  {
    id: 'gym-suggestions',
    title: 'Gym-forslag',
    body: 'Når du opretter et raid, foreslår appen automatisk gyms i nærheden (hvis du deler din placering) og dine senest brugte gyms. Begynd at skrive for at søge i over 150 kendte gyms i Frederikssund kommune. Hvis et gym ikke er på listen, kan du bare skrive navnet manuelt — det bliver husket til næste gang.',
  },
  {
    id: 'show-on-map',
    title: 'Vis på kort',
    body: 'På et raid kan du trykke "Vis på kort" for at åbne gym\'ets placering i Google Maps. Har du Google Maps installeret, åbner den direkte i appen.',
  },
  {
    id: 'unread',
    title: 'Ulæste beskeder',
    body: 'Røde badges på "Chat"- og "Raids"-fanerne viser antallet af ulæste beskeder. Chat-badget tæller både kanal- og DM-beskeder. Raids-badget tæller ulæste raid-chat-beskeder i raids du er tilmeldt. Badgene nulstilles, når du åbner den relevante samtale.',
  },
  {
    id: 'desktop',
    title: 'Desktop-visning',
    body: 'På en stor skærm (computer eller tablet i landskab) skifter appen automatisk til et desktop-layout med et sidemenu til venstre. Spilleroversigten får en "Scan-session", hvor du kan gå vennekoderne igennem én ad gangen — praktisk, hvis du sidder ved computeren med telefonen klar til at scanne.',
  },
  {
    id: 'bug-report',
    title: 'Rapportér en fejl',
    body: 'Finder du en fejl, kan du rapportere den direkte i appen: tryk på menu-ikonet (☰) øverst til venstre og vælg "Rapportér en fejl". Skriv en kort titel og en beskrivelse, så sendes rapporten privat til udviklerne.',
  },
  {
    id: 'changelog',
    title: 'Nyheder',
    body: 'Under menu-ikonet (☰) → "Nyheder" kan du læse om de seneste opdateringer og nye funktioner i appen.',
  },
  {
    id: 'privacy',
    title: 'Privatliv og data',
    body: 'Alle data opbevares i EU (Irland) i overensstemmelse med GDPR. Du kan til enhver tid slette din konto og alle data permanent under "Rediger profil" → "Slet konto permanent". Læs hele privatlivspolitikken under /privacy.',
  },
  {
    id: 'account-delete',
    title: 'Slet konto',
    body: 'Gå til "Profil" → "Rediger profil" → scroll ned til "Slet konto permanent". Al data — profil, beskeder, raid-tilmeldinger, reaktioner — slettes straks og kan ikke gendannes.',
  },
];
