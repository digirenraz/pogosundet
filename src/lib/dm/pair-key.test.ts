import { describe, it, expect } from 'vitest';
import { pairKey } from './pair-key';

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
