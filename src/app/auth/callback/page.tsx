'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const [info, setInfo] = useState<Record<string, string>>({});

  useEffect(() => {
    const hash = window.location.hash.substring(0, 80);
    const search = window.location.search.substring(0, 80);
    const cookieNames = document.cookie
      .split(';')
      .map((c) => c.trim().split('=')[0])
      .filter(Boolean)
      .join(', ');

    const supabase = createClient();
    supabase.auth.getSession().then(({ data, error }) => {
      setInfo({
        hash: hash || '(empty)',
        search: search || '(empty)',
        cookies: cookieNames || '(no cookies)',
        session: data.session ? `✓ ${data.session.user.email}` : '✗ none',
        sessionError: error?.message ?? '—',
      });
    });
  }, []);

  const go = (path: string) => { window.location.href = path; };

  return (
    <div style={{ padding: 24, fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6 }}>
      <h2 style={{ fontFamily: 'sans-serif', marginTop: 0 }}>Auth debug</h2>
      {Object.entries(info).map(([k, v]) => (
        <div key={k}><strong>{k}:</strong> {v}</div>
      ))}
      {info.session?.startsWith('✓') && (
        <button type="button" onClick={() => go('/')} style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer', background: '#00b09f', color: '#fff', border: 0, borderRadius: 8, fontSize: 14 }}>
          Gå til appen →
        </button>
      )}
      {info.session && !info.session.startsWith('✓') && (
        <button type="button" onClick={() => go('/login')} style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer' }}>
          Prøv login igen
        </button>
      )}
    </div>
  );
}
