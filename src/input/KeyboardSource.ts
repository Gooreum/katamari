import type { InputSource, InputState } from '../core/Input';

const BLOCKED = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space',
]);

export class KeyboardSource implements InputSource {
  private down = new Set<string>();

  constructor(private readonly target: EventTarget = window) {
    target.addEventListener('keydown', this.onDown as EventListener);
    target.addEventListener('keyup', this.onUp as EventListener);
    target.addEventListener('blur', this.onBlur);
  }

  private onDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    this.down.add(e.code);
    if (BLOCKED.has(e.code)) e.preventDefault();
  };

  private onUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
  };

  /** 창 포커스를 잃으면 키가 눌린 채로 남는다. 흔한 버그. */
  private onBlur = (): void => {
    this.down.clear();
  };

  sample(out: InputState): void {
    const d = this.down;
    if (d.has('KeyW')) out.moveY += 1;
    if (d.has('KeyS')) out.moveY -= 1;
    if (d.has('KeyD')) out.moveX += 1;
    if (d.has('KeyA')) out.moveX -= 1;
    // 방향키는 공이 아니라 **카메라**를 움직인다.
    // 예전에는 WASD 별칭이라 시점을 조준할 방법이 아예 없었고,
    // 카메라는 진행 방향을 느리게 따라가기만 했다 — 그게 "조작이 어렵다"의 정체였다.
    if (d.has('ArrowRight')) out.lookX += 1;
    if (d.has('ArrowLeft')) out.lookX -= 1;
    if (d.has('ArrowUp')) out.lookY += 1;
    if (d.has('ArrowDown')) out.lookY -= 1;
    if (d.has('ShiftLeft') || d.has('ShiftRight')) out.dash = true;
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onDown as EventListener);
    this.target.removeEventListener('keyup', this.onUp as EventListener);
    this.target.removeEventListener('blur', this.onBlur);
    this.down.clear();
  }
}
