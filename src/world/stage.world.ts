import type { CityBuilding, CityData, StageRoom } from './cityData';
import { WORLD_TABLE } from './generation';
import {
  block, piece as kitPiece, pillar as kitPillar,
  wallWithDoor as kitWallWithDoor,
  type PieceOpts, type Rect, type SlabStyle,
} from './stage.kit';

/**
 * 원작 塊魂(2004) **World 맵의 Urchin Town** — 「별을 만들어라」 6·7의 무대.
 *
 * ## 맵 셋 구조
 *
 * 원작은 큰 맵이 셋(House / Town / World)이고 그 안에 구역이 여럿 있다.
 * **Urchin Town은 World의 구역**이고, 3·5·8번이 도는 Roadway는 Town의 구역이다.
 * 이 파일은 World 중 Urchin Town 하나만 만든다 — 파라다이스·고래 도시·큰바다 등
 * 나머지 13개 구역은 없다.
 *
 * ## 여기는 공이 50cm에서 시작한다
 *
 * 그래서 집·동네와 치수 감각이 다르다. 담장이 3m, 문짝이 5m다 —
 * 5cm 공 기준으로 만든 0.18m 담장은 50cm 공에게 턱이지 벽이 아니다.
 * 소품도 5cm~4m를 쓴다(`WORLD_TABLE`). 동네에서 배경이던 자전거·자판기·승용차가
 * 여기서는 **먹는 물건**이다.
 *
 * ## 평면 투영
 *
 * 원작 Urchin Town은 학교로 올라가는 램프가 있고 공원과 학교가 양쪽 끝에 있다.
 * 이 엔진은 평면 전용이라 램프를 못 만든다 — 높이차로 나뉘던 곳을 크기 게이트로 나눈다.
 */

// ─── 치수 ────────────────────────────────────────────────────
//
// 50cm 공 기준이라 집·동네보다 한 자릿수 크다.

/** 블록 담장 */
const FENCE: SlabStyle = { t: 0.45, h: 3.0, color: 0xd8c9a4 };
/** 화단·연석 — 낮지만 50cm 공에게는 벽이다 */
const KERB: SlabStyle = { t: 0.60, h: 1.2, color: 0xb9b3a4 };
/** 게이트 문짝. `gate < size / 0.85` 여유를 넉넉히 두려고 높다 */
const GATE: SlabStyle = { t: 0.45, h: 5.0, color: 0xf2e6c6 };

const C_SHOP = 0xd9c9a6;
const C_SCHOOL = 0xe4d7b4;
const C_TREE = 0x6f9c46;
const C_GAS = 0xd9584a;

// ─── 구역 개방 지름(m) ───────────────────────────────────────
//
// **원작 값이 아니다 — 설계값이다.**
// 원작 World의 개방 크기를 명시한 자료를 못 찾았다. 6번 목표 3m를 11분에,
// 7번 목표 6m를 10분에 닿게 하는 사다리로 잡았다.
const OPEN_CROSS = 0.7;
const OPEN_AVENUE = 0.9;
const OPEN_PARK = 1.0;
const OPEN_GAS = 1.2;
const OPEN_SHOPS = 1.6;
const OPEN_SCHOOL = 2.2;
const OPEN_PIER = 3.0;

// ─── 구역 사각형 ─────────────────────────────────────────────
//
// 원점 = 시작 광장 중앙 = 스폰. -z가 북(큰길·학교), +z가 남(교차로·부두).
// **구역끼리 겹치면 안 된다** — 겹친 자리에 물건이 두 번 깔린다.

const R_PLAZA: Rect = [-8, -8, 8, 8];
const R_AVENUE: Rect = [-5, -26, 5, -8];
const R_SCHOOL: Rect = [-22, -52, 22, -26];
const R_GAS: Rect = [-30, -24, -5, -10];
const R_SHOPS: Rect = [8, -24, 30, -8];
const R_CROSS: Rect = [-6, 8, 6, 22];
const R_PARK: Rect = [-32, 8, -6, 30];
const R_PIER: Rect = [6, 14, 34, 34];

// ─── 바닥색 ──────────────────────────────────────────────────
const F_PLAZA = 0xcfc9b8;
const F_AVENUE = 0xb4b0a8;
const F_SCHOOL = 0xc9a86e;
const F_GAS = 0xbdb8ae;
const F_SHOPS = 0xc6bfae;
const F_CROSS = 0xb0aca4;
const F_PARK = 0x8fb857;
const F_PIER = 0x9a8e78;

