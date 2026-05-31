import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_UNIVERSE,
  parseURLRequest,
  resolveURLRequest,
  type ResolveCtx,
} from './ResolveURL';
import type { AreasManifest, Manifest, RoomsManifest } from './contracts/BehaviorContract';

/* ── Fixtures ───────────────────────────────────────────────────────────── */

function manifest(over: Partial<Manifest> = {}): Manifest {
  return {
    version: '1.1',
    name: 'forest',
    displayName: 'Forest',
    author: 'test',
    license: 'MIT',
    defaultArea: 'glade',
    brandDeviation: null,
    assets: [],
    post: { preset: 'calm-baseline' },
    ...over,
  };
}

function area(id: string, rooms: string[]): AreasManifest['areas'][number] {
  return {
    id,
    displayName: id,
    moodOverrides: null,
    pathExperience: { kind: 'fade', duration: 1, ambient: '#000' },
    rooms,
  };
}

function room(id: string): RoomsManifest['rooms'][number] {
  return { id, displayName: id, anchor: { x: 0, y: 0, z: 0 } };
}

/** Build a ResolveCtx whose loader returns one fixed universe bundle. */
function ctx(
  bundle: { manifest: Manifest; areas: AreasManifest; rooms: RoomsManifest } | null,
  known: string[] = [DEFAULT_UNIVERSE],
): ResolveCtx {
  return {
    knownUniverses: new Set(known),
    loadUniverseManifests: async () => bundle,
  };
}

/** A coherent default forest bundle: one area 'glade' with rooms clearing+grove. */
function forestBundle() {
  return {
    manifest: manifest({ defaultArea: 'glade' }),
    areas: { version: '1.0', entryArea: 'glade', areas: [area('glade', ['clearing', 'grove'])] },
    rooms: {
      version: '1.1',
      entryRoom: 'clearing',
      rooms: [room('clearing'), room('grove')],
    } as RoomsManifest,
  };
}

afterEach(() => vi.restoreAllMocks());

/* ── parseURLRequest ────────────────────────────────────────────────────── */

describe('parseURLRequest', () => {
  it('returns all-undefined for an empty search', () => {
    expect(parseURLRequest('')).toEqual({ universe: undefined, area: undefined, room: undefined });
  });

  it('treats empty-string params as undefined', () => {
    expect(parseURLRequest('?universe=&area=&room=')).toEqual({
      universe: undefined,
      area: undefined,
      room: undefined,
    });
  });

  it('parses present params', () => {
    expect(parseURLRequest('?universe=forest&area=glade&room=clearing')).toEqual({
      universe: 'forest',
      area: 'glade',
      room: 'clearing',
    });
  });
});

/* ── resolveURLRequest ──────────────────────────────────────────────────── */

describe('resolveURLRequest — happy path', () => {
  it('returns the requested triple unchanged when all ids are valid', async () => {
    const r = await resolveURLRequest(
      { universe: 'forest', area: 'glade', room: 'clearing' },
      ctx(forestBundle()),
    );
    expect(r).toEqual({ universe: 'forest', area: 'glade', room: 'clearing', changed: false });
  });
});

describe('resolveURLRequest — universe fallback', () => {
  it('falls back to forest and warns when the universe is unknown', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await resolveURLRequest(
      { universe: 'nope', area: 'glade', room: 'clearing' },
      ctx(forestBundle()),
    );
    expect(r.universe).toBe(DEFAULT_UNIVERSE);
    expect(r.changed).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("universe 'nope' not found"));
  });
});

describe('resolveURLRequest — area fallback chain', () => {
  it('unknown area falls back to manifest.defaultArea', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bundle = {
      manifest: manifest({ defaultArea: 'glade' }),
      areas: {
        version: '1.0',
        entryArea: 'glade',
        areas: [area('glade', ['clearing']), area('hollow', ['pit'])],
      },
      rooms: { version: '1.1', entryRoom: 'clearing', rooms: [room('clearing'), room('pit')] } as RoomsManifest,
    };
    const r = await resolveURLRequest({ universe: 'forest', area: 'ghost', room: 'clearing' }, ctx(bundle));
    expect(r.area).toBe('glade');
    expect(r.changed).toBe(true);
  });

  it('falls back to entryArea when defaultArea is absent from the areas list', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bundle = {
      // defaultArea 'missing' is not in the areas list → fallbackArea uses entryArea
      manifest: manifest({ defaultArea: 'missing' }),
      areas: { version: '1.0', entryArea: 'hollow', areas: [area('hollow', ['pit'])] },
      rooms: { version: '1.1', entryRoom: 'pit', rooms: [room('pit')] } as RoomsManifest,
    };
    const r = await resolveURLRequest({ universe: 'forest', area: 'ghost' }, ctx(bundle));
    expect(r.area).toBe('hollow');
  });
});

