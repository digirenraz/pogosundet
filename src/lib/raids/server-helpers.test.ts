import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActiveRaids } from './server-helpers';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

// Use a recent timestamp so the client-side active filter passes
const recentTime = new Date().toISOString();

const fakeRaids = [
  {
    id: 'raid-1',
    user_id: 'user-1',
    image_url: 'https://example.com/raid.jpg',
    gym_name: 'Slottet',
    boss_name: 'Mewtwo',
    starts_at: null,
    note: null,
    created_at: recentTime,
    raid_attendees: [{ user_id: 'user-2', profiles: { trainer_name: 'Alpha' } }],
  },
];

function mockSupabase(response: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
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

  it('applies a created_at time filter using .gte()', async () => {
    const supabase = mockSupabase({ data: fakeRaids, error: null });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await getActiveRaids();

    expect(supabase.chain.gte).toHaveBeenCalledWith('created_at', expect.any(String));
  });

  it('orders by created_at descending', async () => {
    const supabase = mockSupabase({ data: fakeRaids, error: null });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await getActiveRaids();

    expect(supabase.chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('returns only raids active within the last 45 minutes', async () => {
    const supabase = mockSupabase({ data: fakeRaids, error: null });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await getActiveRaids();

    expect(result.data).toEqual(fakeRaids);
    expect(result.error).toBeNull();
  });

  it('excludes raids whose reference time is older than 45 minutes', async () => {
    const oldTime = new Date(Date.now() - 50 * 60 * 1000).toISOString();
    const oldRaid = { ...fakeRaids[0], id: 'raid-old', starts_at: oldTime, created_at: oldTime };
    const supabase = mockSupabase({ data: [oldRaid], error: null });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await getActiveRaids();

    expect(result.data).toEqual([]);
  });

  it('returns empty array when no raids exist', async () => {
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
