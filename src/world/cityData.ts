/**
 * 실제 지형 데이터 스키마.
 *
 * OSM에서 받아오든 손으로 쓰든 이 형식이면 게임이 읽는다.
 * 도구(tools/fetch-osm.ts, tools/ladder.ts)와 게임이 이 파일 하나를 공유한다.
 *
 * 좌표는 전부 **미터**, 원점 기준 로컬 평면.
 *   x = 동쪽,  z = 남쪽,  y = 위
 * 위경도를 그대로 쓰지 않는 이유는 서울 위도에서 경도 1도가 88km,
 * 위도 1도가 111km라 그대로 쓰면 도시가 찌그러지기 때문이다.
 */

import type { FloorTex } from './floors';
import type { LabelTable, RoomPlacement } from './generation';

/**
 * 스테이지의 방 하나.
 *
 * 배치 규칙(`RoomPlacement`)에 **렌더 정보**를 얹은 것이다. 배치 숫자는
 * `generation.ts`가 갖고(튜닝 스크립트와 공유해야 하므로), 바닥색·이름처럼
 * 화면에만 쓰는 건 스키마인 여기가 갖는다.
 */
export interface StageRoom extends RoomPlacement {
  readonly name: string;
  /**
   * 바닥색(0xRRGGBB). `floorTex` 가 없는 방은 이 색면 하나로 칠한다.
   *
   * **여기 「원작 실내 바닥은 텍스처가 아니라 색면 하나다」라고 적혀 있었는데 틀렸다.**
   * Katamari Damacy REROLL 거실 화면을 확인하니 다다미는 짜임결과 헤리(테두리 천)가
   * 있고, 그 위를 카펫이 대각선으로 가른다. 색면 하나가 아니다.
   */
  readonly floor: number;
  /**
   * 바닥 텍스처. 없으면 `floor` 색면을 그대로 쓴다 —
   * **선택 필드다.** 필수로 만들면 기존 방 정의가 전부 스키마 위반이 된다
   * (`roads` 를 선택으로 둔 것과 같은 이유).
   */
  readonly floorTex?: FloorTex;
  /**
   * 천장 높이(m). 없으면 천장을 **안 그린다** — 뒷마당처럼 바깥인 방이다.
   *
   * 지금까지 실내에도 천장이 없어서 위를 보면 `scene.background`(하늘색)였다.
   * 벽으로 둘러싼 마당이지 방이 아니다. 평면 한 장이면 되는데 그게 없었다.
   */
  readonly ceiling?: number;
}

export type BuildingKind =
  | 'apartment'    // 아파트 동 — 좁은 바닥, 높음
  | 'lowrise'      // 빌라·다세대 — 3~5층
  | 'commercial'   // 상가·오피스
  | 'civic'        // 학교·관공서·체육시설
  | 'retail'       // 편의점·단층 점포
  // ── 아래 둘은 손배치 스테이지 전용. OSM에서는 절대 안 나온다 ──
  | 'wall'         // 방 벽·기둥·담장 — 구역을 막는 것
  | 'door';        // 미닫이문·문턱 — 크기가 차면 사라지는 것

/** 바닥 깔개 한 장. y 는 World 가 방바닥 위로 띄운다. */
export interface CityRug {
  readonly cx: number;
  readonly cz: number;
  readonly w: number;
  readonly d: number;
  /** 라디안. 0 이면 축 정렬 — 그러면 깔개를 둔 의미가 없다 */
  readonly rotY: number;
  readonly tex: FloorTex;
  /**
   * 바닥에서 띄우는 높이(m). 없으면 0 = 지금까지의 깔개.
   *
   * **이 한 필드가 상판·선반이 된다.** 깔개는 이미 「충돌 없는 렌더 전용 평면」이고
   * 상판도 정확히 그것이다 — 충돌은 다리·몸통(`CityBuilding`)이 맡으므로 공은
   * 상 **밑으로 지나가고**, 그 위에 놓인 물건은 흡수 판정이 3D라 커진 뒤에야 닿는다.
   * 새 개념을 만들 이유가 없었다.
   */
  readonly y?: number;
  /**
   * 공이 이 지름(m)에 닿으면 사라진다. `CityBuilding.gate` 와 같은 규약.
   *
   * 밥상 다리(0.32m)는 지름 0.38m에 먹힌다. 그때 상판만 공중에 남으면 안 된다.
   */
  readonly hideAt?: number;
}