describe('resolveURLRequest — room fallback', () => {
  it('unknown room falls back to the first room of the area', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await resolveURLRequest(
      { universe: 'forest', area: 'glade', room: 'ghost' },
      ctx(forestBundle()),
    );
    expect(r.room).toBe('clearing');
    expect(r.changed).toBe(true);
  });

  it('re-resolves a valid room id that belongs to a different area', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bundle = {
      manifest: manifest({ defaultArea: 'glade' }),
      areas: {
        version: '1.0',
        entryArea: 'glade',
        areas: [area('glade', ['clearing']), area('hollow', ['pit'])],
      },
      rooms: { version: '1.1', entryRoom: 'clearing', rooms: [room('clearing'), room('pit')] } as RoomsManifest,
    };
    // 'pit' is a real room but lives in 'hollow', not 'glade' → re-resolve to glade's room
    const r = await resolveURLRequest({ universe: 'forest', area: 'glade', room: 'pit' }, ctx(bundle));
    expect(r.room).toBe('clearing');
    expect(r.changed).toBe(true);
  });
});

describe('resolveURLRequest — changed semantics', () => {
  it('sets changed:true when params are omitted even though the defaults are valid', async () => {
    const r = await resolveURLRequest({}, ctx(forestBundle()));
    expect(r).toEqual({ universe: 'forest', area: 'glade', room: 'clearing', changed: true });
  });
});

describe('resolveURLRequest — hard edges', () => {
  it('throws when the area has zero valid rooms', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bundle = {
      manifest: manifest({ defaultArea: 'glade' }),
      // area lists 'clearing' but rooms.json has no such room → zero valid rooms
      areas: { version: '1.0', entryArea: 'glade', areas: [area('glade', ['clearing'])] },
      rooms: { version: '1.1', entryRoom: 'x', rooms: [room('elsewhere')] } as RoomsManifest,
    };
    await expect(resolveURLRequest({ universe: 'forest' }, ctx(bundle))).rejects.toThrow(
      /zero valid rooms/,
    );
  });

  it('warns "parent contract wins" when manifest.defaultArea disagrees with areas.entryArea', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bundle = {
      manifest: manifest({ defaultArea: 'glade' }), // manifest says glade
      areas: {
        version: '1.0',
        entryArea: 'hollow', // areas says hollow — disagreement
        areas: [area('glade', ['clearing']), area('hollow', ['pit'])],
      },
      rooms: { version: '1.1', entryRoom: 'clearing', rooms: [room('clearing'), room('pit')] } as RoomsManifest,
    };
    const r = await resolveURLRequest({ universe: 'forest' }, ctx(bundle));
    // manifest wins → resolves to glade, not the areas.entryArea hollow
    expect(r.area).toBe('glade');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('parent contract wins'));
  });

  it('throws when the (default) universe fails to load', async () => {
    await expect(resolveURLRequest({ universe: 'forest' }, ctx(null))).rejects.toThrow(
      /failed to load/,
    );
  });
});

/* ── reserved-universe exemption (Wave 24 · S1 — the "Look up." return) ───── */

/** A coherent `_chart` bundle: area 'the-void' with the single room 'the-chart'. */
function chartBundle() {
  return {
    manifest: manifest({ name: '_chart', displayName: 'The Spore-Chart', defaultArea: 'the-void' }),
    areas: { version: '1.0', entryArea: 'the-void', areas: [area('the-void', ['the-chart'])] },
    rooms: { version: '1.1', entryRoom: 'the-chart', rooms: [room('the-chart')] } as RoomsManifest,
  };
}

/** ResolveCtx with an explicit reserved-universe allowlist. */
function ctxReserved(
  bundle: { manifest: Manifest; areas: AreasManifest; rooms: RoomsManifest } | null,
  known: string[],
  reserved: string[],
): ResolveCtx {
  return {
    knownUniverses: new Set(known),
    reservedUniverses: new Set(reserved),
    loadUniverseManifests: async () => bundle,
  };
}

describe('resolveURLRequest — reserved-universe exemption', () => {
  it('resolves a reserved `_chart` request (does NOT bounce to forest) when allowlisted', async () => {
    const r = await resolveURLRequest(
      { universe: '_chart' },
      ctxReserved(chartBundle(), ['forest'], ['_chart']),
    );
    expect(r.universe).toBe('_chart');
    expect(r.area).toBe('the-void');
    expect(r.room).toBe('the-chart');
  });

  it('still bounces a `_`-prefixed id to forest when the reserved allowlist is absent', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // No reservedUniverses → the chart is neither known nor reserved → fallback.
    const r = await resolveURLRequest({ universe: '_chart' }, ctx(forestBundle(), ['forest']));
    expect(r.universe).toBe(DEFAULT_UNIVERSE);
    expect(r.changed).toBe(true);
  });
});
