import { describe, it, expect } from 'vitest';
import { isViewingPushTarget } from './notification-suppression';

const ORIGIN = 'https://pogosundet.example';

// Regression coverage for #107: DM push notifications were silently swallowed
// on Android. Root cause — the suppression check (added for #73) only compared
// the push target path against `visibilityState === 'visible'` window clients.
// On Android Chrome, a backgrounded installed PWA can keep reporting a window
// client as `visible` for a while (locking the screen, switching apps, Home),
// so a DM arriving for the conversation the user had open right before
// backgrounding was treated as "already on screen" and never shown. Requiring
// `focused` too — which the browser flips synchronously on blur — fixes it.
describe('isViewingPushTarget', () => {
  it('suppresses when a client is both visible and focused on the target screen', () => {
    const clients = [{ url: `${ORIGIN}/chat/dm/partner-abc`, visibilityState: 'visible', focused: true }];
    expect(isViewingPushTarget(clients, '/chat/dm/partner-abc', ORIGIN)).toBe(true);
  });

  it('does NOT suppress a stale "visible" client that has lost focus (the Android regression)', () => {
    const clients = [{ url: `${ORIGIN}/chat/dm/partner-abc`, visibilityState: 'visible', focused: false }];
    expect(isViewingPushTarget(clients, '/chat/dm/partner-abc', ORIGIN)).toBe(false);
  });

  it('does NOT suppress a focused client on a different screen', () => {
    const clients = [{ url: `${ORIGIN}/chat/dm/someone-else`, visibilityState: 'visible', focused: true }];
    expect(isViewingPushTarget(clients, '/chat/dm/partner-abc', ORIGIN)).toBe(false);
  });

  it('does NOT suppress a focused client that is reported hidden', () => {
    const clients = [{ url: `${ORIGIN}/chat/dm/partner-abc`, visibilityState: 'hidden', focused: true }];
    expect(isViewingPushTarget(clients, '/chat/dm/partner-abc', ORIGIN)).toBe(false);
  });

  it('does NOT suppress when there are no window clients (app closed)', () => {
    expect(isViewingPushTarget([], '/chat/dm/partner-abc', ORIGIN)).toBe(false);
  });

  it('ignores clients with unparseable URLs instead of throwing', () => {
    const clients = [{ url: 'not a url', visibilityState: 'visible', focused: true }];
    expect(isViewingPushTarget(clients, '/chat/dm/partner-abc', ORIGIN)).toBe(false);
  });

  it('matches on pathname only, ignoring query/hash differences', () => {
    const clients = [{ url: `${ORIGIN}/raids/raid-1?ref=push#top`, visibilityState: 'visible', focused: true }];
    expect(isViewingPushTarget(clients, '/raids/raid-1', ORIGIN)).toBe(true);
  });
});