/**
 * 손으로 놓는 물건 하나. **가구·가전이 여기 들어간다.**
 *
 * ## 왜 필요한가
 *
 * 지금까지 가구는 `CityBuilding` 이었다 — 2D 외곽선을 y=0부터 위로 뽑는 것뿐이라
 * **프리즘밖에 못 만든다.** 텔레비전이 상자 두 개, 밥상이 각기둥 네 개에 상판은
 * 떠 있는 텍스처였던 이유다. 정작 바닥에 굴러다니는 소품은 `shapes.*.ts` 로
 * 진짜 형상을 만든다(곰인형 부품 12개). **방을 방으로 만들어야 할 가구가
 * 씬에서 제일 대충 만든 물건이었다.**
 *
 * 여기 들어가면 소품과 **완전히 같은 경로**를 탄다 — 같은 지오메트리, 같은
 * 인스턴스 풀, 같은 충돌(3D 구 vs AABB), 같은 흡수. 새 렌더·충돌 코드가 없다.
 *
 * ## 크기가 `size` 하나뿐인 이유
 *
 * 가로세로 비율은 **형상이 갖고 있다.** `assemble()` 이 최장축을 1.0으로 정규화하면서
 * 비율을 지오메트리에 굽기 때문이다(`shapes.kit.ts`). 그래서 「텔레비전을 55cm로」라고만
 * 적으면 나머지는 형상이 정한다.
 */
export interface StageProp {
  /** `SHAPE_IDS` 에 있는 이름. 없으면 `World` 가 시끄럽게 죽는다 */
  readonly label: string;
  readonly x: number;
  readonly z: number;
  /** 최대 변(m). 흡수 문턱이 `size / TUNING.pickRatio` 다 */
  readonly size: number;
  /** 라디안. 0이면 축 정렬 */
  readonly rotY?: number;
  /**
   * 이 높이에 **떠서** 놓는다(m). 없으면 바닥.
   * TV장 위의 텔레비전처럼 「가구 위의 가구」에 쓴다.
   */
  readonly y?: number;
  /**
   * **밑이 뚫린 높이(m).** 여기까지는 충돌이 없어서 공이 밑으로 지나간다.
   *
   * 밥상은 다리 사이가 비어 있는데 충돌 상자는 `size` 짜리 정육면체라
   * 통짜로 막혀 있었다. 이 값을 주면 충돌 상자가 **그 위쪽만** 남는다 —
   * 밥상(실제 높이 0.325)에 0.24 를 주면 지름 20cm 공은 밑을 지나가고
   * 40cm 공은 막힌다. 공의 y가 반지름에 고정돼 있으니 그게 곧 물리다.
   *
   * **다리에는 충돌이 없다**(형상은 그대로 그려진다). AABB 하나로 다리 넷을
   * 표현할 수 없고, 「밑으로 지나간다」가 다리에 부딪히는 것보다 중요하다.
   *
   * 측판이 바닥까지 내려오는 가구(TV장·책장·서랍장)에는 주지 않는다.
   */
  readonly underPass?: number;
}

export interface CityBuilding {
  /** 시계방향 무관. 월드 좌표(m). 첫 점과 끝 점을 중복해서 넣지 말 것. */
  readonly outline: ReadonlyArray<readonly [number, number]>;
  readonly height: number;
  readonly kind: BuildingKind;
  /** 있으면 화자가 이름을 부를 수 있다 */
  readonly name?: string;
  /**
   * 손배치 전용 외벽색(0xRRGGBB).
   *
   * 있으면 `KIND_COLOR` 대신 이 색을 쓰고 **동별 해시 변주도 끈다.**
   * 손으로 고른 색을 흔들면 고른 의미가 없다. 윗면도 지붕 팔레트가 아니라
   * 같은 색을 살짝 눌러서 쓴다 — 벽 위에 기와가 얹히면 안 되니까.
   */
  readonly color?: number;
  /**
   * 있으면 **게이트**다. 공의 지름이 이 값(m)에 도달하면 사라진다.
   * 원작이 구역을 여는 방식 그대로다 — 뒷마당은 10cm, 마루 밑은 20cm에 열린다.
   *
   * **불변식: `gate < size / TUNING.pickRatio`.**
   * 어기면 문이 열리기 전에 플레이어가 문을 먹어치운다.
   * (`size`는 가로·세로·높이 중 최대. `extentOf`가 재는 그 값이다.)
   *
   * 0도 유효한 값이다 — 처음부터 열려 있는 문. `undefined`(게이트 아님)와 다르다.
   */
  readonly gate?: number;
}

