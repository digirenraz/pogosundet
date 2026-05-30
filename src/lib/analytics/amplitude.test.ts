import { describe, it, expect } from 'vitest';
import { normalizePath } from './amplitude';

describe('normalizePath', () => {
  const uuid = '3f8a1c2d-4b5e-6f70-8192-a3b4c5d6e7f8';

  it('leaves static paths untouched', () => {
    expect(normalizePath('/players')).toBe('/players');
    expect(normalizePath('/chat/generelt')).toBe('/chat/generelt');
    expect(normalizePath('/')).toBe('/');
  });

  it('replaces a UUID segment with :id', () => {
    expect(normalizePath(`/players/${uuid}`)).toBe('/players/:id');
    expect(normalizePath(`/raids/${uuid}`)).toBe('/raids/:id');
  });

  it('replaces a UUID in the middle of a path', () => {
    expect(normalizePath(`/chat/dm/${uuid}`)).toBe('/chat/dm/:id');
  });

  it('replaces multiple UUID segments', () => {
    expect(normalizePath(`/a/${uuid}/b/${uuid}`)).toBe('/a/:id/b/:id');
  });

  it('does not treat a non-UUID id (e.g. numeric) as a UUID', () => {
    expect(normalizePath('/raids/123')).toBe('/raids/123');
  });
});
