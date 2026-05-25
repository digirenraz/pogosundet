import { describe, it, expect } from 'vitest';
import { pairKey, dmTypingTopic } from './pair-key';

describe('pairKey', () => {
  it('produces the same key regardless of argument order', () => {
    expect(pairKey('a', 'b')).toBe(pairKey('b', 'a'));
  });

  it('separates the two ids with a colon', () => {
    expect(pairKey('a', 'b')).toBe('a:b');
  });

  it('sorts lexically (uuid-like strings)', () => {
    const u1 = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const u2 = '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    expect(pairKey(u2, u1)).toBe(`${u1}:${u2}`);
  });
});

describe('dmTypingTopic', () => {
  it('is identical from either participant — both ends must share one broadcast topic', () => {
    expect(dmTypingTopic('a', 'b')).toBe(dmTypingTopic('b', 'a'));
  });

  it('is prefixed and distinct from the message channel topic', () => {
    expect(dmTypingTopic('a', 'b')).toBe('dm-typing:a:b');
  });
});
