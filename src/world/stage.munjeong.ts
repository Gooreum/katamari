import raw from './city.munjeong.json';
import type { CityBuilding, CityData } from './cityData';

/**
 * 문정동 — **수집(JSON) 위에 손배치(코드)를 얹는다.**
 *
 * OSM 은 건물 하나를 **외곽선 1개 + 높이 1개**로만 준다. 그래서 그대로 세우면
 * 저층 상가부와 타워의 단차가 없는 민짜 프리즘이 된다. 실물 문정아이파크는
 * 유리 상가부 위에 타워가 올라선 모양인데 게임에서는 77×67m 터에 57m 상자 하나다.
 * 여기서 그 단차를 손으로 얹는다.
 *
 * **왜 JSON 이 아니라 코드인가.** `tools/fetch-osm.ts` 는 재수집 때 `landmarks` 와
 * `spawn` 만 물려받고 `buildings` 는 통째로 갈아엎는다. JSON 에 손으로 써 넣으면
 * 다시 받는 순간 날아간다. `stage.town.ts` 가 하는 것과 같이 **손배치는 코드에 둔다.**
 *
 * **게임과 도구가 이 함수를 같이 쓴다.** `main.ts` 와 `tools/ladder.ts` 양쪽이
 * `buildMunjeongCity()` 를 부른다 — 도구가 게임과 다른 월드를 재면 사다리 숫자가
 * 거짓말이 된다고 `ladder.ts` 주석이 이미 경고하고 있다.
 */

/**
 * 한 건물을 층으로 나눈 것. 원 OSM 건물 한 채를 이 `parts` 목록으로 **치환**한다.
 *
 * **2단(저층부 + 타워)까지만 쓴다.** 3단으로 쌓으면 흡수 부피가 1.5~2배로 부푼다 —
 * `extentOf` 의 `volume` 이 상자마다 독립이고 겹친 부분을 빼지 않기 때문이다
 * (`cityData.ts`). 2단이면 중복이 「타워 바닥면적 × 저층부 높이」뿐이라 감당된다.
 */
interface Massing {
  /**
   * 어느 건물을 대체하는가 — 원 OSM 외곽선의 **외접 사각형 중심**(m, 월드 좌표).
   * 가장 가까운 미점유 건물 한 채를 잡는다. 인덱스로 안 잡는 이유는 재수집하면
   * 배열 순서가 통째로 바뀌기 때문이다.
   */
  readonly at: readonly [number, number];
  readonly name: string;
  readonly parts: readonly MassPart[];
}

interface MassPart {
  /**
   * `'outline'` 이면 원 OSM 외곽선을 그대로 쓴다 — 저층부가 대지를 다 덮을 때.
   * 사각형이면 `[x0, z0, x1, z1]` 월드 좌표(m) — 타워처럼 일부만 덮을 때.
   *
   * 타워 사각형은 저층부 외곽선과 **같은 평면을 공유하지 않게** 최소 0.3m 물린다.
   * 머티리얼이 하나라 정렬 문제는 없지만, 정확히 같은 평면인 면끼리는 깊이가
   * 같아져 깜빡인다.
   */
  readonly shape: 'outline' | readonly [number, number, number, number];
  /**
   * **꼭대기** 높이(m). 바닥은 **항상 0** 이다.
   *
   * 띄울 수가 없다 — `CityBuilding` 에 바닥 y 필드가 없고, 충돌 판정의 y 구간이
   * `[0, height]` 로 하드코딩돼 있다(`Game.ts` 의 `resolveCity`). 그래서 저층부와
   * 타워는 「쌓인」 게 아니라 **지면에서 같이 올라오는 동심 프리즘 둘**이다.
   * 옥탑을 안 만드는 것도 이 때문이다 — 옥탑 상자는 타워를 관통해 지면까지
   * 내려오므로 보이지도 않으면서 `size` 가 제일 작아 제일 먼저 먹힌다.
   *
   * **`12 · 45 · 7 · 5 · 16` 은 쓰지 말 것.** `displayHeight` 가 그 값들을
   * 「OSM 이 높이를 몰라 때려 넣은 기본값」으로 보고 0.72~1.28배로 흔든다
   * (`cityData.ts` 의 `DEFAULT_HEIGHTS`). 손으로 정한 층고가 무작위로 변한다.
   */
  readonly height: number;
  readonly kind: CityBuilding['kind'];
  /**
   * **필수.** 빼면 안 된다.
   *
   * `displayKind` 가 상자마다 면적·높이로 **다시 분류**한다. 그대로 두면 저층부는
   * `civic`(민트), 타워는 `apartment`(아이보리), 작은 것은 `retail`(버터)로 갈려
   * 한 건물이 삼색 케이크가 된다. `color` 가 있으면 동별 해시 변주도 꺼지고
   * 윗면도 `color × 0.92` 로 같은 재질이 된다.
   */
  readonly color: number;
}

