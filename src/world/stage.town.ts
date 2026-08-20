import type { CityBuilding, CityData, StageRoom } from './cityData';
import { TOWN_TABLE } from './generation';
import {
  block, boundary, dissolveWalls, piece as kitPiece, pillar as kitPillar, ring as kitRing,
  wallWithDoor as kitWallWithDoor,
  type PieceOpts, type Rect, type SlabStyle,
} from './stage.kit';

/**
 * 원작 塊魂(2004)의 **Pigeon Town** — 「별을 만들어라 3」의 무대.
 *
 * 원작 구조: 북쪽 언덕 위 **북 피죤타운**, 언덕을 내려오는 **상점가**,
 * 남 피죤타운, 마을을 관통하는 **메추라기 강**, 가운데 **도브 호수**와 그 안의 섬,
 * 호수를 도는 도로, **참새 언덕**, 한 모서리의 **캠프장**과 이웃한 **공사장**.
 *
 * ## 평면 투영 — 못 만든 것
 *
 * 이 엔진은 공의 `y`가 반지름에 고정된 평면 전용이다 (README「알려진 한계」).
 * 그래서 **언덕(북 피죤타운·참새 언덕) · 강의 깊이 · 미끄럼틀 · 나무 위 선물 ·
 * 계단**은 못 만든다. 높이차로 나뉘던 구역을 **크기 게이트**로 나눠 평면에 편다.
 * 언덕 위 시가지는 상점가 끝의 평지 구역이 된다.
 *
 * ## 큰 것은 소품이 아니라 건물이다
 *
 * star3 목표가 50cm면 `pickRatio 0.85`로 최대 42cm까지 먹는다. 자판기·상점·
 * 가로수는 **끝까지 못 먹는 크기**라 소품이 아니라 `CityBuilding`이다.
 * 덕분에 소품이 전부 1cm~1.2m 안에 들어가고 라벨 버킷 경계를 안 건드린다.
 */

// ─── 치수 ────────────────────────────────────────────────────

/** 집 담장 */
const FENCE: SlabStyle = { t: 0.18, h: 1.0, color: 0xc79a5e };
/** 상점가·광장의 낮은 화단 경계 */
const KERB: SlabStyle = { t: 0.30, h: 0.45, color: 0xb9b3a4 };
/** 게이트 문짝. 담장보다 높아야 `gate < size/pickRatio` 여유가 넉넉하다 */
const GATE: SlabStyle = { t: 0.18, h: 1.6, color: 0xf3e7c8 };
/** 맵 테두리. 길이가 곧 크기라 안 먹힌다 — 높이는 시야를 안 막을 만큼만 */
const EDGE: SlabStyle = { t: 0.6, h: 2.0, color: 0xbfae8e };

const C_HOUSE = 0xe8d9b8;
const C_SHOP = 0xd9c9a6;
const C_TREE = 0x6f9c46;
const C_CONTAINER = 0xd08a4a;
const C_STREET = 0xb8874c;

// ─── 구역 개방 지름(m) ───────────────────────────────────────
//
// **원작 값이 아니다 — 설계값이다.**
// 원작 동네 맵의 개방 크기를 명시한 자료를 못 찾았다. 목표 50cm를 9분에 닿게
// 하는 사다리로 잡았다. (집 맵의 뒷마당 10cm는 원작 값이라 그건 그대로 뒀다.)
const OPEN_PATH = 0.08;
const OPEN_PLAZA = 0.12;
const OPEN_SHOPS = 0.18;
const OPEN_LAKE = 0.20;
const OPEN_NORTH = 0.25;
const OPEN_CAMP = 0.30;
const OPEN_SITE = 0.35;
const OPEN_ISLAND = 0.45;
// 바깥 구역 — 8번(12m) 전용이다. 3·5번은 목표가 0.5·2.7m라 여기 못 온다.
const OPEN_FIELD = 4.0;
const OPEN_RIVER = 6.0;
const OPEN_HILL = 8.0;

/**
 * **문 폭 = 개방 지름 × 이 값.** 문턱만큼 커진 공이 그 문을 지나가야 한다.
 *
 * 바깥 세 문을 2.4m로 뒀더니 4m에 열리는 야구장 문을 4m 공이 못 지나갔다.
 * 25%는 조향 여유다 — 정확히 지름만 한 구멍은 직진으로만 통과된다.
 */
