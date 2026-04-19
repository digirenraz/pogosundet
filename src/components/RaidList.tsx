'use client';

import { useState } from 'react';
import { joinRaid, leaveRaid } from '@/lib/raids/helpers';
import { RaidCard } from '@/components/RaidCard';
import type { RaidWithAttendees } from '@/lib/raids/server-helpers';

interface RaidListProps {
  raids: RaidWithAttendees[];
  currentUserId: string;
}

export function RaidList({ raids: initialRaids, currentUserId }: RaidListProps) {
  // Optimistic local state — join/leave updates are reflected immediately.
  const [raids, setRaids] = useState(initialRaids);

  async function handleJoin(raidId: string) {
    // Optimistically add the current user to attendees
    setRaids(prev => prev.map(r =>
      r.id !== raidId ? r : {
        ...r,
        raid_attendees: [...r.raid_attendees, { user_id: currentUserId, profiles: null }],
      }
    ));
    await joinRaid(raidId, currentUserId);
  }

  async function handleLeave(raidId: string) {
    // Optimistically remove the current user from attendees
    setRaids(prev => prev.map(r =>
      r.id !== raidId ? r : {
        ...r,
        raid_attendees: r.raid_attendees.filter(a => a.user_id !== currentUserId),
      }
    ));
    await leaveRaid(raidId, currentUserId);
  }

  return (
    <div className="flex flex-col gap-4">
      {raids.map(raid => (
        <RaidCard
          key={raid.id}
          raid={raid}
          currentUserId={currentUserId}
          onJoin={handleJoin}
          onLeave={handleLeave}
        />
      ))}
    </div>
  );
}
