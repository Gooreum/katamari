export function formatSize(meters: number): string {
  return meters < 1 ? `${(meters * 100).toFixed(1)}cm` : `${meters.toFixed(2)}m`;
}

export class Hud {
  private sizeEl = document.getElementById('size')!;
  private statEl = document.getElementById('stat')!;
  private feedEl = document.getElementById('feed')!;
  private lastSize = '';
  private lastStat = '';
  /** 다음 "두 배" 지점. 넘을 때마다 숫자가 한 번 튄다. */
  private nextMilestone = 0;

  update(diameter: number, count: number, elapsed: number, drawCalls: number, attached = 0): void {
    // DOM 쓰기는 값이 바뀔 때만. 매 프레임 textContent 대입은 레이아웃을 유발한다.
    if (this.nextMilestone === 0) this.nextMilestone = diameter * 2;
    if (diameter >= this.nextMilestone) {
      this.nextMilestone = diameter * 2;
      // 애니메이션 재시작을 강제하려면 클래스를 뗐다가 리플로우를 한 번 태워야 한다
      this.sizeEl.classList.remove('punch');
      void this.sizeEl.offsetWidth;
      this.sizeEl.classList.add('punch');
    }

    const size = formatSize(diameter);
    if (size !== this.lastSize) {
      this.sizeEl.textContent = size;
      this.lastSize = size;
    }
    const mm = Math.floor(elapsed / 60);
    const ss = String(Math.floor(elapsed % 60)).padStart(2, '0');
    const stat = `${count} objects · ${mm}:${ss} · ${drawCalls} draws · ${attached} on surface`;
    if (stat !== this.lastStat) {
      this.statEl.textContent = stat;
      this.lastStat = stat;
    }
  }

  logPickup(label: string, size: number): void {
    const el = document.createElement('div');
    el.className = 'eat';
    el.textContent = `${label}  ${formatSize(size)}`;
    this.feedEl.appendChild(el);
    setTimeout(() => el.remove(), 2100);
    while (this.feedEl.children.length > 6) this.feedEl.firstElementChild!.remove();
  }
}
