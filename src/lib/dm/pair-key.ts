// Deterministic conversation key for a DM pair. Used as part of the realtime
// topic name and any client-side bucketing where the perspective of either
// participant shouldn't matter.
//
// pairKey('a', 'b') === pairKey('b', 'a').
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join(':');
}
