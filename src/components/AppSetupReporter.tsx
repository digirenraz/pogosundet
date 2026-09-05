'use client';

// Records, once per app open, whether this member has the app installed and
// whether notifications are allowed — the two things that decide whether push
// actually reaches them. Feeds the setup overview on /admin so we can tell who
// still needs help getting set up.
//
// Renders nothing. Mounted in the [locale] layout, which persists across
// navigation, so this runs once per full load rather than once per page.
// Logged-out visitors (/, /login, /register) never report: the RPC is only
// called after a user id resolves.
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { reportAppSetup } from '@/lib/push/app-setup';
import { useMounted } from '@/lib/hooks/use-mounted';

export function AppSetupReporter() {
  const mounted = useMounted();

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    async function report() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getClaims();
        if (cancelled || !data?.claims?.sub) return;
        await reportAppSetup(supabase);
      } catch {
        // Missing env in tests, offline, storage disabled — reporting is
        // best-effort telemetry about setup state, never worth an error.
      }
    }

    void report();

    // Re-check when the app comes back to the foreground. Installing to the
    // home screen or granting notification permission both happen *outside*
    // the page (an OS prompt, the browser's install flow), so the visit that
    // follows is the first chance to notice — and reportAppSetup() no-ops
    // unless the state actually changed.
    function onVisible() {
      if (document.visibilityState === 'visible') void report();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [mounted]);

  return null;
}
