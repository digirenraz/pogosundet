// Server-only: the community's notification-readiness overview shown on /admin.
//
// Answers "who can actually receive a raid notification, and who needs a
// nudge?" by combining three sources:
//   • profiles           — everyone who counts as a member (bots excluded)
//   • app_setup_status   — installed / notification permission, per member
//                          (migration 027; written by AppSetupReporter)
//   • push_subscriptions — the row the Edge Functions actually send to
//
// Read through the SERVICE ROLE client on purpose. app_setup_status and
// push_subscriptions are both owner-only under RLS, and deliberately have no
// admin SELECT policy — so no authenticated role can read another member's
// device state even with a forged request. This helper is the single place that
// crosses that line, and every caller must verify isCurrentUserAdmin() first.
// Do NOT import from client components.
import { createAdminClient } from '@/lib/supabase/admin';
import type { PushPermission, SetupPlatform } from '@/lib/push/app-setup';

export interface MemberSetupRow {
  user_id: string;
  trainer_name: string;
  /** Has ever opened the app as an installed PWA. */
  installed: boolean;
  /** Has a live push subscription the Edge Functions can send to. */
  push: boolean;
  /** Browser permission last reported from their device. */
  push_permission: PushPermission | null;
  platform: SetupPlatform | null;
  /** Last app open we recorded, or null if they haven't opened it since migration 027. */
  last_seen_at: string | null;
  /** Last time we saw them in the installed app — spots an uninstall. */
  last_standalone_at: string | null;
  /** True when they have never reported: we know nothing, not "not set up". */
  unknown: boolean;
}

export interface SetupSummary {
  members: number;
  installed: number;
  push: number;
  /** Members who reported but explicitly blocked notifications. */
  denied: number;
  /** Members who haven't opened the app since we started measuring. */
  unknown: number;
  /** Everyone missing at least one step, worst case first. */
  needsNudge: MemberSetupRow[];
  /** Everyone fully set up — installed AND subscribed. */
  ready: MemberSetupRow[];
  /**
   * True when one of the underlying queries failed. The numbers below it are
   * then built from partial data and must NOT be shown: a failed
   * push_subscriptions read, for instance, would report every member as having
   * notifications off — a plausible-looking answer that happens to be wrong,
   * which is worse than no answer on a screen whose whole job is to be
   * trustworthy about who needs help.
   */
  failed: boolean;
}

interface ProfileRow {
  user_id: string;
  trainer_name: string | null;
}

interface StatusRow {
  user_id: string;
  installed_at: string | null;
  last_standalone_at: string | null;
  last_seen_at: string | null;
  push_permission: string | null;
  platform: string | null;
}

/**
 * Orders the nudge list by how much help the person needs: never opened the app
 * since we started measuring (we can't even tell), then not installed at all
 * (the biggest blocker — on iOS it makes push impossible), then installed but
 * no notifications. Blocked permissions sort last within their group: a nudge
 * won't fix those, only a trip to system settings will.
 */
function nudgeRank(row: MemberSetupRow): number {
  if (row.unknown) return 0;
  if (!row.installed) return row.push_permission === 'denied' ? 2 : 1;
  return row.push_permission === 'denied' ? 4 : 3;
}

/** Pure summariser, split out from the queries so it can be unit-tested. */
export function summarise(rows: MemberSetupRow[], failed = false): SetupSummary {
  const needsNudge = rows
    .filter((row) => !(row.installed && row.push))
    .sort((a, b) => {
      const rank = nudgeRank(a) - nudgeRank(b);
      return rank !== 0 ? rank : a.trainer_name.localeCompare(b.trainer_name, 'da');
    });

  return {
    members: rows.length,
    installed: rows.filter((row) => row.installed).length,
    push: rows.filter((row) => row.push).length,
    denied: rows.filter((row) => row.push_permission === 'denied').length,
    unknown: rows.filter((row) => row.unknown).length,
    needsNudge,
    ready: rows
      .filter((row) => row.installed && row.push)
      .sort((a, b) => a.trainer_name.localeCompare(b.trainer_name, 'da')),
    failed,
  };
}

/**
 * Loads the overview.
 *
 * A failed query sets `failed` rather than throwing: /admin renders the
 * moderation queue from the same request, and a broken stats panel must not
 * take that down. But the counts are not shown in that state either — see the
 * note on SetupSummary.failed.
 *
 * CALLERS MUST have already verified the viewer is a moderator.
 */
export async function getSetupStatus(): Promise<SetupSummary> {
  const admin = createAdminClient();

  const [profilesResult, statusResult, pushResult] = await Promise.all([
    // is_bot excluded for the same reason getAllProfiles() excludes it: the
    // event bot is not a person who can install anything.
    admin.from('profiles').select('user_id, trainer_name').eq('is_bot', false),
    admin
      .from('app_setup_status')
      .select(
        'user_id, installed_at, last_standalone_at, last_seen_at, push_permission, platform'
      ),
    admin.from('push_subscriptions').select('user_id'),
  ]);

  const failed = Boolean(
    profilesResult.error || statusResult.error || pushResult.error
  );
  if (failed) {
    console.error('Admin setup status: query failed', {
      profiles: profilesResult.error?.message,
      status: statusResult.error?.message,
      push: pushResult.error?.message,
    });
  }

  const statusByUser = new Map<string, StatusRow>();
  for (const row of (statusResult.data ?? []) as StatusRow[]) {
    statusByUser.set(row.user_id, row);
  }
  const subscribed = new Set(
    ((pushResult.data ?? []) as { user_id: string }[]).map((row) => row.user_id)
  );

  const rows: MemberSetupRow[] = ((profilesResult.data ?? []) as ProfileRow[]).map(
    (profile) => {
      const status = statusByUser.get(profile.user_id);
      return {
        user_id: profile.user_id,
        trainer_name: profile.trainer_name ?? '—',
        installed: status?.installed_at != null,
        push: subscribed.has(profile.user_id),
        push_permission: (status?.push_permission as PushPermission) ?? null,
        platform: (status?.platform as SetupPlatform) ?? null,
        last_seen_at: status?.last_seen_at ?? null,
        last_standalone_at: status?.last_standalone_at ?? null,
        unknown: status === undefined,
      };
    }
  );

  return summarise(rows, failed);
}
