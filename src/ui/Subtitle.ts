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

  private readonly label: string;

  /** @param label 우상단 표식. 스테이지 이름이 들어간다 */
  constructor(label: string) {
    this.label = label;
    this.live = document.createElement('div');
    this.live.className = 'onair';
    this.paint();
    document.body.appendChild(this.live);

    this.el = document.createElement('div');
    this.el.className = 'subtitle';
    document.body.appendChild(this.el);
  }

  /**
   * 표식을 `<점> 라벨 · 꼬리` 로 **다시 그린다.**
   *
   * 덧붙이지 않고 매번 새로 그리는 게 요점이다 — `mark()` 를 두 번 불러도
   * 「… · 계속 · 계속」이 되지 않는다.
   */
  private paint(tail = ''): void {
    // 점은 남긴다 — 표식이 글자만이면 배경에 묻힌다
    this.live.innerHTML = '<span class="onair-dot"></span>';
    this.live.append(this.label + (tail ? ` · ${tail}` : ''));
  }

  /** 우상단 표식에 한 마디 덧붙인다. 계속 굴리기 진입 표시에 쓴다 */
  mark(tail: string): void {
    this.paint(tail);
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
