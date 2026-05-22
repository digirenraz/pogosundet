-- Enforce friend_code format at the DB level: exactly 12 digits in groups of
-- four separated by single spaces (e.g. "1234 5678 9012"). Matches the regex
-- already enforced by validateProfile() in src/lib/profile/validation.ts.
-- Running this on an existing table will fail if any rows violate the format —
-- fix those rows first (profile edit → save) before applying.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_friend_code_format
  CHECK (friend_code ~ '^\d{4} \d{4} \d{4}$');
