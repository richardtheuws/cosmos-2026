/**
 * DefaultArrival — architect §7.2.
 *
 * 1.4s portal arrival, hue derived from manifest.post.preset:
 *   calm-baseline → 0.62 (faded-rose nebula)
 *   deep-trip     → 0.48 (saffron)
 *   neutral       → 0.55
 *
 * The actual portal painting is delegated to PortalTransition (which wraps
 * NebulaPortal). DefaultArrival just returns the ArrivalAnimation descriptor;
 * the substrate's UniverseHost runs it.
 */
import type { ArrivalAnimation, ArrivalCtx } from '../contracts/BehaviorContract';
import type { PostPreset } from '../contracts/BehaviorContract';

export function defaultArrival(_ctx: ArrivalCtx, preset: PostPreset): ArrivalAnimation {
  void _ctx;
  const hue =
    preset === 'deep-trip' ? 0.48 : preset === 'neutral' ? 0.55 : 0.62;
  return { kind: 'portal', duration: 1.4, hue };
}
