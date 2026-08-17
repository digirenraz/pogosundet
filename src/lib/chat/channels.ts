// Slice 11: hard-coded channel enum. Adding a channel requires editing this list
// AND extending the CHECK constraints on channel_messages.channel and
// channel_reads.channel (008/009, most recently widened in migration 023) AND
// the hard-coded channel literals in use-channel-unread.ts and
// use-channel-list-typing.ts.
// Descriptions live here (not i18n) — the channel slugs are the language already.

export type ChannelId = 'generelt' | 'feedback' | 'events';

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
  // Bot-only in practice: the event poller posts here (src/lib/pogo-feed/).
  // Members can still write — it is an ordinary channel, just not one anybody
  // needs to. The attribution in the description is required by ScrapedDuck's
  // terms of use, so don't remove it.
  {
    id: 'events',
    name: 'events',
    description: 'Nye raids og bosser, automatisk. Data fra LeekDuck.com via ScrapedDuck.',
  },
] as const;

export function getChannelById(id: string): Channel | null {
  return CHANNELS.find((c) => c.id === id) ?? null;
}
