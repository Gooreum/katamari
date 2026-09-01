import type { CityBuilding, CityData, CityRug, StageProp, StageRoom } from './cityData';
import type { StageArea } from '../game/Stage';
import { ROOM_TABLES, type RoomPlacement } from './generation';
import {
  piece as kitPiece, pillar as kitPillar, wallWithDoor as kitWallWithDoor,
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
/**
 * 담장. **0xc07d33 주황갈색에서 대나무 탠으로 옮겼다.**
 * 마당 바닥이 흙색일 때는 안 튀었는데 이끼를 깔고 나니 초록과 정면으로 부딪혀
 * 「흙벽」으로 읽혔다. 색 하나를 바꾸는 건 바닥을 바꾸면 따라와야 하는 것이다.
 */
const C_FENCE = 0xa8964e;  // 대나무 울타리

// ─── 가구 색 ─────────────────────────────────────────────────
//
// 벽과 같은 규칙이다 — 실물색이 아니라 화면색. 가구는 벽(0xfbf0d2)·바닥(다다미
// 0xc8d27a) 위에 얹히므로 **둘 다와 대비가 나야** 덩어리로 읽힌다.

// 냉장고·변기·세면대·싱크대·욕조·이불·장난감 상자의 색 상수는 지웠다 —
// 그 일곱은 `HOUSE_PROPS`(형상)로 옮겨서 이제 `SHAPE_COLOR` 의 팔레트를 쓴다

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
/**
 * **방 크기를 «밀도»로 정했다.**
 *
 * 사용자가 「훨씬 나아졌다」고 한 거실이 **m²당 11.2개**다. 아이 방·부엌·화장실은
 * 22~26개로 그 두 배였고, 그게 「여전히 무질서해 보인다」의 절반이다.
 * **물건 개수는 그대로 두고 방을 넓혀서** 밀도를 거실에 맞춘다.
 *
 *   아이 방 13.0 → 25.9m²  (295개 → 11.4/m²)
 *   부엌     9.7 → 19.2m²  (214개 → 11.1/m²)
 *   화장실   3.2 →  7.2m²  ( 83개 → 11.5/m²)
 *   복도    11.3 → 20.7m²  (152개 →  7.3/m² — 통로는 성긴 게 맞다)
 *
 * **벽과 문은 여기만 고치면 따라온다.** `buildWalls` 의 house 갈래가 좌표를 전부
 * 이 사각형에서 파생시키고, 문도 `(kz0 + kz1) / 2` 처럼 방의 중점이라 같이 움직인다.
 *
 * 거실·툇마루·뒷마당은 안 건드린다 — 거실은 사용자가 인정한 방이고,
 * 마당은 이미 5.3/m² 로 성기다.
 */
const R_HALL: Rect = [-1.1, -11.65, 1.1, -2.25];
const R_KIDS: Rect = [-5.9, -7.65, -1.1, -2.25];
const R_KITCHEN: Rect = [-5.9, -11.65, -1.1, -7.65];
const R_BATH: Rect = [1.1, -11.65, 3.5, -8.65];
const R_PORCH: Rect = [-2.7, 2.25, 2.7, 3.45];
const R_YARD: Rect = [-4.0, 3.45, 4.0, 9.45];

type Rect = readonly [number, number, number, number];

/**
 * 방 목록. **순서가 곧 바닥을 까는 순서다** — 뒤가 위로 온다.
 *
 * 크기 범위는 원작 아이템 실측에 맞췄다. 거실이 28cm까지인 건
 * RC 컨트롤러(30.1cm)가 거실 물건이라 그 바로 아래에서 끊은 것이고,
 * 뒷마당은 **0.34m 에서 끊고 마흔 개만 흩뿌린다**(전 0.70m · 아흔 개).
 *
 * 레퍼런스: 「보는 자리에 가까운 것이 크고 먼 것이 작다」. 방 흩뿌림은 방 전체에
 * **균등한 크기**로 뿌려지므로 아흔 개를 그렇게 두면 그 깊이 등급이 아예 안 생긴다.
 * 개수를 **자리로 옮겨** 자리마다 `sizeMax` 를 달리 준다(전경 0.30 → 원경 0.14).
 * 방+자리 총합 250 은 안 바뀐다 — 사다리·성장 곡선이 그 숫자를 쓴다.
 *
 * 제일 큰 물건은 **손배치가 맡는다**
 * (석등 1.20 · 소나무 1.45 · 대나무 1.90 · 창고 1.80 · 나무 2.60).
 * **아이 방이 40cm까지인 건 곰인형(35cm) 때문이다** — 34cm로 끊었더니
 * 30~60cm 칸이 좁은 슬라이스뿐이라 곰인형이 한 판에 0개로 나왔다.
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
 *
 * ## `edge` — 벽 쪽으로 민다
 *
 * 배치가 사각형 안 균등 난수라 **방 한가운데까지 골고루** 뿌려졌다. 실제 방은 반대다 —
 * 가운데가 비고 벽·가구를 따라 쌓인다. 그래서 물건이 놓인 게 아니라 버려진 것으로 보였다.
 *
 * 값은 `edgeBias` 의 지수다. 중앙 40%×40% 에 남는 비율이 `0.4^(2/p)` 라
 * 1.00 → 16% · 0.80 → 10% · 0.70 → 7% · 0.55 → 3.6% 이다.
 * **0.66~0.82 를 쓴다** — 더 세게 밀면 방 한가운데가 통째로 비어서 그것대로 인공적이다.
 *
 * 방마다 다른 이유: 복도(1.8m)·툇마루(1.2m)는 폭이 좁아 「가장자리」랄 게 없어서 약하게,
 * 부엌은 싱크대·찬장이 벽을 두르고 있어 세게. 뒷마당은 실내가 아니라 중간이다.
 */
/** 바닥색. 벽과 같은 규칙 — 재료색이 아니라 화면색이다. */
const F_TATAMI = 0xc8d27a;
const F_WOOD = 0xcf9042;
const F_TILE = 0xeceadf;
const F_BATH = 0xa8d4e0;
const F_PORCH = 0xbf8038;
/**
 * 뒷마당 바닥. **흙이 아니라 이끼다.**
 *
 * `0x9c7b48` 흙색 한 장이었을 때 마당은 정원이 아니라 공사장이었다 —
 * 일곱 방 중 마당만 `floorTex` 가 없어서 화면 절반이 무늬 없는 갈색 판이었다.
 * 일본 정원의 바탕은 이끼고, 그 위를 자갈 마당(`buildRugs`)이 가른다.
 */
const F_MOSS = 0x5f7a3a;

export const HOUSE_ROOMS: readonly StageRoom[] = [
  { id: 'living', name: '거실', rect: R_LIVING, floor: F_TATAMI, floorTex: 'tatami', sizeMin: 0.022, sizeMax: 0.28, count: 40, openAt: 0, labels: ROOM_TABLES['living']!, edge: 0.68, align: true, ceiling: 2.4 },
  { id: 'hall', name: '복도', rect: R_HALL, floor: F_WOOD, floorTex: 'wood', sizeMin: 0.010, sizeMax: 0.22, count: 42, openAt: OPEN_HALL, labels: ROOM_TABLES['hall']!, edge: 0.76, align: true, ceiling: 2.4 },
  { id: 'kids', name: '아이 방', rect: R_KIDS, floor: F_TATAMI, floorTex: 'tatami', sizeMin: 0.010, sizeMax: 0.40, count: 70, openAt: OPEN_ROOMS, labels: ROOM_TABLES['kids']!, edge: 0.7, align: true, ceiling: 2.4 },
  { id: 'kitchen', name: '부엌', rect: R_KITCHEN, floor: F_TILE, floorTex: 'tile', sizeMin: 0.020, sizeMax: 0.40, count: 48, openAt: OPEN_ROOMS, labels: ROOM_TABLES['kitchen']!, edge: 0.66, align: true, ceiling: 2.4 },
  { id: 'bath', name: '화장실', rect: R_BATH, floor: F_BATH, floorTex: 'tile', sizeMin: 0.010, sizeMax: 0.24, count: 18, openAt: OPEN_ROOMS, labels: ROOM_TABLES['bath']!, edge: 0.72, align: true, ceiling: 2.4 },
  { id: 'porch', name: '툇마루', rect: R_PORCH, floor: F_PORCH, floorTex: 'wood', sizeMin: 0.020, sizeMax: 0.45, count: 20, openAt: OPEN_YARD, labels: ROOM_TABLES['porch']!, edge: 0.82, align: true, ceiling: 2.2 },
  { id: 'yard', name: '뒷마당', rect: R_YARD, floor: F_MOSS, floorTex: 'moss', sizeMin: 0.030, sizeMax: 0.34, count: 40, openAt: OPEN_YARD, labels: ROOM_TABLES['yard']!, edge: 0.74 },
];


/**
 * 물건이 **모여 있는 자리.** 방 위에 겹치는 배치 전용 구역이다 — 바닥을 안 그린다.
 *
 * ## 왜 필요한가
 *
 * 방 배치는 사각형 안 난수다. `edge` 로 벽 쪽에 몰아도 그건 여전히 **난수**라,
 * 「가장자리에 고르게 흩뿌려진」 그림이 된다. 실제 집은 그렇지 않다 —
 * 그릇은 싱크대 앞에 쌓이고 크레용은 책상 밑에 쏟아져 있고 슬리퍼는 신발장 앞에 있다.
 * **물건이 모이는 데는 이유가 있고, 그 이유는 대부분 가구다.**
 *
 * 그래서 자리는 전부 **가구를 기준으로** 잡는다 (그래서 가구가 먼저였다).
 *
 * ## 개수는 방에서 뺀 만큼이다
 *
 * 거실 430 → 방 300 + 자리 130 처럼 **총합 1,480을 유지한다.** 밀도를 올리면
 * 이 작업이 배치를 고친 건지 물량을 늘린 건지 구별할 수 없게 된다.
 *
 * `edge` 는 안 준다(기본 1 = 균등). 자리는 이미 작은 사각형이라 그 안에서 또 밀 이유가 없다.
 *
 * **`align` 은 준다.** 안 줬더니 벽에 붙은 자리(TV 앞·신발장 앞·욕조 옆)의 물건만
 * 각도가 제멋대로여서, 방 전체의 벽 근처 정렬률이 100% → 82%로 떨어졌다.
 * 자리 사각형은 방과 같은 축이라 자리 모서리에 맞추면 벽에 맞추는 것과 같은 방향이 나온다.
 */
export const HOUSE_SPOTS: readonly RoomPlacement[] = [
  // ── 거실 — 바닥 자리 108 + 표면 110 (방 40 + 218 = 258) ───
  //
  // **개수를 280 → 120 으로 줄였다가 258 로 올렸다.** 줄인 건 옳았다 —
  // 24.3m² 에 바닥 소품 250개면 무슨 짓을 해도 쓰레기장이고, `curve` 로 재면
  // star1(10cm)은 그중 25개만 먹으면 끝난다. 그런데 120은 이번엔 휑했다.
  // **늘어난 138개는 전부 «자리» 안에 들어간다** — 흩뿌림은 30 → 40 뿐이다.
  //
  // **`only` 로 자리마다 물건을 못 박는다.** 여태 자리마다 방 표 전체(30종)에서
  // 뽑아서 TV 앞에 사과가 있고 밥상 밑에 압정이 있었다. 실제 방은 같은 것끼리 모인다.
  //
  // **크기 범위는 `only` 에 맞춰야 한다.** 크기와 이름을 «따로» 뽑기 때문에
  // `sizeMin: 0.010` 인 자리에 `only: ['신문']` 을 주면 **1.6cm 신문**이 나온다.
  // 실측하니 신문 1.6cm · 찌라시 1.0cm · 건전지 0.8cm 가 굴러다니고 있었다 —
  // 사용자가 「뭔지 잘 모르겠다」고 한 것의 절반이 이거다. 티끌이라 안 읽히는 게 아니라
  // **그 물건이 그 크기일 리가 없어서** 안 읽힌다.

  // 밥상 밑 — 상에서 떨어진 것. **이제 공이 밑으로 들어간다**(`underPass`)
  { id: 'spot-under-table', rect: [0.46, 0.16, 1.04, 0.74], sizeMin: 0.015, sizeMax: 0.045, count: 8, openAt: 0, labels: ROOM_TABLES['living']!, align: true, only: ['동전', '각설탕', '캐러멜'] },
  // 상 옆 — 방석 사이에 놓고 굴리는 것
  { id: 'spot-table-side', rect: [1.20, -0.45, 1.75, 0.05], sizeMin: 0.025, sizeMax: 0.090, count: 12, openAt: 0, labels: ROOM_TABLES['living']!, align: true, only: ['껌', '사탕', '주사위'] },
  // TV 앞 — 리모컨과 건전지가 굴러다니는 자리
  { id: 'spot-tv-front', rect: [-2.00, -1.30, -1.55, -0.40], sizeMin: 0.045, sizeMax: 0.140, count: 10, openAt: 0, labels: ROOM_TABLES['living']!, align: true, only: ['RC 컨트롤러', '건전지'] },
  // TV장 옆 — 다 본 테이프를 쌓아두는 자리
  { id: 'spot-tv-side', rect: [-2.55, -1.75, -2.15, -1.42], sizeMin: 0.170, sizeMax: 0.230, count: 12, openAt: 0, labels: ROOM_TABLES['living']!, align: true, only: ['비디오테이프', '책'] , arrange: 'stack' },
  // 서랍장 앞 — 읽고 던져둔 신문
  { id: 'spot-chest-front', rect: [-2.10, 0.95, -1.65, 1.75], sizeMin: 0.170, sizeMax: 0.260, count: 10, openAt: 0, labels: ROOM_TABLES['living']!, align: true, only: ['신문', '찌라시'] },
  // 책장 앞 — 꺼내놓고 안 꽂은 책
  { id: 'spot-shelf-front', rect: [1.95, -1.60, 2.60, -1.20], sizeMin: 0.170, sizeMax: 0.240, count: 10, openAt: 0, labels: ROOM_TABLES['living']!, align: true, only: ['책'] },
  // 책장 옆 — 바닥에 쌓아둔 인쇄물
  { id: 'spot-shelf-side', rect: [1.50, -2.14, 1.84, -1.80], sizeMin: 0.170, sizeMax: 0.260, count: 10, openAt: 0, labels: ROOM_TABLES['living']!, align: true, only: ['신문', '찌라시'] , arrange: 'stack' },
  // 창가 — 볕 드는 자리. 차 마시고 둔 것들
  { id: 'spot-window', rect: [2.20, -0.80, 2.55, 0.50], sizeMin: 0.070, sizeMax: 0.130, count: 16, openAt: 0, labels: ROOM_TABLES['living']!, align: true, only: ['찻잔', '귤', '재떨이'] },
  // 남서 구석 — 쓸어 모아둔 자리. 작은 것만 모인다.
  // **`'lean'`** — 클립·단추·압정은 1~3cm 라 바닥에 누우면 아예 안 보인다.
  // 두께를 키우는 건 틀린 답이다(원래 얇은 물건이다) — 각도로 푼다.
  // **개미를 뺐다.** 쓸려 나온 물건 셋(클립·단추·압정)과 달리 개미는 «쓸어 모은» 것이
  // 아니다. 방 흩뿌림으로는 여전히 나온다 — 표에서 뺀 게 아니라 이 자리에서만 뺐다
  { id: 'spot-corner-sw', rect: [-2.58, 1.60, -1.90, 2.10], sizeMin: 0.010, sizeMax: 0.030, count: 10, openAt: 0, labels: ROOM_TABLES['living']!, align: true, only: ['클립', '단추', '압정'] , arrange: 'lean' },
  // 툇마루 문 앞 — 드나들며 놓고 가는 자리
  { id: 'spot-door-south', rect: [-0.60, 1.75, 0.60, 2.10], sizeMin: 0.070, sizeMax: 0.150, count: 10, openAt: 0, labels: ROOM_TABLES['living']!, align: true, only: ['찻잔', '접시'] },

  // ── 거실 표면 110 — `y` 가 있으면 그 높이에 얹힌다 ───────
  //
  // **star1(10cm)에서 하나도 안 먹힌다** — 올려다보기만 하는 물건이고
  // 그게 「저건 나중에」라는 원작의 감각이다. star4(1m)에서 상 위를 쓸어간다.
  //
  // **높이는 형상에서 뽑은 실측 수평면이다.** 눈대중으로 적었다가 두 번 걸렸다 —
  // 처음엔 서랍장 물건을 서랍 앞면 한가운데(0.62)에 띄웠고, 고친 뒤에도
  // 책장 선반을 «가운데» 높이(0.315·0.588)로 적어서 물건이 1.7cm 씩 박혀 있었다.
  // 진짜 선반 윗면은 0.332 · 0.605 · 0.878 이다.
  //
  // **`only` 는 크기가 맞는 것끼리 묶는다.** 크기와 이름을 따로 뽑기 때문에
  // 6cm 화투와 22cm 책을 한 자리에 넣으면 22cm 화투와 6cm 책이 나온다.
  //
  // **책장은 칸 사이가 0.273m 다** — 그보다 큰 물건은 위 선반을 뚫는다.
  // 맨 위 칸은 천장까지 0.172m 뿐이라 더 낮게 잡았다.

  // 밥상 위 — 차 마시는 자리. 이 방에서 제일 눈에 띄는 면이다
  { id: 'surf-table', rect: [0.42, 0.12, 1.08, 0.78], sizeMin: 0.070, sizeMax: 0.130, count: 18, openAt: 0, labels: ROOM_TABLES['living']!, align: true, y: 0.325, only: ['찻잔', '귤', '재떨이'] , arrange: 'row' },
  // TV장 위
  { id: 'surf-tv-stand', rect: [-2.50, -1.20, -2.20, -0.50], sizeMin: 0.120, sizeMax: 0.190, count: 10, openAt: 0, labels: ROOM_TABLES['living']!, align: true, y: 0.445, only: ['비디오테이프', '탁상시계'] },
  // TV장 «가운데 칸» — 앞이 뚫린 수납칸이다. 형상에는 있는데 여태 비어 있었다.
  // **`'stack'`** — 다 본 테이프는 쌓아두지 흩어놓지 않는다
  { id: 'surf-tv-shelf', rect: [-2.52, -1.25, -2.18, -0.45], sizeMin: 0.170, sizeMax: 0.190, count: 10, openAt: 0, labels: ROOM_TABLES['living']!, align: true, y: 0.218, only: ['비디오테이프'] , arrange: 'stack' },
  // 텔레비전 «위» — 브라운관 위에 액자와 시계를 올려두는 그 자리
  { id: 'surf-tv-top', rect: [-2.45, -1.00, -2.21, -0.70], sizeMin: 0.120, sizeMax: 0.200, count: 6, openAt: 0, labels: ROOM_TABLES['living']!, align: true, y: 0.760, only: ['액자', '탁상시계'] },
  // 서랍장 위 — 전화기 자리
  { id: 'surf-chest', rect: [-2.55, 1.00, -2.22, 1.70], sizeMin: 0.220, sizeMax: 0.300, count: 12, openAt: 0, labels: ROOM_TABLES['living']!, align: true, y: 1.00, only: ['전화기', '액자'] , arrange: 'row' },
  // 책장 아래 칸 — 책이 꽂혀 있어야 책장이다. 여태 세 권이었다.
  // **`'row'` 로 줄 세운다.** 68×23cm 칸에 12권을 난수로 뿌리면
  // 꽂힌 게 아니라 «쏟아진» 것으로 보인다 — 그게 「배치 기준을 모르겠다」의 정체다
  { id: 'surf-shelf-low', rect: [1.95, -2.12, 2.61, -1.89], sizeMin: 0.170, sizeMax: 0.250, count: 12, openAt: 0, labels: ROOM_TABLES['living']!, align: true, y: 0.332, only: ['책', '신문'] , arrange: 'row' },
  { id: 'surf-shelf-mid', rect: [1.95, -2.12, 2.61, -1.89], sizeMin: 0.170, sizeMax: 0.250, count: 12, openAt: 0, labels: ROOM_TABLES['living']!, align: true, y: 0.605, only: ['책'] , arrange: 'row' },
  // 맨 위 칸 — 천장까지 0.172m 라 낮은 것만.
  // **`'lean'`** — 화투는 두께 7.6%라 눕히면 공 눈높이에서 «선»이다. 세워서 면을 보인다
  { id: 'surf-shelf-high', rect: [1.95, -2.12, 2.61, -1.89], sizeMin: 0.100, sizeMax: 0.160, count: 10, openAt: 0, labels: ROOM_TABLES['living']!, align: true, y: 0.878, only: ['책', '화투'] , arrange: 'lean' },
  // 신문더미 위
  { id: 'surf-papers', rect: [-2.52, -2.08, -2.28, -1.82], sizeMin: 0.180, sizeMax: 0.260, count: 8, openAt: 0, labels: ROOM_TABLES['living']!, align: true, y: 0.145, only: ['신문', '찌라시'] , arrange: 'row' },
  // 화분대 위
  { id: 'surf-plant', rect: [2.30, 1.02, 2.46, 1.18], sizeMin: 0.070, sizeMax: 0.120, count: 6, openAt: 0, labels: ROOM_TABLES['living']!, align: true, y: 0.55, only: ['찻잔', '귤'] },
  // 방석더미 위.
  // **0.196 → 0.185.** 곡면 세그먼트를 올리면서(구 10×5 → 16×10) 눌린 구의
  // 상단이 내려갔다 — 물건이 1.1cm 떠 있었다. 검사가 잡았다
  { id: 'surf-cushions', rect: [2.30, 1.67, 2.46, 1.83], sizeMin: 0.030, sizeMax: 0.100, count: 6, openAt: 0, labels: ROOM_TABLES['living']!, align: true, y: 0.185, only: ['껌', '사탕'] },

  // ── 복도 40 ─────────────────────────────────────────────
  // 신발장 «앞». 신발장 발자국은 x −0.82~−0.52 라 자리가 그걸 통째로 덮고 있었다 —
  // 슬리퍼가 신발장 «안»에 박혀 있었다는 뜻이다. 앞쪽(x −0.48~−0.05)으로 옮긴다
  /**
   * ── 거실 밖 자리 — 여기가 「무질서해 보인다」의 진짜 절반이었다 ──────
   *
   * 재보니 **거실은 84%가 자리에서 나오고 나머지 여섯 방은 70%가 방 사각형 안
   * 균등 난수**였다. 그리고 거실 밖에는 `arrange`(줄·더미·기울임)도
   * `only`(여기엔 이것만)도 **한 곳도 없었다** — 자리 열넷이 전부 방 표 전체
   * (20~30종)에서 뽑아 무작위로 흩뿌렸다. 복도를 찍으면 물건이 마루에
   * 색종이처럼 균등하게 뿌려져 있다.
   *
   * 그래서 열넷을 **서른셋**으로 다시 쓴다. 규칙 셋:
   *   1. 자리마다 `only` — 무엇이 거기 놓이는가. 없으면 싱크대 앞에 화투가 나온다
   *   2. 성격에 맞으면 `arrange` — 줄(row) · 더미(stack) · 기울임(lean)
   *   3. 자리는 **가구 옆·벽 밑·구석**에. 가구 발판 «위»에 겹치면 `buildBlocked` 가
   *      막아서 물건이 밀려난다 (앞 단계에서 스탠드·세면대로 두 번 겪었다)
   *
   * 방 `count` 를 낮춰 그만큼 여기로 옮긴다 — **방별 총합은 그대로다.**
   */

  // ── 복도 108 (방 42) ────────────────────────────────────
  // 지나다니며 «떨어뜨린 것»이 벽을 따라 남는다. 가운데는 비운다
  { id: 'spot-shoe', rect: [-0.72, -3.30, -0.20, -2.50], sizeMin: 0.02, sizeMax: 0.22, count: 20, openAt: OPEN_HALL, labels: ROOM_TABLES['hall']!, align: true, only: ['슬리퍼', '신문'], arrange: 'row' },
  { id: 'spot-hall-west', rect: [-1.00, -6.60, -0.62, -4.20], sizeMin: 0.01, sizeMax: 0.06, count: 26, openAt: OPEN_HALL, labels: ROOM_TABLES['hall']!, align: true, only: ['클립', '단추', '압정', '도장'], arrange: 'lean' },
  { id: 'spot-hall-east', rect: [0.60, -8.80, 1.00, -6.40], sizeMin: 0.02, sizeMax: 0.20, count: 24, openAt: OPEN_HALL, labels: ROOM_TABLES['hall']!, align: true, only: ['신문', '찌라시'], arrange: 'row' },
  { id: 'spot-hall-end', rect: [-0.55, -11.30, 0.75, -10.60], sizeMin: 0.02, sizeMax: 0.22, count: 22, openAt: OPEN_HALL, labels: ROOM_TABLES['hall']!, align: true, only: ['두루마리 휴지', '휴지통'], arrange: 'stack' },
  { id: 'spot-hall-mid', rect: [-0.80, -9.60, 0.80, -8.90], sizeMin: 0.02, sizeMax: 0.14, count: 16, openAt: OPEN_HALL, labels: ROOM_TABLES['hall']!, align: true, only: ['성냥갑', '건전지', '크레용', '전구'] },

  // ── 아이 방 220 (방 70) ─────────────────────────────────
  // 공부 구석·자는 구석·노는 구석이 각각 자기 물건을 갖는다
  { id: 'spot-desk', rect: [-5.05, -6.95, -4.15, -6.35], sizeMin: 0.01, sizeMax: 0.10, count: 34, openAt: OPEN_ROOMS, labels: ROOM_TABLES['kids']!, align: true, only: ['크레용', '지우개', '압핀', '클립'] },
  { id: 'spot-desk-side', rect: [-5.75, -6.90, -5.30, -6.20], sizeMin: 0.02, sizeMax: 0.24, count: 22, openAt: OPEN_ROOMS, labels: ROOM_TABLES['kids']!, align: true, only: ['공책', '연필깎이'], arrange: 'stack' },
  { id: 'spot-shelf-kids', rect: [-5.40, -6.05, -4.95, -5.15], sizeMin: 0.02, sizeMax: 0.22, count: 24, openAt: OPEN_ROOMS, labels: ROOM_TABLES['kids']!, align: true, only: ['공책', '딱지'], arrange: 'row' },
  { id: 'spot-quilt', rect: [-3.25, -4.40, -2.62, -2.90], sizeMin: 0.02, sizeMax: 0.20, count: 30, openAt: OPEN_ROOMS, labels: ROOM_TABLES['kids']!, align: true, only: ['공책', '찌라시', '슬리퍼'], arrange: 'row' },
  { id: 'spot-pillow', rect: [-3.30, -2.85, -2.62, -2.42], sizeMin: 0.03, sizeMax: 0.40, count: 18, openAt: OPEN_ROOMS, labels: ROOM_TABLES['kids']!, align: true, only: ['곰인형'], arrange: 'row' },
  { id: 'spot-toybox', rect: [-5.35, -3.35, -4.55, -2.45], sizeMin: 0.03, sizeMax: 0.38, count: 34, openAt: OPEN_ROOMS, labels: ROOM_TABLES['kids']!, align: true, only: ['장난감 블록', '구슬', '딱지', 'RC 컨트롤러'] },
  { id: 'spot-kids-mid', rect: [-4.40, -4.90, -3.30, -3.90], sizeMin: 0.01, sizeMax: 0.08, count: 32, openAt: OPEN_ROOMS, labels: ROOM_TABLES['kids']!, align: true, only: ['구슬', '주사위', '단추', '캐러멜'] },
  { id: 'spot-kids-door', rect: [-1.95, -5.50, -1.35, -4.40], sizeMin: 0.02, sizeMax: 0.16, count: 26, openAt: OPEN_ROOMS, labels: ROOM_TABLES['kids']!, align: true, only: ['크레용', '사탕', '껌'], arrange: 'lean' },

  // ── 부엌 162 (방 48) ────────────────────────────────────
  // 조리대 앞·식탁 둘레·냉장고 옆이 각각 다른 물건을 갖는다
  { id: 'spot-sink', rect: [-4.45, -10.80, -2.75, -10.20], sizeMin: 0.02, sizeMax: 0.22, count: 34, openAt: OPEN_ROOMS, labels: ROOM_TABLES['kitchen']!, align: true, only: ['밥공기', '접시', '찻잔'], arrange: 'row' },
  { id: 'spot-sink-side', rect: [-5.35, -11.40, -4.75, -10.80], sizeMin: 0.02, sizeMax: 0.30, count: 22, openAt: OPEN_ROOMS, labels: ROOM_TABLES['kitchen']!, align: true, only: ['냄비', '도마', '주전자'], arrange: 'stack' },
  { id: 'spot-cupboard', rect: [-5.40, -10.10, -4.90, -9.30], sizeMin: 0.02, sizeMax: 0.24, count: 24, openAt: OPEN_ROOMS, labels: ROOM_TABLES['kitchen']!, align: true, only: ['밥공기', '접시'], arrange: 'stack' },
  { id: 'spot-dining', rect: [-4.30, -9.10, -2.90, -8.35], sizeMin: 0.02, sizeMax: 0.20, count: 30, openAt: OPEN_ROOMS, labels: ROOM_TABLES['kitchen']!, align: true, only: ['젓가락', '숟가락', '찻잔', '계란'], arrange: 'row' },
  { id: 'spot-fridge', rect: [-2.20, -10.75, -1.35, -10.10], sizeMin: 0.02, sizeMax: 0.26, count: 22, openAt: OPEN_ROOMS, labels: ROOM_TABLES['kitchen']!, align: true, only: ['우유팩', '소시지', '당근'], arrange: 'stack' },
  { id: 'spot-kitchen-floor', rect: [-3.40, -10.00, -2.30, -9.20], sizeMin: 0.01, sizeMax: 0.05, count: 18, openAt: OPEN_ROOMS, labels: ROOM_TABLES['kitchen']!, align: true, only: ['쌀알', '팥', '각설탕'] },
  { id: 'spot-kitchen-door', rect: [-2.10, -8.90, -1.35, -8.10], sizeMin: 0.02, sizeMax: 0.16, count: 12, openAt: OPEN_ROOMS, labels: ROOM_TABLES['kitchen']!, align: true, only: ['성냥갑', '간장 팩', '캐러멜'] },

  // ── 화장실 62 (방 18) ───────────────────────────────────
  { id: 'spot-tub', rect: [2.30, -10.70, 3.35, -10.05], sizeMin: 0.01, sizeMax: 0.16, count: 20, openAt: OPEN_ROOMS, labels: ROOM_TABLES['bath']!, align: true, only: ['고무오리', '비누', '청개구리'], arrange: 'row' },
  { id: 'spot-basin', rect: [1.45, -9.90, 2.15, -9.40], sizeMin: 0.01, sizeMax: 0.14, count: 16, openAt: OPEN_ROOMS, labels: ROOM_TABLES['bath']!, align: true, only: ['칫솔', '비누', '체온계'], arrange: 'row' },
  { id: 'spot-toilet', rect: [2.45, -9.20, 3.30, -8.80], sizeMin: 0.02, sizeMax: 0.18, count: 14, openAt: OPEN_ROOMS, labels: ROOM_TABLES['bath']!, align: true, only: ['두루마리 휴지'], arrange: 'stack' },
  { id: 'spot-bath-floor', rect: [1.30, -11.40, 2.10, -10.60], sizeMin: 0.01, sizeMax: 0.10, count: 12, openAt: OPEN_ROOMS, labels: ROOM_TABLES['bath']!, align: true, only: ['클립', '압정', '단추', '지우개'] },

  // ── 툇마루 50 (방 20) ───────────────────────────────────
  { id: 'spot-porch', rect: [-2.55, 2.40, -1.75, 3.30], sizeMin: 0.02, sizeMax: 0.26, count: 20, openAt: OPEN_YARD, labels: ROOM_TABLES['porch']!, align: true, only: ['화분', '양동이'], arrange: 'row' },
  { id: 'spot-porch-step', rect: [0.90, 2.45, 2.30, 3.20], sizeMin: 0.02, sizeMax: 0.24, count: 18, openAt: OPEN_YARD, labels: ROOM_TABLES['porch']!, align: true, only: ['슬리퍼'], arrange: 'row' },
  { id: 'spot-porch-corner', rect: [2.15, 2.40, 2.60, 3.30], sizeMin: 0.02, sizeMax: 0.16, count: 12, openAt: OPEN_YARD, labels: ROOM_TABLES['porch']!, align: true, only: ['솔방울', '병뚜껑', '동전'] },

  /**
   * ── 뒷마당 160 (방 90) — 일본식 정원 ────────────────────
   *
   * **총합 160 은 안 건드린다.** 사다리·성장 곡선이 그 숫자를 쓴다 —
   * 「무엇이 놓이는가」(`only`)만 정원 물건으로 바꾼다.
   *
   * 옛 자리 셋의 `only` 에 **페트병·연어 캔·양동이**가 들어 있었다. 마당에서
   * 제일 많은 셋이 그것들이었고(28·25·23개), 그게 마당이 정원이 아니라
   * **재활용 수거장**으로 읽히던 이유다.
   *
   * **자갈 마당(x −3.67~0.77 · z 4.47~8.23)에는 자리를 두지 않는다.**
   * 갈퀴로 그은 자갈 위에 스툴과 양동이가 널려 있으면 그건 갈퀴질이 아니다.
   * 여섯 자리 전부 자갈 밖 이끼 위나 담장 가에 있다.
   *
   * **`align` 을 안 준다** — 바깥은 각도가 제멋대로인 게 맞다(옛 판단 그대로).
   */
  /**
   * ── 전경 (z < 5.3) — 크게 ──────────────────────────────
   * 레퍼런스: 「큰 것이 보는 자리에 가깝고 작은 것이 멀다」.
   * 자리마다 `sizeMax` 를 달리 줘서 그 깊이 등급을 만든다.
   */
  { id: 'spot-tsukubai', rect: [0.95, 3.60, 2.05, 4.15], sizeMin: 0.03, sizeMax: 0.30, count: 24, openAt: OPEN_YARD, labels: ROOM_TABLES['yard']!, only: ['자갈', '꽃잎', '달팽이', '청개구리'] },
  { id: 'spot-dog', rect: [2.15, 3.60, 3.60, 4.05], sizeMin: 0.03, sizeMax: 0.30, count: 26, openAt: OPEN_YARD, labels: ROOM_TABLES['yard']!, only: ['개밥그릇', '자갈', '도토리'] },
  { id: 'spot-lantern', rect: [-3.60, 3.60, -2.55, 4.15], sizeMin: 0.03, sizeMax: 0.28, count: 22, openAt: OPEN_YARD, labels: ROOM_TABLES['yard']!, only: ['꽃', '자갈', '솔방울'] },

  // ── 중경 «가장자리» — 자갈 마당은 `clear` 가 비운다 ────
  { id: 'spot-east-path', rect: [2.45, 5.20, 3.15, 7.60], sizeMin: 0.02, sizeMax: 0.22, count: 24, openAt: OPEN_YARD, labels: ROOM_TABLES['yard']!, only: ['자갈', '도토리', '게타'], arrange: 'row' },
  { id: 'spot-west-edge', rect: [-3.88, 5.40, -3.60, 7.90], sizeMin: 0.02, sizeMax: 0.20, count: 20, openAt: OPEN_YARD, labels: ROOM_TABLES['yard']!, only: ['꽃', '자갈', '꽃잎'], arrange: 'lean' },

  // ── 원경 (z ≥ 7.8) — 작게. 뒤로 갈수록 잘아진다 ────────
  // 창고 앞 — **연장은 여기만.** 양동이가 마당에 흩어져 있던 걸 한 곳으로 모은다
  { id: 'spot-shed', rect: [-2.10, 8.48, -1.20, 9.25], sizeMin: 0.02, sizeMax: 0.18, count: 24, openAt: OPEN_YARD, labels: ROOM_TABLES['yard']!, only: ['삽', '모종삽', '갈퀴', '양동이'], arrange: 'lean' },
  // 나무 밑 — 낙엽
  { id: 'spot-tree', rect: [0.60, 8.48, 1.80, 9.25], sizeMin: 0.02, sizeMax: 0.14, count: 24, openAt: OPEN_YARD, labels: ROOM_TABLES['yard']!, only: ['솔방울', '도토리', '꽃잎', '자갈'] },
  // 평상 앞 — 신발 벗어둔 자리
  { id: 'spot-deck', rect: [2.45, 9.15, 3.85, 9.36], sizeMin: 0.02, sizeMax: 0.16, count: 26, openAt: OPEN_YARD, labels: ROOM_TABLES['yard']!, only: ['게타', '찻잔', '화분'], arrange: 'row' },
  // 남쪽 담장 가 — 제일 멀고 제일 잘다.
  // (−3.80~−3.20, 8.60~9.30 은 **창고 위**였다 — 물건 스물이 묻혔다)
  { id: 'spot-back', rect: [-1.70, 8.85, -0.80, 9.30], sizeMin: 0.02, sizeMax: 0.14, count: 20, openAt: OPEN_YARD, labels: ROOM_TABLES['yard']!, only: ['자갈', '솔방울', '꽃잎'] },
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
 * 세로벽용 창. `shoji()` 의 짝이다 — 저쪽은 가로벽(z 고정), 이쪽은 세로벽(x 고정).
 *
 * ## 왜 창을 다나
 *
 * `shoji()` 주석에 남아 있는 그대로다: 벽 한 면이 통짜로 남으면 화면 상단이
 * 사실상 한 색이 된다(실측 최빈색 85.6%). 북·남벽은 장지문이 갈라주는데
 * **동벽은 5.4m 통짜**였다. 거실 가구가 그 벽에 붙지만 가구는 1.2m 아래라
 * 벽 윗부분은 그대로 남는다.
 *
 * ## 가로 살이 없는 이유
 *
 * `City.geometryFor()` 의 압출이 바닥(y=0)부터라 공중에 뜬 조각을 못 만든다.
 * 대신 높이 단차가 가로선을 만든다 — 코시이타 윗선(0.30) · 창호지 윗선(1.75) · 벽 윗선(2.4).
 */
function windowZ(z0: number, z1: number, x: number): CityBuilding[] {
  const H = 1.75;
  const b: CityBuilding[] = [
    // 창호지. 돌출량을 걸레받이(WALL_T + 0.04)와 같게 둔다 —
    // 물체 배치 여유(ROOM_MARGIN 0.06)를 넘기면 벽에 물건이 박힌다
    kitPiece(x, z0, x, z1, { t: WALL_T + 0.04, h: H, color: C_SHOJI }),
    // 창틀 아래 나무 판. 종이보다 앞에 둬야 보이고, 걸레받이(0.06)보다 높아야 안 파묻힌다
    kitPiece(x, z0, x, z1, { t: WALL_T + 0.07, h: 0.30, color: C_SHOJI_RAIL }),
  ];
  // 세로 살. **격자의 대비는 종이가 아니라 이 나무가 만든다** —
  // 종이(0xe8eef2)와 벽(0xfbf0d2)은 둘 다 near-white 라 붙여놔도 경계가 안 보인다
  const N = 6;
  for (let i = 0; i <= N; i++) {
    const z = z0 + ((z1 - z0) * i) / N;
    b.push(kitPiece(x, z - 0.022, x, z + 0.022,
      { t: WALL_T + 0.09, h: H, color: C_PILLAR }));
  }
  // 창틀 기둥 둘. **창 안이 아니라 양옆에 세운다** — 거실 동벽에는 원래 한가운데
  // (z=0) 중간 기둥이 있었는데 창을 내니 그 기둥이 창을 뚫고 나왔다.
  // 기둥을 창 양옆으로 밀면 벽을 끊는 역할은 그대로면서 창틀로도 읽힌다.
  // **`windowZ` 안에서 세우는 이유**는 창과 기둥이 따로 놀다 어긋나는 걸 막기 위해서다
  b.push(kitPillar(x, z0 - 0.15, { t: WALL_T, h: WALL_H, color: C_PILLAR }));
  b.push(kitPillar(x, z1 + 0.15, { t: WALL_T, h: WALL_H, color: C_PILLAR }));
  return b;
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
      // 동벽 중간 기둥은 `windowZ` 가 창틀 기둥 둘로 대신한다
      pillar(lx0, 0),
      // 벽 밑 나무 띠 네 면. 벽과 같은 선이라 막는 범위는 안 바뀐다
      baseboard(lx0, lz0, lx0, lz1), baseboard(lx1, lz0, lx1, lz1),
      baseboard(lx0, lz0, lx1, lz0), baseboard(lx0, lz1, lx1, lz1),
    );
    // 붙박이 장지문 — 북(복도 쪽)·남(툇마루 쪽). `house` 분기에서 문이 서는 자리다.
    // 여기서는 열리지 않는다 — 이 판에는 갈 곳이 없다.
    b.push(...shoji(-1.8, 1.8, lz0), ...shoji(-1.8, 1.8, lz1));
    // 동벽 창 — 북·남벽은 장지문이 갈라주는데 동벽만 5.4m 통짜였다
    b.push(...windowZ(-0.9, 0.6, lx1));
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
  // 동벽 창 — living 분기와 같은 자리. 거실은 어느 판에서든 같은 방이어야 한다
  b.push(...windowZ(-0.9, 0.6, lx1));

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

  /**
   * ── 담장 기둥 — 판 한 장을 「엮은 울타리」로 만든다 ──────
   *
   * 담장이 **무늬 없는 판 한 장**이었다. 켄닌지가키(建仁寺垣)처럼 일정 간격
   * 세로 기둥이 서야 판이 「엮은 것」으로 읽힌다. 이끼·자갈을 깔고 나니
   * 담장만 평평해서 더 두드러졌다.
   *
   * **`kind: 'wall'` 이다**(`kitPillar` 가 항상 그렇게 만든다). 먹을 수 있는
   * 물체로 만들면 사다리에 스물다섯이 얹혀서 판 균형이 흔들린다 —
   * 이건 «장식»이지 «물건»이 아니다.
   *
   * 담장보다 6cm 높게 세운다. 같은 높이면 판에 묻혀서 안 보인다.
   */
  const POST = { t: 0.10, h: FENCE_H + 0.06, color: C_FENCE };
  for (let x = yx0 + 0.45; x < yx1; x += 0.9) b.push(kitPillar(x, yz1, POST, 0.05));
  for (let z = yz0 + 0.45; z < yz1; z += 0.9) {
    b.push(kitPillar(yx0, z, POST, 0.05), kitPillar(yx1, z, POST, 0.05));
  }

  return b;
}

// ─── 가구 ────────────────────────────────────────────────────

// `legs()`(상다리 압출 넷)를 지웠다 — 책상·식탁·평상이 전부 형상으로 옮겨가서
// 부르는 데가 없다. 남겨두면 「아직 압출 가구가 있다」는 오해를 준다.

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
/**
 * 거실 가구 — **손배치 물건**이다. `buildFurniture` 가 아니라 여기 있다.
 *
 * 예전에는 `block()` 21조각이었다. 압출이라 텔레비전이 상자 둘, 서랍장이 상자 셋,
 * 밥상은 각기둥 넷에 상판이 떠 있는 텍스처였다 — **나무 판때기가 하나도 없었다.**
 * 이제 소품과 같은 형상 경로를 탄다(`StageProp`).
 *
 * **`size` 만 적는다.** 가로세로 비율은 형상이 갖고 있다 — `assemble()` 의
 * `normalize()` 가 최장축을 1.0으로 맞추면서 비율을 지오메트리에 굽는다.
 *
 * 좌표는 벽 **안쪽 면** 기준이다: x ±2.63 · z ±2.18 (벽 0.10 + 걸레받이 0.04).
 * 형상은 자기 중심에 놓이므로 벽에 붙일 때 `size`의 절반을 물려야 한다.
 */
export const LIVING_PROPS: readonly StageProp[] = [
  // ── 방 한가운데 — 스폰(0,0) 정면 ────────────────────────
  // **밑이 뚫린다.** 상판(y 0.24~0.325)만 충돌을 잡아서 지름 24cm 이하 공이
  // 다리 사이를 지나간다. 40cm 공은 막힌다 — 32.5cm 상 밑에 안 들어가는 게 맞다
  { label: '밥상', x: 0.75, z: 0.45, size: 0.95, underPass: 0.24 },
  // 방석 넷. 상 둘레에 둘러앉는 자리다
  { label: '방석', x: 0.75, z: -0.30, size: 0.50 },
  { label: '방석', x: 1.60, z: 0.45, size: 0.50, rotY: Math.PI / 2 },
  { label: '방석', x: 0.75, z: 1.20, size: 0.50 },
  { label: '방석', x: -0.10, z: 0.45, size: 0.50, rotY: Math.PI / 2 },

  // ── 서벽 ────────────────────────────────────────────────
  // **TV를 TV장 위에 얹는다**(`y`). 예전엔 상자 둘을 앞뒤로 놓은 계단이었다
  // **다리 사이가 18cm 비어 있다.** 형상에서 측판·뒷판이 선반 밑면에서 끊기므로
  // 그 아래에 있는 건 얇은 다리 넷뿐이다 — 밥상(0.24) 과 같은 규약이다
  { label: 'TV장', x: -2.35, z: -0.85, size: 1.00, rotY: Math.PI / 2, underPass: 0.18 },
  { label: '텔레비전', x: -2.33, z: -0.85, size: 0.55, rotY: Math.PI / 2, y: 0.42 },
  // 서랍장. 서벽 콘센트(z=0.7)를 안 가리게 z 1.35 에 둔다
  { label: '서랍장', x: -2.38, z: 1.35, size: 1.00, rotY: Math.PI / 2 },

  // ── 북벽 — 장지문 폭(x −1.8~1.8) 밖의 민벽 ──────────────
  { label: '책장', x: 2.28, z: -2.00, size: 1.05 },
  // 북벽 콘센트(x=−2.05)를 안 가리게 x −2.40 에서 끊는다
  { label: '신문더미', x: -2.40, z: -1.95, size: 0.45 },

  // ── 동벽 — 창(z −0.9~0.6)과 창틀 기둥(z −1.05 / 0.75)을 피한다 ──
  /**
   * 스탠드. **자리를 옮겼다** — 예전 (2.42, −1.50) 은 충돌 상자가 동벽을 뚫고
   * 나가면서 `spot-shelf-front`(책장 앞) 를 통째로 덮고 있었다. 창가로 내린다.
   */
  { label: '스탠드', x: 2.35, z: -0.90, size: 1.20 },
  // 다리 셋짜리 스탠드. 아래 선반(y 0.26)까지는 비어 있다
  // 0.44 는 거짓말이었다 — 실측하니 가운데가 막히는 높이가 14cm 다(아래 선반 다리).
  // 형상을 다시 만드는 Phase 5 에서 이 값을 다시 잰다
  { label: '화분대', x: 2.38, z: 1.10, size: 0.55, underPass: 0.14 },
  { label: '방석더미', x: 2.38, z: 1.75, size: 0.50 },

  // ── 벽에 걸린 것 ────────────────────────────────────────
  /**
   * 콘센트 둘. **압출(`CityBuilding`)이 아니라 형상이다.**
   *
   * 압출은 y=0 에서 위로만 뽑아서 공중에 뜬 조각을 못 만든다. 그래서 여태 콘센트가
   * 「바닥에 선 12×16cm 흰 판 + 바닥까지 내려온 검은 줄 둘」이었고, 그게 사용자가
   * **오니기리**라고 부른 것이다. `StageProp.y` 로 벽에 건다 — 엔진은 안 건드린다.
   *
   * 벽 안쪽 면은 x −2.63 · z −2.18 이다. 판 두께(0.12 × 0.16 ≈ 0.019m)의 절반만
   * 방 쪽으로 물려서 벽에 붙인다. 높이 0.22m 는 실제 매입 콘센트(바닥에서 25~30cm)와 같다.
   *
   * **별1에서는 안 먹힌다.** 충돌 상자 밑면이 0.22m 라 지름 44cm 부터 닿는데
   * 별1 목표가 25cm 다 — 거실에서는 벽에 붙어 있는 것으로 끝나고 별2·별4 에서 먹힌다.
   */
  { label: '콘센트', x: -2.05, z: -2.170, size: 0.12, y: 0.22 },
  { label: '콘센트', x: -2.620, z: 0.70, size: 0.12, y: 0.22, rotY: Math.PI / 2 },
];

/**
 * **나머지 여섯 방의 가구 — 손배치 형상.**
 *
 * 여태 `buildFurniture` 의 `block()`/`legs()` 압출 조각이었다. 그 엔진은 2D 외곽선을
 * y=0 에서 위로 뽑는 것뿐이라 **프리즘밖에 못 만든다** — 변기가 43×45×72cm 짜리
 * 상자였고 욕조도 싱크대도 깔아둔 이불도 상자였다.
 *
 * **좌표는 압출 조각의 «중심»이고 `size` 는 그 조각의 최대 변이다.**
 * 가로세로 비율은 형상이 갖고 있다(`assemble()` 의 `normalize()`) — 여기엔 안 적는다.
 * 그래서 옮기는 동안 **방 배치는 한 톨도 안 움직였다.**
 *
 * **문 앞을 막으면 안 된다.** 아이 방 문 z −4.5~−3.6 · 부엌 문 −7.65~−6.75 ·
 * 화장실 문 −8.0~−7.3. 막으면 그 구역이 열려도 못 들어가고, 화면으로는 안 보인다.
 */
export const HOUSE_PROPS: readonly StageProp[] = [
  // ── 복도 (2.2 × 9.4m) ───────────────────────────────────
  // 지나다니는 통로다. **양쪽 벽에만 붙이고 가운데는 끝까지 비운다.**
  { label: '신발장', x: -0.86, z: -2.73, size: 0.80, rotY: Math.PI / 2 },
  { label: '우산꽂이', x: 0.94, z: -2.41, size: 0.48 },
  // 9.4m 복도에 가구 둘이면 북쪽 절반이 텅 빈다. 끝에 등 하나를 세운다
  // x −0.74 → −0.735. 스탠드 갓 테를 굵히면서 발판이 1mm 넓어져 복도 벽 안쪽 면
  // (−1.030)을 1mm 넘었다 — `rooms.mts` 가 잡았다
  { label: '스탠드', x: -0.735, z: -11.28, size: 1.20 },

  // ── 아이 방 (4.8 × 5.4m) ────────────────────────────────
  /**
   * **공부하는 구석과 자는 구석을 방 반대편으로 가른다.**
   *
   * 예전에는 책상·의자·책장·이불이 방 한가운데 4m² 안에 뭉쳐 있었다 —
   * 압출 조각 자리를 그대로 물려받은 좌표였고, 그게 「무질서해 보인다」의 절반이다.
   * 북서쪽에 책상+의자+책장, 동쪽 벽에 이불, 남서 구석에 장난감 상자를 놓으면
   * **방 한가운데가 비고** 물건이 그 둘레에 모인다.
   */
  { label: '책상', x: -4.60, z: -7.28, size: 1.00, underPass: 0.42 },   // 북벽
  { label: '의자', x: -4.60, z: -6.85, size: 0.45, underPass: 0.19 },    // 책상 앞
  { label: '책장', x: -5.64, z: -5.60, size: 1.05, rotY: Math.PI / 2 },  // 서벽
  // 이불은 동벽에 붙이되 **문 앞(z −5.40~−4.50)을 피해 남쪽**에 깐다
  { label: '이불', x: -1.83, z: -3.50, size: 1.90, rotY: Math.PI / 2 },
  { label: '장난감 상자', x: -5.56, z: -2.58, size: 0.50 },              // 남서 구석

  // ── 부엌 (4.8 × 4.0m) ───────────────────────────────────
  // 싱크대·냉장고를 북벽 한 줄로 — 조리 동선이 벽을 따라 흐른다.
  // 식탁은 밑이 뚫려서(underPass) 가운데 놓여도 공이 밑으로 지나간다
  { label: '싱크대', x: -3.60, z: -11.23, size: 1.75 },
  { label: '냉장고', x: -1.49, z: -11.23, size: 1.55 },
  { label: '찬장', x: -5.63, z: -10.60, size: 1.45, rotY: Math.PI / 2 },  // 서벽
  { label: '식탁', x: -3.60, z: -8.60, size: 1.20, underPass: 0.55 },
  // **의자 둘.** 식탁만 있으면 「다리 넷 달린 판」이고, 의자가 붙어야 식탁으로 읽힌다
  { label: '의자', x: -4.55, z: -8.60, size: 0.45, rotY: Math.PI / 2, underPass: 0.19 },
  { label: '의자', x: -2.65, z: -8.60, size: 0.45, rotY: -Math.PI / 2, underPass: 0.19 },

  // ── 화장실 (2.4 × 3.0m) ─────────────────────────────────
  // 셋을 세 벽에 하나씩 — 서로 안 겹치고 문 앞(x 1.17~1.72)이 비어야 들어간다
  { label: '욕조', x: 2.93, z: -11.23, size: 0.98 },                     // 북벽
  { label: '변기', x: 3.13, z: -9.60, size: 0.72, rotY: -Math.PI / 2 },  // 동벽
  { label: '세면대', x: 1.80, z: -8.96, size: 0.74, rotY: Math.PI / 2 }, // 남벽

  // ── 툇마루 ──────────────────────────────────────────────
  // 폭 1.2m 짜리 **통로**다. 한 점만 둔다 — 두 점이면 뒷마당 가는 길이 막힌다.
  // 거실 화분대와 **같은 형상을 나눠 쓴다**
  { label: '화분대', x: -2.25, z: 2.65, size: 0.42, underPass: 0.11 },   // 위와 같은 이유

  /**
   * ── 뒷마당 — 일본식 정원 ────────────────────────────────
   *
   * **길은 동쪽, 자갈 마당은 서쪽, 살림 물건은 담장 라인으로 민다.**
   * 툇마루에 앉아 보면 왼쪽에 갈퀴질한 자갈과 석등이 있고, 오른쪽으로 징검돌이
   * 평상까지 간다. 개집·창고·빨래 기둥은 «버리지 않고» 시야에서 비켰다 —
   * 살림하는 집 마당이지 절 정원이 아니다.
   *
   * 자갈 깔개(`buildRugs`)가 x −3.67~0.77 · z 4.47~8.23 을 덮는다.
   * 그 위에 서는 건 석등뿐이고(자갈에 선 석등은 정석이다) 나머지는 이끼 위다.
   */
  /**
   * ── 전경 (z 3.45~5.3) ─────────────────────────────────
   * 레퍼런스: **보는 자리에 가까운 것이 크고 먼 것이 작다.** 툇마루가 z 3.45 다.
   */
  // 물확(쓰쿠바이)는 **툇마루에서 손이 닿는 자리**가 전통 위치다
  { label: '물확', x: 1.75, z: 4.35, size: 0.62 },
  // 석등 — 자갈 마당 서쪽 어귀. 정원의 등불이자 초점
  { label: '석등', x: -2.30, z: 4.75, size: 1.20 },

  /**
   * ── 중경 — 삼존석(三尊石)과 2석 무리 ──────────────────
   *
   * **레퍼런스가 「정원에서 가장 중요한 요소」라고 하는 것이다.**
   * 큰 세로돌(主石) 하나에 작은 돌 둘(脇石)이 붙고, 세 변이 **부등변**이라야
   * 자연이다 — 정삼각이면 사람이 놓은 티가 난다.
   *
   * 삼존 셋 + 2석 둘 = **다섯**(홀수). 짝수 무리는 대칭이 생겨 인공적으로 보인다.
   * 큰 돌이 **뒤·가운데**, 작은 돌이 **앞·옆**이다.
   *
   * 자갈 마당의 파문(`RIPPLE_CENTERS`)이 이 두 무리 자리에 그려져 있다.
   */
  { label: '세로돌', x: -0.55, z: 6.00, size: 0.88, rotY: 0.7 },   // 主石 — 산
  { label: '가로돌', x: 0.10, z: 5.60, size: 0.46, rotY: -1.2 },   // 脇石
  { label: '비스듬돌', x: -1.15, z: 5.42, size: 0.34, rotY: 2.1 }, // 脇石
  { label: '가로돌', x: -2.55, z: 7.30, size: 0.60, rotY: 0.3 },
  { label: '비스듬돌', x: -2.02, z: 7.66, size: 0.32, rotY: -0.9 },

  // ── 원경 (z 7.8~9.45) — 뒤로 갈수록 작게 «보인다» ──────
  // 대나무 — 서벽, 자갈 어귀 밖
  { label: '대나무', x: -3.42, z: 4.88, size: 1.90 },
  // 소나무(전정목) — 동벽
  { label: '소나무', x: 3.35, z: 6.35, size: 1.45 },
  /**
   * 징검돌 일곱 — 툇마루(z 3.45)에서 평상까지 **굽어** 간다.
   *
   * 곧게 놓으면 길이 아니라 자와 눈금이다. 이웃 간격은 0.7~0.9m —
   * 사람 보폭이고, 이보다 벌어지면 「띄엄띄엄 놓인 돌」이지 길이 아니다.
   * 각 돌은 **높이 5cm** 라 10cm 에 열리는 마당의 걸림돌이 아니다.
   */
  { label: '징검돌', x: 0.55, z: 3.95, size: 0.30, rotY: 0.3 },
  { label: '징검돌', x: 0.95, z: 4.70, size: 0.30, rotY: -0.5 },
  { label: '징검돌', x: 1.25, z: 5.50, size: 0.30, rotY: 0.9 },
  { label: '징검돌', x: 1.55, z: 6.30, size: 0.30, rotY: -0.2 },
  { label: '징검돌', x: 1.90, z: 7.05, size: 0.30, rotY: 0.6 },
  { label: '징검돌', x: 2.05, z: 7.85, size: 0.30, rotY: -0.8 },
  // 마지막 돌은 평상 «앞»에 선다 — 발판을 물면 평상에 오르는 돌이 아니라 걸림돌이다
  { label: '징검돌', x: 2.20, z: 8.65, size: 0.30, rotY: 0.1 },

  // 개집 — 동북 구석으로 밀었다 (2.05, 4.65 → 2.95, 4.55)
  { label: '개집', x: 2.95, z: 4.55, size: 0.90 },
  { label: '창고', x: -3.00, z: 8.575, size: 1.80 },
  /**
   * 마당 나무. 집 맵에서 제일 큰 물건이다.
   *
   * **`size` 2.60 은 안 건드린다.** `ladder` 가 이 그루 때문에 꼭대기 칸을
   * 「얇음」으로 잡지만, 그 칸에 닿으려면 공이 1.5m 는 돼야 하는데 집 스테이지
   * 목표는 별4의 1m 가 최대다 — **아무도 안 밟는 칸**이다.
   *
   * 남쪽으로 밀어(z 8.00 → 8.85) 자갈 마당 밖 배경으로 물렸다.
   */
  { label: '나무', x: -0.20, z: 8.85, size: 2.60 },
  { label: '평상', x: 3.15, z: 8.55, size: 1.10, underPass: 0.28 },
  /**
   * 빨래 기둥 둘. 사이의 빨랫줄은 **공중에 뜬 면**이라 못 만든다(밥상 상판과 같은 한계).
   *
   * **동쪽 담장 라인으로 옮겼다.** 서쪽(−3.52)에 두었더니 자갈 마당과 삼존석이
   * 들어설 자리를 세로로 가르고 있었다. 살림하는 집이라 안 버리되,
   * 툇마루에서 보면 화면 오른쪽 끝이라 구도를 안 깬다.
   */
  { label: '빨래 기둥', x: 3.55, z: 5.60, size: 1.70 },
  { label: '빨래 기둥', x: 3.55, z: 7.40, size: 1.70 },
  /**
   * 마당 강아지 둘. **`roam` 이 있으면 돌아다닌다** — `World.stepWander` 가
   * 매 프레임 `pos` 를 옮기고 가는 쪽을 보게 한다.
   *
   * 길찾기는 안 넣었다. 「집에서 멀어지면 집 쪽으로 꺾는다」가 담장·가구를 피하는
   * 전부라, **돌아다니는 원판 안이 비어 있어야 한다.** 그건 좌표를 고를 때 지켰고
   * 검사(`wander.mts`)가 잰다 — 겹치면 개가 개집을 통과한다.
   *
   *   흰 개: 자갈 마당을 가로지른다 (석등에서 1.69m 떨어져 있다)
   *   갈색 개: 개집 앞을 맴돈다
   */
  /**
   * **한 마리는 걷고 한 마리는 쉰다.**
   *
   * 예전엔 둘 다 반경 1.05·0.70 의 «원»을 돌았는데, 그 원이 **갈퀴질한 자갈
   * 마당 한복판**이었다 — 화면에서 개가 파문을 밟고 서 있었고, 그건
   * 「자갈 마당은 비어 있다」와 정면으로 부딪힌다.
   *
   * 정원과 살림 물건을 다 놓고 나면 마당에 남는 빈 «원»은 지름 1.8m 뿐이다
   * (실측). 대신 남는 건 **길고 좁은 띠**라서 `roam` 을 타원으로 바꾸고
   * 동쪽 살림 쪽 0.9 × 2.7m 띠를 줬다 — 정원 쪽은 조용하고 개는 자기 쪽에서 논다.
   */
  // rz 1.15 — 1.35 로 두었더니 산책 타원이 **쉬는 개를 물었다**(개가 개를 통과한다)
  { label: '개', x: 2.15, z: 6.60, size: 0.60, roam: [0.45, 1.15], underPass: 0.10 },
  /**
   * 쉬는 개. `roam` 이 없으면 지금까지처럼 제자리다.
   *
   * 개집 옆(2.95, 5.40)에 두었더니 **걷는 개의 산책 타원이 이 개를 물었다** —
   * 길찾기가 없으니 개가 개를 통과한다. 정원 어귀로 옮겨 앉혔다.
   */
  { label: '개', x: -1.20, z: 4.00, size: 0.55, rotY: 1.9, underPass: 0.10 },
];

/**
 * 나머지 방의 가구. **아직 압출 프리즘이다.**
 *
 * 거실만 형상으로 옮겼다 — 거실이 봐줄 만한지 확인한 뒤에 같은 방식을 나머지
 * 여섯 방으로 옮긴다. 부엌 싱크대·냉장고, 화장실 욕조·변기가 그다음이다.
 */
function buildFurniture(area: StageArea): CityBuilding[] {
  const b: CityBuilding[] = [];
  // 거실 가구는 `LIVING_PROPS`(손배치 형상)로 옮겼다 — 여기엔 없다
  if (area === 'living') return b;

  // **여섯 방 가구가 전부 `HOUSE_PROPS`(손배치 형상)로 옮겨갔다.**
  // 압출은 y=0 에서 위로 뽑는 프리즘밖에 못 만들어서 변기가 상자였고 나무가 각기둥이었다.
  // 이 함수는 이제 아무것도 안 만든다 — 남겨두는 이유는 `area === 'living'` 갈래가
  // 「거실 판에는 나머지 방이 없다」를 말해주기 때문이다.
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
  // 자리도 같은 규칙으로 자른다 — 거실만 짓는 판에 부엌 싱크대 앞 물건을 깔면
  // 벽 없는 자리에 물건이 생긴다
  // 거실 자리·표면은 **이름이 아니라 사각형으로 고른다** — 새 자리를 더해도 안 어긋난다
  const spots = area === 'living'
    ? HOUSE_SPOTS.filter((q) =>
      q.rect[0] >= R_LIVING[0] && q.rect[2] <= R_LIVING[2]
      && q.rect[1] >= R_LIVING[1] && q.rect[3] <= R_LIVING[3])
    : HOUSE_SPOTS;
  return {
    name: '타케다 저택',
    slug: 'house',
    // 실제 좌표가 아니다. 스키마가 요구해서 채우는 값 — 이 스테이지는 OSM이 아니다.
    origin: { lat: 0, lon: 0 },
    /**
     * **12 → 14.** 방을 넓혀서 원점에서 제일 먼 구석이 √(5.9² + 11.65²) ≈ 13.1m 가 됐다.
     * `World.groundSize = radius × 2.6` 이고 안개·그림자 카메라가 그 값을 쓰므로,
     * 12로 두면 부엌·화장실 북쪽 끝이 잘린다.
     */
    radius: 14,
    spawn: { x: 0, z: 0 },
    buildings: [...buildWalls(area), ...buildFurniture(area)],
    water: [],
    landmarks: [],
    // **거실 판은 `LIVING_PROPS` 만.** 나머지 방은 거기 없다 —
    // 그 방들의 가구를 거실 판에 놓으면 벽 밖에 가구가 뜬다
    placement: {
      rooms, spots,
      props: area === 'living' ? LIVING_PROPS : [...LIVING_PROPS, ...HOUSE_PROPS],
    },
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
  /**
   * **가짜 상판 평면을 전부 지웠다.**
   *
   * 앞선 작업에서 밥상·TV장·서랍장·책장 위에 「높이만 있는 텍스처 평면」을 깔았다.
   * 물건을 얹을 자리는 됐지만 **판 자체가 두께 없는 데칼**이라, 공 눈높이에서는
   * 막대 넷 위에 원반이 떠 있는 그림이었다.
   *
   * 이제 그 자리에 **진짜 상판이 있는 형상**이 선다(`LIVING_PROPS`).
   * 물건을 얹는 높이 정보는 `HOUSE_SPOTS` 의 `y` 가 이미 갖고 있으므로
   * 여기 남는 건 바닥 깔개 한 장뿐이다.
   */
  const rugs: CityRug[] = [{ cx: 0.75, cz: 0.45, w: 2.4, d: 1.6, rotY: 0.34, tex: 'rug' }];
  if (area !== 'house') return rugs;

  /**
   * ── 뒷마당 자갈 ─────────────────────────────────────────
   *
   * **깔개는 이미 「충돌 없는 렌더 전용 평면」이다** — 자갈 마당이 정확히 그것이라
   * 새 개념이 필요 없었다. 거실 카펫이 다다미를 대각선으로 자르는 그 장치 그대로다.
   *
   * **축에서 0.15rad 비튼다.** 축에 맞추면 마당을 한 번 더 사각형으로 나눈 것에
   * 그치고 「이끼 위에 자갈을 깔았다」가 안 읽힌다.
   *
   * 둘이 겹치면 안 된다 — 깔개는 전부 y = 0.006 이라 겹치는 자리가 z-fighting 으로
   * 깜빡인다. 아래 둘은 x 로 0.6m 떨어져 있다.
   */
  rugs.push(
    /**
     * 갈퀴질한 자갈 마당(枯山水). **한 장 그림**이라 반복하지 않고(`fit`),
     * 그 위에는 소품을 안 놓는다(`clear`).
     *
     * 좌표를 바꾸면 `floors.ts` 의 `RIPPLE_CENTERS` 도 같이 바꿔야 한다 —
     * 파문은 **돌이 서는 자리**에 그려져 있고, 어긋나면 아무것도 없는 데
     * 물결이 있는 그림이 된다. `garden.mts` 가 어긋남을 잰다.
     *
     * **서쪽·뒤로 치우쳐 있다.** 레퍼런스: 대칭은 인공적으로 보인다.
     */
    { cx: -1.15, cz: 6.45, w: 4.3, d: 3.4, rotY: 0.13,
      tex: 'karesansui', fit: true, clear: true },
    // 물확 앞 물받이. 쓰쿠바이 밑에는 물 빠지라고 자갈을 깐다
    { cx: 1.75, cz: 4.35, w: 0.9, d: 0.9, rotY: 0.40, tex: 'gravel' },
  );
  return rugs;
}

