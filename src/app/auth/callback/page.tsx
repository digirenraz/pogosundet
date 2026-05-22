'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// OAuth callback page — handles the PKCE code exchange client-side.
//
// Using the browser Supabase client so session cookies are written directly
// via document.cookie. After exchange, we do a full page reload via
// window.location.href (not router.replace) so the server receives fresh
// cookies and can establish the authenticated session.
export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');

    if (!code) {
      // No code — might be a hash-fragment flow; let the client auto-detect.
      const supabase = createClient();
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          window.location.href = '/';
        } else {
          setStatus('error');
          setErrorMsg('Ingen kode i URL. Prøv igen.');
        }
      });
      return;
    }

    const supabase = createClient();
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          console.error('[auth/callback] exchange error:', error.message);
          setStatus('error');
          setErrorMsg(error.message);
        } else {
          // Full page reload so the server sees fresh cookies.
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
