import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAllProfiles } from './server-helpers';

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
