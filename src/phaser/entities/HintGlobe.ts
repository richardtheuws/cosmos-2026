/**
 * HintGlobe. Floating bobbing orb that triggers an ElevenLabs voice-line on
 * proximity. One-shot per Globe per visit (re-triggerable on revisit). Visually
 * a soft saffron orb with a sky-wash core and slow pulse.
 */
import Phaser from 'phaser';

export class HintGlobe {
  sprite: Phaser.GameObjects.Image;
  private baseY: number;
  private wobblePhase: number;
  triggered = false;
  hintIdx: number;
  /** Prevents re-trigger spam while Cosmo lingers. Resets when he leaves the radius. */
  private lingerLatch = false;

  constructor(scene: Phaser.Scene, x: number, y: number, hintIdx: number, textureKey = 'hint-globe') {
    this.sprite = scene.add.image(x, y, textureKey);
    this.sprite.setDisplaySize(36, 36);
    this.sprite.setData('hint', this);
    this.baseY = y;
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.hintIdx = hintIdx;
  }

  update(time: number, cosmoX: number, cosmoY: number, onTrigger: (idx: number) => void): void {
    this.sprite.y = this.baseY + Math.sin(time * 0.0018 + this.wobblePhase) * 5;
    const pulse = 1 + Math.sin(time * 0.004 + this.wobblePhase) * 0.06;
    this.sprite.setScale(pulse);

    const dx = cosmoX - this.sprite.x;
    const dy = cosmoY - this.sprite.y;
    const distSq = dx * dx + dy * dy;
    const inRadius = distSq < 70 * 70;

    if (inRadius && !this.lingerLatch) {
      this.lingerLatch = true;
      onTrigger(this.hintIdx);
    } else if (!inRadius && this.lingerLatch && distSq > 110 * 110) {
      this.lingerLatch = false;
    }
  }
}
