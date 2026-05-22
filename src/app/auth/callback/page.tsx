'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// OAuth callback page — handles implicit-flow tokens from the URL hash.
//
// flowType: 'implicit' means Supabase returns tokens in the URL hash fragment
// (#access_token=...) rather than a ?code= query param. getSession() detects
// and stores them automatically. No code-verifier cookie needed, which fixes
// iOS Safari's Bounce Tracking Prevention purging the cookie mid-redirect.
export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        const msg = error?.message ?? 'Ingen session fundet';
        console.error('[auth/callback] getSession error:', msg);
        setErrorMsg(msg);
        setStatus('error');
      } else {
        window.location.href = '/';
      }
    });
  }, []);

  if (status === 'error') {
    return (
      <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
        <p style={{ color: 'red' }}>Login fejlede: {errorMsg}</p>
        <button type="button" onClick={() => { window.location.href = '/login'; }}
          style={{ marginTop: 8, cursor: 'pointer' }}>Prøv igen</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif', color: '#555' }}>
      Logger ind…
    </div>
  );
}
