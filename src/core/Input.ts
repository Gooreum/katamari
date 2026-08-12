/**
 * 시뮬레이션은 입력이 어디서 왔는지 절대 모른다.
 * 키보드/터치/게임패드는 전부 이 InputState 하나로 수렴한다.
 * 모바일 대응 = InputSource 구현체 하나 추가. 그 외 코드는 안 건드린다.
 */
export interface InputState {
  /** 좌우. -1(왼쪽) .. 1(오른쪽) */
  moveX: number;
  /** 전후. -1(뒤) .. 1(앞) */
  moveY: number;
  /** 시점 좌우. -1(왼쪽으로 돌림) .. 1(오른쪽) */
  lookX: number;
  /** 시점 상하. -1(내려봄) .. 1(올려봄) */
  lookY: number;
  dash: boolean;
}

export interface InputSource {
  /** out에 이번 프레임 입력을 누적한다. 클램프는 매니저가 한다. */
  sample(out: InputState): void;
  dispose(): void;
}

export class InputManager {
  readonly state: InputState = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, dash: false };
  private sources: InputSource[] = [];

  add(source: InputSource): this {
    this.sources.push(source);
    return this;
  }

  /** 매 시뮬 스텝 시작에 한 번 호출. */
  sample(): InputState {
    const s = this.state;
    s.moveX = 0;
    s.moveY = 0;
    s.lookX = 0;
    s.lookY = 0;
    s.dash = false;

    for (const src of this.sources) src.sample(s);

    // 여러 소스가 겹쳐도 크기가 1을 넘지 않게
    const len = Math.hypot(s.moveX, s.moveY);
    if (len > 1) {
      s.moveX /= len;
      s.moveY /= len;
    }
    // 시점은 **축별로** 자른다. move처럼 벡터 정규화하면 대각선으로 돌릴 때
    // 두 축이 각각 0.707로 줄어서, 좌우만 돌릴 때보다 느려진다.
    // 시점은 두 축이 서로 다른 회전이라 합성 크기를 제한할 이유가 없다.
    s.lookX = Math.min(1, Math.max(-1, s.lookX));
    s.lookY = Math.min(1, Math.max(-1, s.lookY));
    return s;
  }

  dispose(): void {
    for (const src of this.sources) src.dispose();
    this.sources.length = 0;
  }
}
