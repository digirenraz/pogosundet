'use client';

import { createClient } from '@supabase/supabase-js';

// Creates a plain supabase-js client that uses localStorage (not cookies).
// Used ONLY for the Google OAuth flow: signInWithOAuth (login page) and
// exchangeCodeForSession (callback page).
//
// Why: @supabase/ssr stores the PKCE code verifier in cookies. iOS Safari's
// Bounce Tracking Prevention deletes first-party cookies during the OAuth
// redirect chain (login → Google → Supabase → app), so the verifier is gone
// by the time the callback page tries to use it.
// localStorage is NOT purged by ITP during redirects, so the verifier survives.
//
// After the exchange, the session tokens are transferred to the SSR cookie
// storage (via setSession on the createBrowserClient) so the server can
// read them normally on every subsequent request.
export function createOAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // implicit flow: tokens arrive in the URL hash — no code verifier stored
    // anywhere, so iOS Safari's ITP storage purge can't break the OAuth flow.
    { auth: { flowType: 'implicit' } }
  );
}
