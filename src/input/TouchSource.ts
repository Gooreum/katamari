import type { InputSource, InputState } from '../core/Input';

const RADIUS = 56;      // 스틱 최대 이동 반경(px)
const DEADZONE = 0.12;
const DASH_AT = 0.92;   // 스틱을 끝까지 밀면 대시

/**
 * 화면 아무 데나 누르면 그 자리에 생기는 플로팅 조이스틱.
 * 고정 위치 조이스틱보다 엄지 위치에 관대해서 실사용 만족도가 높다.
 *
 * 이 파일이 존재한다는 것 자체가 입력 추상화가 값을 한다는 증거다 —
 * 게임 로직은 한 줄도 안 바뀐다.
 */
export class TouchSource implements InputSource {
  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private curX = 0;
  private curY = 0;

  private readonly root: HTMLElement;
  private readonly base: HTMLElement;
  private readonly knob: HTMLElement;

  constructor(private readonly surface: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'stick';
    this.base = document.createElement('div');
    this.base.className = 'stick-base';
    this.knob = document.createElement('div');
    this.knob.className = 'stick-knob';
    this.root.append(this.base, this.knob);
    this.root.style.display = 'none';
    document.body.appendChild(this.root);

    surface.addEventListener('pointerdown', this.onDown);
    surface.addEventListener('pointermove', this.onMove);
    surface.addEventListener('pointerup', this.onUp);
    surface.addEventListener('pointercancel', this.onUp);
  }

  private onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' || this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.originX = this.curX = e.clientX;
    this.originY = this.curY = e.clientY;
    this.root.style.display = 'block';
    this.render();
    this.surface.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.curX = e.clientX;
    this.curY = e.clientY;
    this.render();
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.root.style.display = 'none';
  };

  private render(): void {
    const { x, y, mag } = this.vector();
    this.base.style.transform = `translate(${this.originX}px, ${this.originY}px)`;
    this.knob.style.transform =
      `translate(${this.originX + x * RADIUS * mag}px, ${this.originY + y * RADIUS * mag}px)`;
  }

  private vector(): { x: number; y: number; mag: number } {
    const dx = this.curX - this.originX;
    const dy = this.curY - this.originY;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return { x: 0, y: 0, mag: 0 };
    const mag = Math.min(dist / RADIUS, 1);
    return { x: dx / dist, y: dy / dist, mag };
  }

  sample(out: InputState): void {
    if (this.pointerId === null) return;
    const { x, y, mag } = this.vector();
    if (mag < DEADZONE) return;

    // 데드존 바깥을 0..1로 다시 펴준다 — 안 하면 최소 입력이 툭 튄다
    const scaled = (mag - DEADZONE) / (1 - DEADZONE);
    out.moveX += x * scaled;
    out.moveY += -y * scaled;   // 화면 y는 아래가 +
    if (mag > DASH_AT) out.dash = true;
  }

  dispose(): void {
    this.surface.removeEventListener('pointerdown', this.onDown);
    this.surface.removeEventListener('pointermove', this.onMove);
    this.surface.removeEventListener('pointerup', this.onUp);
    this.surface.removeEventListener('pointercancel', this.onUp);
    this.root.remove();
  }
}
