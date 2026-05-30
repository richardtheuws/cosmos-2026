import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateManifest, type ValidateOptions } from './ManifestSchema';

const lenient: ValidateOptions = { lenient: true, source: 'test' };
const strict: ValidateOptions = { lenient: false, source: 'test' };

/** A fully-valid raw manifest object. */
function rawOk(): Record<string, unknown> {
  return {
    version: '1.1',
    name: 'forest',
    displayName: 'Forest',
    author: 'test',
    license: 'MIT',
    defaultArea: 'glade',
    assets: [{ type: 'image', path: 'a.png', preload: true }],
    post: { preset: 'calm-baseline' },
  };
}

afterEach(() => vi.restoreAllMocks());

describe('validateManifest — lenient mode', () => {
  it('backfills defaults and warns on an empty object', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const m = validateManifest({}, lenient);
    expect(m.name).toBe('unknown');
    expect(m.license).toBe('MIT');
    expect(m.defaultArea).toBe('entry');
    expect(m.post.preset).toBe('calm-baseline');
    expect(m.assets).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it('passes a valid manifest through unchanged', () => {
    const m = validateManifest(rawOk(), lenient);
    expect(m.name).toBe('forest');
    expect(m.post.preset).toBe('calm-baseline');
    expect(m.assets).toHaveLength(1);
  });
});

describe('validateManifest — strict mode throws', () => {
  it('throws on a missing name', () => {
    const raw = rawOk();
    delete raw.name;
    expect(() => validateManifest(raw, strict)).toThrow(/name/);
  });

  it('throws on an unknown post.preset', () => {
    const raw = rawOk();
    raw.post = { preset: 'wild' };
    expect(() => validateManifest(raw, strict)).toThrow(/preset/);
  });

  it('throws when assets is not an array', () => {
    const raw = rawOk();
    raw.assets = 'not-an-array';
    expect(() => validateManifest(raw, strict)).toThrow(/assets/);
  });

  it('throws on a non-1.x version', () => {
    const raw = rawOk();
    raw.version = '2.0';
    expect(() => validateManifest(raw, strict)).toThrow(/1\.x/);
  });
});
