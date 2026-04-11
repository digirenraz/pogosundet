import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Creates a Supabase client for Server Components, Route Handlers, and Server Actions.
// Uses Next.js cookies() to read/write the auth session cookie.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is a no-op in Server Components (read-only context).
            // The session is kept alive via middleware.ts → updateSession.
          }
        },
      },
    }
  );
}
