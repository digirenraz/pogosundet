"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Installed-PWA OAuth bridge.
//
// In a standalone PWA (Android home-screen install), tapping "Continue with
// Google" hands off to a Chrome Custom Tab. The /auth/callback exchange + the
// redirect to / complete *inside that tab*, then control returns to the PWA —
// which is still showing the (logged-out) login/register page it was on. The
// session cookie is shared with the PWA, but the page only checked auth at
// mount, so it never reacts and looks like a "bounce back to login".
//
// This mounts on the logged-out pages and redirects into the app the moment a
// session is available: via Supabase's auth-state change AND a re-check when the
// PWA regains focus (returning from the Custom Tab, which also covers the
// cookie-commit timing race). It's a no-op in normal browsers, where the server
// redirect on / already handles a logged-in user. Renders nothing.
export function AuthRedirectOnSignIn() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let navigated = false;

    const go = () => {
      if (navigated) return;
      navigated = true;
      router.replace("/players");
    };

    // Fires SIGNED_IN once the client picks up the session.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) go();
    });

    // Returning from the Custom Tab fires visibility/focus; re-read the session
    // in case the cookie committed just as the tab handed control back.
    const recheck = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) go();
    };
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    // Catch a session that's already present when this mounts.
    void recheck();

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, [router]);

  return null;
}
