import { createBrowserClient } from "@supabase/ssr";

// Creates a Supabase client for Client Components (browser-side).
// Reads and writes the auth session cookie automatically via the browser.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
