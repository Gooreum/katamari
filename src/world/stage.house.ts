import type { CityBuilding, CityData, CityRug, StageRoom } from './cityData';
import type { StageArea } from '../game/Stage';
import { ROOM_TABLES } from './generation';
import {
  block, piece as kitPiece, pillar as kitPillar, wallWithDoor as kitWallWithDoor,
  type PieceOpts, type SlabStyle,
} from './stage.kit';

/**
 * 원작 塊魂(2004)의 **타케다 저택 1층**.
 *
 * 원작에서 집 맵은 「별을 만들어라」 1~3이 공유한다. 왕자는 거실에서 시작하고,
 * 복도로 나가 아이 방·부엌·화장실을 돌고, 툇마루를 지나 뒷마당으로 나간다.
 * 구역은 문이 아니라 **크기**로 열린다 — 원작에서 뒷마당은 지름 10cm다.
 *
 * 다만 **1번은 거실 한 칸뿐이다** — 원작 「별을 만들어라 1」에는 다른 구역이 없다.
 * 그래서 `buildHouseStage(area)`가 구역을 받고, `'living'`이면 거실만 짓는다.
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
const C_BASE = 0x6b4a2a;   // 걸레받이 — 벽 밑을 두르는 나무 띠
const C_OUTLET = 0xf2ece0; // 콘센트 판
const C_SLOT = 0x2a2724;   // 콘센트 구멍 — 판을 콘센트로 만드는 건 이 두 점이다
/**
 * 창호지. **`C_DOOR`(0xfffaea)를 쓰면 안 보인다** — 벽(0xfbf0d2)과 대비가 1.06:1 이라
 * 둘 다 near-white 라서 원리상 구별이 안 된다(실제로 넣어보고 화면에서 확인했다).
 *
 * 명도로는 못 벌린다. 벽보다 밝게 만들 수가 없기 때문이다 — 벽이 이미 251,240,210 이다.
 * 그래서 **색상**으로 벌린다. 벽은 따뜻한 크림, 창호지는 바깥빛이 비치는 **찬 흰색**.
 * 레퍼런스에서도 장지문 쪽이 회벽보다 푸르게 뜬다.
 */
const C_SHOJI = 0xe8eef2;
/** 창호문 아래를 두르는 나무 판(코시이타). 격자의 대비는 종이가 아니라 이 나무가 만든다 */
const C_SHOJI_RAIL = 0x8a5a24;
const C_PILLAR = 0xc2762c; // 기둥·문틀 나무
const C_DOOR = 0xfffaea;   // 장지문 창호지
const C_FENCE = 0xc07d33;  // 판자 담장

// ─── 가구 색 ─────────────────────────────────────────────────
//
// 벽과 같은 규칙이다 — 실물색이 아니라 화면색. 가구는 벽(0xfbf0d2)·바닥(다다미
// 0xc8d27a) 위에 얹히므로 **둘 다와 대비가 나야** 덩어리로 읽힌다.

const C_WOOD = 0x9a6b3f;      // 서랍장·책장·상다리
const C_TV = 0x4a4744;        // 브라운관
const C_METAL = 0xc9ccd1;     // 스탠드 기둥·빨래 기둥
const C_APPLIANCE = 0xf4f1e8; // 냉장고·변기·세면대
const C_SINK = 0xd7d2c6;      // 싱크대 상판
const C_TUB = 0xa8d4e0;       // 욕조 — 화장실 바닥(F_BATH)과 같은 계열이라 명도로 벌린다
const C_QUILT = 0xe8eef2;     // 깔아둔 이불
const C_TOY = 0xe0483c;       // 장난감 상자
const C_TREE = 0x6f9c46;      // 마당 나무

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
 *
 * ## `labels` — 방마다 자기 물건
 *
 * 이게 없던 시절에는 표가 스테이지당 하나라 크기만으로 이름이 정해졌다.
 * 20cm짜리는 부엌에 있든 화장실에 있든 같은 여덟 이름에서 뽑혔고, 그래서
 * **부엌에 크레용·리모컨이, 화장실에 밥솥·전화기가** 깔렸다.
 * 방 이름은 '부엌'인데 내용물이 거실이었다.
 *
 * 표는 `generation.ts`가 갖는다(`ROOM_TABLES`) — 도구가 게임과 **같은 이름 목록**을
 * 읽어야 하고, 그 파일이 THREE를 모르는 쪽이기 때문이다. 여기서는 골라 물기만 한다.
 */
