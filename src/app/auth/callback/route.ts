import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the OAuth redirect from Google (and future providers).
// Supabase sends the user here after Google authentication with a one-time code.
// We exchange the code for a session and redirect to the home page.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
  }

  // Something went wrong — send back to login with a generic error flag.
  return NextResponse.redirect(`${origin}/login?error=auth-error`);
}
