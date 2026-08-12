/**
 * 인게임 계측.  T = 토글,  C = CSV 클립보드 복사
 *
 * tools/curve.ts는 "탐욕적 플레이어" 모델이라 이론적 상한에 가깝다.
 * 이건 실제 플레이 곡선이라 둘을 비교해야 한다 —
 * 모델이 매끄러운데 실플레이가 계단이면 문제는 분포가 아니라 레벨 배치다.
 *
 * 세로축은 로그 스케일. 목표는 직선이다.
 */
export class Telemetry {
  private samples: Array<{ t: number; d: number; n: number }> = [];
  private doubles: Array<{ from: number; to: number; dt: number; n: number }> = [];
  private anchor = { t: 0, d: 0, n: 0 };
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private panel: HTMLElement;
  private readout: HTMLElement;
  private visible = false;
  private dirty = true;

  constructor(startDiameter: number) {
    this.anchor = { t: 0, d: startDiameter, n: 0 };
    this.samples.push({ t: 0, d: startDiameter, n: 0 });

    this.panel = document.createElement('div');
    this.panel.className = 'telemetry';
    this.canvas = document.createElement('canvas');
    this.canvas.width = 300;
    this.canvas.height = 130;
    this.readout = document.createElement('div');
    this.readout.className = 'telemetry-rows';
    this.panel.append(this.canvas, this.readout);
    document.body.appendChild(this.panel);
    this.panel.style.display = 'none';
    this.ctx = this.canvas.getContext('2d')!;

    addEventListener('keydown', this.onKey);
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.code === 'KeyT') {
      this.visible = !this.visible;
      this.panel.style.display = this.visible ? 'block' : 'none';
      this.dirty = true;
    }
    if (e.code === 'KeyC' && this.visible) void this.copyCsv();
  };

  record(t: number, diameter: number, count: number): void {
    this.samples.push({ t, d: diameter, n: count });
    if (diameter >= this.anchor.d * 2) {
      this.doubles.push({
        from: this.anchor.d,
        to: diameter,
        dt: t - this.anchor.t,
        n: count - this.anchor.n,
      });
      this.anchor = { t, d: diameter, n: count };
    }
    this.dirty = true;
  }

  /** 렌더 루프에서 호출. 숨겨져 있으면 아무것도 안 한다. */
  draw(): void {
    if (!this.visible || !this.dirty) return;
    this.dirty = false;

    const { ctx, canvas } = this;
    const w = canvas.width, h = canvas.height;
    const pad = 4;
    ctx.clearRect(0, 0, w, h);

    const last = this.samples[this.samples.length - 1]!;
    const tMax = Math.max(last.t, 10);
    const dMin = this.samples[0]!.d;
    const dMax = Math.max(last.d, dMin * 4);
    const logMin = Math.log(dMin), logSpan = Math.log(dMax) - logMin || 1;

    const px = (t: number) => pad + (t / tMax) * (w - pad * 2);
    const py = (d: number) => h - pad - ((Math.log(d) - logMin) / logSpan) * (h - pad * 2);

    // 두 배 지점마다 가로선 — 간격이 고르면 곡선이 매끄러운 것
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = 1;
    for (let d = dMin * 2; d <= dMax; d *= 2) {
      const y = Math.round(py(d)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(w - pad, y);
      ctx.stroke();
    }

    // 완벽한 지수 성장 = 이 대각선
    ctx.strokeStyle = 'rgba(255,217,61,.45)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px(0), py(dMin));
    ctx.lineTo(px(last.t), py(last.d));
    ctx.stroke();
    ctx.setLineDash([]);

    // 실측
    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // 샘플이 수천 개라도 픽셀 수만큼만 그린다
    const stride = Math.max(1, Math.floor(this.samples.length / w));
    for (let i = 0; i < this.samples.length; i += stride) {
      const s = this.samples[i]!;
      i === 0 ? ctx.moveTo(px(s.t), py(s.d)) : ctx.lineTo(px(s.t), py(s.d));
    }
    ctx.lineTo(px(last.t), py(last.d));
    ctx.stroke();

    const dts = this.doubles.map((x) => x.dt);
    const mean = dts.reduce((a, b) => a + b, 0) / (dts.length || 1);
    const cv = dts.length
      ? Math.sqrt(dts.reduce((a, b) => a + (b - mean) ** 2, 0) / dts.length) / mean
      : 0;

    const rows = this.doubles.slice(-6).map((r) =>
      `<span>×2</span><b>${r.dt.toFixed(1)}s</b><i>${r.n}개</i>`,
    );
    this.readout.innerHTML =
      `<div class="telemetry-cv">CV ${cv.toFixed(3)} · ${this.doubles.length} doublings</div>` +
      rows.map((r) => `<div class="telemetry-row">${r}</div>`).join('') +
      `<div class="telemetry-hint">C: CSV 복사</div>`;
  }

  private async copyCsv(): Promise<void> {
    const csv = ['t,diameter,eaten', ...this.samples.map((s) =>
      `${s.t.toFixed(3)},${s.d.toFixed(5)},${s.n}`)].join('\n');
    try {
      await navigator.clipboard.writeText(csv);
      this.readout.querySelector('.telemetry-hint')!.textContent =
        `${this.samples.length}행 복사됨`;
    } catch {
      console.log(csv);
      this.readout.querySelector('.telemetry-hint')!.textContent = '콘솔에 출력됨';
    }
  }

  dispose(): void {
    removeEventListener('keydown', this.onKey);
    this.panel.remove();
  }
}
