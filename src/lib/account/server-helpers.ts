// Server-only account helpers.
// Do not import this in client components.
import { createAdminClient } from '@/lib/supabase/admin';

// Permanently deletes the auth user and all associated data.
// The profiles row is removed automatically via ON DELETE CASCADE on the FK.
export async function deleteAccount(userId: string) {
  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  return { error };
}
