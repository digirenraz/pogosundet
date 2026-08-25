'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// ModerationMenuEntry — the "Moderation" row in the AppMenu dropdown, plus its
// pending-report badge. Renders nothing at all for non-moderators.
//
// The admin check runs ONLY when the dropdown is actually open (`enabled`), not
// on every page load: /admin is a screen for one or two people, and the other
// 99% of sessions should not pay a query for a menu row they'll never see.
//
// The count query is authorised by the "Admins can read reports" RLS policy —
// a non-admin who forced this component to render would get an empty result,
// not someone else's moderation queue.
// ---------------------------------------------------------------------------

interface ModerationMenuEntryProps {
  /** True while the AppMenu dropdown is open. */
  enabled: boolean;
  onNavigate(): void;
}

export function ModerationMenuEntry({
  enabled,
  onNavigate,
}: ModerationMenuEntryProps) {
  const t = useTranslations('Moderation');
  const [isAdmin, setIsAdmin] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      try {
        const supabase = createClient();

        // is_admin() over a column select: migration 024 revokes SELECT on
        // profiles.is_admin, and the RPC takes no argument, so it can only
        // report on the caller.
        const { data: admin } = await supabase.rpc('is_admin');
        if (cancelled || admin !== true) return;
        setIsAdmin(true);

        const { count } = await supabase
          .from('message_reports')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending');
        if (!cancelled) setPending(count ?? 0);
      } catch {
        // No Supabase client available (missing env in tests, offline, etc.).
        // The menu row simply stays hidden — a moderation shortcut is never
        // important enough to break the whole app menu for.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!isAdmin) return null;

  return (
    <Link
      href="/admin"
      onClick={onNavigate}
      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[14px] font-semibold text-card-foreground text-left"
    >
      <ShieldAlert size={18} className="text-muted-foreground" />
      <span className="flex-1">{t('menuItem')}</span>
      {pending > 0 && (
        <span className="min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center">
          {pending}
        </span>
      )}
    </Link>
  );
}
