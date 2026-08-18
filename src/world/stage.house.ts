import type { CityBuilding, CityData, StageRoom } from './cityData';

/**
 * 원작 塊魂(2004)의 **타케다 저택 1층**.
 *
 * 원작에서 집 맵은 「별을 만들어라」 1~3이 공유한다. 왕자는 거실에서 시작하고,
 * 복도로 나가 아이 방·부엌·화장실을 돌고, 툇마루를 지나 뒷마당으로 나간다.
 * 구역은 문이 아니라 **크기**로 열린다 — 원작에서 뒷마당은 지름 10cm다.
 *
 * ## 이 파일이 JSON이 아니라 코드인 이유
 *
 * 방·벽·문이 전부 좌표 계산이다. 사각형 하나에서 벽 네 장과 문 자리를 뽑는 게
 * 손으로 쓴 폴리곤 목록보다 짧고, 방 크기를 바꿀 때 벽이 따라온다.
 * 잠실(2.9MB JSON)과 달리 이건 수십 KB짜리 코드라 번들에 부담도 없다.
 *
 * ## 못 만든 것 — 평면 엔진의 한계
 *
 * 원작 집에는 **마루 밑**(20cm에 개방) · 다락 · 지붕이 있다. 이 엔진은 공의 y가
 * 반지름에 고정된 평면 전용이라 (README「알려진 한계」) 높이가 다른 구역을 못 만든다.
 * 1층 평면만 재현한다. 뒷마당은 같은 평면이라 원작대로 10cm에 열린다.
 *
 * ## 높이 규약
 *
 * `displayHeight`(cityData.ts)는 `DEFAULT_HEIGHTS = {5, 7, 12, 16, 45}` 와
 * **정확히 같은 높이**를 ±28% 흔든다. OSM 폴백값을 흩으려는 장치인데, 손배치에는
 * 재앙이다 — 벽 높이가 제멋대로 달라진다. **이 파일은 그 다섯 값을 쓰지 않는다.**
 */

// ─── 치수 (m) ────────────────────────────────────────────────

/** 실내 벽 두께. 원작 목조 주택의 기둥·심벽 굵기 감각 */
const WALL_T = 0.10;
/** 실내 벽 높이. 5(DEFAULT_HEIGHTS)를 피해 2.4 */
const WALL_H = 2.4;
/** 미닫이문 높이. 벽보다 낮아야 문틀 위 벽(란마)이 남아 문으로 읽힌다 */
const DOOR_H = 1.8;
/** 담장 두께·높이 — 뒷마당을 두르는 것 */
const FENCE_T = 0.14;
const FENCE_H = 1.2;

// ─── 색 (원작 톤: 나무·회벽·다다미) ──────────────────────────

/**
 * 재료색. **원작 화면색이지 실물색이 아니다.**
 *
 * 실제 회벽·삼나무·창호지 색(0xf2e8d5 / 0xa9763f / 0xf7f1e0)으로도 렌더해봤는데
 * 실내가 통째로 크림색 한 덩어리가 됐다. 원작 실내가 알록달록한 건 물건 때문만이
 * 아니라 **면 자체가 색을 갖기** 때문이라, 채도를 올리고 명도를 벌린다.
 */
const C_WALL = 0xfbf0d2;   // 회벽
const C_PILLAR = 0xc2762c; // 기둥·문틀 나무
const C_DOOR = 0xfffaea;   // 장지문 창호지
const C_FENCE = 0xc07d33;  // 판자 담장

// ─── 구역 개방 지름 (m) ──────────────────────────────────────

/**
 * 거실 → 복도. 첫 성장 직후 바로 열려야 한다.
 * 5cm로 시작해서 6cm면 한 번도 두 배가 안 된 시점이다 — 원작 1단계도 이렇게 짧다.
 */
const OPEN_HALL = 0.06;
/** 복도 → 아이 방 · 부엌 · 화장실 */
const OPEN_ROOMS = 0.08;
/** 툇마루 → 뒷마당. **원작 값이다.** */
const OPEN_YARD = 0.10;

// ─── 방 사각형 (x0, z0, x1, z1) ──────────────────────────────
//
// 원점 = 거실 중앙 = 스폰. -z가 북(집 안쪽), +z가 남(툇마루·뒷마당).

// **복도가 세로축의 기준자다.** 복도가 z −8.55 … −2.25 를 관통하고,
// 서쪽에 아이 방·부엌이, 동쪽에 화장실이 그 구간 **안에서** 붙는다.
// 방이 복도 구간 밖으로 삐져나가면 문이 벽 없는 자리에 붙어서 집이 샌다.