export interface CityLandmark {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly z: number;
  /** 최대 변 (가로/세로/높이 중 큰 값). 흡수 판정 기준이 된다. */
  readonly footprint: readonly [number, number];
  readonly height: number;
  /** 이걸 먹었을 때 화자 대사 */
  readonly line?: string;
  /** 먹을 수 없는 배경이면 false — 스카이라인 기준점 역할만 한다 */
  readonly edible: boolean;
}

export interface CityWater {
  readonly outline: ReadonlyArray<readonly [number, number]>;
  readonly name?: string;
}

/**
 * 도로 종류. 색을 결정한다 — 폭은 도로마다 따로 들고 있다.
 *
 * `walk` 안에 보행자 광장(pedestrian)과 인도(footway)가 같이 들어가는데
 * 둘은 폭이 3배 차이난다. 그래서 폭을 kind에서 파생시키지 않는다.
 */
export type RoadKind =
  | 'arterial'   // 대로 — motorway/trunk/primary/secondary
  | 'street'     // 생활도로 — tertiary/residential/unclassified/living_street
  | 'alley'      // 골목 — service
  | 'walk';      // 보도·산책로·계단 — footway/pedestrian/path/cycleway/steps

/**
 * 도로 한 구간.
 *
 * 건물의 `outline`(닫힌 링)과 달리 **열린 폴리라인**이라 이름이 `line` 이다.
 * 첫 점과 끝 점이 다르고, 2점짜리(직선 구간)가 정상이다.
 */
export interface CityRoad {
  /** 중심선. 월드 좌표(m). */
  readonly line: ReadonlyArray<readonly [number, number]>;
  readonly kind: RoadKind;
  /** 폭(m). OSM width/lanes 태그가 있으면 실측, 없으면 종류별 기본값 */
  readonly width: number;
}

export interface CityData {
  readonly name: string;
  readonly slug: string;
  /** 로컬 좌표 원점의 실제 위경도 — 데이터 재현성을 위해 남긴다 */
  readonly origin: { readonly lat: number; readonly lon: number };
  /** 데이터가 커버하는 반경(m) */
  readonly radius: number;
  /** 플레이어 시작 지점 */
  readonly spawn: { readonly x: number; readonly z: number };
  readonly buildings: readonly CityBuilding[];
  readonly water: readonly CityWater[];
  readonly landmarks: readonly CityLandmark[];
  /**
   * 도로·보도. **렌더 전용** — 충돌·물체 배치·성장 곡선에 쓰지 않는다.
   *
   * 선택 필드다. 도로를 받기 전에 만든 도시 파일에는 이 키가 없고,
   * 필수로 만들면 그 파일들이 전부 스키마 위반이 된다.
   */
  readonly roads?: readonly CityRoad[];
  /**
   * 바닥에 깔린 깔개. **렌더 전용** — 충돌·물체 배치·성장 곡선에 안 쓴다 (`roads` 와 같다).
   *
   * 원작 거실에서 분홍 카펫이 다다미를 **대각선으로** 가른다. 그 한 장이
   * "바닥이 여러 재질"이라는 인상의 절반을 만든다 — 그래서 `rect`(축 정렬)가 아니라
   * 중심 + 크기 + `rotY` 로 받는다. 축에 맞춰 깔면 방바닥을 한 번 더 나눈 것에 그친다.
   */
  readonly rugs?: readonly CityRug[];
  /**
   * 손배치 스테이지 전용 배치 규칙.
   *
   * 있으면 `World`가 도넛 공식 대신 **방 단위**로 물건을 깐다.
   * OSM 도시에는 없다 — 거기서는 지금까지의 `placeCoef * size^placePower`가 맞다.
   */
  readonly placement?: {
    readonly rooms: readonly StageRoom[];
    /**
     * 이 스테이지의 라벨·형태 표. 없으면 `generation.ts`의 기본(집 물건)을 쓴다.
     *
     * **버킷 개수와 크기 경계는 기본 표와 같아야 한다** — 이름만 다르다.
     * 라벨은 물건의 정체고 크기 경계는 사다리라, 경계를 스테이지마다 바꾸면
     * 사다리 검사가 서로 다른 자를 대게 된다.
     *
     * 이게 없던 시절엔 동네에도 밥솥·서랍장이 굴러다녔다.
     */
    readonly labels?: LabelTable;
    /**
     * **바닥을 안 그리는 배치 전용 구역.** 방 위에 겹쳐서 물건을 모은다.
     *
     * 방(`StageRoom`)으로 만들면 같은 높이에 바닥이 두 장 깔려 z-fighting 이 난다.
     * 그래서 `rooms` 와 나눠 든다 — `World` 는 배치에 `[...rooms, ...spots]` 를 넘기고
     * 바닥은 `rooms` 만 그린다.
     *
     * 균등 난수가 「버려져 있다」로 읽히는 걸 여기가 고친다. 실제 집에서는
     * 그릇이 싱크대 앞에 쌓이고 크레용이 책상 밑에 쏟아진다.
     * **개수는 방에서 뺀 만큼**이라 밀도가 안 는다.
     */
    readonly spots?: readonly RoomPlacement[];
    /**
     * **손으로 놓는 물건.** 가구·가전이 여기 들어간다 — `StageProp` 주석 참고.
     *
     * `buildings` 와 달리 압출이 아니라 **진짜 형상**이고, 소품과 같은 경로를 탄다.
     */
    readonly props?: readonly StageProp[];
  };
}

