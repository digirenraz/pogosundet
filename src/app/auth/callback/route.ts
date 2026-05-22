import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const preferredRegion = "dub1";

// Handles the OAuth redirect from Google (and future providers).
//
// Returns a 200 HTML page (not a 3xx redirect) for the success case.
// iOS Safari reliably processes Set-Cookie headers on 200 responses but
// has been observed to drop them on redirect (3xx) responses, leaving the
// user unauthenticated even though the exchange succeeded server-side.
// The HTML page contains a script that navigates to / after the browser
// has stored the session cookies.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth-error`);
  }

  // 200 response — cookies set here will always be stored by the browser.
  const successHtml = `<!DOCTYPE html><html><head><title>Logger ind…</title></head><body><script>window.location.replace('/')</script><p style="font-family:sans-serif;padding:32px;color:#555">Logger ind…</p></body></html>`;
  const successResponse = new NextResponse(successHtml, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          // Write session cookies directly onto the 200 response so the
          // browser processes them before the JS redirect fires.
          cookiesToSet.forEach(({ name, value, options }) => {
            successResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchange error:", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=auth-error&details=${encodeURIComponent(error.message)}`
    );
  }
  return successResponse;
}
