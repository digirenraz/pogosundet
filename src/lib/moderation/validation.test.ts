import { describe, expect, it } from 'vitest';
import { validateModeration, validateReport } from './validation';
import {
  MODERATOR_NOTE_MAX_LENGTH,
  REPORT_NOTE_MAX_LENGTH,
} from './types';
import { reportContextHref } from './types';

const VALID_UUID = '9f1c4c1e-1c2b-4a5d-8f3e-6b2a7c9d0e11';

describe('validateReport', () => {
  it('accepts a well-formed report and normalises the note', () => {
    const result = validateReport({
      surface: 'channel',
      messageId: VALID_UUID,
      reason: 'harassment',
      note: '  han truer mig  ',
    });
    expect(result).toEqual({
      ok: true,
      surface: 'channel',
      messageId: VALID_UUID,
      reason: 'harassment',
      note: 'han truer mig',
    });
  });

  it('turns an omitted or blank note into null', () => {
    for (const note of [undefined, '', '   ']) {
      const result = validateReport({
        surface: 'dm',
        messageId: VALID_UUID,
        reason: 'spam',
        note,
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.note).toBeNull();
    }
  });

  it('rejects an unknown surface', () => {
    expect(
      validateReport({
        surface: 'email',
        messageId: VALID_UUID,
        reason: 'spam',
      })
    ).toEqual({ ok: false, error: 'surface' });
  });

  it('rejects an unknown reason', () => {
    expect(
      validateReport({
        surface: 'raid',
        messageId: VALID_UUID,
        reason: 'because-i-said-so',
      })
    ).toEqual({ ok: false, error: 'reason' });
  });

  it('rejects optimistic placeholder ids — they do not exist server-side yet', () => {
    expect(
      validateReport({
        surface: 'channel',
        messageId: 'opt-1717171717',
        reason: 'spam',
      })
    ).toEqual({ ok: false, error: 'messageId' });
  });

  it('rejects a note over the length cap', () => {
    expect(
      validateReport({
        surface: 'channel',
        messageId: VALID_UUID,
        reason: 'other',
        note: 'a'.repeat(REPORT_NOTE_MAX_LENGTH + 1),
      })
    ).toEqual({ ok: false, error: 'note' });
  });

  it('accepts a note exactly at the cap', () => {
    const result = validateReport({
      surface: 'channel',
      messageId: VALID_UUID,
      reason: 'other',
      note: 'a'.repeat(REPORT_NOTE_MAX_LENGTH),
    });
    expect(result.ok).toBe(true);
  });
});

describe('validateModeration', () => {
  it('accepts each supported action', () => {
    for (const action of ['delete', 'ban', 'unban', 'dismiss'] as const) {
      const result = validateModeration({ reportId: VALID_UUID, action });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.action).toBe(action);
    }
  });

  it('requires a note for a warning — an empty warning DM is meaningless', () => {
    expect(
      validateModeration({ reportId: VALID_UUID, action: 'warn' })
    ).toEqual({ ok: false, error: 'note' });
    expect(
      validateModeration({ reportId: VALID_UUID, action: 'warn', note: '   ' })
    ).toEqual({ ok: false, error: 'note' });

    const result = validateModeration({
      reportId: VALID_UUID,
      action: 'warn',
      note: 'Hold en pæn tone, tak.',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown action', () => {
    expect(
      validateModeration({ reportId: VALID_UUID, action: 'nuke' })
    ).toEqual({ ok: false, error: 'action' });
  });

  it('rejects a malformed report id', () => {
    expect(validateModeration({ reportId: 'nope', action: 'dismiss' })).toEqual(
      { ok: false, error: 'reportId' }
    );
  });

  it('rejects a moderator note over the length cap', () => {
    expect(
      validateModeration({
        reportId: VALID_UUID,
        action: 'ban',
        note: 'a'.repeat(MODERATOR_NOTE_MAX_LENGTH + 1),
      })
    ).toEqual({ ok: false, error: 'note' });
  });
});

describe('reportContextHref', () => {
  it('links a channel report to the channel', () => {
    expect(
      reportContextHref({ surface: 'channel', context_id: 'generelt' })
    ).toBe('/chat/generelt');
  });

  it('links a raid report to the raid', () => {
    expect(reportContextHref({ surface: 'raid', context_id: VALID_UUID })).toBe(
      `/raids/${VALID_UUID}`
    );
  });

  it('has no link for a DM — only the two participants may read the thread', () => {
    expect(reportContextHref({ surface: 'dm', context_id: null })).toBeNull();
  });
});
