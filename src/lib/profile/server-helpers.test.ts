import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAllProfiles, redactHiddenFriendCodes } from './server-helpers';
import type { Profile } from './helpers';

// unstable_cache requires the Next.js incremental cache infrastructure,
// which doesn't exist in Vitest. Stub it so the wrapped function is called directly.
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from '@/lib/supabase/admin';

function mockSupabase(response: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(response),
  };
  return { from: vi.fn().mockReturnValue(chain), chain };
}

const fakeProfiles = [
  { id: '1', user_id: 'u1', trainer_name: 'Alpha', friend_code: '1111 2222 3333' },
  { id: '2', user_id: 'u2', trainer_name: 'Beta', friend_code: '4444 5555 6666' },
];

describe('getAllProfiles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all profiles ordered by created_at', async () => {
    const supabase = mockSupabase({ data: fakeProfiles, error: null });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);

    const result = await getAllProfiles();

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(supabase.chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result.data).toEqual(fakeProfiles);
    expect(result.error).toBeNull();
  });

  it('returns empty array when no profiles exist', async () => {
    const supabase = mockSupabase({ data: null, error: null });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);

    const result = await getAllProfiles();

    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('propagates Supabase errors', async () => {
    const supabaseError = { message: 'connection error', code: '500' };
    const supabase = mockSupabase({ data: null, error: supabaseError });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);

    const result = await getAllProfiles();

    expect(result.error).toEqual(supabaseError);
  });
});

describe('redactHiddenFriendCodes', () => {
  const profiles = [
    { id: '1', user_id: 'u1', trainer_name: 'Alpha', friend_code: '1111 2222 3333', hide_friend_code: false },
    { id: '2', user_id: 'u2', trainer_name: 'Beta', friend_code: '4444 5555 6666', hide_friend_code: true },
    { id: '3', user_id: 'u3', trainer_name: 'Gamma', friend_code: '7777 8888 9999', hide_friend_code: true },
  ] as unknown as Profile[];

  it("blanks the friend code of users who hid it, for a different viewer", () => {
    const result = redactHiddenFriendCodes(profiles, 'u1');
    expect(result[0].friend_code).toBe('1111 2222 3333'); // not hidden
    expect(result[1].friend_code).toBe(''); // hidden, viewer is not owner
    expect(result[2].friend_code).toBe(''); // hidden, viewer is not owner
  });

  it("keeps the viewer's OWN code even when they've hidden it", () => {
    const result = redactHiddenFriendCodes(profiles, 'u2');
    expect(result[1].friend_code).toBe('4444 5555 6666'); // u2 viewing own row
    expect(result[2].friend_code).toBe(''); // someone else's hidden code still redacted
  });

  it('preserves the hide_friend_code flag so the UI can render the placeholder', () => {
    const result = redactHiddenFriendCodes(profiles, 'u1');
    expect(result[1].hide_friend_code).toBe(true);
  });

  it('redacts all hidden codes for a logged-out / unknown viewer', () => {
    const result = redactHiddenFriendCodes(profiles, null);
    expect(result[0].friend_code).toBe('1111 2222 3333');
    expect(result[1].friend_code).toBe('');
    expect(result[2].friend_code).toBe('');
  });

  it('does not mutate the input array', () => {
    redactHiddenFriendCodes(profiles, 'u1');
    expect(profiles[1].friend_code).toBe('4444 5555 6666');
  });
});
