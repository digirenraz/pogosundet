'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Shows an "Install app" banner on Android Chrome when the browser fires
// beforeinstallprompt. iOS users are directed to /onboarding/ios instead —
// iOS never fires this event.
export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!prompt || dismissed) return null;

  async function handleInstall() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setPrompt(null);
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-card border border-border rounded-xl p-4 shadow-lg flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-card-foreground">Installér PoGoSundet</p>
        <p className="text-[12px] text-muted-foreground">Tilføj til hjemmeskærm for hurtig adgang og notifikationer</p>
      </div>
      <button
        onClick={handleInstall}
        className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-[13px] font-bold shrink-0"
      >
        Installér
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted-foreground shrink-0"
        aria-label="Luk"
      >
        <X size={18} />
      </button>
    </div>
  );
}
