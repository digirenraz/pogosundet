import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 renamed middleware.ts → proxy.ts
const intlMiddleware = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  // 1. Refresh the Supabase auth session and enforce the profile-existence guard.
  //    May return a 3xx redirect to /profile/setup — if so, short-circuit and
  //    skip the intl middleware so we don't double-process.
  const supabaseResponse = await updateSession(request);
  if (supabaseResponse.status >= 300 && supabaseResponse.status < 400) {
    return supabaseResponse;
  }

  // 2. Run next-intl middleware (locale detection + redirect)
  const intlResponse = intlMiddleware(request);

  // 3. Copy any updated Supabase auth cookies onto the intl response
  //    so they aren't lost when intl returns a new response object.
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value, cookie);
  });

  return intlResponse;
}

export const config = {
  // Run on all paths except: Next.js internals, static files, and our auth handlers
  matcher: ["/((?!_next|api|auth|.*\\..*).*)"],
  // Run middleware in Dublin — same AWS region as Supabase EU.
  // Critical: middleware calls supabase.auth.getUser() on every request;
  // running it in iad1 (default) adds ~80ms US↔EU latency to every navigation.
  regions: ["dub1"],
};
