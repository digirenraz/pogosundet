import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProfile, getProfile } from './helpers';

// Mock the Supabase browser client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/client';

// Helper to build a chainable mock that resolves to { data, error }
function mockSupabase(response: { data: unknown; error: unknown }) {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(response),
  };
  // insert().select().single() path
  chain.insert.mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue(response),
    }),
  });
  return { from: vi.fn().mockReturnValue(chain), chain };
}

const profileInput = {
  user_id: 'user-123',
  trainer_name: 'PoGoRaider',
  friend_code: '1234 5678 9012',
  first_name: 'Sofia',
  bio: 'Active near the harbour.',
};

describe('createProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts profile data and returns the created row', async () => {
    const createdRow = { id: 'profile-1', ...profileInput };
    const supabase = mockSupabase({ data: createdRow, error: null });
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const result = await createProfile(profileInput);

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(result.data).toEqual(createdRow);
    expect(result.error).toBeNull();
  });

  it('propagates Supabase errors', async () => {
    const supabaseError = { message: 'duplicate key', code: '23505' };
    const supabase = mockSupabase({ data: null, error: supabaseError });
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const result = await createProfile(profileInput);

    expect(result.data).toBeNull();
    expect(result.error).toEqual(supabaseError);
  });
});

describe('getProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queries profiles by user_id and returns the row', async () => {
    const existingRow = { id: 'profile-1', ...profileInput };
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: existingRow, error: null }),
    };
    const supabase = { from: vi.fn().mockReturnValue(chain) };
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const result = await getProfile('user-123');

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(result.data).toEqual(existingRow);
    expect(result.error).toBeNull();
  });

  it('returns null data when no profile exists', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
    };
    const supabase = { from: vi.fn().mockReturnValue(chain) };
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const result = await getProfile('user-456');

    expect(result.data).toBeNull();
  });
});
