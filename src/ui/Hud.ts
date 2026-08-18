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

  /**
   * @param target    목표 지름(m). 원작 HUD의 절반이 이 숫자다
   * @param remaining 남은 시간(초). `null`이면 무제한 스테이지 — 시계를 아예 안 띄운다
   *                  (원작 1스테이지가 그렇다. 조작을 배우는 판에 시계를 붙이지 않는다)
   */
  update(
    diameter: number, count: number, elapsed: number, drawCalls: number,
    attached = 0, target = 0, remaining: number | null = null,
  ): void {
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
    // 시계는 **남은 시간**을 보여준다. 경과 시간은 제한이 있는 판에서 아무 정보도 아니다.
    const clock = remaining === null
      ? `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`
      : `남은 ${Math.floor(Math.max(0, remaining) / 60)}:${String(Math.floor(Math.max(0, remaining) % 60)).padStart(2, '0')}`;
    const goal = target > 0 ? `목표 ${formatSize(target)} · ` : '';
    const stat = `${goal}${clock} · ${count}개 · ${drawCalls} draws · ${attached} on surface`;
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
