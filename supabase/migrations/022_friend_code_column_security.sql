-- Migration 022: close the friend-code REST-API residual (security-review finding #3).
--
-- Previously the anon and authenticated roles could read friend_code for any
-- profile via the raw REST API (GET /rest/v1/profiles?select=friend_code),
-- regardless of the hide_friend_code toggle. Application-layer redaction in
-- redactHiddenFriendCodes() never ran for direct API callers.
--
-- Column-level REVOKE closes this at the database layer:
--   • SELECT * on profiles no longer includes friend_code for anon/authenticated
--   • Explicit SELECT friend_code fails with permission denied
--
-- service_role (admin client — used by getAllProfiles and account deletion)
-- bypasses column-level privileges entirely and is unaffected.
--
-- get_own_profile() is a SECURITY DEFINER RPC that lets authenticated users
-- read their OWN full profile row, including friend_code, even after the
-- revocation. The SECURITY DEFINER execution context runs as the function
-- owner (postgres) which has unrestricted column access; the explicit
-- WHERE user_id = auth.uid() ensures only the caller's own row is returned.
-- The app uses this RPC in getProfile() (profile edit page) and in the
-- profile/page.tsx server component that renders the own-profile QR view.
--
-- Apply-before-merge: /profile and /profile/edit read friend_code via this
-- RPC on the first load after the code deploys. The REVOKE + function must
-- be present before the PR merges or those pages break for every user.

REVOKE SELECT (friend_code) ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_own_profile()
  RETURNS SETOF public.profiles
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = ''
AS $$
  SELECT * FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Only authenticated users have an auth.uid(); anon callers have no use for
-- "my own profile" so we restrict the GRANT to authenticated.
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;
