import { describe, it, expect } from 'vitest';
import {
  groupReactions,
  type ChannelReactionRow,
} from './reactions-helpers';

describe('groupReactions', () => {
  it('returns an empty object for empty input', () => {
    expect(groupReactions([])).toEqual({});
  });

  it('groups a single-emoji single-user row', () => {
    const rows: ChannelReactionRow[] = [
      { message_id: 'm1', user_id: 'u1', emoji: '👍' },
    ];
    expect(groupReactions(rows)).toEqual({ '👍': ['u1'] });
  });

  it('groups multi-emoji multi-user rows', () => {
    const rows: ChannelReactionRow[] = [
      { message_id: 'm1', user_id: 'u1', emoji: '👍' },
      { message_id: 'm1', user_id: 'u2', emoji: '👍' },
      { message_id: 'm1', user_id: 'u1', emoji: '❤️' },
    ];
    const out = groupReactions(rows);
    expect(out).toEqual({ '👍': ['u1', 'u2'], '❤️': ['u1'] });
  });

  it('preserves first-seen insertion order for emojis and users', () => {
    const rows: ChannelReactionRow[] = [
      { message_id: 'm1', user_id: 'u3', emoji: '😂' },
      { message_id: 'm1', user_id: 'u1', emoji: '👍' },
      { message_id: 'm1', user_id: 'u2', emoji: '😂' },
    ];
    const out = groupReactions(rows);
    expect(Object.keys(out)).toEqual(['😂', '👍']);
    expect(out['😂']).toEqual(['u3', 'u2']);
  });

  it('deduplicates duplicate (user_id, emoji) pairs', () => {
    const rows: ChannelReactionRow[] = [
      { message_id: 'm1', user_id: 'u1', emoji: '👍' },
      { message_id: 'm1', user_id: 'u1', emoji: '👍' },
    ];
    expect(groupReactions(rows)).toEqual({ '👍': ['u1'] });
  });
});
