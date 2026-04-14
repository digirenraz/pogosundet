export interface ProfileInput {
  trainer_name: string;
  friend_code: string;
  first_name?: string;
  bio?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

// Friend code must be exactly 12 digits formatted as XXXX XXXX XXXX
const FRIEND_CODE_RE = /^\d{4} \d{4} \d{4}$/;

export function validateProfile(data: ProfileInput): ValidationResult {
  const errors: Record<string, string> = {};

  // trainer_name: required, trimmed length 3–24
  const name = data.trainer_name ?? '';
  if (name.trim().length === 0) {
    errors.trainer_name = 'errorTrainerNameRequired';
  } else if (name !== name.trim() || name.trim().length < 3 || name.trim().length > 24) {
    // Reject leading/trailing spaces, and names outside 3–24 chars
    errors.trainer_name = 'errorTrainerNameLength';
  }

  // friend_code: required, must match XXXX XXXX XXXX
  const code = data.friend_code ?? '';
  if (code.length === 0) {
    errors.friend_code = 'errorFriendCodeRequired';
  } else if (!FRIEND_CODE_RE.test(code)) {
    errors.friend_code = 'errorFriendCodeFormat';
  }

  // first_name: optional, max 50 chars if provided
  const firstName = data.first_name ?? '';
  if (firstName.length > 50) {
    errors.first_name = 'errorFirstNameLength';
  }

  // bio: optional, max 280 chars if provided
  const bio = data.bio ?? '';
  if (bio.length > 280) {
    errors.bio = 'errorBioLength';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
