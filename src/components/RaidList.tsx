'use client';

import { useState } from 'react';
import { joinRaid, leaveRaid, updateAttendeeExtra } from '@/lib/raids/helpers';
import { RaidCard } from '@/components/RaidCard';
import type { RaidWithAttendees } from '@/lib/raids/server-helpers';

interface RaidListProps {
  active: RaidWithAttendees[];
  expired: RaidWithAttendees[];
  currentUserId: string;
}

export function RaidList({ active: initialActive, expired, currentUserId }: RaidListProps) {
  // Only active raids are in local state — expired are static display only.
  const [raids, setRaids] = useState(initialActive);

  // Optimistically add the current user to a raid's attendee list.
  async function handleJoin(raidId: string) {
    setRaids(prev =>
      prev.map(r =>
        r.id !== raidId
          ? r
          : {
              ...r,
              raid_attendees: [
                ...r.raid_attendees,
                { user_id: currentUserId, extra_count: 0, profiles: null },
              ],
            }
      )
    );
    await joinRaid(raidId, currentUserId);
  }

  // Optimistically remove the current user from a raid's attendee list.
  async function handleLeave(raidId: string) {
    setRaids(prev =>
      prev.map(r =>
        r.id !== raidId
          ? r
          : {
              ...r,
              raid_attendees: r.raid_attendees.filter(a => a.user_id !== currentUserId),
            }
      )
    );
    await leaveRaid(raidId, currentUserId);
  }

  // Optimistically update the extra_count for the current user on a raid.
  async function handleUpdateExtra(raidId: string, extra: number) {
    setRaids(prev =>
      prev.map(r =>
        r.id !== raidId
          ? r
          : {
              ...r,
              raid_attendees: r.raid_attendees.map(a =>
                a.user_id === currentUserId ? { ...a, extra_count: extra } : a
              ),
            }
      )
    );
    await updateAttendeeExtra(raidId, currentUserId, extra);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Active raids */}
      {raids.map(raid => (
        <RaidCard
          key={raid.id}
          raid={raid}
          currentUserId={currentUserId}
          onJoin={handleJoin}
          onLeave={handleLeave}
          onUpdateExtra={handleUpdateExtra}
        />
      ))}

      {/* Expired raids section */}
      {expired.length > 0 && (
        <>
          <p className="text-[13px] font-semibold text-muted-foreground mt-4 mb-2">
            Sluttede raids
          </p>
          {expired.map(raid => (
            <RaidCard
              key={raid.id}
              raid={raid}
              currentUserId={currentUserId}
              onJoin={() => {}}
              onLeave={() => {}}
              onUpdateExtra={() => {}}
              expired
            />
          ))}
        </>
      )}
    </div>
  );
}