const GATE_CLEARANCE = 1.25;

/**
 * **안쪽 담장이 사라지는 지름(m).** 가장 넓은 안쪽 문(1.6m)이 기준이다.
 *
 * 문이 열려도 담장이 남으면 통로 폭이 문 폭 그대로다. 그래서 공이 1.5m부터
 * 시작 마당에 갇히고 6m 넘으면 한 칸도 못 움직였다 — 담장·문을 전부 지운
 * 세계에서는 12m 공도 3만8천 칸을 돈다. **막던 건 건물이 아니라 담장이었다.**
 *
 * 자기 문보다 커진 공 앞에서 담장은 할 일이 끝난다. 그때 사라진다.
 */
const D_INNER = 1.6;

// ─── 구역 사각형 ─────────────────────────────────────────────
//
// 원점 = 시작 마당 중앙 = 스폰. -z가 북(상점가·북 피죤타운), +z가 남(광장·호수).
// **구역끼리 겹치면 안 된다** — 겹친 자리에 물건이 두 번 깔린다.

const R_YARD: Rect = [-3, -3, 3, 3];
const R_PATH: Rect = [-1.5, 3, 1.5, 8];
const R_PLAZA: Rect = [-6, 8, 6, 15];
const R_SHOPS: Rect = [-2.5, -12, 2.5, -3];
const R_NORTH: Rect = [-9, -21, 9, -12];
const R_CAMP: Rect = [-15, 2, -6, 12];
const R_SITE: Rect = [-15, -9, -2.5, -3];
const R_LAKESIDE: Rect = [6, 8, 16, 15];
const R_ISLAND: Rect = [8.5, 17.5, 13.5, 21.5];

/**
 * **바깥 세 구역 — 12m 공을 담으려고 붙였다.**
 *
 * 원작 Town에는 우리가 아직 안 만든 구역이 남아 있다(야구장 · 메추라기 강 · 참새 언덕).
 * 별을 만들어라 8은 12m인데 안쪽 아홉 구역은 가장 넓은 방의 짧은 변이 9m라
 * **공이 어디에도 안 들어간다.** 그래서 원작에 있는 구역을 큰 스케일로 덧붙였다.
 *
 * 문턱이 4·6·8m라 **3·5번(목표 0.5·2.7m)은 여기 못 들어온다** —
 * 안쪽 아홉 구역의 밸런스는 한 글자도 안 건드렸다.
 */
const R_FIELD: Rect = [16, -14, 56, 14];
const R_RIVER: Rect = [-63, -12, -15, 10];
const R_HILL: Rect = [20, 14, 52, 46];

/**
 * 도브 호수 — 연석으로 둘러싼 사각형. 안에 섬이 있다.
 *
 * **구역 사각형끼리 겹치면 안 된다** (겹친 자리에 물건이 두 번 깔린다).
 * 그래서 호수는 구역이 아니고, 섬만 구역이다. 수면은 아래 `water`가 섬과
 * 다리 통로를 **뺀 다섯 토막**으로 그린다 — 한 장으로 덮으면 섬까지 물이 돼서
 * 섬에 물건이 하나도 안 깔린다 (`World`가 물 위 배치를 막는다).
 */
const R_LAKE: Rect = [6, 15, 16, 24];

/**
 * 다리 통로의 x 구간. 호수 북쪽 연석에서 섬 북쪽 변까지 **물을 가로지르는 육지**다.
 *
 * 처음엔 연석에 구멍(게이트)만 냈는데, 열리는 순간 그 구멍으로 들어가서
 * 호수 전체를 굴러다닐 수 있었다 — 도달 검사가 45cm에서 수면 5,109칸을 잡았다.
 * **다리는 구멍이 아니라 상판이다.** 통로 양옆에 연석을 세워 물을 막는다.
 */
const BRIDGE_X0 = 10.2;
const BRIDGE_X1 = 11.8;