const R_LIVING: Rect = [-2.7, -2.25, 2.7, 2.25];
const R_HALL: Rect = [-0.9, -8.55, 0.9, -2.25];
const R_KIDS: Rect = [-4.5, -5.85, -0.9, -2.25];
const R_KITCHEN: Rect = [-4.5, -8.55, -0.9, -5.85];
const R_BATH: Rect = [0.9, -8.55, 2.7, -6.75];
const R_PORCH: Rect = [-2.7, 2.25, 2.7, 3.45];
const R_YARD: Rect = [-4.0, 3.45, 4.0, 9.45];

type Rect = readonly [number, number, number, number];

/**
 * 방 목록. **순서가 곧 바닥을 까는 순서다** — 뒤가 위로 온다.
 *
 * 크기 범위는 원작 아이템 실측에 맞췄다. 거실이 28cm까지인 건
 * RC 컨트롤러(30.1cm)가 거실 물건이라 그 바로 아래에서 끊은 것이고,
 * 뒷마당이 1.2m까지인 건 화분·물뿌리개가 거기 있기 때문이다.
 *
 * 개수는 방 넓이에 대충 비례하되 **거실을 두껍게** 준다. 원작 1스테이지가
 * 거실에서만 5cm → 10cm를 만들어야 해서, 여기 밀도가 곧 초반 재미다.
 */
/** 바닥색. 벽과 같은 규칙 — 재료색이 아니라 화면색이다. */
const F_TATAMI = 0xc8d27a;
const F_WOOD = 0xcf9042;
const F_TILE = 0xeceadf;
const F_BATH = 0xa8d4e0;
const F_PORCH = 0xbf8038;
const F_DIRT = 0x9c7b48;

export const HOUSE_ROOMS: readonly StageRoom[] = [
  { id: 'living', name: '거실', rect: R_LIVING, floor: F_TATAMI, sizeMin: 0.010, sizeMax: 0.28, count: 430, openAt: 0 },
  { id: 'hall', name: '복도', rect: R_HALL, floor: F_WOOD, sizeMin: 0.010, sizeMax: 0.22, count: 150, openAt: OPEN_HALL },
  { id: 'kids', name: '아이 방', rect: R_KIDS, floor: F_TATAMI, sizeMin: 0.010, sizeMax: 0.34, count: 290, openAt: OPEN_ROOMS },
  { id: 'kitchen', name: '부엌', rect: R_KITCHEN, floor: F_TILE, sizeMin: 0.020, sizeMax: 0.40, count: 210, openAt: OPEN_ROOMS },
  { id: 'bath', name: '화장실', rect: R_BATH, floor: F_BATH, sizeMin: 0.010, sizeMax: 0.24, count: 80, openAt: OPEN_ROOMS },
  { id: 'porch', name: '툇마루', rect: R_PORCH, floor: F_PORCH, sizeMin: 0.020, sizeMax: 0.45, count: 70, openAt: OPEN_YARD },
  { id: 'yard', name: '뒷마당', rect: R_YARD, floor: F_DIRT, sizeMin: 0.030, sizeMax: 1.20, count: 250, openAt: OPEN_YARD },
];

// ─── 기하 ────────────────────────────────────────────────────

/**
 * 선분 (x0,z0)→(x1,z1) 을 두께 t로 부풀린 사각 외곽선.
 *
 * 축정렬 선분만 받는다. 집 벽은 전부 축정렬이고, 비스듬한 벽을 지원하면
 * 법선 계산이 필요해지는데 쓸 데가 없다.
 */
function slab(x0: number, z0: number, x1: number, z1: number, t: number): CityBuilding['outline'] {
  const h = t / 2;
  // 가로 벽이면 z를, 세로 벽이면 x를 부풀린다
  const horizontal = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const [ax, az, bx, bz] = horizontal
    ? [Math.min(x0, x1), z0 - h, Math.max(x0, x1), z0 + h]
    : [x0 - h, Math.min(z0, z1), x0 + h, Math.max(z0, z1)];
  return [[ax, az], [bx, az], [bx, bz], [ax, bz]];
}

interface SlabOpts {
  readonly t?: number;
  readonly h?: number;
  readonly color?: number;
  readonly kind?: 'wall' | 'door';
  readonly gate?: number;
  readonly name?: string;
}

function piece(x0: number, z0: number, x1: number, z1: number, o: SlabOpts = {}): CityBuilding {
  return {
    outline: slab(x0, z0, x1, z1, o.t ?? WALL_T),
    height: o.h ?? WALL_H,
    kind: o.kind ?? 'wall',
    color: o.color ?? C_WALL,
    ...(o.gate !== undefined ? { gate: o.gate } : {}),
    ...(o.name !== undefined ? { name: o.name } : {}),
  };
}

