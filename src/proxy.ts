import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 renamed middleware.ts → proxy.ts
const intlMiddleware = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  // 1. Refresh the Supabase auth session (keeps cookies alive on every request)
  const supabaseResponse = await updateSession(request);

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
};
