// Recognising a bot question in a chat message. Pure — no Supabase, no network —
// so every edge of the matching rule is unit-testable, and so the client can
// import it to decide whether a message it is about to send needs the consent
// explainer first.
//
// Same split as src/lib/pogo-feed/diff.ts: the decision is plain functions over
// plain data, and only the route does I/O.

import { QA_TRIGGER, MAX_QUESTION_LENGTH } from './types';

/**
 * Extract the question from a chat message, or null if it isn't one.
 *
 * The rules, in order:
 *
 *   - Leading whitespace is ignored (a mobile keyboard adds one readily).
 *   - The trigger must be at the START. "kan nogen !pogo spørge" is a member
 *     talking about the bot, not talking to it.
 *   - Matching is case-insensitive: "!POGO" and "!Pogo" both work, because
 *     phone keyboards capitalise the first word of a message.
 *   - The trigger must be followed by whitespace or end of string. Without this
 *     word boundary "!pogoify" would fire, and any future "!pogostats" command
 *     would be silently swallowed by this one.
 *   - What is left, trimmed, must be non-empty and within MAX_QUESTION_LENGTH.
 *
 * A bare "!pogo" with no question returns null rather than an empty question:
 * there is nothing to ask, and sending an empty prompt to the model would burn
 * a rate-limit slot and a few cents to produce a confused answer.
 */
export function parseQuestion(body: string): string | null {
  const text = body.trimStart();

  const prefix = text.slice(0, QA_TRIGGER.length);
  if (prefix.toLowerCase() !== QA_TRIGGER) return null;

  const rest = text.slice(QA_TRIGGER.length);

  // Word boundary: end of message, or whitespace before the question.
  // \s covers the non-breaking space some keyboards emit, which /^\s/ matches
  // but a naive `rest[0] === ' '` would not.
  if (rest !== '' && !/^\s/.test(rest)) return null;

  const question = rest.trim();
  if (question === '') return null;
  if (question.length > MAX_QUESTION_LENGTH) return null;

  return question;
}

/**
 * Cheap "does this look like a bot question?" test for the composer.
 *
 * Deliberately NOT `parseQuestion(body) !== null`: the client uses this to
 * decide whether to show the one-time consent explainer, and it must trigger on
 * a bare "!pogo" or an over-long question too. Somebody who types the trigger
 * has shown intent to use the bot, whatever else they typed — they should see
 * the explainer, not silently nothing.
 */
export function looksLikeQuestion(body: string): boolean {
  const text = body.trimStart();
  if (text.slice(0, QA_TRIGGER.length).toLowerCase() !== QA_TRIGGER) return false;

  const rest = text.slice(QA_TRIGGER.length);
  return rest === '' || /^\s/.test(rest);
}