/**
 * 구역 목록. **순서가 곧 바닥을 까는 순서다** — 뒤가 위로 온다.
 *
 * 크기 범위가 집·동네와 다르다. 공이 50cm로 시작하니 **10cm 아래는 의미가 없다** —
 * 먹어도 곡선이 안 움직이고 인스턴스만 늘린다.
 */
export const WORLD_ROOMS: readonly StageRoom[] = [
  { id: 'plaza', name: '시작 광장', rect: R_PLAZA, floor: F_PLAZA, sizeMin: 0.10, sizeMax: 0.80, count: 560, openAt: 0 },
  { id: 'cross', name: '교차로', rect: R_CROSS, floor: F_CROSS, sizeMin: 0.12, sizeMax: 1.10, count: 300, openAt: OPEN_CROSS },
  { id: 'avenue', name: '큰길', rect: R_AVENUE, floor: F_AVENUE, sizeMin: 0.15, sizeMax: 1.40, count: 340, openAt: OPEN_AVENUE },
  { id: 'park', name: '공원', rect: R_PARK, floor: F_PARK, sizeMin: 0.15, sizeMax: 1.80, count: 520, openAt: OPEN_PARK },
  { id: 'gas', name: '주유소', rect: R_GAS, floor: F_GAS, sizeMin: 0.20, sizeMax: 2.20, count: 300, openAt: OPEN_GAS },
  { id: 'shops', name: '상가', rect: R_SHOPS, floor: F_SHOPS, sizeMin: 0.20, sizeMax: 2.60, count: 400, openAt: OPEN_SHOPS },
  { id: 'school', name: '학교', rect: R_SCHOOL, floor: F_SCHOOL, sizeMin: 0.25, sizeMax: 3.20, count: 620, openAt: OPEN_SCHOOL },
  { id: 'pier', name: '부두', rect: R_PIER, floor: F_PIER, sizeMin: 0.30, sizeMax: 4.00, count: 480, openAt: OPEN_PIER },
];

// ─── 얇은 래퍼 — 계산은 stage.kit.ts 가 한다 ──────────────────

function piece(x0: number, z0: number, x1: number, z1: number, o: PieceOpts = {}): CityBuilding {
  return kitPiece(x0, z0, x1, z1, FENCE, o);
}
function pillar(x: number, z: number): CityBuilding {
  return kitPillar(x, z, FENCE, 0.35);
}
/**
 * 담장에 문 하나. 문짝 폭 최소 3m·높이 5m라 size가 5m 이상이고,
 * 가장 큰 개방값 3.0m는 5 / 0.85 = 5.88m 보다 작다 — 불변식이 지켜진다.
 */
function gateWall(
  x0: number, z0: number, x1: number, z1: number,
  at: number, w: number, gate: number, name: string,
): CityBuilding[] {
  return kitWallWithDoor(x0, z0, x1, z1, at, w, gate, name, FENCE, GATE);
}

// ─── 마을 짓기 ───────────────────────────────────────────────

/**
 * 담장.
 *
 * **공유 경계는 한 번만 세운다.** 두 구역이 맞닿은 변에 양쪽이 각자 벽을 세우면
 * 게이트가 두 겹이 되고, 하나를 열어도 뒤에 하나가 남는다 (동네에서 겪었다).
 */
