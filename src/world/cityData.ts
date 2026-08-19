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

import type { RoomPlacement } from './generation';

/**
 * 스테이지의 방 하나.
 *
 * 배치 규칙(`RoomPlacement`)에 **렌더 정보**를 얹은 것이다. 배치 숫자는
 * `generation.ts`가 갖고(튜닝 스크립트와 공유해야 하므로), 바닥색·이름처럼
 * 화면에만 쓰는 건 스키마인 여기가 갖는다.
 */
export interface StageRoom extends RoomPlacement {
  readonly name: string;
  /** 바닥색(0xRRGGBB). 원작 실내 바닥은 텍스처가 아니라 색면 하나다 */
  readonly floor: number;
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
    readonly labels?: readonly (readonly string[])[];
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
