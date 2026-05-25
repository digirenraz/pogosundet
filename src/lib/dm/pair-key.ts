// Deterministic conversation key for a DM pair. Used as part of the realtime
// topic name and any client-side bucketing where the perspective of either
// participant shouldn't matter.
//
// pairKey('a', 'b') === pairKey('b', 'a').
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join(':');
}

// Stable, symmetric Realtime topic for a DM pair's typing broadcasts. Both
// participants — and the chat-list typing hook — must derive the *identical*
// topic, because Supabase broadcast events only reach clients on the exact same
// topic string (unlike postgres_changes, which is replication-based). This is
// deliberately separate from the message channel's topic so it carries no
// postgres_changes callbacks and is immune to the per-mount collision rule.
//
// dmTypingTopic('a', 'b') === dmTypingTopic('b', 'a').
export function dmTypingTopic(a: string, b: string): string {
  return `dm-typing:${pairKey(a, b)}`;
}
