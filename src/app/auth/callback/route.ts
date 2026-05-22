import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const preferredRegion = "dub1";

// Handles the OAuth redirect from Google (and future providers).
// Supabase sends the user here after Google authentication with a one-time code.
//
// We create the Supabase client inline here rather than using the shared
// createClient() helper. The shared helper writes session cookies via the
// Next.js cookies() store, which is NOT applied to a NextResponse.redirect()
// returned from a Route Handler. Instead we write directly onto the response
// object so the session cookies survive the redirect to the home page.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const successResponse = NextResponse.redirect(`${origin}/`);
  const errorResponse = NextResponse.redirect(`${origin}/login?error=auth-error`);

  if (!code) return errorResponse;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write session cookies directly onto the response that will be returned
          // so they are not lost when we redirect.
          cookiesToSet.forEach(({ name, value, options }) =>
            successResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('[auth/callback] exchangeCodeForSession error:', error.message, error.status);
    return NextResponse.redirect(
      `${origin}/login?error=auth-error&details=${encodeURIComponent(error.message)}`
    );
  }
  return successResponse;
}
