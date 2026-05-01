/**
 * Keyboard input — strict, polled. Phaser has its own input but we want a
 * frame-stable snapshot that the controller reads at fixed steps.
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

  /** Call once per frame, AFTER reading the JustPressed flags in the controller. */
  postFrame(): void {
    this.state.jumpJustPressed = false;
    this.state.bombJustPressed = false;
    this.prevJump = this.state.jump;
    this.prevBomb = this.state.bomb;
  }

  private onKey = (e: KeyboardEvent): void => {
    const down = e.type === 'keydown';
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.state.left = down;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.state.right = down;
        break;
      case 'ArrowUp':
      case 'KeyW':
        this.state.up = down;
        this.state.panUp = down;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.state.down = down;
        this.state.panDown = down;
        break;
      case 'Space':
      case 'KeyZ':
        if (down && !this.prevJump) this.state.jumpJustPressed = true;
        this.state.jump = down;
        e.preventDefault();
        break;
      case 'KeyX':
      case 'AltLeft':
        if (down && !this.prevBomb) this.state.bombJustPressed = true;
        this.state.bomb = down;
        e.preventDefault();
        break;
    }
  };
}
