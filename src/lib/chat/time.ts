// Pure date formatting + message-grouping helpers used by the chat surface.
// Ported from the Claude Design handoff (`ChatData.jsx`). No React, no
// Supabase — safe to unit-test in isolation.

function pad2(n: number): string {
  return n < 10 ? '0' + n : '' + n;
}

const SHORT_WEEKDAY_DA = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
const LONG_WEEKDAY_DA = [
  'Søndag',
  'Mandag',
  'Tirsdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lørdag',
];
const MONTHS_DA = [
  'jan.',
  'feb.',
  'mar.',
  'apr.',
  'maj',
  'jun.',
  'jul.',
  'aug.',
  'sep.',
  'okt.',
  'nov.',
  'dec.',
];

// Tight relative label used in channel-list / DM previews:
// "nu", "5 min", "12 t", "i går", "ma.", "5/3".
export function relTime(date: Date, ref: Date = new Date()): string {
  const diffMs = ref.getTime() - date.getTime();
  const diffMin = diffMs / 60_000;
  if (diffMin < 1) return 'nu';
  if (diffMin < 60) return Math.floor(diffMin) + ' min';
  if (diffMin < 60 * 24) return Math.floor(diffMin / 60) + ' t';

  const today = new Date(ref);
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayDiff = Math.round(
    (today.getTime() - d.getTime()) / (24 * 60 * 60_000)
  );
  if (dayDiff === 1) return 'i går';
  if (dayDiff < 7) return SHORT_WEEKDAY_DA[d.getDay()] + '.';
  return d.getDate() + '/' + (d.getMonth() + 1);
}

// 24-hour clock used inside the chat stream — e.g. "14:32".
export function clockTime(date: Date): string {
  return pad2(date.getHours()) + ':' + pad2(date.getMinutes());
}

// In-stream day separator label: "I dag", "I går", weekday, or "5. maj".
export function daySeparator(date: Date, ref: Date = new Date()): string {
  const today = new Date(ref);
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayDiff = Math.round(
    (today.getTime() - d.getTime()) / (24 * 60 * 60_000)
  );
  if (dayDiff === 0) return 'I dag';
  if (dayDiff === 1) return 'I går';
  if (dayDiff < 7) return LONG_WEEKDAY_DA[d.getDay()];
  return d.getDate() + '. ' + MONTHS_DA[d.getMonth()];
}

// Read-receipt time: "14:32" for today, "I går · 18:04" otherwise.
export function receiptTime(date: Date, ref: Date = new Date()): string {
  const sep = daySeparator(date, ref);
  return sep === 'I dag' ? clockTime(date) : sep + ' · ' + clockTime(date);
}

// Minimal shape required to group messages — keeps the helper independent
// of any concrete message type (server row, DB row, optimistic stub).
export interface GroupableMessage {
  id: string;
  author_id: string;
  sent_at: Date;
}

export interface MessageGroup<M extends GroupableMessage = GroupableMessage> {
  author_id: string;
  messages: M[];
}

// Group consecutive messages from the same author within 3 minutes + same day.
export function groupMessages<M extends GroupableMessage>(
  messages: M[]
): MessageGroup<M>[] {
  const groups: MessageGroup<M>[] = [];
  let current: MessageGroup<M> | null = null;
  for (const m of messages) {
    const sameAuthor = current !== null && current.author_id === m.author_id;
    const sameDay =
      current !== null &&
      new Date(current.messages[0].sent_at).toDateString() ===
        m.sent_at.toDateString();
    const within3min =
      current !== null &&
      m.sent_at.getTime() -
        current.messages[current.messages.length - 1].sent_at.getTime() <
        3 * 60_000;
    if (current && sameAuthor && sameDay && within3min) {
      current.messages.push(m);
    } else {
      current = { author_id: m.author_id, messages: [m] };
      groups.push(current);
    }
  }
  return groups;
}