// ─── 바닥색 ──────────────────────────────────────────────────
// 재료색이 아니라 화면색이다. 잔디는 실제보다 밝고 흙은 실제보다 노랗다.
const F_YARD = 0x9fbf62;
const F_DIRT = 0xb59a63;
const F_PLAZA = 0xd8d2c2;
const F_SHOPS = 0xc9c3b4;
const F_NORTH = 0xa8c46e;
const F_ROAD = 0xb8b4ac;
const F_CAMP = 0x8fae5c;
const F_SITE = 0xc2a878;
const F_ISLAND = 0xa9c56b;
const F_FIELD = 0xc2a06a;
const F_RIVER = 0x9fb98a;
const F_HILL = 0x93b85e;

/**
 * 구역 목록. **순서가 곧 바닥을 까는 순서다** — 뒤가 위로 온다.
 *
 * 개수·크기 범위가 곧 사다리다. 시작 마당을 두껍게(380개) 주는 건 원작 1구역이
 * 꽃을 먹어 18cm까지 만드는 판이기 때문이고, 공사장·섬이 1.2m까지 가는 건
 * 거기가 목표 50cm를 넘긴 뒤 굴러다니는 구역이기 때문이다.
 */
export const TOWN_ROOMS: readonly StageRoom[] = [
  { id: 'yard', name: '시작 마당', rect: R_YARD, floor: F_YARD, sizeMin: 0.010, sizeMax: 0.16, count: 520, openAt: 0 },
  { id: 'path', name: '흙길', rect: R_PATH, floor: F_DIRT, sizeMin: 0.015, sizeMax: 0.24, count: 210, openAt: OPEN_PATH },
  { id: 'plaza', name: '비둘기 광장', rect: R_PLAZA, floor: F_PLAZA, sizeMin: 0.020, sizeMax: 0.40, count: 430, openAt: OPEN_PLAZA },
  { id: 'shops', name: '상점가', rect: R_SHOPS, floor: F_SHOPS, sizeMin: 0.020, sizeMax: 0.50, count: 380, openAt: OPEN_SHOPS },
  { id: 'lakeside', name: '호숫가 도로', rect: R_LAKESIDE, floor: F_ROAD, sizeMin: 0.030, sizeMax: 0.70, count: 350, openAt: OPEN_LAKE },
  { id: 'north', name: '북 피죤타운', rect: R_NORTH, floor: F_NORTH, sizeMin: 0.030, sizeMax: 0.80, count: 430, openAt: OPEN_NORTH },
  { id: 'camp', name: '캠프장', rect: R_CAMP, floor: F_CAMP, sizeMin: 0.040, sizeMax: 0.90, count: 290, openAt: OPEN_CAMP },
  { id: 'site', name: '공사장', rect: R_SITE, floor: F_SITE, sizeMin: 0.050, sizeMax: 1.20, count: 270, openAt: OPEN_SITE },
  { id: 'island', name: '호수 섬', rect: R_ISLAND, floor: F_ISLAND, sizeMin: 0.060, sizeMax: 1.20, count: 160, openAt: OPEN_ISLAND },
  // ── 바깥 세 구역 (8번 전용) ────────────────────────────────
  { id: 'field', name: '야구장', rect: R_FIELD, floor: F_FIELD, sizeMin: 0.30, sizeMax: 3.00, count: 900, openAt: OPEN_FIELD },
  { id: 'river', name: '메추라기 강', rect: R_RIVER, floor: F_RIVER, sizeMin: 0.40, sizeMax: 4.50, count: 800, openAt: OPEN_RIVER },
  { id: 'hill', name: '참새 언덕', rect: R_HILL, floor: F_HILL, sizeMin: 0.50, sizeMax: 6.00, count: 900, openAt: OPEN_HILL },
];

// ─── 얇은 래퍼 — 계산은 stage.kit.ts 가 한다 ──────────────────

function piece(x0: number, z0: number, x1: number, z1: number, o: PieceOpts = {}): CityBuilding {
  return kitPiece(x0, z0, x1, z1, FENCE, o);
}
function pillar(x: number, z: number): CityBuilding {
  return kitPillar(x, z, FENCE, 0.14);
}
/**
 * 담장에 문 하나. 문짝 폭은 최소 1.0m, 높이 1.6m라 size가 1.6m 이상이고,
 * 가장 큰 개방값 0.45m는 1.6 / 0.85 = 1.88m 보다 작다 — 불변식이 지켜진다.
 */
