/**
 * DefaultInteractables — architect §7.4. Empty by default; authors override
 * via `behavior.interactables(ctx)` to ship the trampoline-analog.
 */
import type { InteractableHandle } from '../contracts/BehaviorContract';

export function defaultInteractables(): InteractableHandle[] {
  return [];
}
