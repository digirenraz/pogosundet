export interface RaidInput {
  image_url?: string | null;
  gym_name?: string | null;
  boss_name?: string | null;
  starts_at?: string | null;
  note?: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

// At least one of image_url, gym_name, or boss_name must be provided.
// A note or start time alone is not enough to identify a raid.
export function validateRaid(data: RaidInput): ValidationResult {
  const errors: Record<string, string> = {};

  const hasImage = !!data.image_url?.trim();
  const hasGym = !!data.gym_name?.trim();
  const hasBoss = !!data.boss_name?.trim();

  if (!hasImage && !hasGym && !hasBoss) {
    errors.form = 'errorAtLeastOne';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