function gateWall(
  x0: number, z0: number, x1: number, z1: number,
  at: number, w: number, gate: number, name: string,
): CityBuilding[] {
  return kitWallWithDoor(x0, z0, x1, z1, at, w, gate, name, FENCE, GATE);
}

/**
 * 거리 집기 — **별을 만들어라 5(2m70cm)의 사다리다.**
 *
 * 소품이 1.2m에서 끊기고 다음 건물이 1.8m였다. `pickRatio 0.85`면 1.8m를 먹는 데
 * 지름 2.12m가 필요한데 1.53~2.12m를 채우는 게 개집 한 채뿐이라, 동네에서
 * 1.2m → 2.7m가 121초를 잡아먹었다. 아래 열두 채가 그 구간을 메운다.
 *
 * **전부 자기 구역 사각형 안에 있고 문 앞을 비운다.** 구역 밖이면 어느 방에도
 * 안 속한 채 떠 있는 장식이 되고, 문 앞이면 게이트를 막는다 — 지난 작업에서
 * 철물점이 공사장 문을 막아 35cm에서 안 열린 적이 있다.
 */
const STREET_FURNITURE: ReadonlyArray<readonly [Rect, number, string]> = [
  // 비둘기 광장
  [[-3.0, 8.4, -2.4, 9.0], 1.4, '우체통'],
  [[1.0, 13.0, 2.2, 13.4], 1.5, '벤치'],
  [[-4.0, 13.2, -2.8, 13.6], 1.5, '벤치'],
  [[0.6, 10.6, 1.6, 11.6], 1.6, '분수대'],
  // 호숫가 도로
  [[8.0, 8.6, 9.4, 9.2], 1.7, '자전거'],
  [[13.0, 12.6, 14.4, 13.2], 1.7, '자전거'],
  [[12.6, 9.0, 13.4, 9.8], 1.3, '쓰레기통'],   // 야구장 문(x=16) 앞 1m를 비운다
  // 북 피죤타운
  [[-8.6, -13.0, -7.8, -12.2], 2.4, '전봇대'],
  [[7.4, -20.4, 8.2, -19.6], 2.4, '전봇대'],
  // 캠프장
  [[-13.6, 9.6, -12.6, 10.6], 1.3, '드럼통'],   // 강변 다리(x=-15) 앞 1m를 비운다
  [[-9.0, 3.0, -7.6, 4.4], 1.5, '평상'],
  // 공사장
  // 상점가 서쪽은 빵집·철물점이 x -6.4~-3.8을 z -11.5~-4.7까지 채운다.
  // 공사장 서쪽 빈 자리로 보냈다 (컨테이너·표지판과도 안 겹친다).
  [[-14.6, -6.0, -13.2, -4.6], 1.5, '모래 포대'],

  // ── 2차 보강: 1.7~2.5m ────────────────────────────────────
  // 12채를 넣고 재보니 2.7m 도달이 258초 — 실플레이 3배로 774초라 제한 780초와
  // 6초 차이였다. 통과라고 부를 수 없는 여유라 이 구간을 더 채운다.
  // 자리는 손으로 찍지 않고 **구역 안 빈 칸을 계산으로 뽑았다**.
  [[-1.4, 9.4, 0.2, 11.0], 2.0, '정자'],
  [[-1.4, 11.8, 0.2, 13.4], 2.5, '가로등'],
  [[2.6, 8.6, 4.2, 10.2], 1.9, '게시판'],
  [[8.2, 10.2, 9.8, 11.8], 1.8, '오리배'],
  [[9.8, 11.0, 11.4, 12.6], 1.7, '보트'],
  [[11.4, 10.2, 13.0, 11.8], 2.5, '가로등'],
  [[-0.4, -16.4, 1.2, -14.8], 2.1, '게시판'],
  [[6.8, -18.8, 8.4, -17.2], 1.9, '자전거 보관대'],
  [[-12.8, 6.6, -11.2, 8.2], 1.7, '장작더미'],
  [[-11.2, 5.0, -9.6, 6.6], 1.8, '캠프파이어'],
  [[-10.4, -8.4, -8.8, -6.8], 2.0, '파이프 더미'],
];

