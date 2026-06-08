// Decides whether an incoming push notification should be suppressed because
// the user is already looking at the exact screen it points to.
//
// MIRRORED in public/sw.js (a classic service worker can't import ES modules —
// keep both in sync if either changes; the SW's `push` handler cross-references
// this file). This copy exists purely so the decision has unit test coverage.
//
// `visibilityState === 'visible'` alone is NOT a reliable "the user is looking
// at this right now" signal on Android Chrome: backgrounding an installed PWA
// (locking the screen, switching apps, hitting Home) can leave a stale
// `visible` WindowClient behind for a noticeable while before `visibilitychange`
// catches up. Combined with the original suppression check (path-match only),
// that silently swallowed DM push notifications for whichever conversation the
// user had open right before backgrounding — issue #107 ("DM notifications not
// arriving on Android"). `focused` mirrors `document.hasFocus()`, which the
// browser flips synchronously on blur, so requiring BOTH is the conservative
// "definitely on screen right now" check a suppression decision needs — a
// swallowed notification can't be recovered, while an extra one is harmless.
export interface PushWindowClient {
  url: string;
  visibilityState: string;
  focused: boolean;
}

export function isViewingPushTarget(
  windowClients: PushWindowClient[],
  targetUrl: string,
  origin: string,
): boolean {
  const targetPath = new URL(targetUrl, origin).pathname;
  return windowClients.some(client => {
    if (client.visibilityState !== 'visible' || !client.focused) return false;
    try {
      return new URL(client.url, origin).pathname === targetPath;
    } catch {
      return false;
    }
  });
}
