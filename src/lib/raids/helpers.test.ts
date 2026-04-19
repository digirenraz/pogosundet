import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRaid, joinRaid, leaveRaid } from './helpers';

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/client';

const raidInput = {
  user_id: 'user-123',
  image_url: 'https://example.com/raid.jpg',
  gym_name: 'Slottet',
  boss_name: 'Mewtwo',
  starts_at: null,
  note: null,
};

describe('createRaid', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts raid data and returns the created row', async () => {
    const createdRow = { id: 'raid-1', ...raidInput, created_at: '2026-01-01T12:00:00Z' };
    const innerChain = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: createdRow, error: null }),
      }),
    };
    const chain = { insert: vi.fn().mockReturnValue(innerChain) };
    const supabase = { from: vi.fn().mockReturnValue(chain) };
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const result = await createRaid(raidInput);

    expect(supabase.from).toHaveBeenCalledWith('raids');
    expect(chain.insert).toHaveBeenCalledWith(raidInput);
    expect(result.data).toEqual(createdRow);
    expect(result.error).toBeNull();
  });

  it('propagates Supabase errors', async () => {
    const supabaseError = { message: 'insert failed', code: '500' };
    const innerChain = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: supabaseError }),
      }),
    };
    const chain = { insert: vi.fn().mockReturnValue(innerChain) };
    const supabase = { from: vi.fn().mockReturnValue(chain) };
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const result = await createRaid(raidInput);

    expect(result.data).toBeNull();
    expect(result.error).toEqual(supabaseError);
  });
});

describe('joinRaid', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts into raid_attendees', async () => {
    const chain = { insert: vi.fn().mockResolvedValue({ error: null }) };
    const supabase = { from: vi.fn().mockReturnValue(chain) };
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const result = await joinRaid('raid-1', 'user-123');

    expect(supabase.from).toHaveBeenCalledWith('raid_attendees');
    expect(chain.insert).toHaveBeenCalledWith({ raid_id: 'raid-1', user_id: 'user-123' });
    expect(result.error).toBeNull();
  });

  it('propagates Supabase errors', async () => {
    const supabaseError = { message: 'already joined', code: '23505' };
    const chain = { insert: vi.fn().mockResolvedValue({ error: supabaseError }) };
    const supabase = { from: vi.fn().mockReturnValue(chain) };
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const result = await joinRaid('raid-1', 'user-123');

    expect(result.error).toEqual(supabaseError);
  });
});

describe('leaveRaid', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes from raid_attendees by raid_id and user_id', async () => {
    const chain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    // Second .eq() resolves the promise
    let eqCallCount = 0;
    chain.eq.mockImplementation(() => {
      eqCallCount++;
      if (eqCallCount === 2) return Promise.resolve({ error: null });
      return chain;
    });
    const supabase = { from: vi.fn().mockReturnValue(chain) };
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const result = await leaveRaid('raid-1', 'user-123');

    expect(supabase.from).toHaveBeenCalledWith('raid_attendees');
    expect(chain.eq).toHaveBeenCalledWith('raid_id', 'raid-1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(result.error).toBeNull();
  });

  it('propagates Supabase errors', async () => {
    const supabaseError = { message: 'delete failed', code: '500' };
    const chain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    let eqCallCount = 0;
    chain.eq.mockImplementation(() => {
      eqCallCount++;
      if (eqCallCount === 2) return Promise.resolve({ error: supabaseError });
      return chain;
    });
    const supabase = { from: vi.fn().mockReturnValue(chain) };
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const result = await leaveRaid('raid-1', 'user-123');

    expect(result.error).toEqual(supabaseError);
  });
});
