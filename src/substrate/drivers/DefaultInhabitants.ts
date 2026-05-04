/**
 * DefaultInhabitants — architect §7.3 returns an empty array. A Room with no
 * inhabitants is valid; the brand quality bar lives at the Room-level review,
 * not at the substrate floor.
 */
import type { InhabitantHandle } from '../contracts/BehaviorContract';

export function defaultInhabitants(): InhabitantHandle[] {
  return [];
}
