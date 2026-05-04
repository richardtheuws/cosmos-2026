/**
 * Universe↔Universe transition — architect §4.3 + §8.1 option A.
 *
 * Wraps the existing Phaser-side NebulaPortal. The substrate's caller looks
 * up the active Phaser scene (already in main.ts as
 * `phaserGame.scene.getScene('CosmoScene')`) and passes it in here.
 *
 * Lifecycle: 1.6s open + 0.3s hold + 0.6s close = 2.5s total. The hold is
 * where the next Universe loads (PreloadManager runs during this window in
 * future waves; today we just sit on the hold for ceremonial weight).
 */
import type Phaser from 'phaser';
import { NebulaPortal } from '../../phaser/entities/NebulaPortal';
import type { TransitionDriver } from '../contracts/BehaviorContract';

export class PortalTransition implements TransitionDriver {
  private portal: NebulaPortal | null = null;
  private rafHandle = 0;

  constructor(
    private phaserScene: Phaser.Scene,
    private hue = 0.62,
    private openMs = 1600,
    private holdMs = 300,
    private closeMs = 600,
  ) {
    void this.hue; // hue intentionally consumed by NebulaPortal palette in a future tweak
  }

  async run(_dt: number): Promise<void> {
    void _dt;
    return new Promise<void>((resolve) => {
      this.portal = new NebulaPortal(this.phaserScene);
      this.portal.open(this.openMs);

      const start = performance.now();
      const tick = (now: number): void => {
        const elapsed = now - start;
        if (this.portal && this.portal.isActive()) {
          // The portal has its own update loop hook the substrate must drive.
          // We use a small dt approximation since NebulaPortal expects seconds.
          this.portal.update(0.016);
        }
        const totalMs = this.openMs + this.holdMs;
        if (elapsed >= totalMs) {
          this.portal?.close(this.closeMs);
          // After close fires, NebulaPortal auto-disposes when its fade hits 0.
          // Wait the close window then resolve.
          setTimeout(() => resolve(), this.closeMs + 80);
          return;
        }
        this.rafHandle = requestAnimationFrame(tick);
      };
      this.rafHandle = requestAnimationFrame(tick);
    });
  }

  dispose(): void {
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
    this.portal?.dispose();
    this.portal = null;
  }
}
