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

/**
 * 이 상자의 바닥 모양.
 *
 * · `'outline'` — 원 OSM 외곽선 그대로. 저층부가 대지를 다 덮을 때.
 * · `{ inset }` — **같은 모양을 무게중심 쪽으로 물린 것.** 타워가 저층부와 같은
 *   모양인데 조금 좁을 때. 문정동 건물은 대각선으로 앉은 V자·L자가 많아서
 *   축에 나란한 사각형으로 타워를 잡으면 건물 밖으로 삐져나온다.
 *   값은 **줄일 비율**(0.12 = 12% 안쪽). 0.3m 이상 물려야 저층부 벽과 같은 평면이
 *   되지 않는다 — 같은 평면인 면끼리는 깊이가 같아져 깜빡인다.
 * · `[x0, z0, x1, z1]` — 축에 나란한 사각형. 모양이 단순한 건물에만.
 */
type MassShape = 'outline' | { readonly inset: number } | readonly [number, number, number, number];

interface MassPart {
  readonly shape: MassShape;
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

/**
 * 한국 동네 색.
 *
 * 괴혼 팔레트 규칙은 그대로 지킨다 — **채도는 낮고 명도는 높다**(`City.ts` 의
 * `KIND_COLOR` 주석). 나무 블록에 칠한 페인트처럼 보여야 하고, 공 눈높이(5cm 일 때
 * 카메라가 23cm)에서 벽 최하단이 검게 죽지 않아야 한다.
 * 바꾸는 건 **색상뿐**이다 — 일본 동네 파스텔에서 서울 문정동으로.
 */
const C_PODIUM_GLASS = 0xbcd2d0;   // 저층 상가 유리 — 청록이 도는 회색
const C_TOWER_TILE = 0xe9e2d4;     // 주거 타워 외벽 타일 — 미색

/**
 * 손으로 얹은 건물.
 *
 * 비어 있으면 `buildMunjeongCity()` 가 수집 JSON 을 그대로 돌려준다.
 */
const MASSING: readonly Massing[] = [
  {
    /**
     * 집. 저층 유리 상가부 위에 주거 타워가 올라선 주상복합이다.
     *
     * **층수는 사는 사람에게서 받았다** — 상가 1~3층, 건물 전체 15층(2026-09-18).
     * 로드뷰로 직접 세려 했으나 길이 좁아 바로 밑에서 올려다보게 되고, 원근 압축과
     * 한가운데 걸린 햇빛 반사로 위쪽 층이 판독 불가였다. 증언이 더 정확하다.
     *
     * 포디움 높이는 **층고를 가중해서** 낸다. 상가는 층고가 높다(4.2m 잡음),
     * 주거는 오피스텔 기준 2.9m. 3×4.2 / (3×4.2 + 12×2.9) = 0.266 이고
     * OSM 전체 높이 57m 에 곱해 15.2m. 층수만으로 3/15 을 쓰면 11.4m 가 되는데
     * 그건 상가 층고를 주거와 같다고 본 것이라 낮게 나온다.
     *
     * **OSM 57m 와 15층은 서로 안 맞는다.** 15층을 오피스텔 층고로 되짚으면
     * 48m 쯤이라 57m 가 9m 크다. 어느 쪽이 맞는지 확인할 자료를 못 찾았다.
     * 다만 이 건물의 흡수 크기는 `max(가로, 세로, 높이)` = 터 77m 라 높이가
     * 바뀌어도 게임 수치는 안 움직인다. 그래서 OSM 값을 그대로 두고 비율만 쓴다.
     */
    at: [6.6, 3.4], name: '문정아이파크',
    parts: [
      { shape: 'outline', height: 15.2, kind: 'retail', color: C_PODIUM_GLASS },
      /**
       * 타워는 같은 V자를 **3%(한 변 약 2m)만** 물린 것.
       *
       * 처음엔 12% 로 잡았다가 **사는 사람이 「상가가 거의 안 나온다, 타워가 거의
       * 그대로 내려온다」고 해서 줄였다**(2026-09-18). 있지도 않은 턱을 만들면
       * 그게 곧 거짓이다. 그래서 이 건물에서 단차를 만드는 건 형태가 아니라
       * **저층 유리 색 띠**다.
       *
       * 0 으로 두지 않는 이유는 따로다 — 두 상자의 벽이 정확히 같은 평면에 놓이면
       * 깊이가 같아져 면이 깜빡인다.
       */
      { shape: { inset: 0.03 }, height: 57, kind: 'apartment', color: C_TOWER_TILE },
    ],
  },
];

/** 외곽선의 외접 사각형 중심 */
function centerOf(outline: CityBuilding['outline']): [number, number] {
  const xs = outline.map((p) => p[0]);
  const zs = outline.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
}

/**
 * 같은 모양을 무게중심 쪽으로 `k` 만큼 줄인다.
 *
 * 진짜 폴리곤 오프셋(변마다 법선 방향으로 밀기)이 아니라 **중심 기준 축소**다.
 * 볼록에 가까운 모양에서는 둘이 거의 같고, 여기 쓰이는 건물 외곽선이 그렇다.
 * V자처럼 오목한 데가 있으면 안쪽 꺾임이 실제보다 덜 물리는데, 타워가
 * 저층부 안에 들어가기만 하면 되므로 그 오차는 문제가 되지 않는다.
 */
function insetOutline(
  outline: CityBuilding['outline'], k: number,
): Array<readonly [number, number]> {
  // 면적 무게중심. 외접 사각형 중심을 쓰면 가늘고 긴 모양에서 한쪽으로 쏠린다.
  let a = 0; let gx = 0; let gz = 0;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, zi] = outline[i]!;
    const [xj, zj] = outline[j]!;
    const cross = xj * zi - xi * zj;
    a += cross; gx += (xi + xj) * cross; gz += (zi + zj) * cross;
  }
  if (Math.abs(a) < 1e-9) {
    const [cx, cz] = centerOf(outline);          // 퇴화한 폴리곤 — 외접 중심으로 물러선다
    return outline.map(([x, z]) => [cx + (x - cx) * (1 - k), cz + (z - cz) * (1 - k)] as const);
  }
  gx /= 3 * a; gz /= 3 * a;
  return outline.map(([x, z]) => [gx + (x - gx) * (1 - k), gz + (z - gz) * (1 - k)] as const);
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
        outline: p.shape === 'outline' ? src.outline
          : 'inset' in p.shape ? insetOutline(src.outline, p.shape.inset)
            : [
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

/**
 * 한국 도시 건물의 **저층부**. 규칙으로 74채 전부에 입힌다.
 *
 * **이건 개별 건물에 대한 주장이 아니다.** 「이 건물 상가가 3층까지다」를 안다는 게
 * 아니라, 「한국 도시 건물은 저층부가 위층과 재질이 다르다」는 일반 사실을 쓰는 것이다.
 * 정확한 층수를 아는 건물은 `MASSING` 이 덮어쓴다 — **규칙이 기본값이고 손배치가
 * 예외다.** 이 저장소가 이미 그렇게 한다(OSM 높이가 없으면 종류로 추정하고,
 * 사다리 꼭대기만 손으로 세운다).
 *
 * **왜 저층부가 타워보다 중요한가.** 공이 10cm 일 때 카메라가 46cm 다. 플레이어가
 * 게임 내내 보는 건 건물 밑동 몇 미터뿐이고, 57m 타워의 윗부분은 거의 안 보인다.
 * 그러니 화면을 바꾸는 건 타워 형태가 아니라 **눈높이에 걸리는 저층부**다.
 *
 * 층고는 한국 기준이다 — 상가 4.2m, 주거·사무 2.9m.
 * 값은 `displayHeight` 가 흔드는 `12·45·7·5·16` 을 피한다.
 */
const PODIUM = {
  /** 이 높이를 넘으면 상가가 여러 층이다 */
  TALL: 24,
  /** 고층 건물의 저층 상가 3개 층 */
  TALL_H: 12.6,
  /** 중층 건물의 저층 상가 1개 층 */
  MID_H: 4.4,
  /** 이 아래는 건물 자체가 저층이라 띠를 두르지 않는다 — 단층 상가·주택 */
  MIN: 11,
} as const;

/**
 * 저층부 색 — 종류별.
 *
 * 괴혼 규칙(저채도·고명도)은 지키되 **몸통보다 한 단 진하게** 잡는다.
 * 처음에 몸통과 비슷한 밝기로 잡았더니 띠가 있는지 없는지 안 보였다 —
 * 저층부가 다르다는 걸 보여주는 게 목적인데 그러면 아무 일도 안 한 것이다.
 * 실제로도 한국 건물 저층부는 화강암·타일이라 위층 도장보다 어둡다.
 */
const PODIUM_COLOR: Partial<Record<CityBuilding['kind'], number>> = {
  apartment: 0xc9bca4,   // 아파트 저층 — 화강암
  commercial: 0xa4bcc2,  // 상가 유리 — 청록 회색
  retail: 0xa4bcc2,
  civic: 0xbdb8ab,       // 관공서 — 짙은 화강암
  lowrise: 0xc4886a,     // 빌라 1층 — 적벽돌
};

/**
 * 손 안 댄 건물에 저층부를 한 겹 깐다.
 *
 * **부피가 겹친다.** `extentOf` 의 `volume` 은 상자마다 독립이고 겹친 부분을 빼지
 * 않으므로(`cityData.ts`), 저층부를 깔면 그 높이만큼 부피가 두 번 세진다.
 * 고층 건물 기준 20% 안쪽이고, 문정동에서 건물을 실제로 먹는 건 별 8(목표 12m)의
 * 막바지뿐이라 감당한다. 이 사실은 README 「알려진 한계」에 적는다.
 */
function addPodiums(city: CityData): CityData {
  const out: CityBuilding[] = [];
  for (const b of city.buildings) {
    out.push(b);
    // 손배치는 이미 층이 나뉘어 있다 — 두 번 깔지 않는다
    if (b.color !== undefined) continue;
    if (b.height < PODIUM.MIN) continue;
    const color = PODIUM_COLOR[b.kind];
    if (color === undefined) continue;
    const h = b.height >= PODIUM.TALL ? PODIUM.TALL_H : PODIUM.MID_H;
    if (h >= b.height) continue;
    out.push({
      // **안쪽으로 물리면 안 된다** — 밑동이 좁으면 건물이 파인 것처럼 보인다.
      // 2% 내밀어 얕은 턱을 만든다. 0 이면 본체 벽과 같은 평면이 되어 깜빡인다.
      outline: insetOutline(b.outline, -0.02),
      height: h,
      kind: 'retail',
      color,
      ...(b.name !== undefined ? { name: b.name } : {}),
    });
  }
  return { ...city, buildings: out };
}

export function buildMunjeongCity(): CityData {
  return addPodiums(applyMassing(raw as unknown as CityData, MASSING));
}

/** 검사 전용 — 표가 실제로 몇 채를 담고 있는지 밖에서 볼 수 있게 한다. */
export const MASSING_COUNT = MASSING.length;
export type { Massing, MassPart };
