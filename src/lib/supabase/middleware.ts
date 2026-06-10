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

// Cookie that caches a positive profile-existence check so we skip the
// `profiles` query (one DB round trip) on every subsequent navigation. Safe to
// cache because profile existence only changes at setup completion (first nav
// after setup re-queries once, then sets the cookie) and at account deletion
// (which signs the user out, so the guard is skipped entirely). The cookie
// VALUE is the user id — switching accounts changes the id, so a stale cookie
// from a previous account never matches and the guard re-checks.
const PROFILE_GUARD_COOKIE = "pogo-profile-ok";

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
    // Skip the profiles query when the guard cookie already proves this exact
    // user has a profile — saves a DB round trip on every navigation.
    const guardProven =
      request.cookies.get(PROFILE_GUARD_COOKIE)?.value === user.id;
    if (!PROFILE_GUARD_SKIPLIST.has(path) && !guardProven) {
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

      // Profile exists — remember that for 30 days. Set the cookie only HERE
      // (after the query, on whatever `supabaseResponse` currently is):
      // getUser() above may have REASSIGNED supabaseResponse inside the
      // cookies.setAll callback, so setting the cookie any earlier risks it
      // being lost to that reassignment.
      supabaseResponse.cookies.set(PROFILE_GUARD_COOKIE, user.id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  }

  return supabaseResponse;
}
