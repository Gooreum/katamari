import type { Script } from '../narrative/Narrator';
import type { StageOutcome, StageRule } from '../game/Stage';
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
    summary: Summary, script: Script,
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

    const rows = script.result.units
      .map((u) => `<dt>${u.label}</dt><dd>${escapeHtml(value(u.from))}</dd>`)
      .join('');

    el.innerHTML = `
      <div class="result-card">
        <div class="result-head">${escapeHtml(rule.name)}</div>
        <div class="result-verdict ${cleared ? 'ok' : 'fail'}">
          ${cleared ? '목표 달성' : '시간 종료'} · 목표 ${formatSize(rule.target)}
        </div>
        <dl class="result-stats">${rows}</dl>
        <p class="result-king">${escapeHtml(verdict.text)}</p>
        <div class="result-hint"><kbd>R</kbd> 다시</div>
      </div>`;
    document.body.appendChild(el);
    // 한 프레임 뒤에 클래스를 붙여야 전환이 돈다 (붙이자마자 주면 초기 상태가 없다)
    requestAnimationFrame(() => el.classList.add('on'));
    this.el = el;
  }

  dispose(): void {
    this.el?.remove();
    this.el = null;
  }
}

/** 라벨·물체 이름이 대본에서 오므로 그대로 innerHTML 에 넣지 않는다. */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ));
}
