import { HOUSE_STAGES, type StageRule } from './Stage';

/**
 * 진행도 — 어떤 별을 주웠는지.
 *
 * 원작은 깬 만큼 다음 별이 열린다. 그 상태를 저장할 곳이 브라우저밖에 없다.
 *
 * **`localStorage`는 읽기만 해도 던진다.** 사파리 프라이빗, 서드파티 쿠키 차단,
 * 기업 정책으로 스토리지가 막힌 환경에서 접근 자체가 `SecurityError`다.
 * 그래서 모든 접근을 감싸고, 실패하면 "아무것도 못 깼다"로 돌아간다 —
 * 저장이 막혔다고 게임이 안 뜨면 그게 더 나쁘다.
 */

const KEY = 'katamari.cleared';

/** 깬 스테이지 id 집합. 못 읽으면 빈 집합. */
export function loadCleared(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const list: unknown = JSON.parse(raw);
    // 손으로 고친 값·구버전 포맷을 그대로 믿지 않는다.
    // 배열이 아니면 통째로 버리고, 배열이면 문자열만 남긴다.
    return new Set(
      Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

/** 클리어 기록. 실패해도 조용히 넘어간다 — 이번 판은 정상 종료돼야 한다. */
export function markCleared(id: string): void {
  try {
    const next = new Set(loadCleared());
    next.add(id);
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    /* 저장 못 해도 판정·결과 화면은 그대로 간다 */
  }
}

/**
 * 해금 여부.
 *
 * **첫 판은 항상 열려 있고, 나머지는 바로 앞 판을 깼으면 열린다.**
 * 목록에 없는 규칙은 잠근 것으로 본다 — 어디에 이어지는지 모르는 판이다.
 *
 * 이건 **선택 화면의 규칙**이지 실행 금지가 아니다.
 * `?stage=star3`로 직접 들어오는 건 그대로 통한다 (`stageFromSlug` 참고).
 */
export function isUnlocked(rule: StageRule, cleared: ReadonlySet<string>): boolean {
  const i = HOUSE_STAGES.findIndex((s) => s.id === rule.id);
  if (i < 0) return false;
  if (i === 0) return true;
  return cleared.has(HOUSE_STAGES[i - 1]!.id);
}
