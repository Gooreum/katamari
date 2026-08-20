import type { Script } from '../narrative/Narrator';
import { nextStage, type StageNav, type StageOutcome, type StageRule } from '../game/Stage';
import { formatSize } from './Hud';

export interface Summary {
  diameter: number;
  count: number;
  biggest: string;
  elapsed: number;
}

/**
 * 결과 화면 — 왕의 평가.
 *
 * `Game.summary`가 예전부터 이걸 기다리고 있었고("결과 화면이 붙으면 여기서
 * 가져간다"), 대본에도 `result.units` / `result.verdicts`가 준비돼 있었다.
 * 새로 만든 건 DOM뿐이다.
 *
 * `Subtitle`과 같은 규약을 쓴다 — 생성자에서 DOM을 만들고 `dispose()`로 거둔다.
 * `index.html`에 자리를 잡아두지 않는 이유는 이 화면이 한 판에 한 번만
 * 필요하고, 없을 때 빈 껍데기가 문서에 남아 있을 이유가 없어서다.
 */
export class Result {
  private el: HTMLElement | null = null;

  show(
    rule: StageRule, outcome: Exclude<StageOutcome, null>,
    summary: Summary, script: Script, nav?: StageNav,
    /** 이 판의 **이전** 최고 지름(m). 0이면 첫 클리어라 비교할 게 없다 */
    best = 0,
  ): void {
    if (this.el) return;   // 두 번 띄우지 않는다

    const el = document.createElement('div');
    el.className = 'result';

    const cleared = outcome === 'cleared';
    // **평가는 결과가 아니라 크기로 고른다.** 시간이 다 됐어도 크게 굴렸으면
    // 왕은 그 크기에 대해 말한다 — 원작 왕은 성패보다 크기에 관심이 있다.
    const verdict = [...script.result.verdicts]
      .filter((v) => summary.diameter >= v.minDiameter)
      .sort((a, b) => b.minDiameter - a.minDiameter)[0]
      ?? script.result.verdicts[0]!;

    const value = (from: 'diameter' | 'count' | 'biggest' | 'time'): string => {
      switch (from) {
        case 'diameter': return formatSize(summary.diameter);
        case 'count': return `${summary.count}개`;
        case 'biggest': return summary.biggest;
        case 'time': {
          const m = Math.floor(summary.elapsed / 60);
          const s = String(Math.floor(summary.elapsed % 60)).padStart(2, '0');
          return `${m}:${s}`;
        }
      }
    };

    /**
     * 자기 기록. **첫 클리어(best 0)면 아무것도 안 보인다** — 비교할 게 없다.
     *
     * 원작에서 왕은 더 좋은 공을 가져오면 옛 별을 부수고 갈아 끼운다.
     * 그 교체가 일어났는지를 숫자로만 알려준다 — **왕의 대사는 안 늘린다.**
     * 대본에 없는 말을 여기서 지어내면 그때부터 왕이 두 사람이 된다.
     */
    const record = best <= 0 ? ''
      : summary.diameter > best
        ? `<p class="result-record new">최고 기록 경신 · 이전 ${formatSize(best)}</p>`
        : `<p class="result-record">이 판 최고 기록 ${formatSize(best)}</p>`;

    const rows = script.result.units
      .map((u) => `<dt>${u.label}</dt><dd>${escapeHtml(value(u.from))}</dd>`)
      .join('');

    /**
     * **다음 별은 깼을 때만 열린다.** 시간이 다 됐는데도 이어갈 수 있으면
     * 제한시간이 아무 의미가 없어진다. 마지막 판이면 `nextStage`가 null이다.
     */
    const next = cleared ? nextStage(rule) : null;
    // `nav`가 없는 경로(도구·테스트에서 화면만 확인)에서는 예전 힌트를 그대로 둔다.
    const actions = nav ? `
        <div class="result-actions">
          <button class="btn" data-act="select">스테이지 선택</button>
          <button class="btn" data-act="retry">다시</button>
          ${next ? `<button class="btn primary" data-act="next">다음 별로 · ${escapeHtml(next.name)}</button>` : ''}
        </div>`
      : '<div class="result-hint"><kbd>R</kbd> 다시</div>';

    el.innerHTML = `
      <div class="result-card">
        <div class="result-head">${escapeHtml(rule.name)}</div>
        <div class="result-verdict ${cleared ? 'ok' : 'fail'}">
          ${cleared ? '목표 달성' : '시간 종료'} · 목표 ${formatSize(rule.target)}
        </div>
        <dl class="result-stats">${rows}</dl>
        ${record}
        <p class="result-king">${escapeHtml(verdict.text)}</p>
        ${actions}
      </div>`;

    if (nav) {
      // 위임. 버튼이 세 개뿐이지만 조건부로 하나가 빠지므로 개별 바인딩은 분기가 늘어난다.
      el.addEventListener('click', (e) => {
        switch ((e.target as HTMLElement).closest<HTMLElement>('.btn')?.dataset['act']) {
          case 'next': if (next) nav.go(next); break;
          case 'retry': nav.go(rule); break;
          case 'select': nav.select(); break;
        }
      });
    }

    document.body.appendChild(el);
    // 한 프레임 뒤에 클래스를 붙여야 전환이 돈다 (붙이자마자 주면 초기 상태가 없다)
    requestAnimationFrame(() => {
      el.classList.add('on');
      // 기본 동작에 포커스 — 깼으면 「다음 별로」, 아니면 「다시」. Enter 한 번으로 이어진다.
      // 두 번 나눠 찾는 이유: `querySelector('a, b')`는 셀렉터 우선순위가 아니라
      // **문서 순서**로 고른다. 「다시」가 앞에 있어서 한 줄로 쓰면 그게 잡힌다.
      const pick = el.querySelector<HTMLButtonElement>('.btn.primary')
        ?? el.querySelector<HTMLButtonElement>('[data-act="retry"]');
      pick?.focus();
    });
    this.el = el;
  }

  dispose(): void {
    this.el?.remove();
    this.el = null;
  }
}

/**
 * 라벨·물체 이름이 대본에서 오므로 그대로 innerHTML 에 넣지 않는다.
 * `StageSelect`도 같은 규칙이 필요해서 export 한다 — 복붙하면 한쪽만 고쳐진다.
 */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ));
}