/** 바닥색. 벽과 같은 규칙 — 재료색이 아니라 화면색이다. */
const F_TATAMI = 0xc8d27a;
const F_WOOD = 0xcf9042;
const F_TILE = 0xeceadf;
const F_BATH = 0xa8d4e0;
const F_PORCH = 0xbf8038;
const F_DIRT = 0x9c7b48;

export const HOUSE_ROOMS: readonly StageRoom[] = [
  { id: 'living', name: '거실', rect: R_LIVING, floor: F_TATAMI, floorTex: 'tatami', sizeMin: 0.010, sizeMax: 0.28, count: 430, openAt: 0, labels: ROOM_TABLES['living']! },
  { id: 'hall', name: '복도', rect: R_HALL, floor: F_WOOD, floorTex: 'wood', sizeMin: 0.010, sizeMax: 0.22, count: 150, openAt: OPEN_HALL, labels: ROOM_TABLES['hall']! },
  { id: 'kids', name: '아이 방', rect: R_KIDS, floor: F_TATAMI, floorTex: 'tatami', sizeMin: 0.010, sizeMax: 0.34, count: 290, openAt: OPEN_ROOMS, labels: ROOM_TABLES['kids']! },
  { id: 'kitchen', name: '부엌', rect: R_KITCHEN, floor: F_TILE, sizeMin: 0.020, sizeMax: 0.40, count: 210, openAt: OPEN_ROOMS, labels: ROOM_TABLES['kitchen']! },
  { id: 'bath', name: '화장실', rect: R_BATH, floor: F_BATH, sizeMin: 0.010, sizeMax: 0.24, count: 80, openAt: OPEN_ROOMS, labels: ROOM_TABLES['bath']! },
  { id: 'porch', name: '툇마루', rect: R_PORCH, floor: F_PORCH, floorTex: 'wood', sizeMin: 0.020, sizeMax: 0.45, count: 70, openAt: OPEN_YARD, labels: ROOM_TABLES['porch']! },
  { id: 'yard', name: '뒷마당', rect: R_YARD, floor: F_DIRT, sizeMin: 0.030, sizeMax: 1.20, count: 250, openAt: OPEN_YARD, labels: ROOM_TABLES['yard']! },
];

// ─── 기하 ────────────────────────────────────────────────────

/**
 * 이 집의 치수. 계산은 `stage.kit.ts` 가 하고 여기서는 **상수만 묶는다** —
 * 동네 담장(0.18m·1.0m)과 호수 연석(0.30m·0.45m)이 같은 함수를 써야 해서
 * 치수가 인자로 빠졌다.
 */
const WALL: SlabStyle = { t: WALL_T, h: WALL_H, color: C_WALL };
const DOOR: SlabStyle = { t: WALL_T, h: DOOR_H, color: C_DOOR };

type SlabOpts = PieceOpts;

/**
 * 걸레받이. 벽 밑을 두르는 낮은 나무 띠.
 *
 * 원작 거실 화면에서 벽과 바닥이 만나는 자리에 이 띠가 있고, 그게 "방"이라는
 * 인상을 만든다. 없으면 벽이 바닥에 그냥 꽂혀 있는 판때기로 보인다.
 *
 * **벽과 같은 선 위에 둔다.** 새로 막는 게 아니라 이미 있는 벽을 두껍게 보이게
 * 할 뿐이라, 공의 이동 가능 영역이 안 바뀐다.
 */
function baseboard(x0: number, z0: number, x1: number, z1: number): CityBuilding {
  return kitPiece(x0, z0, x1, z1, { t: WALL_T + 0.04, h: 0.06, color: C_BASE });
}

