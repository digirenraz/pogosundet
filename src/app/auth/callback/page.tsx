'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// OAuth callback page — handles the PKCE code exchange client-side.
//
// Using the browser Supabase client here (not a Route Handler) so that
// session cookies are written directly via document.cookie. The server-side
// Route Handler approach requires Set-Cookie headers to survive a
// NextResponse.redirect(), which is unreliable on Vercel preview deploys.
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');

    if (!code) {
      router.replace('/login?error=auth-error');
      return;
    }

    const supabase = createClient();
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          console.error('[auth/callback] exchange error:', error.message);
          router.replace(`/login?error=auth-error&details=${encodeURIComponent(error.message)}`);
        } else {
          router.replace('/');
        }
      });
  }, [router]);

  return null;
}