// ─── 기하 유틸 ────────────────────────────────────────────────

export interface Extent {
  cx: number; cz: number;
  width: number; depth: number;
  /** 흡수 판정에 쓰는 최대 변 */
  size: number;
  /** 성장 계산에 쓰는 부피 */
  volume: number;
}

/**
 * 외곽선 + 높이 → 축정렬 크기.
 *
 * 주의: 건물의 "크기"는 높이가 아니라 **가로/세로/높이 중 최대**다.
 * 올림픽주경기장은 30m 높이지만 250m 폭이라 사실상 250m짜리 물체다.
 * 이걸 높이로만 재면 사다리에 큰 구멍이 생긴다.
 */
export function extentOf(outline: CityBuilding['outline'], height: number): Extent {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of outline) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const width = maxX - minX;
  const depth = maxZ - minZ;
  return {
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    width, depth,
    size: Math.max(width, depth, height),
    // 바닥면적을 폴리곤으로 정확히 재는 대신 외접 사각형의 65%로 근사한다.
    // 도시 건물은 대체로 볼록하고 직각이라 이 정도면 충분하다.
    volume: width * depth * height * 0.65,
  };
}

/**
 * 표시용 종류. OSM이 종류를 안 알려준 건물을 형태로 유추한다.
 *
 * `kindFromTags`는 아는 태그가 없으면 전부 `commercial`로 떨군다. 그래서 잠실 6,340채 중
 * 51.4%가 `commercial`이고, 그게 도시가 한 덩어리 회색으로 보이는 이유의 절반이다.
 * 그런데 외곽선과 높이는 진짜 데이터라서, 거기서 유추할 수 있는 만큼은 유추할 수 있다.
 *
 * OSM이 **명시한** 종류는 건드리지 않는다 — 유추가 실제 태그를 이길 이유가 없다.
 * 폴백인 `commercial`만 다시 나눈다.
 *
 * 실측: 3,260채 중 748채가 갈라져 commercial 51.4% → 39.6%가 된다.
 * 나머지는 100~300m² 저층에 몰려 있어 형태만으로는 더 못 나눈다 — 그건 동별 변주가 맡는다.
 */
export function displayKind(b: CityBuilding): BuildingKind {
  if (b.kind !== 'commercial') return b.kind;
  const e = extentOf(b.outline, b.height);
  const area = e.width * e.depth * 0.65;
  if (area >= 800 && b.height < 25) return 'civic'; // 학교·마트·체육관 같은 대형 저층
  if (area < 100 && b.height <= 12) return 'retail'; // 골목 점포
  if (b.height >= 30) return 'apartment'; // 고층 주거
  if (b.height <= 8) return 'lowrise'; // 저층 다세대
  return 'commercial';
}

