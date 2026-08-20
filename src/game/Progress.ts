import { HOUSE_STAGES, type StageRule } from './Stage';

/**
 * 진행도 — **어떤 별을 얼마나 크게 만들었는지.**
 *
 * 원작에서 판 사이의 성장은 공이 아니라 하늘에 쌓인다. 판마다 정해진 크기에서
 * 새로 시작하고(1번은 5cm → 10cm), 클리어한 공은 밤하늘로 올라가 별이 된다.
 * 그리고 **같은 판을 더 크게 다시 굴려 오면 왕이 옛 별을 부수고 갈아 끼운다.**
 * 그래서 여기 남는 건 마지막 기록이 아니라 **최고 기록**이다.
 *
 * **`localStorage`는 읽기만 해도 던진다.** 사파리 프라이빗, 서드파티 쿠키 차단,
 * 기업 정책으로 스토리지가 막힌 환경에서 접근 자체가 `SecurityError`다.
 * 그래서 모든 접근을 감싸고, 실패하면 "아무것도 못 깼다"로 돌아간다 —
 * 저장이 막혔다고 게임이 안 뜨면 그게 더 나쁘다.
 */

const KEY = 'katamari.stars';

/** 예전 포맷. 크기 없이 깬 id 배열만 있었다 */
const LEGACY_KEY = 'katamari.cleared';

/**
 * 판 id → 그 판에서 만든 **최고** 지름(m).
 *
 * 값이 숫자가 아니거나 0 이하면 버린다 — 손으로 고친 값·구버전을 그대로 믿지 않는다.
 */
export function loadStars(): ReadonlyMap<string, number> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return migrate();
    const obj: unknown = JSON.parse(raw);
    // 배열이면 옛 포맷이 이 키에 잘못 들어온 것이다. 통째로 버린다.
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return new Map();
    return new Map(
      Object.entries(obj as Record<string, unknown>)
        .filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1]) && e[1] > 0),
    );
  } catch {
    return new Map();
  }
}

/**
 * 예전 저장분 살리기.
 *
 * 크기를 안 적던 시절 기록이라 얼마나 컸는지 모른다. 그런데 **깬 판은 목표
 * 이상이었던 게 확실하다** — 시간이 다 되면 `markCleared`가 안 불렸기 때문이다.
 * 그래서 목표 크기로 친다. 실제보다 작을 수는 있어도 거짓말은 아니다.
 *
 * **새 키가 있으면 부르지 않는다.** 한 번 옮겨온 뒤에는 옛 키가 남아 있어도
 * 무시해야 한다 — 안 그러면 저장할 때마다 옛 값이 되살아난다.
 */
function migrate(): ReadonlyMap<string, number> {
  const raw = localStorage.getItem(LEGACY_KEY);
  if (raw === null) return new Map();
  const list: unknown = JSON.parse(raw);
  if (!Array.isArray(list)) return new Map();
  const out = new Map<string, number>();
  for (const id of list) {
    if (typeof id !== 'string') continue;
    const rule = HOUSE_STAGES.find((s) => s.id === id);
    if (rule) out.set(id, rule.target);
  }
  return out;
}

/**
 * 별을 기록한다. **더 큰 것만 남는다.**
 *
 * 원작에서 왕은 더 좋은 공을 굴려 오면 옛 별을 갈아 끼우지, 나빠졌다고 별을
 * 낮추지 않는다. 같은 판을 작게 다시 깼다고 하늘이 어두워지면 그건 반대다.
 */
export function recordStar(id: string, diameter: number): void {
  try {
    const stars = new Map(loadStars());
    if ((stars.get(id) ?? 0) >= diameter) return;
    stars.set(id, diameter);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(stars)));
  } catch {
    /* 저장 못 해도 판정·결과 화면은 그대로 간다 */
  }
}

/** 깬 판 집합. 해금 판정과 선택 화면이 쓴다 — 크기는 안 본다 */
export function loadCleared(): ReadonlySet<string> {
  return new Set(loadStars().keys());
}

/**
 * 크기를 모르는 채로 "깼다"고만 기록한다. 목표 크기로 남긴다.
 *
 * 게임 본편은 `recordStar`로 실제 지름을 넘긴다. 이건 크기가 없는 호출부
 * (도구·검사)를 위해 남겨둔 문이다.
 */
export function markCleared(id: string): void {
  recordStar(id, HOUSE_STAGES.find((s) => s.id === id)?.target ?? 0.01);
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
