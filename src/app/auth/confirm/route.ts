import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const preferredRegion = "dub1";

// Handles email confirmation links sent by Supabase.
// Used for two flows:
//   - type=signup   → verifies a new account, then redirects to /
//   - type=recovery → verifies a password-reset request, then redirects to /reset/confirm
//
// The email templates in Supabase dashboard should use:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup  (for signup)
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery (for reset)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (!error) {
      if (type === "recovery") {
        // Session is now set; user must choose a new password.
        return NextResponse.redirect(`${origin}/reset/confirm`);
      }
      // Email confirmed — user is now logged in.
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirm-error`);
}
