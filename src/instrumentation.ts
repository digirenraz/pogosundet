// Next.js instrumentation hook — runs once when the server process boots.
// Loads the right Sentry config for the active runtime (Node vs Edge) and
// wires request-error capture for Server Components / Route Handlers.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Captures errors thrown in nested React Server Components / Route Handlers.
export const onRequestError = Sentry.captureRequestError;