/**
 * 붙박이 장지문 한 짝. **문이 아니다** — `gate`를 안 주므로 열리지 않는다.
 *
 * ## 왜 필요한가
 *
 * star1(`area === 'living'`)은 **문이 하나도 없는 판**이라(아래 `buildWalls` 주석 참고)
 * 5.4m 벽이 통짜 한 면이었다. 화면 상단 15%를 재보니 **최빈색이 85.6%** — 사실상 한 색이다.
 * 레퍼런스(REROLL 거실)의 같은 자리는 8.1%다. `house` 분기(star2·star4)의 거실에는
 * 미닫이문·창호문이 있어서 그 밝은 문짝이 벽을 갈라주는데, star1에만 그게 없었다.
 *
 * 그래서 **열리지 않는 장지문**을 넣는다. `gate`가 없으니 `City.openGates()`가
 * 첫 줄에서 빠져나오는 것도 그대로다.
 *
 * ## 가로 살이 없는 이유
 *
 * `City.geometryFor()`의 `ExtrudeGeometry`는 **바닥(y=0)부터** 뽑는다. 공중에 뜬 조각을
 * 못 만들어서 1.2m 높이의 가로 살은 원리상 불가능하다. 대신 높이 단차가 가로선을 만든다 —
 * 걸레받이 윗선(0.06) · 창호지 윗선(1.8) · 벽 윗선(2.4).
 */
function shoji(x0: number, x1: number, z: number): CityBuilding[] {
  const b: CityBuilding[] = [
    // 창호지. **돌출량을 걸레받이(WALL_T + 0.04)와 같게 둔다** —
    // 물체 배치 여유(generation.ts 의 ROOM_MARGIN 0.06)를 넘기면 벽에 물건이 박힌다
    kitPiece(x0, z, x1, z, { t: WALL_T + 0.04, h: DOOR_H, color: C_SHOJI }),
    // 코시이타 — 창호문 아랫단의 나무 판. 종이보다 앞에 둬야 보인다.
    // 걸레받이(0.06)보다 높아야 파묻히지 않는다
    kitPiece(x0, z, x1, z, { t: WALL_T + 0.07, h: 0.28, color: C_SHOJI_RAIL }),
  ];
  // 세로 살. **격자의 대비는 종이가 아니라 이 나무가 만든다** —
  // 종이와 벽은 둘 다 near-white 라 붙여놔도 경계가 안 보인다.
  // 살 간격 0.33m — 실제 장지문 살이 그 정도다. 7등분(0.51m)으로 시작했더니
  // 벽 띠 최빈색이 67.4%로 목표(65%)를 못 넘었다. 간격을 좁히는 게 정답이다
  const N = 11;
  for (let i = 0; i <= N; i++) {
    const x = x0 + ((x1 - x0) * i) / N;
    b.push(kitPiece(x - 0.022, z, x + 0.022, z,
      { t: WALL_T + 0.09, h: DOOR_H, color: C_PILLAR }));
  }
  return b;
}

/**
 * 콘센트. 판 + 구멍 둘.
 *
 * ## 예전 것은 두 겹으로 안 보였다
 *
 *   1. **색**: `C_OUTLET`(0xf2ece0) 대 `C_WALL`(0xfbf0d2) 대비가 **1.05:1** —
 *      둘 다 near-white 라 원리상 구별이 안 된다
 *   2. **위치**: 두께 `WALL_T + 0.03`(0.13) 에 높이 0.06 인데, 걸레받이가
 *      `WALL_T + 0.04`(0.14) 에 높이 0.06 이다. **더 두껍고 같은 높이라
 *      콘센트가 걸레받이 속에 통째로 파묻혀 있었다.**
 *
 * 「콘센트를 화면으로 확인 못 했다」고 남겨뒀던 게 이거였다. 못 본 게 아니라 없었다.
 *
 * 그래서 판을 걸레받이보다 **두껍고 높게** 올리고, 구멍을 **어두운 조각**으로 판다.
 * 콘센트를 콘센트로 만드는 건 판이 아니라 그 두 구멍이다.
 *
 * 높이 0.16m 는 실제 콘센트보다 낮다. `City.geometryFor()` 의 압출이 바닥에서
 * 시작해서 공중에 뜬 조각을 못 만드는 게 이유다 — 이 파일의 「평면 엔진의 한계」와 같은 계열.
 */
