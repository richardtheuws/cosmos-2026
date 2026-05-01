/**
 * Keyboard input — strict, polled. Phaser has its own input but we want a
 * frame-stable snapshot that the controller reads at fixed steps.
 *
 * Sprint 7B: virtual input layer (touch overlay) feeds in via setVirtualInput().
 * Keyboard and virtual are unioned (OR) — either source can trigger any action.
 */
export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  jumpJustPressed: boolean;
  bomb: boolean;
  bombJustPressed: boolean;
  panUp: boolean;
  panDown: boolean;
}

/** Virtual input from on-screen controls. Each field is a hold-state; just-pressed
 *  edges are derived inside InputController so callers don't need to do timing. */
export interface VirtualInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  bomb: boolean;
}

export class InputController {
  state: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    jumpJustPressed: false,
    bomb: false,
    bombJustPressed: false,
    panUp: false,
    panDown: false,
  };
  /** Keyboard-only state (raw). Unioned with virtual to produce `state`. */
  private kb = {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    bomb: false,
  };
  /** Virtual-only state (raw). */
  private virt: VirtualInput = {
    left: false,
    right: false,
    jump: false,
    bomb: false,
  };
  private prevJump = false;
  private prevBomb = false;

  attach(): void {
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
  }

  /** Sprint 7B — touch overlay calls this every pointer event with the new
   *  virtual-input snapshot. Just-pressed edges are derived in mergeAndSync(). */
  setVirtualInput(v: Partial<VirtualInput>): void {
    if (v.left !== undefined) this.virt.left = v.left;
    if (v.right !== undefined) this.virt.right = v.right;
    if (v.jump !== undefined) this.virt.jump = v.jump;
    if (v.bomb !== undefined) this.virt.bomb = v.bomb;
    this.mergeAndSync();
  }

  /** Call once per frame, AFTER reading the JustPressed flags in the controller. */
  postFrame(): void {
    this.state.jumpJustPressed = false;
    this.state.bombJustPressed = false;
    this.prevJump = this.state.jump;
    this.prevBomb = this.state.bomb;
  }

  /** Recompute the public `state` as the union of keyboard + virtual sources.
   *  Just-pressed edges fire on the rising edge of the unioned signal. */
  private mergeAndSync(): void {
    const left = this.kb.left || this.virt.left;
    const right = this.kb.right || this.virt.right;
    const up = this.kb.up;
    const down = this.kb.down;
    const jump = this.kb.jump || this.virt.jump;
    const bomb = this.kb.bomb || this.virt.bomb;

    if (jump && !this.prevJump) this.state.jumpJustPressed = true;
    if (bomb && !this.prevBomb) this.state.bombJustPressed = true;

    this.state.left = left;
    this.state.right = right;
    this.state.up = up;
    this.state.down = down;
    this.state.jump = jump;
    this.state.bomb = bomb;
    // panUp/panDown stay keyboard-only — touch users don't need vertical pan.
    this.state.panUp = this.kb.up;
    this.state.panDown = this.kb.down;
  }

  private onKey = (e: KeyboardEvent): void => {
    const down = e.type === 'keydown';
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.kb.left = down;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.kb.right = down;
        break;
      case 'ArrowUp':
      case 'KeyW':
        this.kb.up = down;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.kb.down = down;
        break;
      case 'Space':
      case 'KeyZ':
        this.kb.jump = down;
        e.preventDefault();
        break;
      case 'KeyX':
      case 'AltLeft':
        this.kb.bomb = down;
        e.preventDefault();
        break;
      default:
        return;
    }
    this.mergeAndSync();
  };
}
