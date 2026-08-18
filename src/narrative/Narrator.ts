/**
 * 화자 엔진.
 *
 * 대본(Script)과 분리되어 있다. 도쿄 편을 붙일 때 이 파일은 안 건드린다 —
 * 대본 파일 하나만 추가하면 된다.
 *
 * 화자가 계속 떠들면 금방 질리므로 세 가지로 절제한다:
 *   1. 쿨다운 — 최소 간격
 *   2. 우선순위 — 충돌음이 마일스톤보다 급하다
 *   3. 소진 — 같은 대사를 반복하지 않고, 다 쓰면 풀을 리셋
 */

export type NarrativeEvent =
  | 'start'      // 시작
  | 'milestone'  // 지름이 두 배가 됨
  | 'bigAbsorb'  // 자기 몸통만 한 걸 삼킴
  | 'impact'     // 못 먹는 것에 세게 박음
  | 'shed'       // 충격으로 붙은 게 떨어짐
  | 'gate'       // 크기가 차서 구역이 열림 — 원작의 "뒷마당 10cm"
  | 'idle';      // 한동안 아무것도 못 먹음

export interface Line {
  event: NarrativeEvent;
  text: string;
  /** 이 지름 구간에서만 나온다 (m). 없으면 항상. */
  min?: number;
  max?: number;
  /** 한 판에 한 번만 */
  once?: boolean;
}

export interface Script {
  readonly id: string;
  readonly lines: readonly Line[];
  /** 결과 화면 문구 — 루프가 붙으면 쓴다 */
  readonly result: {
    readonly units: ReadonlyArray<{ label: string; from: 'diameter' | 'count' | 'biggest' | 'time' }>;
    readonly verdicts: ReadonlyArray<{ minDiameter: number; text: string }>;
  };
}

const PRIORITY: Record<NarrativeEvent, number> = {
  start: 3,
  // 시작과 동급이다. 문이 열리는 건 흡수가 아니라 **사건**이고,
  // 성장 곡선에서 가장 기억에 남는 지점이라 놓치면 안 된다.
  gate: 3,
  impact: 2,
  shed: 2,
  bigAbsorb: 1,
  milestone: 1,
  idle: 0,
};

/**
 * 최소 간격(초).
 * 이 게임은 스트레스 푸는 쪽이라 화자가 자주 끼어들면 안 된다.
 * 3분 플레이에 10~15줄 정도가 적당하다.
 */
const COOLDOWN = 13;
/** 이보다 오래 떠 있었으면 더 급한 대사가 끊고 들어올 수 있다 */
const INTERRUPT_AFTER = 2.5;

export interface SubtitleSink {
  show(text: string, seconds: number): void;
}

export class Narrator {
  private used = new Set<Line>();
  private sinceLine = COOLDOWN;
  private currentPriority = -1;
  private currentAge = 0;

  constructor(
    private readonly script: Script,
    private readonly sink: SubtitleSink,
  ) {}

  step(dt: number): void {
    this.sinceLine += dt;
    this.currentAge += dt;
  }

  /**
   * @param diameter 현재 지름(m) — 구간 조건 판정용
   * @param slot 같은 이벤트를 구분할 키. 마일스톤이 연달아 터질 때 중복 방지.
   */
  fire(event: NarrativeEvent, diameter: number): void {
    const priority = PRIORITY[event];

    if (this.sinceLine < COOLDOWN) {
      // 더 급한 대사만, 그것도 앞 대사가 어느 정도 읽힌 뒤에 끊는다
      if (priority <= this.currentPriority || this.currentAge < INTERRUPT_AFTER) return;
    }

    const line = this.pick(event, diameter);
    if (!line) return;

    this.used.add(line);
    this.sinceLine = 0;
    this.currentPriority = priority;
    this.currentAge = 0;
    // 읽는 속도 대략 — 한글은 초당 8자쯤
    this.sink.show(line.text, Math.min(6, 1.8 + line.text.length / 8));
  }

  private pick(event: NarrativeEvent, diameter: number): Line | null {
    const fits = (l: Line) =>
      l.event === event &&
      (l.min === undefined || diameter >= l.min) &&
      (l.max === undefined || diameter < l.max);

    let pool = this.script.lines.filter((l) => fits(l) && !this.used.has(l));

    if (pool.length === 0) {
      // 다 썼으면 once가 아닌 것만 되살린다
      const reusable = this.script.lines.filter((l) => fits(l) && !l.once);
      for (const l of reusable) this.used.delete(l);
      pool = reusable;
    }
    if (pool.length === 0) return null;
    return pool[(Math.random() * pool.length) | 0]!;
  }

  reset(): void {
    this.used.clear();
    this.sinceLine = COOLDOWN;
    this.currentPriority = -1;
  }
}