/**
 * `heightFromTags`(tools/fetch-osm.ts)가 태그를 못 찾았을 때 넣는 값들.
 * 이 값과 정확히 같으면 "높이를 모른다"는 뜻이다.
 *
 * 실수로 진짜 높이를 흔들 위험은 있다 — 정말 12.00m인 건물도 여기 걸린다.
 * 그래도 흔드는 쪽을 택한다: 잠실 6,340채 중 12.0m가 2,572채인데
 * 그게 전부 실측일 리는 없다.
 */
const DEFAULT_HEIGHTS = new Set([12, 45, 7, 5, 16]);

/**
 * 표시용 높이. 태그가 없어 기본값으로 채워진 건물에만 변주를 준다.
 *
 * 잠실은 전체의 40.6%가 정확히 12.0m, 13.9%가 정확히 45.0m다 — 둘 다 폴백값이라
 * 스카이라인이 판때기가 된다. 색을 아무리 벌려도 같은 높이 판이 늘어서 있으면
 * 한 덩어리로 보인다.
 *
 * 기본값은 애초에 "모른다"는 뜻이므로, 하나의 숫자로 고정해 두는 것보다
 * 흩는 편이 실제에 가깝다. **실제 태그가 있는 높이는 건드리지 않는다** —
 * 있는 데이터를 흔드는 건 거짓말이다.
 *
 * 위치 해시라 결정적이다. 흡수로 청크를 다시 그려도 건물이 자라거나 줄지 않는다.
 */
export function displayHeight(b: CityBuilding): number {
  if (!DEFAULT_HEIGHTS.has(b.height)) return b.height;
  const p = b.outline[0]!;
  const x = Math.sin(p[0] * 19 + p[1] * 41) * 43758.5453;
  return b.height * (0.72 + (x - Math.floor(x)) * 0.56);
}

/**
 * 랜드마크가 건물보다 얼마나 작아도 그 건물을 대표한다고 볼지.
 * 손배치 footprint와 OSM 실측 외곽선은 정확히 일치하지 않는다 —
 * 종합운동장(손: 260m)과 올림픽 주경기장(OSM: 263m)처럼 살짝 넘는 경우가 있다.
 */
const COVER_SIZE_SLACK = 1.5;

/**
 * 이 건물이 어떤 랜드마크에 **이미 대표되고 있는가**. 덮은 랜드마크를 돌려준다(없으면 null).
 *
 * 랜드마크는 손으로 배치한 '사건'이고 OSM 건물은 실측 외곽선이다. 같은 자리에 둘 다 있으면
 * 같은 물체가 둘이 된다 — 실제로 롯데월드몰이 랜드마크(190m)로도 OSM 건물(169m)로도 있었다.
 * 게임과 도구가 같은 판정을 써야 사다리 숫자가 거짓말을 안 한다.
 *
 * 크기 조건이 반드시 필요하다. 좌표만 보고 자르면 55m짜리 매직아일랜드 성이
 * 자기 footprint 안에 든 414m짜리 롯데월드를 통째로 지운다.
 * 랜드마크가 어떤 건물을 대표하려면 최소한 비슷한 크기여야 한다.
 */
export function coveredByLandmark(
  cx: number, cz: number, size: number,
  landmarks: readonly CityLandmark[],
): CityLandmark | null {
  for (const l of landmarks) {
    if (Math.abs(cx - l.x) > l.footprint[0] / 2) continue;
    if (Math.abs(cz - l.z) > l.footprint[1] / 2) continue;
    const landmarkSize = Math.max(l.footprint[0], l.footprint[1], l.height);
    if (size > landmarkSize * COVER_SIZE_SLACK) continue;
    return l;
  }
  return null;
}

/** 위경도 → 원점 기준 미터. 서울 규모(수 km)에서는 이 평면 근사로 충분하다. */
export function toLocalMeters(
  lat: number, lon: number,
  origin: { lat: number; lon: number },
): [number, number] {
  const mPerLat = 111_320;
  const mPerLon = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  return [
    (lon - origin.lon) * mPerLon,   // x = 동쪽
    -(lat - origin.lat) * mPerLat,  // z = 남쪽
  ];
}
