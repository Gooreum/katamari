/**
 * 스테이지 규칙. THREE 의존성 없음 — 도구에서도 읽는다.
 *
 * 원작 塊魂은 한 맵을 계속 굴리는 게 아니라 **스테이지가 여러 개**다.
 * 각각 목표 크기와 제한시간이 있고, 끝나면 왕이 평가한다.
 * 집 맵(타케다 저택)은 「별을 만들어라」 1~3이 공유한다.
 */

/**
 * 이 판이 쓰는 구역.
 *
 * 원작 「별을 만들어라 1」은 **거실 한 칸뿐이고 다른 구역이 없다.**
 * 저택이 열리는 건 2번부터고, 2번이 다시 5cm에서 시작하는 것도 원작 그대로다.
 *
 * 3번은 원작이 **동네 맵(Pigeon Town)**인데 그 맵이 아직 없어서 집을 쓴다.
 * 숨기지 않고 README「알려진 한계」에 적어둔다.
 */
export type StageArea = 'living' | 'house';

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
}

/**
 * 원작 값.
 *
 * **제한시간은 이번에 안 건드렸다.** 3번은 원작이 9분(그리고 동네 맵)이라는
 * 조사 결과가 있지만, 위키 본문 접근이 전부 막혀 검색 요약에만 의존했고
 * 그 요약이 8분/9분으로 자기모순을 냈다. 근거가 단단해지기 전에는 안 박는다.
 * 구역(1번 = 거실만)은 여러 출처가 일치했으므로 반영한다.
 */
export const HOUSE_STAGES: readonly StageRule[] = [
  { id: 'star1', name: '별을 만들어라 1', target: 0.10, limit: 0, area: 'living' },
  { id: 'star2', name: '별을 만들어라 2', target: 0.20, limit: 360, area: 'house' },
  { id: 'star3', name: '별을 만들어라 3', target: 0.50, limit: 480, area: 'house' },
];

export const DEFAULT_STAGE = HOUSE_STAGES[0]!;

/**
 * `?stage=star2` → 규칙. 모르는 값이면 1번.
 *
 * 선택 화면을 **건너뛰는 직행 진입로**다. 잠긴 판이라도 그대로 실행된다 —
 * 잠금은 선택 화면의 규칙이지 실행 금지가 아니고, 도구·e2e가 이 문으로 들어온다.
 */
export function stageFromSlug(slug: string | null): StageRule {
  return HOUSE_STAGES.find((s) => s.id === slug) ?? DEFAULT_STAGE;
}

/** 목록에서의 위치. 목록에 없으면 -1 */
export function stageIndex(rule: StageRule): number {
  return HOUSE_STAGES.findIndex((s) => s.id === rule.id);
}

/**
 * 다음 스테이지. **마지막 판이면 `null`** — 결과 화면의 「다음 별로」가
 * 그때 사라진다. 목록 밖 규칙도 `null`이다 (이어질 곳을 모른다).
 */
export function nextStage(rule: StageRule): StageRule | null {
  const i = stageIndex(rule);
  return i < 0 ? null : HOUSE_STAGES[i + 1] ?? null;
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
