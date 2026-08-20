import type { StageRule } from '../game/Stage';
import { isUnlocked } from '../game/Progress';
import { skyHtml } from './Sky';
import { formatSize } from './Hud';
import { escapeHtml } from './Result';

/**
 * 스테이지 선택 화면 — 어느 별을 주우러 갈지.
 *
 * 원작은 왕의 방에서 별을 고르고 지구로 내려간다. 그 구조만 가져왔다.
 * `Result`와 같은 규약을 쓴다 — `show()`에서 DOM을 만들고 `dispose()`로 거둔다.
 *
 * 행을 `<button>`으로 만든 건 취향이 아니라 **접근성이 공짜로 붙기 때문**이다.
 * Tab 이동·Enter/Space 실행·포커스 링이 브라우저에서 오고, `disabled` 하나가
 * "잠김"의 시각 표시와 조작 차단과 스크린리더 상태를 한꺼번에 처리한다.
 */
export class StageSelect {
  private el: HTMLElement | null = null;

  show(
    stages: readonly StageRule[],
    /** 판 id → 그 판에서 만든 최고 지름(m). 하늘에 뜰 별이 여기서 나온다 */
    stars: ReadonlyMap<string, number>,
    intro: string,
    onPick: (rule: StageRule) => void,
  ): void {
    if (this.el) return;   // 두 번 띄우지 않는다

    // 해금 판정은 크기를 안 본다 — 깼는지만 본다
    const cleared = new Set(stars.keys());

    const el = document.createElement('div');
    el.className = 'select';

    const rows = stages.map((s, i) => {
      const open = isUnlocked(s, cleared);
      const done = cleared.has(s.id);
      // 무제한을 "0분"으로 쓰면 거짓말이 된다 — 원작 1스테이지는 시계가 없다
      const limit = s.limit > 0 ? `${Math.round(s.limit / 60)}분` : '시간 무제한';
      return `
        <button class="select-row${open ? '' : ' locked'}" data-i="${i}"${open ? '' : ' disabled'}>
          <span class="select-star">${done ? '★' : open ? '☆' : '🔒'}</span>
          <span class="select-name">${escapeHtml(s.name)}</span>
          <span class="select-meta">목표 ${formatSize(s.target)} · ${limit}</span>
        </button>`;
    }).join('');

    // **하늘이 카드보다 먼저 와야 뒤에 깔린다.** 순서를 바꾸면 별이 카드를 덮는다.
    el.innerHTML = `
      ${skyHtml(stars)}
      <div class="select-card">
        <div class="select-head">별을 만들어라</div>
        <p class="select-king">${escapeHtml(intro)}</p>
        <div class="select-list">${rows}</div>
      </div>`;

    // 위임 — 행마다 리스너를 다는 것보다 짧고, 행이 늘어나도 안 바뀐다.
    // `disabled` 버튼은 클릭 이벤트 자체가 안 오지만, 자식 span 을 통해
    // 새는 경우가 브라우저마다 달라서 명시적으로 한 번 더 막는다.
    el.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.select-row');
      if (!btn || btn.hasAttribute('disabled')) return;
      const rule = stages[Number(btn.dataset['i'])];
      if (rule) onPick(rule);
    });

    document.body.appendChild(el);
    // 한 프레임 뒤에 클래스를 붙여야 전환이 돈다 (`Result`와 같은 이유)
    requestAnimationFrame(() => {
      el.classList.add('on');
      // **잠기지 않은 마지막 판**에 포커스. 이어서 하러 오는 게 보통이라
      // 첫 판에 두면 매번 한 칸씩 내려야 한다.
      const open = el.querySelectorAll<HTMLButtonElement>('.select-row:not([disabled])');
      open[open.length - 1]?.focus();
    });
    this.el = el;
  }

  dispose(): void {
    this.el?.remove();
    this.el = null;
  }
}