/**
 * 랜드마크 — **별을 만들어라 8(12m)의 상단 사다리다.**
 *
 * 안쪽 구역의 최대 흡수 건물이 주택 6.4m라 `pickRatio 0.85` 기준 **7.5m에서
 * 먹을 게 없어진다.** 아래 다섯 채가 6.4 → 14.0m를 잇는다.
 *
 * **원작 Town에 이런 건물이 있다는 뜻이 아니다** — 사다리를 위해 세운 것이다.
 * 바닥면적을 작게 잡은 건 `size` 가 가로·세로·높이 중 **최대**라서다.
 * 넓적하게 지으면 높이가 아니라 폭이 크기가 된다.
 */
const C_LANDMARK = 0xbfae8e;
const TOWN_LANDMARKS: ReadonlyArray<readonly [Rect, number, string]> = [
  [[18.0, -12.0, 22.0, -8.0], 7.5, '관람석'],
  [[18.0, -6.0, 22.4, -1.6], 8.8, '조명탑'],
  [[-61.0, -10.0, -56.0, -5.0], 10.4, '수문'],
  [[22.0, 16.0, 27.4, 21.4], 12.2, '급수탑'],
  [[22.0, 24.0, 27.8, 29.8], 14.0, '송전탑'],
];

// ─── 마을 짓기 ───────────────────────────────────────────────

/**
 * 마을 담장.
 *
 * **공유 경계는 한 번만 세운다.** 두 구역이 맞닿은 변에 양쪽이 각자 벽을 세우면
 * 게이트가 두 겹이 되고(하나를 열어도 뒤에 하나가 남는다), 실제로 처음 짤 때
 * 상점가↔북 피죤타운과 상점가↔공사장이 그렇게 겹쳐 게이트가 10개가 됐다.
 * 그래서 각 변의 담당을 아래 주석에 못 박는다.
 */
