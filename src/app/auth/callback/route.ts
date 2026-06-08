import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const preferredRegion = "dub1";

// Handles the OAuth redirect from Google (and future providers).
// Supabase sends the user here after Google authentication with a one-time code.
// We exchange the code for a session and redirect to the home page.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Behind Vercel's proxy, `origin` (derived from request.url) is the internal
  // deployment host, NOT the public domain the browser is actually on. The
  // exchange writes the session cookie for the public host (the Host the browser
  // sent), but redirecting back to the internal `origin` lands the browser on a
  // host that doesn't carry that cookie — so it bounces straight back to /login.
  // Google OAuth is the only flow that round-trips through this server redirect,
  // which is why email/password login is unaffected. Prefer the forwarded host
  // (the real public domain) in production. Falls back to `origin` locally where
  // there is no proxy. See Supabase's Next.js App Router auth-callback docs.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const isLocalEnv = process.env.NODE_ENV === "development";
  const base = !isLocalEnv && forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${base}/`);
    }
  }

  // Something went wrong — send back to login with a generic error flag.
  return NextResponse.redirect(`${base}/login?error=auth-error`);
}
