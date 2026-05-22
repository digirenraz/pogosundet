'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createOAuthClient } from '@/lib/supabase/oauth-client';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    const oauthClient = createOAuthClient();

    const handleSession = async (accessToken: string, refreshToken: string) => {
      // Transfer tokens from the OAuth client (localStorage) to the SSR client
      // (cookies) so the server can read the session on subsequent requests.
      const ssrClient = createClient();
      const { error } = await ssrClient.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        setErrorMsg(`setSession fejlede: ${error.message}`);
        setStatus('error');
      } else {
        window.location.href = '/';
      }
    };

    if (code) {
      // PKCE fallback (shouldn't happen with implicit flow, kept for safety).
      oauthClient.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error || !data.session) {
          setErrorMsg(error?.message ?? 'Exchange fejlede');
          setStatus('error');
        } else {
          void handleSession(data.session.access_token, data.session.refresh_token);
        }
      });
    } else {
      // Implicit flow: tokens are in the URL hash. getSession() auto-detects them.
      oauthClient.auth.getSession().then(({ data, error }) => {
        if (error || !data.session) {
          setErrorMsg(error?.message ?? 'Ingen session fundet i URL');
          setStatus('error');
        } else {
          void handleSession(data.session.access_token, data.session.refresh_token);
        }
      });
    }
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
