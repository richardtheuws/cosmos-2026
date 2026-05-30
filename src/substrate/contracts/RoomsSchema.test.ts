import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateRoomsManifest, type RoomsValidateOptions } from './RoomsSchema';

const lenient: RoomsValidateOptions = { lenient: true, source: 'rooms', defaultArea: 'glade' };
const strict: RoomsValidateOptions = { lenient: false, source: 'rooms', defaultArea: 'glade' };

function rawRoom(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'clearing', area: 'glade', displayName: 'Clearing', ...over };
}

afterEach(() => vi.restoreAllMocks());

describe('validateRoomsManifest — area backfill (backwards-compat)', () => {
  it('backfills a missing area with manifest.defaultArea and soft-warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const raw = rawRoom();
    delete raw.area;
    const m = validateRoomsManifest({ version: '1.1', entryRoom: 'clearing', rooms: [raw] }, lenient);
    expect(m.rooms[0].area).toBe('glade');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('backfilling'));
  });
});

describe('validateRoomsManifest — zero rooms', () => {
  it('warns in lenient mode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    validateRoomsManifest({ version: '1.1', entryRoom: 'clearing', rooms: [] }, lenient);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('zero rooms'));
  });

  it('throws in strict mode', () => {
    expect(() =>
      validateRoomsManifest({ version: '1.1', entryRoom: 'clearing', rooms: [] }, strict),
    ).toThrow(/zero rooms/);
  });
});

describe('validateRoomsManifest — exit defaults', () => {
  it('fills via="path" and distance=1 for an exit missing fields', () => {
    const m = validateRoomsManifest(
      { version: '1.1', entryRoom: 'clearing', rooms: [rawRoom({ exits: [{ to: 'grove' }] })] },
      lenient,
    );
    expect(m.rooms[0].exits).toEqual([{ to: 'grove', via: 'path', distance: 1 }]);
  });

  it('defaults to an empty exits array when none provided', () => {
    const m = validateRoomsManifest({ version: '1.1', entryRoom: 'clearing', rooms: [rawRoom()] }, lenient);
    expect(m.rooms[0].exits).toEqual([]);
  });
});

describe('validateRoomsManifest — biomeKey null vs undefined', () => {
  it('preserves an explicit null biomeKey', () => {
    const m = validateRoomsManifest(
      { version: '1.1', entryRoom: 'clearing', rooms: [rawRoom({ biomeKey: null })] },
      lenient,
    );
    expect(m.rooms[0].biomeKey).toBeNull();
  });

  it('leaves biomeKey undefined when absent', () => {
    const m = validateRoomsManifest({ version: '1.1', entryRoom: 'clearing', rooms: [rawRoom()] }, lenient);
    expect(m.rooms[0].biomeKey).toBeUndefined();
  });

  it('keeps a string biomeKey', () => {
    const m = validateRoomsManifest(
      { version: '1.1', entryRoom: 'clearing', rooms: [rawRoom({ biomeKey: 'slow-bloom' })] },
      lenient,
    );
    expect(m.rooms[0].biomeKey).toBe('slow-bloom');
  });
});
