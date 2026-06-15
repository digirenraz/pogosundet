// Pure helpers for the raid participants list.

interface AttendeeLike {
  profiles: { trainer_name: string | null } | null;
}

// Build the clipboard text for the "Kopiér spillernavne" button — one trainer
// name per line, in attendee order, skipping rows with no resolved name. The
// host pastes this into Pokémon GO to invite everyone to the raid lobby.
export function buildPlayerNamesText(attendees: AttendeeLike[]): string {
  return attendees
    .map((a) => a.profiles?.trainer_name?.trim() ?? '')
    .filter((name) => name.length > 0)
    .join('\n');
}
