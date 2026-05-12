'use client';

import type { Profile } from '@/lib/profile/helpers';
import { usePresence } from '@/lib/profile/use-presence';
import { PlayerDetailDeck } from './PlayerDetailDeck';

interface Props {
  profiles: Profile[];
  startIndex: number;
  currentUserId: string;
}

// Thin client wrapper so the page (server component) can stay server-side.
// usePresence requires a client component; the deck itself is also a client
// component but accepting a Set keeps it isolated from Supabase realtime.
export function PlayerDetailDeckWithPresence({ profiles, startIndex, currentUserId }: Props) {
  const onlineUserIds = usePresence(currentUserId);
  return (
    <PlayerDetailDeck
      profiles={profiles}
      startIndex={startIndex}
      onlineUserIds={onlineUserIds}
    />
  );
}