function outlet(x: number, z: number, alongX: boolean): CityBuilding[] {
  const bar = (w: number, t: number, h: number, color: number, off: number): CityBuilding =>
    kitPiece(
      alongX ? x + off - w : x, alongX ? z : z + off - w,
      alongX ? x + off + w : x, alongX ? z : z + off + w,
      { t, h, color },
    );
  return [
    bar(0.06, WALL_T + 0.08, 0.16, C_OUTLET, 0),
    bar(0.010, WALL_T + 0.11, 0.12, C_SLOT, -0.022),
    bar(0.010, WALL_T + 0.11, 0.12, C_SLOT, +0.022),
  ];
}

function piece(x0: number, z0: number, x1: number, z1: number, o: SlabOpts = {}): CityBuilding {
  return kitPiece(x0, z0, x1, z1, WALL, o);
}

/**
 * 문이 뚫린 벽 한 장.
 *
 * `gate` 불변식(`gate < size / pickRatio`)은 여기서 자동으로 지켜진다 —
 * 문짝 폭이 최소 0.6m라 size가 최소 1.8m(DOOR_H)이고,
 * 가장 큰 개방값 0.10m 는 1.8 / 0.85 = 2.12m 보다 한참 작다.
 */
function wallWithDoor(
  x0: number, z0: number, x1: number, z1: number,
  at: number, w: number, gate: number, name: string,
  o: SlabOpts = {},
): CityBuilding[] {
  return kitWallWithDoor(x0, z0, x1, z1, at, w, gate, name, WALL, DOOR, o);
}

/** 모서리 기둥. 벽이 만나는 자리에 세워 실루엣을 끊는다 — 원작 목조 주택의 결이다. */
function pillar(x: number, z: number): CityBuilding {
  return kitPillar(x, z, { t: WALL_T, h: WALL_H, color: C_PILLAR });
}

// ─── 집 짓기 ─────────────────────────────────────────────────

function buildWalls(area: StageArea): CityBuilding[] {
  const b: CityBuilding[] = [];
  const [lx0, lz0, lx1, lz1] = R_LIVING;

  /**
   * **거실 전용 — 문이 하나도 없다.**
   *
   * 원작 1번은 다른 구역이 *없는* 판이라, 나가는 문을 잠그는 게 아니라 애초에
   * 문이 없다. 그래서 `gate`가 0개고 `City.openGates()`가 첫 줄에서 빠져나오며,
   * 화자의 `gate` 대사도 안 뜬다 — 열릴 게 없으니 맞는 동작이다.
   *
   * 문턱만 올려서 잠그는 방법도 있지만, 그러면 갈 수도 없는 방 여섯 개에
   * 물건 1,050개를 깔고 바닥 여섯 장을 그리게 된다.
   */
  if (area === 'living') {
    b.push(
      piece(lx0, lz0, lx0, lz1), piece(lx1, lz0, lx1, lz1),
      piece(lx0, lz0, lx1, lz0), piece(lx0, lz1, lx1, lz1),
      pillar(lx0, lz0), pillar(lx1, lz0), pillar(lx0, lz1), pillar(lx1, lz1),
      // 중간 기둥. 벽 한 장이 5.4m·4.5m 라 **모서리 기둥만으로는 안 끊긴다** —
      // 실제로 화면 상단 15%의 최빈색이 85.6%였다. 남북은 장지문 폭(±1.8) 바깥에,
      // 동서는 한가운데.
      pillar(-2.25, lz0), pillar(2.25, lz0), pillar(-2.25, lz1), pillar(2.25, lz1),
      pillar(lx0, 0), pillar(lx1, 0),
      // 벽 밑 나무 띠 네 면. 벽과 같은 선이라 막는 범위는 안 바뀐다
      baseboard(lx0, lz0, lx0, lz1), baseboard(lx1, lz0, lx1, lz1),
      baseboard(lx0, lz0, lx1, lz0), baseboard(lx0, lz1, lx1, lz1),
    );
    // 붙박이 장지문 — 북(복도 쪽)·남(툇마루 쪽). `house` 분기에서 문이 서는 자리다.
    // 여기서는 열리지 않는다 — 이 판에는 갈 곳이 없다.
    b.push(...shoji(-1.8, 1.8, lz0), ...shoji(-1.8, 1.8, lz1));
    // 콘센트 둘 — 북벽과 서벽에 하나씩. 북쪽은 **장지문 폭 밖의 민벽**에 붙인다
    b.push(...outlet(-2.05, lz0, true), ...outlet(lx0, 0.7, false));
    return b;
  }

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

// ─── 가구 ────────────────────────────────────────────────────

/**
 * 상판 없는 **다리 넷.**
 *
 * `City.geometryFor()`의 압출은 바닥(y=0)에서 시작해 **공중에 뜬 면을 못 만든다**
 * (장지문에 가로 살이 없는 것과 같은 이유). 그래서 밥상·책상·식탁·평상은
 * 상판을 못 얹는다.
 *
 * **타협이 아니라 오히려 정답에 가깝다.** 원작에서 5cm 왕자는 밥상 *밑을* 지나간다.
 * 다리만 있으면 작은 공은 사이로 빠지고 큰 공은 다리를 먹는다 — 그 감각이 그대로 남는다.
 *
 * 다리 하나의 `size`는 가로·세로·높이 중 최대라 **곧 다리 높이**다. 0.30m짜리
 * 밥상 다리는 지름 35cm부터 먹힌다(`pickRatio` 0.85).
 */
function legs(
  x0: number, z0: number, x1: number, z1: number, h: number, w = 0.07,
): CityBuilding[] {
  const at: ReadonlyArray<readonly [number, number]> = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]];
  return at.map(([x, z]) =>
    block([x - w / 2, z - w / 2, x + w / 2, z + w / 2], h, 'retail', C_WOOD, '상다리'));
}