/** Phase 3 에서 채운다. 비어 있으면 `buildMunjeongCity()` 가 JSON 을 그대로 돌려준다. */
const MASSING: readonly Massing[] = [];

/** 외곽선의 외접 사각형 중심 */
function centerOf(outline: CityBuilding['outline']): [number, number] {
  const xs = outline.map((p) => p[0]);
  const zs = outline.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
}

/** 매칭 허용 거리(m). 이보다 멀면 OSM 쪽이 바뀐 것으로 본다. */
const MATCH_M = 15;

/**
 * 도시에 massing 을 얹는다. `buildMunjeongCity()` 가 `MASSING` 으로 이걸 부른다.
 *
 * **표를 인자로 받는 이유는 검사 때문이다.** 모듈 상수만 있으면 「200m 밖을 가리키는
 * 항목」이나 「두 항목이 같은 건물을 잡는 경우」를 찔러볼 방법이 없다.
 */
export function applyMassing(city: CityData, massing: readonly Massing[]): CityData {
  if (massing.length === 0) return city;

  const made: CityBuilding[] = [];
  const claimed = new Set<number>();

  for (const m of massing) {
    let best = -1;
    let bestD = Infinity;
    city.buildings.forEach((b, i) => {
      // 한 건물이 두 번 치환되지 않게 잠근다. 잠긴 것은 후보에서 빼야
      // 다음 massing 이 그 옆 건물을 제대로 잡는다.
      if (claimed.has(i)) return;
      const [cx, cz] = centerOf(b.outline);
      const d = Math.hypot(cx - m.at[0], cz - m.at[1]);
      if (d < bestD) { bestD = d; best = i; }
    });

    // **조용히 넘어가지 않는다.** 재수집 뒤 massing 이 통째로 안 먹히는데
    // 아무도 모르는 것이 제일 나쁜 실패 방식이다.
    if (best < 0 || bestD > MATCH_M) {
      console.warn(
        `[munjeong] "${m.name}" 에 맞는 OSM 건물을 못 찾았습니다`
        + ` (가장 가까운 것 ${bestD === Infinity ? '없음' : `${bestD.toFixed(0)}m`})`,
      );
      continue;
    }

    claimed.add(best);
    const src = city.buildings[best]!;
    for (const p of m.parts) {
      made.push({
        outline: p.shape === 'outline' ? src.outline : [
          [p.shape[0], p.shape[1]], [p.shape[2], p.shape[1]],
          [p.shape[2], p.shape[3]], [p.shape[0], p.shape[3]],
        ],
        height: p.height,
        kind: p.kind,
        color: p.color,
        name: m.name,
      });
    }
  }

  const rest = city.buildings.filter((_, i) => !claimed.has(i));
  return { ...city, buildings: [...rest, ...made] };
}

export function buildMunjeongCity(): CityData {
  return applyMassing(raw as unknown as CityData, MASSING);
}

/** 검사 전용 — 표가 실제로 몇 채를 담고 있는지 밖에서 볼 수 있게 한다. */
export const MASSING_COUNT = MASSING.length;
export type { Massing, MassPart };
