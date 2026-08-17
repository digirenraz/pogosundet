// Turn bare URLs in a chat message into tappable links.
//
// Built from React text nodes and <a> elements — never dangerouslySetInnerHTML,
// so there is no HTML-injection surface: anything that isn't matched as a URL is
// returned as a plain string and React escapes it.
//
// Only http/https is linkified. A `javascript:` or `data:` URL in a message body
// stays inert text.

import type { ReactNode } from 'react';

// Deliberately conservative: an explicit http(s) scheme, then everything up to
// whitespace or an angle bracket. No bare-domain matching ("gå til leekduck.com"
// should not become a link) and no scheme-relative matching.
const URL_PATTERN = /https?:\/\/[^\s<>]+/gi;

// Trailing characters that are almost always sentence punctuation rather than
// part of the URL. Balanced parens are handled separately below.
const TRAILING_PUNCTUATION = /[.,;:!?'"]+$/;

/**
 * Trim punctuation that the regex greedily swallowed.
 *
 * "se https://leekduck.com/events/." should link the URL without the full stop,
 * but "…/wiki/Raid_(disambiguation)" must keep its closing paren.
 */
function trimUrl(url: string): string {
  let trimmed = url.replace(TRAILING_PUNCTUATION, '');

  // Drop a trailing ")" only when it has no matching "(" inside the URL.
  while (trimmed.endsWith(')')) {
    const opens = (trimmed.match(/\(/g) ?? []).length;
    const closes = (trimmed.match(/\)/g) ?? []).length;
    if (opens >= closes) break;
    trimmed = trimmed.slice(0, -1).replace(TRAILING_PUNCTUATION, '');
  }

  return trimmed;
}

/**
 * Split a message body into text and link nodes.
 *
 * Returns the original string unchanged when there is nothing to link, so the
 * common case adds no extra DOM.
 */
export function linkify(body: string): ReactNode {
  URL_PATTERN.lastIndex = 0;
  const matches = [...body.matchAll(URL_PATTERN)];
  if (matches.length === 0) return body;

  const nodes: ReactNode[] = [];
  let cursor = 0;

  matches.forEach((match, index) => {
    const raw = match[0];
    const start = match.index ?? 0;
    const url = trimUrl(raw);

    // A match that was entirely punctuation after trimming isn't a link.
    if (url.length <= 'https://'.length) return;

    if (start > cursor) nodes.push(body.slice(cursor, start));

    nodes.push(
      <a
        key={`link-${index}-${start}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        // The bubble around this is a <button> whose click/long-press opens the
        // message action sheet. Without this, tapping a link would also trigger
        // that. See the note in MessageGroup.tsx about the nesting trade-off.
        onClick={(e) => e.stopPropagation()}
        className="underline underline-offset-2 break-all"
      >
        {url}
      </a>
    );

    cursor = start + url.length;
  });

  if (cursor < body.length) nodes.push(body.slice(cursor));

  return nodes;
}
