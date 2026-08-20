/**
 * 스테이지 규칙. THREE 의존성 없음 — 도구에서도 읽는다.
 *
 * 원작 塊魂은 한 맵을 계속 굴리는 게 아니라 **스테이지가 여러 개**다.
 * 각각 목표 크기와 제한시간이 있고, 끝나면 왕이 평가한다.
 * **맵도 판마다 다르다** — 1번은 타케다 저택 거실, 2·4번은 저택 전체,
 * 3·5번은 동네(Pigeon Town)다. 어느 구역인지는 `area`가 들고 있다.
 */

/**
 * 이 판이 쓰는 구역.
 *
 * 원작 「별을 만들어라 1」은 **거실 한 칸뿐이고 다른 구역이 없다.**
 * 저택이 열리는 건 2번부터고, 2번이 다시 5cm에서 시작하는 것도 원작 그대로다.
 *
 * 3번은 원작이 **동네 맵(Pigeon Town)**이다 — 북 피죤타운·상점가·도브 호수·
 * 캠프장·공사장. 평면 엔진이라 언덕과 강 깊이는 못 만들고 평면 투영으로 재현했다.
 *
 * **원작은 큰 맵이 셋(House / Town / World)이고 그 안에 구역이 있다.**
 * 6·7번의 Urchin Town은 World 구역, 8번의 Roadway는 Town 구역이다.
 * 여기 `'world'`는 그중 Urchin Town 하나를 가리킨다.
 */
export type StageArea = 'living' | 'house' | 'town' | 'world';

export interface StageRule {
  readonly id: string;
  readonly name: string;
  /** 목표 지름(m) */
  readonly target: number;
  /**
   * 제한시간(초). **0이면 무제한.**
   *
   * 원작 1스테이지는 첫 플레이에 시간 제한이 없다 — 10cm에 닿으면 그냥 끝난다.
   * 조작을 배우는 판이라 시계를 안 붙인 것이고, 그 판단을 그대로 가져온다.
   */
  readonly limit: number;
  readonly area: StageArea;
  /**
   * 시작 **지름**(m). 원작은 판마다 다르다 — 6·7번이 50cm, 8번이 10cm다.
   *
   * 1~5번은 전부 0.05인데, 그중 **확인된 건 1번뿐**이다 (5cm → 10cm).
   * 2~5번의 시작 크기는 어느 자료에도 없어서 1번 값을 그대로 둔 것이고,
   * 지어낸 값이 아니라 **모르는 값**이라는 뜻이다.
   */
  readonly start: number;
}

/**
 * 원작 값. 다섯 판이 **두 맵을 재사용**한다 — 1·2·4는 타케다 저택, 3·5는 동네.
 *
 * 이름이 `HOUSE_STAGES`였는데 절반이 동네라 이미 거짓말이었다. `STAGES`로 고쳤다.
 *
 * ## 시작 크기 — 아직 5cm 하나뿐이다
 *
 * 조사에서 **6·7번이 "Starting Size 50cm"로 명시**된 걸 찾았다. 스테이지별 시작
 * 크기가 실제로 있다는 뜻이다. 그런데 **4·5번의 값은 어느 자료에도 없다.**
 * 그래서 이번에도 전부 5cm로 둔다 — 지어내지 않는다.
 * `StageRule.start`는 6·7번(50cm)을 만들 때 넣으면 된다.
 *
 * ## 5번 목표는 2m70cm다 — 2m80cm가 아니다
 *
 * 여러 곳에 "Make a Star 5는 2m80cm"라고 나오는데 그건 **최고 평가 기준**이다.
 * 같은 출처가 2번을 "37cm"라고 하는데 2번 목표는 20cm다. 제한시간도 마찬가지로
 * "8분"은 슈팅스타 조건이고 실제 제한은 13:00이다.
 */
