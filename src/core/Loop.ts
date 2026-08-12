/**
 * 고정 타임스텝 루프.
 *
 * 시뮬은 항상 1/60초 단위로 돈다 — 30Hz 폰이든 120Hz 아이패드든 물리 감각이 동일하다.
 * 렌더는 가변이고, alpha(0..1)로 두 스텝 사이를 보간해서 화면이 부드럽다.
 *
 * 렌더 dt에 물리를 묶으면 나중에 절대 못 고친다. 지금 깔고 가는 게 맞다.
 */
export class Loop {
  private accumulator = 0;
  private last = 0;
  private running = false;
  private rafId = 0;

  constructor(
    private readonly stepSeconds: number,
    private readonly onStep: (dt: number) => void,
    private readonly onRender: (alpha: number, frameDt: number) => void,
    /** 한 프레임에 허용할 최대 시뮬 스텝 수. 탭 복귀 시 death spiral 방지. */
    private readonly maxSteps = 5,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.accumulator = 0;
    this.tick(this.last);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    // 250ms 넘게 벌어진 건 버린다 (백그라운드 탭에서 돌아온 경우)
    const frameDt = Math.min((now - this.last) / 1000, 0.25);
    this.last = now;
    this.accumulator += frameDt;

    let steps = 0;
    while (this.accumulator >= this.stepSeconds && steps < this.maxSteps) {
      this.onStep(this.stepSeconds);
      this.accumulator -= this.stepSeconds;
      steps++;
    }
    if (steps === this.maxSteps) this.accumulator = 0;

    this.onRender(this.accumulator / this.stepSeconds, frameDt);
  };
}

/** 프레임레이트 독립 감쇠 계수. lerp(a, b, damp(rate, dt)) 형태로 쓴다. */
export function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}