/**
 * 방 안의 가구.
 *
 * ## 가구는 새 개념이 아니라 `CityBuilding` 이다
 *
 * 동네 맵이 이미 그렇게 한다(집 5채·상점 4채·자판기·텐트). `kind`를 `'wall'`/`'door'`가
 * 아닌 값으로 주면 세 가지가 **공짜로** 따라온다:
 *
 *   1. `Game.resolveCity()`가 크기가 차면 먹는다 — 원작에서 서랍장·TV를 삼키는 그 순간
 *   2. `World.buildBlocked()`가 바닥면을 비운다 — 소품이 가구 속에 안 파묻힌다
 *   3. `ladder`·`curve`가 자동으로 센다 (`kind !== 'wall' && kind !== 'door'`)
 *
 * 새 충돌 코드도 새 렌더 경로도 한 줄이 필요 없다.
 *
 * ## 왜 넣나 — 측정된 이유가 있다
 *
 * `ladder --city house`가 **78cm~2m 구간 14개(권장 16 이상)** 를 구멍으로 잡고 있었다.
 * 그 크기대는 원래 가구가 채우는 자리인데 집에 가구가 한 점도 없었다.
 * 방이 텅 빈 사각형이라 "무슨 방인지" 안 보이는 것과 같은 원인이다.
 *
 * ## 좌표 규약
 *
 * 벽 **안쪽 면** 기준이다. 벽은 두께 0.10이 중심선에 걸리고 걸레받이가 0.14라,
 * 거실(±2.7, ±2.25)의 안쪽 면은 **x ±2.63 · z ±2.18** 이다.
 * 콘센트(북벽 x=−2.05 · 서벽 z=0.7)와 장지문 폭(x −1.8~1.8)은 피한다 —
 * 앞선 작업이 「화면에 안 보이던 결함」을 고쳐가며 세운 것들이라 가구로 덮으면 안 된다.
 */
