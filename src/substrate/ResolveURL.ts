/**
 * URL grammar parser per architect §2.1 + §2.2.
 *
 * Resolution is left-to-right: invalid universe → forest, invalid area →
 * universe.defaultArea (or first), invalid room → entryRoom (or area's first).
 * Each fallback fires `console.warn` and the caller updates `history.replaceState`
 * so the URL self-heals.
 */
import type { AreasManifest, Manifest, RoomsManifest } from './contracts/BehaviorContract';

export interface URLRequest {
  universe?: string;
  area?: string;
  room?: string;
}

export interface ResolvedURL {
  universe: string;
  area: string;
  room: string;
  /** True if any input id was rewritten by fallback. The caller should
   *  push history.replaceState so the URL reflects what loaded. */
  changed: boolean;
}

export const DEFAULT_UNIVERSE = 'forest';

export function parseURLRequest(search: string): URLRequest {
  const sp = new URLSearchParams(search);
  const u = sp.get('universe');
  const a = sp.get('area');
  const r = sp.get('room');
  return {
    universe: u && u.length > 0 ? u : undefined,
    area: a && a.length > 0 ? a : undefined,
    room: r && r.length > 0 ? r : undefined,
  };
}

export interface ResolveCtx {
  /** Universe ids known to the substrate (folders under `universes/`). */
  knownUniverses: ReadonlySet<string>;
  /** Loader that fetches a universe's manifest+areas+rooms by id. */
  loadUniverseManifests(universeId: string): Promise<{
    manifest: Manifest;
    areas: AreasManifest;
    rooms: RoomsManifest;
  } | null>;
}

/** Resolve a URL request against actual manifests. Performs the full
 *  left-to-right fallback chain. The returned `universe` is guaranteed to
 *  be a known universe; `area` is guaranteed to belong to it; `room` is
 *  guaranteed to belong to the area. */
export async function resolveURLRequest(req: URLRequest, ctx: ResolveCtx): Promise<ResolvedURL> {
  const requestedUniverse = req.universe ?? DEFAULT_UNIVERSE;
  let changed = req.universe === undefined;

  // Step 1 — resolve universe.
  let universe = requestedUniverse;
  if (!ctx.knownUniverses.has(universe)) {
    // eslint-disable-next-line no-console
    console.warn(`[substrate] universe '${requestedUniverse}' not found, falling back to '${DEFAULT_UNIVERSE}'`);
    universe = DEFAULT_UNIVERSE;
    changed = true;
  }

  let manifests = await ctx.loadUniverseManifests(universe);
  if (!manifests) {
    // The default universe couldn't load either — fatal, the loader handles.
    throw new Error(`[substrate] default universe '${DEFAULT_UNIVERSE}' failed to load`);
  }

  // Step 2 — resolve area.
  const requestedArea = req.area ?? manifests.manifest.defaultArea;
  const areaSpec =
    manifests.areas.areas.find((a) => a.id === requestedArea) ??
    fallbackArea(manifests.areas, manifests.manifest.defaultArea);
  if (areaSpec.id !== requestedArea) {
    // eslint-disable-next-line no-console
    console.warn(
      `[substrate] area '${requestedArea}' not found in universe '${universe}', falling back to '${areaSpec.id}'`,
    );
    changed = true;
  } else if (req.area === undefined) {
    changed = true;
  }
  // Punch-list #4: warn when manifest.defaultArea and areas.entryArea disagree.
  if (manifests.areas.entryArea !== manifests.manifest.defaultArea) {
    // eslint-disable-next-line no-console
    console.warn(
      `[substrate] manifest.defaultArea='${manifests.manifest.defaultArea}' disagrees with areas.entryArea='${manifests.areas.entryArea}' — using manifest (parent contract wins).`,
    );
  }
  const area = areaSpec.id;

  // Step 3 — resolve room.
  const areaRoomIds = new Set(areaSpec.rooms);
  const requestedRoom = req.room ?? roomEntryFor(areaSpec, manifests.rooms);
  const roomCandidate =
    manifests.rooms.rooms.find((r) => r.id === requestedRoom && areaRoomIds.has(r.id)) ??
    manifests.rooms.rooms.find((r) => areaRoomIds.has(r.id));
  if (!roomCandidate) {
    throw new Error(
      `[substrate] universe '${universe}' area '${area}' has zero valid rooms — manifest is broken`,
    );
  }
  if (roomCandidate.id !== requestedRoom) {
    // eslint-disable-next-line no-console
    console.warn(
      `[substrate] room '${requestedRoom}' not found in area '${area}', falling back to '${roomCandidate.id}'`,
    );
    changed = true;
  } else if (req.room === undefined) {
    changed = true;
  }

  return { universe, area, room: roomCandidate.id, changed };
}

function fallbackArea(
  areas: AreasManifest,
  defaultArea: string,
): AreasManifest['areas'][number] {
  return (
    areas.areas.find((a) => a.id === defaultArea) ??
    areas.areas.find((a) => a.id === areas.entryArea) ??
    areas.areas[0]
  );
}

function roomEntryFor(area: AreasManifest['areas'][number], rooms: RoomsManifest): string {
  // Prefer manifest.entryRoom if it's in this area; otherwise first listed room of area.
  if (area.rooms.includes(rooms.entryRoom)) return rooms.entryRoom;
  return area.rooms[0] ?? rooms.entryRoom;
}

/** Push an URL update with the resolved triple via `history.replaceState`.
 *  The substrate flag stays put — only universe/area/room are rewritten. */
export function syncURL(resolved: ResolvedURL): void {
  if (typeof window === 'undefined' || typeof history === 'undefined') return;
  const sp = new URLSearchParams(window.location.search);
  sp.set('substrate', 'v2');
  sp.set('universe', resolved.universe);
  sp.set('area', resolved.area);
  sp.set('room', resolved.room);
  const next = `${window.location.pathname}?${sp.toString()}${window.location.hash}`;
  history.replaceState(null, '', next);
}
