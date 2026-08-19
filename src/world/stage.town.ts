import type { CityBuilding, CityData, StageRoom } from './cityData';
import { TOWN_BUCKETS } from './generation';
import {
  block, piece as kitPiece, pillar as kitPillar, ring as kitRing,
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

const C_HOUSE = 0xe8d9b8;
const C_SHOP = 0xd9c9a6;
const C_TREE = 0x6f9c46;
const C_CONTAINER = 0xd08a4a;

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

// ─── 구역 사각형 ─────────────────────────────────────────────
//
// 원점 = 시작 마당 중앙 = 스폰. -z가 북(상점가·북 피죤타운), +z가 남(광장·호수).
// **구역끼리 겹치면 안 된다** — 겹친 자리에 물건이 두 번 깔린다.

const R_YARD: Rect = [-6, -6, 6, 6];
const R_PATH: Rect = [-3, 6, 3, 16];
const R_PLAZA: Rect = [-12, 16, 12, 30];
const R_SHOPS: Rect = [-5, -26, 5, -6];
const R_NORTH: Rect = [-20, -46, 20, -26];
const R_CAMP: Rect = [-32, 4, -12, 22];
const R_SITE: Rect = [-32, -20, -5, -6];
const R_LAKESIDE: Rect = [12, 16, 34, 30];
const R_ISLAND: Rect = [18, 36, 28, 44];

/**
 * 도브 호수 — 연석으로 둘러싼 사각형. 안에 섬이 있다.
 *
 * **구역 사각형끼리 겹치면 안 된다** (겹친 자리에 물건이 두 번 깔린다).
 * 그래서 호수는 구역이 아니고, 섬만 구역이다. 수면은 아래 `water`가 섬을
 * **둘러싸는 네 토막**으로 그린다 — 한 장으로 덮으면 섬까지 물이 돼서
 * 섬에 물건이 하나도 안 깔린다 (`World`가 물 위 배치를 막는다).
 */
const R_LAKE: Rect = [12, 30, 34, 50];

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

/**
 * 구역 목록. **순서가 곧 바닥을 까는 순서다** — 뒤가 위로 온다.
 *
 * 개수·크기 범위가 곧 사다리다. 시작 마당을 두껍게(380개) 주는 건 원작 1구역이
 * 꽃을 먹어 18cm까지 만드는 판이기 때문이고, 공사장·섬이 1.2m까지 가는 건
 * 거기가 목표 50cm를 넘긴 뒤 굴러다니는 구역이기 때문이다.
 */
export const TOWN_ROOMS: readonly StageRoom[] = [
  { id: 'yard', name: '시작 마당', rect: R_YARD, floor: F_YARD, sizeMin: 0.010, sizeMax: 0.16, count: 380, openAt: 0 },
  { id: 'path', name: '흙길', rect: R_PATH, floor: F_DIRT, sizeMin: 0.015, sizeMax: 0.24, count: 160, openAt: OPEN_PATH },
  { id: 'plaza', name: '비둘기 광장', rect: R_PLAZA, floor: F_PLAZA, sizeMin: 0.020, sizeMax: 0.40, count: 300, openAt: OPEN_PLAZA },
  { id: 'shops', name: '상점가', rect: R_SHOPS, floor: F_SHOPS, sizeMin: 0.020, sizeMax: 0.50, count: 260, openAt: OPEN_SHOPS },
  { id: 'lakeside', name: '호숫가 도로', rect: R_LAKESIDE, floor: F_ROAD, sizeMin: 0.030, sizeMax: 0.70, count: 240, openAt: OPEN_LAKE },
  { id: 'north', name: '북 피죤타운', rect: R_NORTH, floor: F_NORTH, sizeMin: 0.030, sizeMax: 0.80, count: 340, openAt: OPEN_NORTH },
  { id: 'camp', name: '캠프장', rect: R_CAMP, floor: F_CAMP, sizeMin: 0.040, sizeMax: 0.90, count: 220, openAt: OPEN_CAMP },
  { id: 'site', name: '공사장', rect: R_SITE, floor: F_SITE, sizeMin: 0.050, sizeMax: 1.20, count: 200, openAt: OPEN_SITE },
  { id: 'island', name: '호수 섬', rect: R_ISLAND, floor: F_ISLAND, sizeMin: 0.060, sizeMax: 1.20, count: 120, openAt: OPEN_ISLAND },
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
  b.push(block([2.4, -3.6, 4.4, -1.6], 1.3, 'retail', C_HOUSE, '개집'));

  // ── 흙길 ────────────────────────────────────────────────
  // 좌우만 막는다. 북은 마당이 세웠고, 남(z=16)은 광장과 맞닿는다.
  b.push(piece(px0, pz0, px0, pz1), piece(px1, pz0, px1, pz1));
  b.push(...gateWall(px0, pz1, px1, pz1, 0, 1.4, OPEN_PLAZA, '광장 입구'));

  // ── 비둘기 광장 ─────────────────────────────────────────
  // 북(z=16)에서 흙길 폭만 빼고 담장. 서(x=-12)는 캠프장, 동(x=12)은 호숫가.
  b.push(piece(zx0, zz0, px0, zz0), piece(px1, zz0, zx1, zz0));
  b.push(piece(zx0, zz1, zx1, zz1));
  b.push(piece(zx0, cz1, zx0, zz1));                 // 서 담장 중 캠프장 밖 구간
  b.push(...gateWall(zx0, zz0, zx0, cz1, 19, 1.6, OPEN_CAMP, '캠프장 문'));
  b.push(...gateWall(zx1, zz0, zx1, zz1, 23, 1.6, OPEN_LAKE, '호숫가 문'));
  // 화단 둘 — 낮아서 시야는 안 막지만 5cm 공에게는 벽이다
  b.push(...kitRing([-9, 19, -5, 23], KERB));
  b.push(...kitRing([5, 24, 9, 28], KERB));
  b.push(pillar(zx0, zz0), pillar(zx1, zz0), pillar(zx0, zz1), pillar(zx1, zz1));

  // ── 상점가 ──────────────────────────────────────────────
  // 남북으로 긴 골목. 서(x=-5)는 공사장, 북(z=-26)은 북 피죤타운.
  b.push(piece(sx1, sz0, sx1, sz1));
  b.push(piece(sx0, sz0, sx0, oz0));                 // 서 담장 중 공사장 밖 구간
  b.push(...gateWall(sx0, oz0, sx0, sz1, -13, 1.6, OPEN_SITE, '공사장 가림막'));
  b.push(...gateWall(sx0, sz0, sx1, sz0, 0, 1.6, OPEN_NORTH, '언덕 위 골목'));
  b.push(
    block([-11, -25, -5.4, -20], 5.0, 'commercial', C_SHOP, '빵집'),
    block([-11, -18, -5.4, -13], 4.4, 'commercial', C_SHOP, '철물점'),
    block([5.4, -24, 11, -19], 4.6, 'commercial', C_SHOP, '문구점'),
    block([5.4, -16, 11, -11], 5.2, 'commercial', C_SHOP, '목욕탕'),
  );
  // 자판기 둘 — 1.8m라 끝까지 못 먹는다
  b.push(
    block([-4.6, -22.2, -3.8, -21.4], 1.8, 'retail', 0xd94f4f, '자판기'),
    block([3.8, -14.6, 4.6, -13.8], 1.8, 'retail', 0x4f8fd9, '자판기'),
  );

  // ── 북 피죤타운 ─────────────────────────────────────────
  // 원작은 언덕 위 시가지다. 평면 엔진이라 상점가 북쪽 끝의 평지로 편다.
  // 남쪽 변(z=-26)의 상점가 폭 구간은 위에서 이미 문이 났다.
  b.push(piece(nx0, nz0, nx1, nz0), piece(nx0, nz0, nx0, nz1), piece(nx1, nz0, nx1, nz1));
  b.push(piece(nx0, nz1, sx0, nz1), piece(sx1, nz1, nx1, nz1));
  b.push(
    block([-17, -43, -9, -37], 6.0, 'lowrise', C_HOUSE, '주택'),
    block([-6, -43, 2, -37], 6.4, 'lowrise', C_HOUSE, '주택'),
    block([5, -43, 13, -37], 5.8, 'lowrise', C_HOUSE, '주택'),
    block([-17, -34, -10, -29], 5.4, 'lowrise', C_HOUSE, '주택'),
    block([6, -34, 13, -29], 5.6, 'lowrise', C_HOUSE, '주택'),
  );
  for (const x of [-13, -3, 7, 15]) {
    b.push(block([x - 0.5, -36.5, x + 0.5, -35.5], 3.0, 'civic', C_TREE, '가로수'));
  }

  // ── 캠프장 ──────────────────────────────────────────────
  // 동쪽 변(x=-12)의 광장 구간은 광장이 문을 냈다. 나머지 3면 + 남는 구간.
  b.push(piece(cx0, cz0, cx1, cz0), piece(cx0, cz1, cx1, cz1), piece(cx0, cz0, cx0, cz1));
  b.push(piece(cx1, cz0, cx1, zz0));
  b.push(
    block([-29, 8, -25, 12], 2.2, 'civic', 0xd9a441, '텐트'),
    block([-22, 14, -18, 18], 2.0, 'civic', 0x66a86e, '텐트'),
  );

  // ── 공사장 ──────────────────────────────────────────────
  // 동쪽 변(x=-5)의 상점가 구간은 상점가가 문을 냈다.
  b.push(piece(ox0, oz0, ox1, oz0), piece(ox0, oz1, ox1, oz1), piece(ox0, oz0, ox0, oz1));
  b.push(
    block([-29, -17, -23, -13], 2.6, 'civic', C_CONTAINER, '컨테이너'),
    block([-21, -12, -15, -8], 2.6, 'civic', C_CONTAINER, '컨테이너'),
  );
  b.push(
    block([-26.4, -9.4, -25.6, -8.6], 2.2, 'retail', 0xe0a03a, '공사 표지판'),
    block([-18.4, -18.4, -17.6, -17.6], 2.2, 'retail', 0xe0a03a, '공사 표지판'),
  );

  // ── 호숫가 도로 ─────────────────────────────────────────
  // 서쪽 변(x=12)은 광장이 문을 냈다. 남쪽 변(z=30)은 호수 연석이 맡는다.
  b.push(piece(lx0, lz0, lx1, lz0), piece(lx1, lz0, lx1, lz1));

  /**
   * **호수를 연석으로 두른다.**
   * 지금 `water`는 배치 금지 구역일 뿐 충돌이 없다 — 안 막으면 공이 호수 위를
   * 굴러 지나가고, 그러면 섬 게이트(45cm)가 아무 의미도 없어진다.
   */
  const [kx0, kz0, kx1, kz1] = R_LAKE;
  b.push(kitPiece(kx0, kz1, kx1, kz1, KERB));
  b.push(kitPiece(kx0, kz0, kx0, kz1, KERB), kitPiece(kx1, kz0, kx1, kz1, KERB));
  // 북쪽 연석에 다리 한 짝. 45cm에 열린다
  b.push(...kitWallWithDoor(kx0, kz0, kx1, kz0, 23, 1.6, OPEN_ISLAND, '호수 다리', KERB, GATE));

  return b;
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
    radius: 50,
    spawn: { x: 0, z: 0 },
    buildings: buildTownWalls(),
    /**
     * 도브 호수. 렌더는 `City`가 하고, 못 들어가게 막는 건 위의 연석이다.
     *
     * **섬을 둘러싸는 네 토막이다.** 한 장으로 덮으면 섬까지 물이 돼서
     * `World`가 섬 위 배치를 전부 막아버린다 — 섬에 물건이 하나도 안 깔린다.
     */
    water: [
      [R_LAKE[0], R_LAKE[1], R_LAKE[2], R_ISLAND[1]],
      [R_LAKE[0], R_ISLAND[3], R_LAKE[2], R_LAKE[3]],
      [R_LAKE[0], R_ISLAND[1], R_ISLAND[0], R_ISLAND[3]],
      [R_ISLAND[2], R_ISLAND[1], R_LAKE[2], R_ISLAND[3]],
    ].map(([x0, z0, x1, z1]) => ({
      outline: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]] as ReadonlyArray<readonly [number, number]>,
    })),
    landmarks: [],
    placement: { rooms: TOWN_ROOMS, labels: TOWN_BUCKETS },
  };
}