function buildFurniture(area: StageArea): CityBuilding[] {
  const b: CityBuilding[] = [
    // ── 거실 ────────────────────────────────────────────────
    // 서쪽 벽에 서랍장 + TV. 콘센트가 z=0.7 이라 그 북쪽 구간만 쓴다
    block([-2.60, -1.90, -2.15, -1.00], 0.62, 'retail', C_WOOD, '서랍장'),
    block([-2.58, -0.85, -2.18, -0.35], 0.46, 'retail', C_TV, '텔레비전'),
    // 북벽 동쪽 끝 — 장지문(x −1.8~1.8) 밖의 민벽
    block([1.95, -2.15, 2.60, -1.85], 1.05, 'civic', C_WOOD, '책장'),
    // 동벽. 스탠드는 1.2m라 star1(10cm)·star2(20cm)에서는 끝까지 못 먹는다
    block([2.35, -0.20, 2.55, 0.00], 1.20, 'retail', C_METAL, '스탠드'),
    block([2.25, 1.55, 2.58, 1.90], 0.58, 'retail', C_WOOD, '전화대'),
    // 밥상 — 깔개(중심 0.35,−0.25 · 2.4×1.6 · 0.34rad) 위에 올린다.
    // 스폰(0,0)에서 0.55m 떨어뜨렸다 — 시작하자마자 다리에 박히면 안 된다
    ...legs(0.55, -0.70, 1.35, -0.05, 0.30),
  ];
  if (area === 'living') return b;   // star1은 거실 한 칸뿐이다

  b.push(
    // ── 복도 ────────────────────────────────────────────────
    // **문 자리를 피한다.** 아이 방 문 z −4.5~−3.6 · 부엌 문 −7.65~−6.75 ·
    // 화장실 문 −8.0~−7.3. 문 앞을 막으면 그 구역이 열려도 못 들어간다 —
    // 화면으로는 안 보이는 결함이라 도달 검사(Step 3)가 잡는다.
    block([-0.82, -3.30, -0.52, -2.50], 0.55, 'retail', C_WOOD, '신발장'),
    block([0.55, -3.20, 0.75, -3.00], 0.48, 'retail', 0x3fbfc4, '우산꽂이'),

    // ── 아이 방 ─────────────────────────────────────────────
    ...legs(-4.20, -5.60, -3.20, -5.05, 0.55),                         // 책상
    block([-3.85, -4.85, -3.55, -4.55], 0.45, 'retail', C_WOOD, '의자'),
    // 깔아둔 이불. 낮고 넓어서 **바닥을 나누는 면**으로 읽힌다
    block([-2.60, -5.60, -1.30, -3.70], 0.22, 'retail', C_QUILT, '이불'),
    block([-4.30, -3.10, -3.80, -2.60], 0.34, 'retail', C_TOY, '장난감 상자'),
    block([-4.35, -4.60, -4.05, -3.50], 1.00, 'civic', C_WOOD, '책장'),

    // ── 부엌 ────────────────────────────────────────────────
    block([-4.35, -8.40, -2.60, -7.80], 0.85, 'retail', C_SINK, '싱크대'),
    block([-2.30, -8.40, -1.70, -7.80], 1.55, 'civic', C_APPLIANCE, '냉장고'),
    block([-4.35, -7.50, -4.05, -6.60], 1.45, 'civic', C_WOOD, '찬장'),
    // 식탁. **찬장(x −4.35~−4.05)에서 떼어놓는다** — 처음엔 다리가 x=−4.10 이라
    // 찬장 속에 박혀 있었다. 겹치면 한 덩어리로 보이고 부피가 두 번 계산된다
    ...legs(-3.95, -6.90, -2.75, -6.20, 0.68, 0.08),

    // ── 화장실 ──────────────────────────────────────────────
    // 1.8m × 1.8m 짜리 방이라 셋만 넣어도 꽉 찬다. 문(x=0.9, z −8.0~−7.3)
    // 앞의 0.7m 통로는 비워둔다
    block([1.60, -8.42, 2.58, -7.75], 0.55, 'retail', C_TUB, '욕조'),
    block([2.15, -7.35, 2.58, -6.90], 0.72, 'retail', C_APPLIANCE, '변기'),
    block([1.05, -7.30, 1.45, -6.90], 0.78, 'retail', C_APPLIANCE, '세면대'),

    // ── 툇마루 ──────────────────────────────────────────────
    // 폭 1.2m 짜리 **통로**다. 한 점만 둔다 — 두 점이면 뒷마당 가는 길이 막힌다
    block([-2.45, 2.45, -2.05, 2.85], 0.42, 'retail', 0x8a4f2a, '화분대'),

    // ── 뒷마당 ──────────────────────────────────────────────
    block([1.60, 4.20, 2.50, 5.10], 0.85, 'retail', C_FENCE, '개집'),
    block([-3.80, 7.90, -2.20, 9.25], 1.80, 'civic', C_METAL, '창고'),
    /**
     * 마당 나무. 집 맵에서 제일 큰 물건이다.
     *
     * **`ladder` 가 이 그루 때문에 꼭대기 칸을 「얇음」으로 잡는다.** 사다리 칸은
     * 가장 작은 물체에서 옥타브로 끊으므로, 제일 큰 것이 커지면 칸이 하나 더 생기고
     * 그 칸에는 가구 예닐곱 개밖에 없다. 1.9m로 내려봤지만 칸 하나가 통째로
     * 사라지지 않는 한 결과는 같았다.
     *
     * **그래서 안 고친다.** 그 칸(1.3~2.6m)에 닿으려면 공이 1.5m는 돼야 하는데
     * 집 스테이지 목표는 star4의 1m가 최대다 — **아무도 안 밟는 칸**이다.
     * 도구를 만족시키자고 마당에 2m짜리 물건 아홉 개를 더 세우는 건
     * 사다리를 메우는 게 아니라 마당을 망치는 것이다.
     */
    block([-0.40, 7.60, 0.40, 8.40], 2.60, 'civic', C_TREE, '나무'),
    ...legs(2.40, 7.30, 3.50, 8.40, 0.38, 0.09),                       // 평상
    // 빨래 기둥 둘. 사이의 빨랫줄은 **공중에 뜬 면**이라 못 만든다
    // (밥상 상판과 같은 한계). 기둥 둘만으로도 마당의 세로선이 된다
    block([-2.64, 5.16, -2.48, 5.32], 1.70, 'retail', C_METAL, '빨래 기둥'),
    block([2.48, 6.52, 2.64, 6.68], 1.70, 'retail', C_METAL, '빨래 기둥'),
  );
  return b;
}