function buildWorldWalls(): CityBuilding[] {
  const b: CityBuilding[] = [];

  const [zx0, zz0, zx1, zz1] = R_PLAZA;
  const [ax0, az0, ax1, az1] = R_AVENUE;
  const [cx0, cz0, cx1, cz1] = R_CROSS;
  const [px0, pz0, px1, pz1] = R_PARK;
  const [gx0, gz0, gx1, gz1] = R_GAS;
  const [sx0, sz0, sx1, sz1] = R_SHOPS;
  const [nx0, nz0, nx1, nz1] = R_SCHOOL;
  const [ix0, iz0, ix1, iz1] = R_PIER;

  // ── 시작 광장 ────────────────────────────────────────────
  // 북(z=-8)은 큰길과, 남(z=8)은 교차로와, 동(x=8)은 상가와 맞닿는다.
  b.push(piece(zx0, zz0, ax0, zz0), piece(ax1, zz0, zx1, zz0));
  b.push(...gateWall(ax0, zz0, ax1, zz0, 0, 3.0, OPEN_AVENUE, '큰길 입구'));
  b.push(piece(zx0, zz1, cx0, zz1), piece(cx1, zz1, zx1, zz1));
  b.push(...gateWall(cx0, zz1, cx1, zz1, 0, 3.0, OPEN_CROSS, '교차로 입구'));
  b.push(piece(zx0, zz0, zx0, zz1));
  b.push(...gateWall(zx1, zz0, zx1, zz1, 0, 3.0, OPEN_SHOPS, '상가 골목'));
  b.push(pillar(zx0, zz0), pillar(zx1, zz0), pillar(zx0, zz1), pillar(zx1, zz1));

  // ── 큰길 ────────────────────────────────────────────────
  // 좌우만 막는다. 북(z=-26)은 학교, 서(x=-5)의 일부는 주유소.
  b.push(piece(ax1, az0, ax1, az1));
  b.push(piece(ax0, gz1, ax0, az1));                 // 주유소 아래 구간
  b.push(...gateWall(ax0, gz0, ax0, gz1, -17, 3.0, OPEN_GAS, '주유소 진입로'));
  b.push(piece(ax0, az0, ax0, gz0));                 // 주유소 위 구간
  b.push(...gateWall(ax0, az0, ax1, az0, 0, 3.5, OPEN_SCHOOL, '학교 정문'));

  // ── 학교 ────────────────────────────────────────────────
  // 원작 Urchin Town의 학교 — 큰 교정에 정글짐이 있다. 램프는 평면이라 못 만든다.
  b.push(piece(nx0, nz0, nx1, nz0), piece(nx0, nz0, nx0, nz1), piece(nx1, nz0, nx1, nz1));
  b.push(piece(nx0, nz1, ax0, nz1), piece(ax1, nz1, nx1, nz1));

  // ── 주유소 ──────────────────────────────────────────────
  b.push(piece(gx0, gz0, gx1, gz0), piece(gx0, gz1, gx1, gz1), piece(gx0, gz0, gx0, gz1));

  // ── 상가 ────────────────────────────────────────────────
  // 서쪽 변(x=8)은 광장이 문을 냈다. 남(z=-8)은 부두 쪽으로 이어진다.
  b.push(piece(sx0, sz0, sx1, sz0), piece(sx1, sz0, sx1, sz1));
  b.push(piece(sx0, sz1, ix0, sz1), piece(ix1, sz1, sx1, sz1));
  b.push(piece(sx0, zz1, sx0, sz1));                 // 광장 문 아래 구간

  // ── 교차로 ──────────────────────────────────────────────
  // 서(x=-6)는 공원, 동(x=6)은 부두.
  b.push(piece(cx0, cz1, cx1, cz1));
  b.push(piece(cx0, cz0, cx0, pz0));
  b.push(...gateWall(cx0, pz0, cx0, cz1, 15, 3.0, OPEN_PARK, '공원 문'));
  b.push(piece(cx1, cz0, cx1, iz0));
  b.push(...gateWall(cx1, iz0, cx1, cz1, 18, 3.0, OPEN_PIER, '부두 문'));

  // ── 공원 ────────────────────────────────────────────────
  // 원작 Urchin Town은 양쪽 끝에 공원과 학교가 있다.
  b.push(piece(px0, pz0, px1, pz0), piece(px0, pz1, px1, pz1), piece(px0, pz0, px0, pz1));
  b.push(piece(px1, pz0, px1, cz1));                 // 교차로 문 위 구간
  b.push(piece(px1, cz1, px1, pz1));                 // 교차로 문 아래 구간

  // ── 부두 ────────────────────────────────────────────────
  b.push(piece(ix0, iz0, ix1, iz0), piece(ix0, iz1, ix1, iz1), piece(ix1, iz0, ix1, iz1));
  b.push(piece(ix0, cz1, ix0, iz1));                 // 교차로 문 아래 구간

  return b;
}

/**
 * 원작 World — Urchin Town 구역.
 *
 * `City`가 읽는 `CityData` 그대로다. 집·동네와 같은 렌더·충돌 경로를 탄다.
 * 다른 건 `placement.labels`가 **경계까지 다른 표**(5cm~4m)를 가리킨다는 것뿐이다.
 */
export function buildWorldStage(): CityData {
  return {
    name: '어친타운',
    slug: 'world',
    // 실제 좌표가 아니다. 스키마가 요구해서 채우는 값 — 이 스테이지는 OSM이 아니다.
    origin: { lat: 0, lon: 0 },
    radius: 60,
    spawn: { x: 0, z: 0 },
    buildings: buildWorldWalls(),
    water: [],
    landmarks: [],
    placement: { rooms: WORLD_ROOMS, labels: WORLD_TABLE },
  };
}

/** 큰 건물·랜드마크는 Step 2에서 붙인다 */
export { KERB, C_SHOP, C_SCHOOL, C_TREE, C_GAS, block };
