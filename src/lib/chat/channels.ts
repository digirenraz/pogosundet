// Slice 11: hard-coded channel enum. Adding a third channel requires editing
// this list AND extending the CHECK constraint in 008_channel_messages.sql.
// Descriptions live here (not i18n) — the channel slugs are the language already.

export type ChannelId = 'generelt' | 'feedback';

export interface Channel {
  id: ChannelId;
  name: string;
  description: string;
}

export const CHANNELS: readonly Channel[] = [
  {
    id: 'generelt',
    name: 'generelt',
    description: 'Snak om alt og intet — fjorden, fangst og fællesskab.',
  },
  {
    id: 'feedback',
    name: 'app-feedback',
    description: 'Bugs, idéer og ønsker til PoGoSundet.',
  },
] as const;

export function getChannelById(id: string): Channel | null {
  return CHANNELS.find((c) => c.id === id) ?? null;
}
