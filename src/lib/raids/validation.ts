// Max lengths for the free-text raid fields. Single source of truth, shared by
// the form's `maxLength` attributes (src/app/[locale]/raids/new/page.tsx) and
// mirrored by DB CHECK constraints (migration 019) so the cap holds even if a
// client bypasses the form. RAID_GYM_NAME_MAX matches the gyms.name cap
// (migration 018) since a posted gym name can be auto-learned into that table.
export const RAID_GYM_NAME_MAX = 120;
export const RAID_BOSS_NAME_MAX = 60;
export const RAID_NOTE_MAX = 500;

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