/**
 * 원작 타케다 저택 1층.
 *
 * `City`가 읽는 `CityData` 그대로다 — OSM 도시와 같은 렌더·충돌 경로를 탄다.
 * 다른 건 `placement`가 붙어 있다는 것뿐이고, 그게 있으면 `World`가 도넛 공식
 * 대신 방 단위로 물건을 깐다.
 *
 * `area`가 `'living'`이면 거실 한 칸만 짓는다 — 원작 「별을 만들어라 1」이다.
 * **기본값이 `'house'`인 건 도구 때문이다** — `ladder`·`curve`·기존 e2e가 인자 없이
 * 부르고, 그것들이 재야 하는 건 저택 전체다.
 */
export function buildHouseStage(area: StageArea = 'house'): CityData {
  // 방이 없으면 물건도 안 깔린다. 벽과 방 목록이 **같은 구역**을 봐야 한다 —
  // 어긋나면 벽 없는 곳에 물건이 깔리거나 빈 방이 생긴다.
  const rooms = area === 'living'
    ? HOUSE_ROOMS.filter((r) => r.id === 'living')
    : HOUSE_ROOMS;
  return {
    name: '타케다 저택',
    slug: 'house',
    // 실제 좌표가 아니다. 스키마가 요구해서 채우는 값 — 이 스테이지는 OSM이 아니다.
    origin: { lat: 0, lon: 0 },
    radius: 12,
    spawn: { x: 0, z: 0 },
    buildings: [...buildWalls(area), ...buildFurniture(area)],
    water: [],
    landmarks: [],
    placement: { rooms },
    rugs: buildRugs(area),
  };
}

/**
 * 깔개. 지금은 거실 한 장뿐이다.
 *
 * 원작 거실에서 분홍 카펫이 다다미를 **비스듬히** 가로지른다 — 그 대각선이
 * "바닥이 여러 재질"이라는 인상을 만든다. 축에 맞춰 깔면 방바닥을 한 번 더
 * 나눈 것에 그치고 재질이 둘이라는 게 안 읽힌다.
 *
 * 거실은 5.4m × 4.5m 다. 2.4 × 1.6m 면 바닥의 약 16% — 다다미를 가리지 않으면서
 * 화면 안에서 한 덩어리로 읽히는 크기다.
 */
function buildRugs(area: StageArea): CityRug[] {
  if (area !== 'living' && area !== 'house') return [];
  return [{ cx: 0.35, cz: -0.25, w: 2.4, d: 1.6, rotY: 0.34, tex: 'rug' }];
}