function buildTownWalls(): CityBuilding[] {
  const b: CityBuilding[] = [];

  const [yx0, yz0, yx1, yz1] = R_YARD;
  const [px0, pz0, px1, pz1] = R_PATH;
  const [zx0, zz0, zx1, zz1] = R_PLAZA;
  const [sx0, sz0, sx1, sz1] = R_SHOPS;
  const [nx0, nz0, nx1, nz1] = R_NORTH;
  const [cx0, cz0, cx1, cz1] = R_CAMP;
  const [ox0, oz0, ox1, oz1] = R_SITE;
  const [lx0, lz0, lx1, lz1] = R_LAKESIDE;

  // ── 시작 마당 ────────────────────────────────────────────
  // 북(z=-6)은 상점가와, 남(z=6)은 흙길과 맞닿는다. 맞닿은 폭만 문이고
  // 나머지는 담장이다 — 상점가 폭(10m)이 마당 폭(12m)보다 좁다.
  b.push(piece(yx0, yz0, yx0, yz1), piece(yx1, yz0, yx1, yz1));
  b.push(piece(yx0, yz0, sx0, yz0), piece(sx1, yz0, yx1, yz0));
  b.push(...gateWall(sx0, yz0, sx1, yz0, 0, 1.4, OPEN_SHOPS, '상점가 쪽문'));
  b.push(piece(yx0, yz1, px0, yz1), piece(px1, yz1, yx1, yz1));
  b.push(...gateWall(px0, yz1, px1, yz1, 0, 1.4, OPEN_PATH, '마당 뒷문'));
  b.push(pillar(yx0, yz0), pillar(yx1, yz0), pillar(yx0, yz1), pillar(yx1, yz1));
  // 마당 안 개집 — 원작 동선에 개집이 나온다
  b.push(block([1.2, -2.4, 2.4, -1.2], 1.3, 'retail', C_HOUSE, '개집'));

  // ── 흙길 ────────────────────────────────────────────────
  // 좌우만 막는다. 북은 마당이 세웠고, 남(z=16)은 광장과 맞닿는다.
  b.push(piece(px0, pz0, px0, pz1), piece(px1, pz0, px1, pz1));
  b.push(...gateWall(px0, pz1, px1, pz1, 0, 1.4, OPEN_PLAZA, '광장 입구'));

  // ── 비둘기 광장 ─────────────────────────────────────────
  // 북(z=16)에서 흙길 폭만 빼고 담장. 서(x=-12)는 캠프장, 동(x=12)은 호숫가.
  b.push(piece(zx0, zz0, px0, zz0), piece(px1, zz0, zx1, zz0));
  b.push(piece(zx0, zz1, zx1, zz1));
  b.push(piece(zx0, cz1, zx0, zz1));                 // 서 담장 중 캠프장 밖 구간
  b.push(...gateWall(zx0, zz0, zx0, cz1, 10, 1.6, OPEN_CAMP, '캠프장 문'));
  b.push(...gateWall(zx1, zz0, zx1, zz1, 11.5, 1.6, OPEN_LAKE, '호숫가 문'));
  // 화단 둘 — 낮아서 시야는 안 막지만 5cm 공에게는 벽이다
  b.push(...kitRing([-4.5, 9.5, -2.5, 11.5], KERB));
  b.push(...kitRing([2.5, 12.0, 4.5, 14.0], KERB));
  b.push(pillar(zx0, zz0), pillar(zx1, zz0), pillar(zx0, zz1), pillar(zx1, zz1));

  // ── 상점가 ──────────────────────────────────────────────
  // 남북으로 긴 골목. 서(x=-5)는 공사장, 북(z=-26)은 북 피죤타운.
  b.push(piece(sx1, sz0, sx1, sz1));
  b.push(piece(sx0, sz0, sx0, oz0));                 // 서 담장 중 공사장 밖 구간
  b.push(...gateWall(sx0, oz0, sx0, sz1, -6, 1.6, OPEN_SITE, '공사장 가림막'));
  b.push(...gateWall(sx0, sz0, sx1, sz0, 0, 1.6, OPEN_NORTH, '언덕 위 골목'));
  b.push(
    // **문 앞을 막지 않게 서쪽으로 1.1m 물려 세운다.** 맵을 45% 줄이면서
    // 철물점이 공사장 문(x=-2.5, z -6.8~-5.2) 바로 뒤로 밀려와 35cm에서
    // 공사장이 안 열렸다 — 도달 검사가 잡았다.
    block([-6.4, -11.5, -3.8, -8.6], 5.0, 'commercial', C_SHOP, '빵집'),
    block([-6.4, -7.6, -3.8, -4.7], 4.4, 'commercial', C_SHOP, '철물점'),
    block([2.7, -11.0, 6.0, -8.1], 4.6, 'commercial', C_SHOP, '문구점'),
    block([2.7, -6.6, 6.0, -3.7], 5.2, 'commercial', C_SHOP, '목욕탕'),
  );
  // 자판기 둘 — 1.8m라 끝까지 못 먹는다
  b.push(
    block([-2.2, -10.2, -1.6, -9.6], 1.8, 'retail', 0xd94f4f, '자판기'),
    block([1.6, -6.4, 2.2, -5.8], 1.8, 'retail', 0x4f8fd9, '자판기'),
  );

  // ── 북 피죤타운 ─────────────────────────────────────────
  // 원작은 언덕 위 시가지다. 평면 엔진이라 상점가 북쪽 끝의 평지로 편다.
  // 남쪽 변(z=-26)의 상점가 폭 구간은 위에서 이미 문이 났다.
  b.push(piece(nx0, nz0, nx1, nz0), piece(nx0, nz0, nx0, nz1), piece(nx1, nz0, nx1, nz1));
  b.push(piece(nx0, nz1, sx0, nz1), piece(sx1, nz1, nx1, nz1));
  b.push(
    block([-7.6, -19.6, -4.0, -16.9], 6.0, 'lowrise', C_HOUSE, '주택'),
    block([-2.7, -19.6, 0.9, -16.9], 6.4, 'lowrise', C_HOUSE, '주택'),
    block([2.2, -19.6, 5.8, -16.9], 5.8, 'lowrise', C_HOUSE, '주택'),
    block([-7.6, -15.5, -4.5, -13.2], 5.4, 'lowrise', C_HOUSE, '주택'),
    block([2.7, -15.5, 5.8, -13.2], 5.6, 'lowrise', C_HOUSE, '주택'),
  );
  for (const x of [-6, -1.5, 3, 7]) {
    b.push(block([x - 0.4, -16.6, x + 0.4, -15.8], 3.0, 'civic', C_TREE, '가로수'));
  }

  // ── 캠프장 ──────────────────────────────────────────────
  // 동쪽 변(x=-12)의 광장 구간은 광장이 문을 냈다. 나머지 3면 + 남는 구간.
  b.push(piece(cx0, cz0, cx1, cz0), piece(cx0, cz1, cx1, cz1));
  b.push(piece(cx0, R_RIVER[3], cx0, cz1));   // 서쪽 변 중 강과 안 맞닿는 북쪽 구간만
  b.push(piece(cx1, cz0, cx1, zz0));
  b.push(
    block([-13.5, 3.6, -11.7, 5.4], 2.2, 'civic', 0xd9a441, '텐트'),
    block([-10.0, 8.0, -8.2, 9.8], 2.0, 'civic', 0x66a86e, '텐트'),
  );

  // ── 공사장 ──────────────────────────────────────────────
  // 동쪽 변(x=-5)의 상점가 구간은 상점가가 문을 냈다.
  b.push(piece(ox0, oz0, ox1, oz0), piece(ox0, oz1, ox1, oz1));   // 서쪽 변(x=-15)은 강이 주인
  b.push(
    block([-13.5, -8.0, -10.8, -6.2], 2.6, 'civic', C_CONTAINER, '컨테이너'),
    block([-9.5, -5.6, -6.8, -3.8], 2.6, 'civic', C_CONTAINER, '컨테이너'),
  );
  b.push(
    block([-12.3, -4.4, -11.7, -3.8], 2.2, 'retail', 0xe0a03a, '공사 표지판'),
    block([-8.4, -8.4, -7.8, -7.8], 2.2, 'retail', 0xe0a03a, '공사 표지판'),
  );

  // ── 호숫가 도로 ─────────────────────────────────────────
  // 서쪽 변(x=12)은 광장이 문을 냈다. 남쪽 변(z=30)은 호수 연석이 맡는다.
  b.push(piece(lx0, lz0, lx1, lz0));   // 동쪽 변(x=16)은 야구장 문이 주인이다

  /**
   * **호수를 연석으로 두른다.**
   * 지금 `water`는 배치 금지 구역일 뿐 충돌이 없다 — 안 막으면 공이 호수 위를
   * 굴러 지나가고, 그러면 섬 게이트(45cm)가 아무 의미도 없어진다.
   */
  const [kx0, kz0, kx1, kz1] = R_LAKE;
  const [ix0, iz0, ix1, iz1] = R_ISLAND;
  // 호수 바깥 연석 — 서·동·남. 북(z=30)은 다리 입구가 있어 아래에서 따로 세운다.
  b.push(kitPiece(kx0, kz0, kx0, kz1, KERB), kitPiece(kx1, kz0, kx1, kz1, KERB));
  b.push(kitPiece(kx0, kz1, kx1, kz1, KERB));
  // 북쪽 연석 + 다리 입구 (45cm에 열린다)
  b.push(...kitWallWithDoor(
    kx0, kz0, kx1, kz0, (BRIDGE_X0 + BRIDGE_X1) / 2, BRIDGE_X1 - BRIDGE_X0,
    OPEN_ISLAND, '호수 다리', KERB, GATE,
  ));
  // 다리 상판 양옆 — 이게 없으면 문이 열리는 순간 호수 전체가 열린다
  b.push(
    kitPiece(BRIDGE_X0, kz0, BRIDGE_X0, iz0, KERB),
    kitPiece(BRIDGE_X1, kz0, BRIDGE_X1, iz0, KERB),
  );
  // 섬 둘레 — 북쪽은 다리가 들어오는 폭만 비운다
  b.push(kitPiece(ix0, iz0, BRIDGE_X0, iz0, KERB), kitPiece(BRIDGE_X1, iz0, ix1, iz0, KERB));
  b.push(kitPiece(ix0, iz1, ix1, iz1, KERB));
  b.push(kitPiece(ix0, iz0, ix0, iz1, KERB), kitPiece(ix1, iz0, ix1, iz1, KERB));

  b.push(...STREET_FURNITURE.map(([rect, h, name]) => block(rect, h, 'retail', C_STREET, name)));

  // ── 바깥 세 구역 ────────────────────────────────────────
  // 원작 Town의 야구장 · 메추라기 강 · 참새 언덕. 12m 공이 도는 곳이다.
  const [fx0, fz0, fx1, fz1] = R_FIELD;
  const [vx0, vz0, vx1, vz1] = R_RIVER;
  const [hx0, hz0, hx1, hz1] = R_HILL;

  // 야구장 — 서쪽 변(x=16)에서 호숫가 도로와 만난다
  b.push(piece(fx0, fz0, fx1, fz0), piece(fx1, fz0, fx1, fz1));
  b.push(piece(fx0, fz0, fx0, lz0));
  b.push(...gateWall(fx0, lz0, fx0, fz1, 11.0, OPEN_FIELD * GATE_CLEARANCE, OPEN_FIELD, '야구장 문'));
  b.push(piece(fx0, fz1, fx0, lz1));   // 호숫가 북쪽 끝까지 남는 1m
  b.push(piece(fx0, fz1, hx0, fz1), piece(hx1, fz1, fx1, fz1));
  b.push(...gateWall(hx0, fz1, hx1, fz1, 34, OPEN_HILL * GATE_CLEARANCE, OPEN_HILL, '언덕 오르막'));

  // 메추라기 강 — 동쪽 변(x=-15)에서 캠프장과 만난다
  b.push(piece(vx0, vz0, vx1, vz0), piece(vx0, vz1, vx1, vz1), piece(vx0, vz0, vx0, vz1));
  b.push(piece(vx1, vz0, vx1, cz0));
  b.push(...gateWall(vx1, cz0, vx1, vz1, 6, OPEN_RIVER * GATE_CLEARANCE, OPEN_RIVER, '강변 다리'));

  // 참새 언덕 — 북쪽 변(z=14)에서 야구장과 만난다
  b.push(piece(hx0, hz1, hx1, hz1), piece(hx0, hz0, hx0, hz1), piece(hx1, hz0, hx1, hz1));

  b.push(...TOWN_LANDMARKS.map(([rect, h, name]) => block(rect, h, 'civic', C_LANDMARK, name)));

  // 테두리는 소멸 대상이 아니다 — `dissolveWalls` 뒤에 붙인다
  return [
    ...dissolveWalls(b, TOWN_ROOMS, { inner: D_INNER, clearance: GATE_CLEARANCE }),
    ...boundary(TOWN_ROOMS, EDGE),
  ];
}

