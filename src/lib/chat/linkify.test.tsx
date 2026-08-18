import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { linkify } from './linkify';

function renderBody(body: string) {
  return render(<div>{linkify(body)}</div>);
}

describe('linkify', () => {
  it('returns the original string when there is no URL', () => {
    // Fast path: the common case should not allocate an array of nodes.
    expect(linkify('helt almindelig besked')).toBe('helt almindelig besked');
  });

  it('turns a bare https URL into an anchor', () => {
    renderBody('se her https://leekduck.com/events/kyogre/');

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://leekduck.com/events/kyogre/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('keeps the surrounding text intact', () => {
    const { container } = renderBody('før https://example.com efter');

    expect(container.textContent).toBe('før https://example.com efter');
  });

  it('links multiple URLs in one message', () => {
    renderBody('https://a.example.com og https://b.example.com');

    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('does not swallow a trailing full stop', () => {
    renderBody('læs mere på https://leekduck.com/events/.');

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'https://leekduck.com/events/'
    );
  });

  it('keeps a balanced closing parenthesis inside the URL', () => {
    renderBody('https://en.wikipedia.org/wiki/Raid_(disambiguation)');

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'https://en.wikipedia.org/wiki/Raid_(disambiguation)'
    );
  });

  it('does not linkify a javascript: URL', () => {
    // The injection guard: only http/https are ever turned into anchors.
    renderBody('javascript:alert(1)');

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('does not linkify a data: URL', () => {
    renderBody('data:text/html;base64,PHNjcmlwdD4=');

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('does not linkify a bare domain', () => {
    renderBody('gå til leekduck.com for mere');

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders HTML in a message as text, not markup', () => {
    const { container } = renderBody('<img src=x onerror=alert(1)>');

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});
