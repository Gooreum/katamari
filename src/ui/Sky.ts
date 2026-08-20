import { HOUSE_STAGES } from '../game/Stage';

/**
 * 선택 화면 배경의 밤하늘 — **내가 만든 별만 뜬다.**
 *
 * 원작에서 클리어한 공은 하늘로 올라가 천체가 된다. 그 전에는 아무것도 없다 —
 * 왕이 술김에 별을 전부 부순 게 이 게임의 전제다. 그래서 **처음 들어오면
 * 하늘이 비어 있는 게 맞다.** 장식용 배경별을 뿌리면 "내가 채운 별"이 안 보인다.
 *
 * THREE도 캔버스도 안 쓴다. DOM 문자열만 만드는 순수 함수라 브라우저 없이
 * 검사할 수 있다 — 그게 이 구조를 고른 이유다.
 */

/**
 * 판마다 별이 앉는 자리(가로%, 세로%). **설계값이다** — 원작 하늘의 배치를 못 찾았다.
 *
 * 고정 표를 쓰는 이유가 둘 있다:
 *   1. 해시로 흩뿌리면 들어올 때마다 별이 옮겨 다닌다. 하늘은 그러면 안 된다
 *   2. 카드가 가운데를 덮으므로 **가로 30~70% 띠를 비워야** 별이 글씨 뒤로 숨지 않는다
 */
const SEATS: Readonly<Record<string, readonly [number, number]>> = {
  star1: [14, 22], star2: [26, 68], star3: [78, 18], star4: [88, 54],
  star5: [8, 46], star6: [72, 80], star7: [20, 86], star8: [92, 30],
};

/**
 * 지름(m) → 별 반지름(px). 10cm에서 3px, 30m에서 12px.
 *
 * **로그인 이유**: 1번(10cm)과 8번(12m)은 120배 차이다. 선형으로 그리면
 * 작은 별이 점도 안 되거나 큰 별이 화면을 덮는다.
 */
export function starRadius(diameter: number): number {
  const u = Math.min(1, Math.max(0, Math.log(diameter / 0.1) / Math.log(300)));
  return 3 + u * 9;
}

/** 깬 별들의 하늘. 못 깬 판은 아무것도 안 그린다 */
export function skyHtml(stars: ReadonlyMap<string, number>): string {
  const dots = HOUSE_STAGES
    .map((s, i) => {
      const d = stars.get(s.id);
      const seat = SEATS[s.id];
      // 자리를 안 정한 판(나중에 늘어날 판)은 조용히 건너뛴다 — 하늘이 깨지진 않는다
      if (d === undefined || seat === undefined) return '';
      const size = (starRadius(d) * 2).toFixed(1);
      // 반짝임 위상을 판마다 어긋나게 — 전부 같이 깜빡이면 별이 아니라 신호등이다
      return `<i class="sky-star" style="left:${seat[0]}%;top:${seat[1]}%;`
        + `width:${size}px;height:${size}px;animation-delay:${(i * 0.7).toFixed(1)}s"></i>`;
    })
    .join('');
  // 장식이라 스크린리더가 읽을 게 없다 — 판 목록이 같은 정보를 이미 말한다
  return `<div class="sky" aria-hidden="true">${dots}</div>`;
}
