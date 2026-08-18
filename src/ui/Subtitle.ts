import type { SubtitleSink } from '../narrative/Narrator';

/**
 * 화자 자막 + 스테이지 표식.
 *
 * 자막은 화면 하단 중앙. 게임을 가리면 안 되므로 한 줄로 제한하고,
 * 배경을 깔되 반투명으로 둔다.
 */
export class Subtitle implements SubtitleSink {
  private el: HTMLElement;
  private live: HTMLElement;
  private hideAt = 0;
  private visible = false;

  /** @param label 우상단 표식. 스테이지 이름이 들어간다 */
  constructor(label: string) {
    this.live = document.createElement('div');
    this.live.className = 'onair';
    // 점은 남긴다 — 표식이 글자만이면 배경에 묻힌다
    this.live.innerHTML = '<span class="onair-dot"></span>';
    this.live.append(label);
    document.body.appendChild(this.live);

    this.el = document.createElement('div');
    this.el.className = 'subtitle';
    document.body.appendChild(this.el);
  }

  show(text: string, seconds: number): void {
    this.el.textContent = text;
    this.el.classList.add('on');
    this.visible = true;
    this.hideAt = performance.now() / 1000 + seconds;
  }

  /** 렌더 루프에서 호출 */
  update(): void {
    if (!this.visible) return;
    if (performance.now() / 1000 >= this.hideAt) {
      this.el.classList.remove('on');
      this.visible = false;
    }
  }

  dispose(): void {
    this.el.remove();
    this.live.remove();
  }
}
