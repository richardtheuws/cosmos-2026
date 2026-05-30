import { describe, expect, it } from 'vitest';
import { resolveMood } from './ResolveMood';
import type { AreaSpec, Manifest, PostPreset } from './contracts/BehaviorContract';

function manifest(preset: PostPreset, intensityCurve?: Manifest['post']['intensityCurve']): Manifest {
  return {
    version: '1.1',
    name: 'u',
    displayName: 'U',
    author: 'test',
    license: 'MIT',
    defaultArea: 'a',
    brandDeviation: null,
    assets: [],
    post: { preset, intensityCurve },
  };
}

function area(over: Partial<AreaSpec> = {}): AreaSpec {
  return {
    id: 'a',
    displayName: 'A',
    moodOverrides: null,
    pathExperience: { kind: 'fade', duration: 1, ambient: '#000' },
    rooms: ['r'],
    ...over,
  };
}

describe('resolveMood — preset palettes', () => {
  it('calm-baseline yields the locked calm palette + intensity', () => {
    const m = resolveMood(manifest('calm-baseline'), area());
    expect(m.ambient).toBe('#F5EDD8');
    expect(m.primary).toBe('#D8A4B5');
    expect(m.post).toEqual({ bloom: 1.0, kaleido: 0.85, fluid: 0.9, chroma: 1.0 });
  });

  it('deep-trip yields the deep-trip palette + intensity', () => {
    const m = resolveMood(manifest('deep-trip'), area());
    expect(m.ambient).toBe('#1B0F2A');
    expect(m.post).toEqual({ bloom: 1.4, kaleido: 1.3, fluid: 1.2, chroma: 1.4 });
  });

  it('an unknown preset object defaults to the calm-baseline palette', () => {
    const m = resolveMood(manifest('wild' as PostPreset), area());
    expect(m.ambient).toBe('#F5EDD8');
    expect(m.post.bloom).toBe(1.0);
  });
});

describe('resolveMood — intensityCurve override', () => {
  it('manifest.post.intensityCurve overrides the preset intensity per key', () => {
    const m = resolveMood(manifest('calm-baseline', { bloom: 2.0, kaleido: 0.5, fluid: 0.9, chroma: 1.0 }), area());
    expect(m.post.bloom).toBe(2.0);
    expect(m.post.kaleido).toBe(0.5);
  });
});

describe('resolveMood — area moodOverrides', () => {
  it('overrides ambient/primary and merges per-key post; absent keys inherit', () => {
    const m = resolveMood(
      manifest('calm-baseline'),
      area({ moodOverrides: { ambient: '#112233', post: { bloom: 1.9 } } }),
    );
    expect(m.ambient).toBe('#112233');
    expect(m.primary).toBe('#D8A4B5'); // inherited (no override)
    expect(m.post.bloom).toBe(1.9); // overridden
    expect(m.post.kaleido).toBe(0.85); // inherited from preset
  });
});

describe('resolveMood — reserved room param', () => {
  it('ignores the _room argument without throwing or changing output', () => {
    const withoutRoom = resolveMood(manifest('calm-baseline'), area());
    const withRoom = resolveMood(manifest('calm-baseline'), area(), {
      id: 'r',
      displayName: 'R',
      anchor: { x: 0, y: 0, z: 0 },
    });
    expect(withRoom).toEqual(withoutRoom);
  });
});
