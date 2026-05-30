import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateAreasManifest } from './AreasSchema';
import type { ValidateOptions } from './ManifestSchema';

const lenient: ValidateOptions = { lenient: true, source: 'areas' };
const strict: ValidateOptions = { lenient: false, source: 'areas' };

function rawArea(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'glade',
    displayName: 'Glade',
    pathExperience: { kind: 'mushroom-path', duration: 1.6, ambient: '#F5EDD8' },
    rooms: ['clearing'],
    ...over,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('validateAreasManifest — zero areas', () => {
  it('warns in lenient mode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const m = validateAreasManifest({ version: '1.0', entryArea: 'glade', areas: [] }, lenient);
    expect(m.areas).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('zero areas'));
  });

  it('throws in strict mode', () => {
    expect(() =>
      validateAreasManifest({ version: '1.0', entryArea: 'glade', areas: [] }, strict),
    ).toThrow(/zero areas/);
  });
});

describe('validateAreasManifest — pathExperience.kind', () => {
  it('warns and accepts an unknown kind in lenient mode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const m = validateAreasManifest(
      { version: '1.0', entryArea: 'glade', areas: [rawArea({ pathExperience: { kind: 'teleport', duration: 1, ambient: '#000' } })] },
      lenient,
    );
    expect(m.areas[0].pathExperience.kind).toBe('teleport');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("'teleport' is unknown"));
  });

  it('throws on an unknown kind in strict mode', () => {
    expect(() =>
      validateAreasManifest(
        { version: '1.0', entryArea: 'glade', areas: [rawArea({ pathExperience: { kind: 'teleport', duration: 1, ambient: '#000' } })] },
        strict,
      ),
    ).toThrow(/teleport/);
  });
});

describe('validateAreasManifest — moodOverrides partial parse', () => {
  it('keeps only the provided override keys', () => {
    const m = validateAreasManifest(
      { version: '1.0', entryArea: 'glade', areas: [rawArea({ moodOverrides: { ambient: '#fff', post: { bloom: 1.5 } } })] },
      lenient,
    );
    const mo = m.areas[0].moodOverrides;
    expect(mo?.ambient).toBe('#fff');
    expect(mo?.primary).toBeUndefined();
    expect(mo?.post).toEqual({ bloom: 1.5 });
  });

  it('parses a null moodOverrides as null', () => {
    const m = validateAreasManifest(
      { version: '1.0', entryArea: 'glade', areas: [rawArea({ moodOverrides: null })] },
      lenient,
    );
    expect(m.areas[0].moodOverrides).toBeNull();
  });
});