/**
 * 원작 Pigeon Town — 평면 투영.
 *
 * `City`가 읽는 `CityData` 그대로다. 집 맵과 같은 렌더·충돌 경로를 탄다.
 * 다른 건 `placement.labels`가 동네 표를 가리킨다는 것뿐이다.
 */
export function buildTownStage(): CityData {
  return {
    name: '피죤타운',
    slug: 'town',
    // 실제 좌표가 아니다. 스키마가 요구해서 채우는 값 — 이 스테이지는 OSM이 아니다.
    origin: { lat: 0, lon: 0 },
    /**
     * 지면 원반의 반지름. **모든 구역을 덮어야 한다.**
     * 26m였는데 바깥 세 구역이 x=56 · z=46까지 나가면서 지면 밖에 섰다 —
     * 가장 먼 모서리(56, 46)가 72.5m라 여유를 붙여 80m로 잡는다.
     */
    radius: 90,
    spawn: { x: 0, z: 0 },
    buildings: buildTownWalls(),
    /**
     * 도브 호수. 렌더는 `City`가 하고, 못 들어가게 막는 건 위의 연석이다.
     *
     * **섬을 둘러싸는 네 토막이다.** 한 장으로 덮으면 섬까지 물이 돼서
     * `World`가 섬 위 배치를 전부 막아버린다 — 섬에 물건이 하나도 안 깔린다.
     */
    water: [
      [R_LAKE[0], R_LAKE[1], BRIDGE_X0, R_ISLAND[1]],
      [BRIDGE_X1, R_LAKE[1], R_LAKE[2], R_ISLAND[1]],
      [R_LAKE[0], R_ISLAND[3], R_LAKE[2], R_LAKE[3]],
      [R_LAKE[0], R_ISLAND[1], R_ISLAND[0], R_ISLAND[3]],
      [R_ISLAND[2], R_ISLAND[1], R_LAKE[2], R_ISLAND[3]],
    ].map(([x0, z0, x1, z1]) => ({
      outline: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]] as ReadonlyArray<readonly [number, number]>,
    })),
    landmarks: [],
    placement: { rooms: TOWN_ROOMS, labels: TOWN_TABLE },
  };
}
