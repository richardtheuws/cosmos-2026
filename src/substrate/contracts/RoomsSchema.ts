/**
 * Hand-rolled `rooms.json` validator with backwards-compat: a Room missing
 * the `area` field is rewritten to belong to `manifest.defaultArea` per
 * architect §1.3 + UNIVERSE-AUTHORING.md migration note.
 */
import type { RoomsManifest, RoomSpec, RoomExit } from './BehaviorContract';
import {
  asArray,
  asNumber,
  asObject,
  asString,
  optString,
  throwOrWarn,
  type ValidateOptions,
} from './ManifestSchema';

export interface RoomsValidateOptions extends ValidateOptions {
  /** Used to backfill missing `area` per backwards-compat policy. */
  defaultArea: string;
}

export function validateRoomsManifest(raw: unknown, opts: RoomsValidateOptions): RoomsManifest {
  const r = asObject(raw, opts, opts.source);
  const version = asString(r.version, opts, `${opts.source}.version`, '1.1');
  const entryRoom = asString(r.entryRoom, opts, `${opts.source}.entryRoom`, 'start');

  const rooms = asArray(r.rooms, opts, `${opts.source}.rooms`).map((room, i) =>
    validateRoom(room, { ...opts, source: `${opts.source}.rooms[${i}]` }),
  );

  if (rooms.length === 0) {
    throwOrWarn(opts, 'rooms.json declares zero rooms — every Universe needs at least one');
  }

  return { version, entryRoom, rooms };
}

function validateRoom(raw: unknown, opts: RoomsValidateOptions): RoomSpec {
  const r = asObject(raw, opts, opts.source);
  const id = asString(r.id, opts, `${opts.source}.id`, 'room');

  // Backwards-compat: a missing `area` field falls back to the manifest's
  // defaultArea. We log a soft warning so authors notice during migration.
  let area: string;
  if (typeof r.area === 'string' && r.area.length > 0) {
    area = r.area;
  } else {
    area = opts.defaultArea;
    if (opts.lenient) {
      // eslint-disable-next-line no-console
      console.warn(
        `[substrate/schema] ${opts.source}: missing 'area' — backfilling with manifest.defaultArea='${area}' for backwards-compat`,
      );
    }
  }

  const displayName = asString(r.displayName, opts, `${opts.source}.displayName`, id);
  const displayNameEn = optString(r.displayNameEn);
  const description = optString(r.description);

  const anchorRaw = asObject(r.anchor ?? { x: 0, y: 0, z: 0 }, opts, `${opts.source}.anchor`);
  const anchor = {
    x: asNumber(anchorRaw.x, opts, `${opts.source}.anchor.x`, 0),
    y: asNumber(anchorRaw.y, opts, `${opts.source}.anchor.y`, 0),
    z: asNumber(anchorRaw.z, opts, `${opts.source}.anchor.z`, 0),
  };

  let cameraBounds: { panRangeX: number; panRangeY: number } | undefined;
  if (r.cameraBounds && typeof r.cameraBounds === 'object') {
    const cb = r.cameraBounds as Record<string, unknown>;
    cameraBounds = {
      panRangeX: asNumber(cb.panRangeX, opts, `${opts.source}.cameraBounds.panRangeX`, 1.6),
      panRangeY: asNumber(cb.panRangeY, opts, `${opts.source}.cameraBounds.panRangeY`, 0.6),
    };
  }

  const biomeKey =
    typeof r.biomeKey === 'string' && r.biomeKey.length > 0
      ? r.biomeKey
      : r.biomeKey === null
        ? null
        : undefined;

  const exits = Array.isArray(r.exits)
    ? r.exits.map((e, i) => validateExit(e, { ...opts, source: `${opts.source}.exits[${i}]` }))
    : [];

  return { id, area, displayName, displayNameEn, description, anchor, cameraBounds, biomeKey, exits };
}

function validateExit(raw: unknown, opts: RoomsValidateOptions): RoomExit {
  const r = asObject(raw, opts, opts.source);
  return {
    to: asString(r.to, opts, `${opts.source}.to`, ''),
    via: asString(r.via, opts, `${opts.source}.via`, 'path'),
    distance: asNumber(r.distance, opts, `${opts.source}.distance`, 1),
  };
}
