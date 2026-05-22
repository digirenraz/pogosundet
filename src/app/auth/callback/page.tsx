'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createOAuthClient } from '@/lib/supabase/oauth-client';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) {
      // Wrap in setTimeout to avoid synchronous setState in effect.
      setTimeout(() => {
        setErrorMsg('Ingen kode fundet i URL');
        setStatus('error');
      }, 0);
      return;
    }

    // 1. Exchange code using localStorage-based client (verifier survived ITP).
    const oauthClient = createOAuthClient();
    oauthClient.auth
      .exchangeCodeForSession(code)
      .then(async ({ data, error }) => {
        if (error || !data.session) {
          console.error('[auth/callback] exchange error:', error?.message);
          setErrorMsg(error?.message ?? 'Exchange fejlede');
          setStatus('error');
          return;
        }

        // 2. Transfer session to cookie storage so the server can read it.
        const ssrClient = createClient();
        await ssrClient.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        // 3. Full page reload so the server gets fresh cookies on the next request.
        window.location.href = '/';
      });
  }, []);

  if (status === 'error') {
    return (
      <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
        <p style={{ color: 'red' }}>Login fejlede: {errorMsg}</p>
        <button type="button" onClick={() => { window.location.href = '/login'; }}
          style={{ marginTop: 8, padding: '8px 16px', cursor: 'pointer' }}>
          Prøv igen
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif', color: '#555' }}>
      Logger ind…
    </div>
  );
}
