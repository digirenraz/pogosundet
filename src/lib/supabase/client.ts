import { createBrowserClient } from "@supabase/ssr";

// Creates a Supabase client for Client Components (browser-side).
// Reads and writes the auth session cookie automatically via the browser.
//
// flowType: 'implicit' — tokens arrive in the URL hash after OAuth, so no
// code-verifier cookie needs to survive iOS Safari's cross-site redirect
// chain. PKCE (the default) fails on iOS because Safari's Bounce Tracking
// Prevention purges first-party cookies set before the OAuth redirect.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: 'implicit' } }
  );
}
