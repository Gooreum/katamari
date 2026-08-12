import type { SubtitleSink } from '../narrative/Narrator';

/**
 * 화자 자막 + 생방송 표식.
 *
 * 자막은 화면 하단 중앙. 게임을 가리면 안 되므로 한 줄로 제한하고,
 * 배경을 깔되 반투명으로 둔다.
 */
export class Subtitle implements SubtitleSink {
  private el: HTMLElement;
  private live: HTMLElement;
  private hideAt = 0;
  private visible = false;

  constructor() {
    this.live = document.createElement('div');
    this.live.className = 'onair';
    this.live.innerHTML = '<span class="onair-dot"></span>LIVE · SEOUL';
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
