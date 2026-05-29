"use client";

// Root-level error boundary. Catches errors thrown in the root layout itself
// (where the normal [locale]/error.tsx and next-intl provider are unavailable),
// reports them to Sentry, and renders a minimal fallback.
//
// i18n note: this component sits ABOVE NextIntlClientProvider, so next-intl is
// not reliably available here. The single fallback string is therefore
// hardcoded in Danish by necessity — this is the one sanctioned exception to
// the "all strings via next-intl" rule, and only fires on catastrophic errors.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="da">
      <body className="bg-background text-foreground antialiased">
        <main style={{ padding: "2rem", textAlign: "center" }}>
          <h1>Noget gik galt</h1>
          <p>Prøv igen om et øjeblik.</p>
          <button onClick={() => reset()} style={{ marginTop: "1rem" }}>
            Prøv igen
          </button>
        </main>
      </body>
    </html>
  );
}