/**
 * 문이 뚫린 벽 한 장. 벽을 두 토막으로 자르고 그 사이에 문짝을 세운다.
 *
 * **문짝을 벽에 얹지 않고 벽을 잘라내는 이유**: 문이 열리면(= 문짝 건물이 사라지면)
 * 그 자리가 뻥 뚫려야 한다. 벽 위에 덧대면 문이 사라져도 뒤에 벽이 남는다.
 *
 * `gate` 불변식(`gate < size / pickRatio`)은 여기서 자동으로 지켜진다 —
 * 문짝 폭이 최소 0.6m라 size가 최소 1.8m(DOOR_H)이고,
 * 가장 큰 개방값 0.10m 는 1.8 / 0.85 = 2.12m 보다 한참 작다.
 *
 * @param at 문 중심의 축 좌표 (가로 벽이면 x, 세로 벽이면 z)
 * @param w  문 폭(m)
 */
function wallWithDoor(
  x0: number, z0: number, x1: number, z1: number,
  at: number, w: number, gate: number, name: string,
  o: SlabOpts = {},
): CityBuilding[] {
  const horizontal = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const lo = at - w / 2;
  const hi = at + w / 2;
  const parts: CityBuilding[] = [];

  // **문이 벽 구간 안에 있어야 한다.**
  // 이걸 안 잡으면 문짝만 허공에 서고 그 자리에 벽이 없어서 집이 통째로 샌다.
  // 실제로 부엌·화장실을 복도 구간 밖에 두는 바람에 8cm에서 집 밖으로 나갈 수 있었고,
  // 화면상으로는 멀쩡해 보였다 — 도달 범위 검사(scratch reach.ts)가 잡았다.
  const [segLo, segHi] = horizontal
    ? [Math.min(x0, x1), Math.max(x0, x1)]
    : [Math.min(z0, z1), Math.max(z0, z1)];
  if (lo < segLo - 1e-9 || hi > segHi + 1e-9) {
    throw new Error(
      `${name}: 문(${lo.toFixed(2)}~${hi.toFixed(2)})이 벽 구간(${segLo.toFixed(2)}~${segHi.toFixed(2)}) 밖이다`,
    );
  }

  if (horizontal) {
    const a = Math.min(x0, x1), b = Math.max(x0, x1);
    if (lo - a > 0.01) parts.push(piece(a, z0, lo, z0, o));
    if (b - hi > 0.01) parts.push(piece(hi, z0, b, z0, o));
    parts.push(piece(lo, z0, hi, z0, {
      ...o, h: DOOR_H, kind: 'door', color: C_DOOR, gate, name,
    }));
  } else {
    const a = Math.min(z0, z1), b = Math.max(z0, z1);
    if (lo - a > 0.01) parts.push(piece(x0, a, x0, lo, o));
    if (b - hi > 0.01) parts.push(piece(x0, hi, x0, b, o));
    parts.push(piece(x0, lo, x0, hi, {
      ...o, h: DOOR_H, kind: 'door', color: C_DOOR, gate, name,
    }));
  }
  return parts;
}

/** 모서리 기둥. 벽이 만나는 자리에 세워 실루엣을 끊는다 — 원작 목조 주택의 결이다. */
function pillar(x: number, z: number): CityBuilding {
  const s = 0.09;
  return {
    outline: [[x - s, z - s], [x + s, z - s], [x + s, z + s], [x - s, z + s]],
    height: WALL_H,
    kind: 'wall',
    color: C_PILLAR,
  };
}

// ─── 집 짓기 ─────────────────────────────────────────────────

