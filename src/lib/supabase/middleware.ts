import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

// Paths (locale-stripped) that must NOT be redirected to /profile/setup, either
// because they don't require a profile (login, public, root, privacy) or because
// they ARE the setup page itself.
const PROFILE_GUARD_SKIPLIST = new Set<string>([
  "/",
  "/login",
  "/register",
  "/privacy",
  "/profile/setup",
  "/reset",
  "/reset/confirm",
  "/onboarding/ios",
]);

// Strip a leading `/<locale>` segment if present, so the skiplist check works
// regardless of whether next-intl prefixed the URL.
function stripLocale(pathname: string): string {
  const segments = pathname.split("/");
  if (segments.length > 1 && routing.locales.includes(segments[1] as (typeof routing.locales)[number])) {
    const rest = "/" + segments.slice(2).join("/");
    return rest === "/" ? "/" : rest.replace(/\/$/, "");
  }
  return pathname === "/" ? "/" : pathname.replace(/\/$/, "");
}

// Refreshes the Supabase auth session on every request so cookies stay valid,
// then enforces the profile-existence guard centrally so individual pages no
// longer need to repeat the same query.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write updated cookies onto both the request (for downstream middleware)
          // and the response (so the browser receives them).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Keep getUser() here (not getClaims): this call also refreshes an expired
  // session token, which getClaims() does not do.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const path = stripLocale(request.nextUrl.pathname);
    if (!PROFILE_GUARD_SKIPLIST.has(path)) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) {
        const url = request.nextUrl.clone();
        url.pathname = "/profile/setup";
        url.search = "";
        const redirectResponse = NextResponse.redirect(url);
        // Preserve the refreshed auth cookies on the redirect response.
        supabaseResponse.cookies.getAll().forEach((cookie) =>
          redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
        );
        return redirectResponse;
      }
    }
  }

  return supabaseResponse;
}
