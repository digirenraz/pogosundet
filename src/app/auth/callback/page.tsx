'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    const supabase = createClient();

    if (code) {
      // PKCE flow: exchange the code. The code-verifier cookie is present in
      // the browser (set by signInWithOAuth). No server handler exists to
      // consume it first, so the exchange should succeed.
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) {
            console.error('[auth/callback] exchange error:', error.message);
            setErrorMsg(error.message);
            setStatus('error');
          } else {
            window.location.href = '/';
          }
        });
    } else {
      // No code — fall back to detecting a session from existing cookies or
      // hash tokens (implicit flow fallback).
      supabase.auth.getSession().then(({ data, error }) => {
        if (error || !data.session) {
          setErrorMsg(error?.message ?? 'Ingen kode eller session fundet');
          setStatus('error');
        } else {
          window.location.href = '/';
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