function buildWalls(): CityBuilding[] {
  const b: CityBuilding[] = [];
  const [lx0, lz0, lx1, lz1] = R_LIVING;
  const [hx0, hz0, hx1] = R_HALL;
  const [kx0, kz0, , kz1] = R_KIDS;
  const [, , cx1, cz1] = R_KITCHEN;
  const [bx0, , bx1, bz1] = R_BATH;
  const [px0, pz0, px1, pz1] = R_PORCH;
  const [yx0, yz0, yx1, yz1] = R_YARD;

  // ── 거실 ────────────────────────────────────────────────
  b.push(piece(lx0, lz0, lx0, lz1), piece(lx1, lz0, lx1, lz1));
  // 북벽 — 복도로 나가는 미닫이문 (x=0, 폭 1.2m)
  b.push(...wallWithDoor(lx0, lz0, lx1, lz0, 0, 1.2, OPEN_HALL, '거실 미닫이문'));
  // 남벽 — 툇마루로 나가는 창호문 (x=0, 폭 1.8m). 원작 툇마루는 넓게 열린다
  b.push(...wallWithDoor(lx0, lz1, lx1, lz1, 0, 1.8, OPEN_YARD, '툇마루 창호문'));
  b.push(pillar(lx0, lz0), pillar(lx1, lz0), pillar(lx0, lz1), pillar(lx1, lz1));

  // ── 복도 서벽 — 두 토막, 각각 문 하나 ───────────────────
  // 아이 방 구간(z −5.85…−2.25)과 부엌 구간(z −8.55…−5.85)을 따로 세운다.
  // 한 벽에 문 둘을 뚫는 것보다 방 경계에서 끊는 쪽이 좌표가 스스로를 설명한다.
  b.push(...wallWithDoor(hx0, kz0, hx0, kz1, (kz0 + kz1) / 2, 0.9, OPEN_ROOMS, '아이 방 문'));
  b.push(...wallWithDoor(hx0, hz0, hx0, cz1, (hz0 + cz1) / 2, 0.9, OPEN_ROOMS, '부엌 문'));

  // ── 복도 동벽 ───────────────────────────────────────────
  // 남쪽 절반은 그냥 외벽이고(집이 ㄴ자로 꺾인다), 북쪽 절반에 화장실 문이 난다.
  b.push(piece(hx1, bz1, hx1, lz0));
  b.push(...wallWithDoor(hx1, hz0, hx1, bz1, (hz0 + bz1) / 2, 0.7, OPEN_ROOMS, '화장실 문'));

  // ── 외벽 ────────────────────────────────────────────────
  b.push(piece(kx0, hz0, kx0, kz1));        // 서쪽 — 아이 방·부엌을 한 줄로
  b.push(piece(kx0, hz0, bx1, hz0));        // 북쪽 — 부엌·복도·화장실을 한 줄로
  b.push(piece(bx1, hz0, bx1, bz1));        // 동쪽 — 화장실
  b.push(piece(bx0, bz1, bx1, bz1));        // 화장실 남벽
  b.push(piece(kx0, kz1, lx0, kz1));        // 아이 방 남벽 (거실 북벽이 못 덮는 구간만)
  b.push(piece(kx0, cz1, cx1, cz1));        // 부엌·아이 방 칸막이
  b.push(pillar(kx0, hz0), pillar(kx0, kz1), pillar(bx1, hz0), pillar(bx1, bz1));

  // ── 툇마루 ──────────────────────────────────────────────
  // 동/서 난간. 남쪽은 뒷마당으로 그대로 이어진다 (원작 툇마루는 마당을 향해 열려 있다)
  b.push(
    piece(px0, pz0, px0, pz1, { h: 0.5, color: C_PILLAR }),
    piece(px1, pz0, px1, pz1, { h: 0.5, color: C_PILLAR }),
  );

  // ── 뒷마당 담장 ─────────────────────────────────────────
  // 3면만 두른다. 북쪽은 툇마루·집이 막고 있다.
  b.push(
    piece(yx0, yz0, yx0, yz1, { t: FENCE_T, h: FENCE_H, color: C_FENCE }),
    piece(yx1, yz0, yx1, yz1, { t: FENCE_T, h: FENCE_H, color: C_FENCE }),
    piece(yx0, yz1, yx1, yz1, { t: FENCE_T, h: FENCE_H, color: C_FENCE }),
  );
  // 툇마루 좌우로 새는 자리를 막는다 — 마당이 10cm 전에 열리면 안 된다
  b.push(
    piece(yx0, pz1, px0, pz1, { t: FENCE_T, h: FENCE_H, color: C_FENCE }),
    piece(px1, pz1, yx1, pz1, { t: FENCE_T, h: FENCE_H, color: C_FENCE }),
  );

  return b;
}

/**
 * 원작 타케다 저택 1층.
 *
 * `City`가 읽는 `CityData` 그대로다 — OSM 도시와 같은 렌더·충돌 경로를 탄다.
 * 다른 건 `placement`가 붙어 있다는 것뿐이고, 그게 있으면 `World`가 도넛 공식
 * 대신 방 단위로 물건을 깐다.
 */
export function buildHouseStage(): CityData {
  return {
    name: '타케다 저택',
    slug: 'house',
    // 실제 좌표가 아니다. 스키마가 요구해서 채우는 값 — 이 스테이지는 OSM이 아니다.
    origin: { lat: 0, lon: 0 },
    radius: 12,
    spawn: { x: 0, z: 0 },
    buildings: buildWalls(),
    water: [],
    landmarks: [],
    placement: { rooms: HOUSE_ROOMS },
  };
}
