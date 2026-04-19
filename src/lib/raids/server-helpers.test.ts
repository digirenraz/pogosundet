import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActiveRaids } from './server-helpers';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

const fakeRaids = [
  {
    id: 'raid-1',
    user_id: 'user-1',
    image_url: 'https://example.com/raid.jpg',
    gym_name: 'Slottet',
    boss_name: 'Mewtwo',
    starts_at: null,
    note: null,
    created_at: new Date().toISOString(),
    raid_attendees: [{ user_id: 'user-2', profiles: { trainer_name: 'Alpha' } }],
  },
];

function mockSupabase(response: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(response),
  };
  return { from: vi.fn().mockReturnValue(chain), chain };
}

describe('getActiveRaids', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queries the raids table with attendees', async () => {
    const supabase = mockSupabase({ data: fakeRaids, error: null });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await getActiveRaids();

    expect(supabase.from).toHaveBeenCalledWith('raids');
    expect(supabase.chain.select).toHaveBeenCalledWith(
      expect.stringContaining('raid_attendees')
    );
  });

  it('applies a time filter using .or()', async () => {
    const supabase = mockSupabase({ data: fakeRaids, error: null });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await getActiveRaids();

    expect(supabase.chain.or).toHaveBeenCalledWith(
      expect.stringContaining('starts_at.gt')
    );
  });

  it('orders by created_at descending', async () => {
    const supabase = mockSupabase({ data: fakeRaids, error: null });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await getActiveRaids();

    expect(supabase.chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('returns raids data on success', async () => {
    const supabase = mockSupabase({ data: fakeRaids, error: null });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await getActiveRaids();

    expect(result.data).toEqual(fakeRaids);
    expect(result.error).toBeNull();
  });

  it('returns empty array when no active raids', async () => {
    const supabase = mockSupabase({ data: null, error: null });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await getActiveRaids();

    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('propagates Supabase errors and returns empty array', async () => {
    const supabaseError = { message: 'connection error', code: '500' };
    const supabase = mockSupabase({ data: null, error: supabaseError });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await getActiveRaids();

    expect(result.data).toEqual([]);
    expect(result.error).toEqual(supabaseError);
  });
});
