import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteAccount } from './server-helpers';

// Mock the admin Supabase client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from '@/lib/supabase/admin';

describe('deleteAccount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls auth.admin.deleteUser with the given userId', async () => {
    const adminClient = {
      auth: {
        admin: {
          deleteUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
        },
      },
    };
    vi.mocked(createAdminClient).mockReturnValue(adminClient as never);

    const result = await deleteAccount('user-123');

    expect(adminClient.auth.admin.deleteUser).toHaveBeenCalledWith('user-123');
    expect(result.error).toBeNull();
  });

  it('propagates errors from Supabase', async () => {
    const supabaseError = { message: 'User not found', status: 404 };
    const adminClient = {
      auth: {
        admin: {
          deleteUser: vi.fn().mockResolvedValue({ data: null, error: supabaseError }),
        },
      },
    };
    vi.mocked(createAdminClient).mockReturnValue(adminClient as never);

    const result = await deleteAccount('user-999');

    expect(result.error).toEqual(supabaseError);
  });
});
