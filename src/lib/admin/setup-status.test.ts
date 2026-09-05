import { describe, expect, it } from 'vitest';
import { summarise, toMemberRow, type MemberSetupRow } from './setup-status';

function member(overrides: Partial<MemberSetupRow>): MemberSetupRow {
  return {
    // Derived from the name only so each row gets a distinct id without every
    // test having to invent one; pass user_id explicitly to override it.
    user_id: `user-${overrides.trainer_name ?? 'default'}`,
    trainer_name: 'Trainer',
    installed: false as boolean | null,
    push: false,
    push_permission: 'default',
    platform: 'android',
    last_seen_at: '2026-09-01T10:00:00Z',
    last_standalone_at: null,
    unknown: false,
    ...overrides,
  };
}

describe('summarise', () => {
  it('counts installs and push subscriptions independently', () => {
    const summary = summarise([
      member({ trainer_name: 'A', installed: true, push: true }),
      member({ trainer_name: 'B', installed: true }),
      member({ trainer_name: 'C' }),
    ]);
    expect(summary.members).toBe(3);
    expect(summary.installed).toBe(2);
    expect(summary.push).toBe(1);
  });

  it('lists everyone missing either step, and nobody who is fully set up', () => {
    const summary = summarise([
      member({ trainer_name: 'Ready', installed: true, push: true }),
      member({ trainer_name: 'NoPush', installed: true }),
      // A push subscription without an install can happen (Android Chrome in a
      // browser tab) — still worth nudging, since they lose the app icon badge.
      member({ trainer_name: 'NoApp', push: true }),
    ]);
    expect(summary.needsNudge.map((r) => r.trainer_name)).toEqual([
      'NoApp',
      'NoPush',
    ]);
    expect(summary.ready.map((r) => r.trainer_name)).toEqual(['Ready']);
  });

  // The rollout case, exercised through the real row-builder: everyone who
  // enabled notifications BEFORE this shipped has a push_subscriptions row but
  // no app_setup_status row. Reporting them as never-seen would bury a signal
  // we already have, and rank them above people who genuinely need help.
  it('does not call a known subscriber unknown just because they have no report', () => {
    const row = toMemberRow(
      { user_id: 'u1', trainer_name: 'PreExisting' },
      undefined,
      true
    );
    expect(row.unknown).toBe(false);
    expect(row.push).toBe(true);
    // Install genuinely isn't known — not false.
    expect(row.installed).toBeNull();
  });

  it('calls a member with neither a report nor a subscription unknown', () => {
    const row = toMemberRow(
      { user_id: 'u2', trainer_name: 'NeverSeen' },
      undefined,
      false
    );
    expect(row.unknown).toBe(true);
    expect(row.installed).toBeNull();
  });

  it('ranks an unconfirmed-install subscriber last — their push already works', () => {
    const summary = summarise([
      toMemberRow({ user_id: 'a', trainer_name: 'PreExisting' }, undefined, true),
      toMemberRow({ user_id: 'b', trainer_name: 'NeverSeen' }, undefined, false),
      member({ trainer_name: 'NotInstalled' }),
    ]);
    expect(summary.needsNudge.map((r) => r.trainer_name)).toEqual([
      'NeverSeen',
      'NotInstalled',
      'PreExisting',
    ]);
  });

  it('counts only confirmed installs, never an unknown one', () => {
    const summary = summarise([
      member({ trainer_name: 'A', installed: null, push: true }),
      member({ trainer_name: 'B', installed: true, push: true }),
    ]);
    expect(summary.installed).toBe(1);
    expect(summary.ready.map((r) => r.trainer_name)).toEqual(['B']);
  });

  it('sorts the nudge list by how much help the person needs', () => {
    const summary = summarise([
      member({ trainer_name: 'InstalledNoPush', installed: true }),
      member({ trainer_name: 'NotInstalled' }),
      member({ trainer_name: 'NeverOpened', unknown: true, installed: null, push_permission: null }),
      member({
        trainer_name: 'Blocked',
        installed: true,
        push_permission: 'denied',
      }),
    ]);
    expect(summary.needsNudge.map((r) => r.trainer_name)).toEqual([
      'NeverOpened',
      'NotInstalled',
      'InstalledNoPush',
      'Blocked',
    ]);
  });

  it('counts unknowns and blocked permissions separately from the rest', () => {
    const summary = summarise([
      member({ trainer_name: 'A', unknown: true, installed: null, push_permission: null }),
      member({ trainer_name: 'B', push_permission: 'denied' }),
      member({ trainer_name: 'C', installed: true, push: true }),
    ]);
    expect(summary.unknown).toBe(1);
    expect(summary.denied).toBe(1);
  });

  it('is not marked failed for a clean load', () => {
    expect(summarise([member({ trainer_name: 'A' })]).failed).toBe(false);
  });

  it('carries the failed flag through, so partial data is never shown as fact', () => {
    // The counts are still computed — the panel just refuses to render them.
    const summary = summarise([member({ trainer_name: 'A' })], true);
    expect(summary.failed).toBe(true);
  });

  it('handles an empty community', () => {
    const summary = summarise([]);
    expect(summary).toMatchObject({ members: 0, installed: 0, push: 0 });
    expect(summary.needsNudge).toEqual([]);
  });
});