export const STAGES: readonly StageRule[] = [
  { id: 'star1', name: '별을 만들어라 1', target: 0.10, limit: 0, area: 'living', start: 0.05 },
  { id: 'star2', name: '별을 만들어라 2', target: 0.20, limit: 360, area: 'house', start: 0.05 },
  { id: 'star3', name: '별을 만들어라 3', target: 0.50, limit: 540, area: 'town', start: 0.05 },
  { id: 'star4', name: '별을 만들어라 4', target: 1.00, limit: 600, area: 'house', start: 0.05 },
  { id: 'star5', name: '별을 만들어라 5', target: 2.70, limit: 780, area: 'town', start: 0.05 },
];

/** 옛 이름. 도구·기존 e2e가 아직 쓴다 — 같은 배열을 가리킨다. */
export const HOUSE_STAGES = STAGES;

export const DEFAULT_STAGE = STAGES[0]!;

/**
 * `?stage=star2` → 규칙. 모르는 값이면 1번.
 *
 * 선택 화면을 **건너뛰는 직행 진입로**다. 잠긴 판이라도 그대로 실행된다 —
 * 잠금은 선택 화면의 규칙이지 실행 금지가 아니고, 도구·e2e가 이 문으로 들어온다.
 */
export function stageFromSlug(slug: string | null): StageRule {
  return STAGES.find((s) => s.id === slug) ?? DEFAULT_STAGE;
}

/** 목록에서의 위치. 목록에 없으면 -1 */
export function stageIndex(rule: StageRule): number {
  return STAGES.findIndex((s) => s.id === rule.id);
}

/**
 * 다음 스테이지. **마지막 판이면 `null`** — 결과 화면의 「다음 별로」가
 * 그때 사라진다. 목록 밖 규칙도 `null`이다 (이어질 곳을 모른다).
 */
export function nextStage(rule: StageRule): StageRule | null {
  const i = stageIndex(rule);
  return i < 0 ? null : STAGES[i + 1] ?? null;
}

/**
 * 스테이지 이동. `Game`이 `location`을 모르게 하려고 `main.ts`가 주입한다.
 *
 * 판 전환은 **리로드**다. `Game`은 생성자에서 월드를 통째로 만들지만
 * `stop()`은 입력·자막만 거둔다 — 렌더러도 GPU 버퍼도 안 놓는다.
 * 그래서 판마다 `new Game`을 하면 누수고, 리로드가 정확하다.
 */
export interface StageNav {
  /** 그 스테이지로 이동. 같은 규칙을 주면 재시작이다. */
  go(rule: StageRule): void;
  /** 선택 화면으로 */
  select(): void;
}

/**
 * `stage` 파라미터만 갈아끼운 쿼리 문자열. `id`가 `null`이면 빼는데,
 * **`?stage` 없음 = 선택 화면**이 진입 규칙이라 그게 곧 "선택 화면으로"다.
 *
 * `district` 같은 나머지 파라미터는 그대로 둔다 — 지형을 고른 채 판만 옮긴다.
 * `location`을 안 만지는 순수 함수라 브라우저 없이 검사할 수 있다.
 */
export function stageSearch(search: string, id: string | null): string {
  const p = new URLSearchParams(search);
  if (id === null) p.delete('stage');
  else p.set('stage', id);
  const q = p.toString();
  return q ? `?${q}` : '';
}

/** 판이 끝난 이유. `null`이면 아직 진행 중. */
export type StageOutcome = 'cleared' | 'timeup' | null;

/**
 * 지금 판정.
 *
 * **목표 달성을 먼저 본다.** 마지막 순간에 목표를 넘기면서 시간이 다 되는 경우,
 * 실패로 보내면 플레이어가 화면에서 본 것과 결과가 어긋난다.
 */
export function judge(rule: StageRule, diameter: number, elapsed: number): StageOutcome {
  if (diameter >= rule.target) return 'cleared';
  if (rule.limit > 0 && elapsed >= rule.limit) return 'timeup';
  return null;
}
