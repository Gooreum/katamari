/**
 * 스테이지 규칙. THREE 의존성 없음 — 도구에서도 읽는다.
 *
 * 원작 塊魂은 한 맵을 계속 굴리는 게 아니라 **스테이지가 여러 개**다.
 * 각각 목표 크기와 제한시간이 있고, 끝나면 왕이 평가한다.
 * 집 맵(타케다 저택)은 「별을 만들어라」 1~3이 공유한다.
 */

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
}

/** 원작 값. 셋 다 타케다 저택에서 돈다. */
export const HOUSE_STAGES: readonly StageRule[] = [
  { id: 'star1', name: '별을 만들어라 1', target: 0.10, limit: 0 },
  { id: 'star2', name: '별을 만들어라 2', target: 0.20, limit: 360 },
  { id: 'star3', name: '별을 만들어라 3', target: 0.50, limit: 480 },
];

export const DEFAULT_STAGE = HOUSE_STAGES[0]!;

/** `?stage=star2` → 규칙. 모르는 값이면 1번. 선택 UI는 아직 없다. */
export function stageFromSlug(slug: string | null): StageRule {
  return HOUSE_STAGES.find((s) => s.id === slug) ?? DEFAULT_STAGE;
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
