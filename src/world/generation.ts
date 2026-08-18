/**
 * 월드 생성. THREE 의존성 없음 — 브라우저와 node 양쪽에서 돈다.
 *
 * 이게 중요한 이유: 튜닝 스크립트(tools/curve.ts)와 게임이 **같은 숫자**를 읽어야 한다.
 * 파라미터가 렌더 코드 안에 박혀 있으면 곡선 분석이 거짓말이 된다.
 */

/**
 * 물체 본체 색.
 *
 * 정점색(계수)에 곱해지므로 **이게 그 물체의 진짜 색**이다 — shapes.kit.ts 참고.
 * 빌더가 본체를 WHITE(계수 1)로 칠해 뒀으니 여기 색이 그대로 나오고,
 * 바퀴(DARK)·유리(GLASS)·금속(METAL)은 자기 계수만큼 눌린다.
 *
 * 예전에는 형광 12색이었다. 실루엣이 63종으로 늘어난 뒤에도 색이 무작위라
 * 자판기가 형광 분홍, 라바콘이 하늘색으로 나왔다 — 형태는 맞는데 색이 주사위였다.
 *
 * 새벽 서울 길거리는 회색·검정·흰색·베이지가 기본이다.
 * 채도는 실제로 튀는 것에만 준다 — 전부 채도가 높으면 아무것도 안 튄다.
 */
export const PALETTE = [
  // ── 중성 0~7 ────────────────────────────────────────────────
  0xf0efe9, // 0  흰색       종이·마스크·스티로폼·종량제 봉투
  0xd8d2c4, // 1  미색       찌라시·은행알·이쑤시개
  0xc3b393, // 2  크라프트   택배 상자
  0xa8a49c, // 3  밝은 회색  전봇대·콘크리트
  0x6e6b66, // 4  회색       파라솔 받침·우산꽂이
  0x3a3a3c, // 5  검정       헬멧·킥보드·리모컨·배달 용기
  0xc9ccd1, // 6  은색       동전·열쇠·승용차
  0x8a6a48, // 7  나무       평상
  // ── 포인트 8~19 ─────────────────────────────────────────────
  0xd94f4f, // 8  빨강       소화기·포장마차 의자·컵라면
  0xe8621f, // 9  주황       라바콘·포장마차 천막
  0xe8b93a, // 10 노랑       주차 차단기·음식물 쓰레기통
  0x3f7d3a, // 11 초록       소주병·분리수거 통
  0x8ec63f, // 12 연두       따릉이
  0x2ac1bc, // 13 민트       배달 오토바이·교통카드
  0x2f6fb5, // 14 파랑       페트병 뚜껑·슬리퍼
  0xa8563f, // 15 적갈       벽돌·화분
  0x5b7f4e, // 16 잎         은행나무
  0xb87333, // 17 구리       십원짜리
  0xd9b877, // 18 담배 필터  담배꽁초
  0x8f5f9e, // 19 보라       립밤·사탕
] as const;

/**
 * 형태별 본체 색 — PALETTE 인덱스.
 *
 * 배열인 이유는 같은 물건이 여러 색으로 나오기 때문이다. 승용차가 전부 은색이면
 * 주차된 줄이 복사-붙여넣기로 보인다. 라바콘처럼 실제로 한 색뿐인 것은 하나만 둔다.
 *
 * **같은 값을 두 번 넣으면 그 색의 확률이 올라간다** — `choices[(roll * len) | 0]` 로
 * 뽑기 때문이다. `[5, 5, 0]` 이면 검정 2/3, 흰색 1/3. 가중치용 문법이 따로 필요 없다.
 *
 * WHITE 부품이 없는 형태(명함·평상·열쇠 …)도 값이 필요하다 —
 * PAPER·WOOD·METAL 계수에도 이 색이 곱해지므로, 그런 형태에는 중성색을 준다.
 *
 * 여기 없는 형태는 예전처럼 팔레트 전체에서 무작위로 받는다.
 * tools/shapecheck.ts 가 빠진 형태를 잡아낸다.
 */
export const SHAPE_COLOR: Record<string, readonly number[]> = {
  // ── 버킷 0 (1~2cm) ──────────────────────────────────────────
  담배꽁초: [0], 병뚜껑: [11, 8, 14], 십원짜리: [17], 이쑤시개: [1],
  은행알: [1], '껌 종이': [0], 옷핀: [6],
  // ── 버킷 1 (2~4cm) ──────────────────────────────────────────
  라이터: [8, 10, 14], 오백원짜리: [6], 건전지: [5, 10], 립밤: [0, 19],
  열쇠: [6], '페트병 뚜껑': [14, 11, 8], 사탕: [8, 10, 19],
  // ── 버킷 2 (4~8cm) ──────────────────────────────────────────
  담뱃갑: [0, 5], 명함: [0], 찌라시: [1, 10], 물티슈: [0, 0, 14],
  소주잔: [0], 교통카드: [13, 14], '이어폰 케이스': [5, 0],
  // ── 버킷 3 (8~16cm) ─────────────────────────────────────────
  // 컵라면은 흰/미색 바탕에 빨간 띠다. 몸통까지 빨강이면 컵 전체가 빨개진다
  종이컵: [0], '탕후루 꼬치': [1], 컵라면: [1], '즉석밥 용기': [0],
  '요구르트 줄': [0], 마스크: [0], 리모컨: [5],
  // ── 버킷 4 (16~32cm) ────────────────────────────────────────
  소주병: [11], '떡볶이 접시': [0], '배달 용기': [5], 슬리퍼: [5, 5, 14],
  벽돌: [15], '종량제 봉투': [0], 화분: [15],
  // ── 버킷 5 (32~63cm) ────────────────────────────────────────
  라바콘: [9], '택배 상자': [2], 소화기: [8], '라이더 헬멧': [5, 5, 0],
  '스티로폼 박스': [0], 우산꽂이: [4], '음식물 쓰레기통': [10],
  // ── 버킷 6 (63cm~1.26m) ─────────────────────────────────────
  '포장마차 의자': [8], 입간판: [0], '전동 킥보드': [5], '분리수거 통': [11, 14],
  평상: [7], '파라솔 받침': [4], 정수기: [0],
  // ── 버킷 7 (1.26~2.51m) ─────────────────────────────────────
  따릉이: [12], '배달 오토바이': [5, 5, 13], 에어간판: [8, 10, 14], 자판기: [8, 14],
  김치냉장고: [0, 6], '붕어빵 카트': [6], '편의점 파라솔': [0, 0, 14],
  // ── 버킷 8 (2.51~5m) ────────────────────────────────────────
  '포장마차 천막': [9, 8], '마을버스 승강장': [4], 전봇대: [3], 은행나무: [16],
  '아크릴 간판': [0, 0, 14], 승용차: [6, 0, 5, 4], '주차 차단기': [10],
};

export const GEOMETRY_COUNT = 4;

/**
 * 전용 형태를 가진 라벨. src/world/shapes.ts 가 **같은 순서로** 지오메트리를 만들고,
 * 인덱스는 기본 도형 4개 다음(GEOMETRY_COUNT + i)에 이어붙는다.
 *
 * 여기 없는 라벨은 지금까지처럼 기본 도형 4개 중 하나를 무작위로 받는다 —
 * 63종을 한 번에 만들지 않고 늘려갈 수 있는 이유다.
 *
 * 이 문자열은 아래 LABEL_BUCKETS 에 **실재하는 라벨이어야 한다.**
 * 오타가 나면 아무도 안 쓰는 죽은 지오메트리가 조용히 생긴다 —
 * tools/shapecheck.ts 가 이걸 검사한다.
 *
 * 크기 그룹별로 나누는 이유는 두 가지다:
 *   1. 빌더 파일(shapes.small/mid/large.ts)이 `Record<ShapeIdSmall, ...>` 를 구현하므로
 *      **한 종이라도 빠지면 컴파일 에러**가 난다
 *   2. 미리보기 그리드의 줄 순서가 곧 이 순서다
 */
/** 버킷 0~2 (1~8cm). shapes.small.ts 가 전부 구현해야 한다. */
export const SHAPE_IDS_SMALL = [
  // 버킷 0 (1~2cm)
  '담배꽁초', '병뚜껑', '십원짜리', '이쑤시개', '은행알', '껌 종이', '옷핀',
  // 버킷 1 (2~4cm)
  '라이터', '오백원짜리', '건전지', '립밤', '열쇠', '페트병 뚜껑', '사탕',
  // 버킷 2 (4~8cm)
  '담뱃갑', '명함', '찌라시', '물티슈', '소주잔', '교통카드', '이어폰 케이스',
] as const;
/** 버킷 3~5 (8cm~63cm). shapes.mid.ts */
export const SHAPE_IDS_MID = [
  // 버킷 3 (8~16cm)
  '종이컵', '탕후루 꼬치', '컵라면', '즉석밥 용기', '요구르트 줄', '마스크', '리모컨',
  // 버킷 4 (16~32cm)
  '소주병', '떡볶이 접시', '배달 용기', '슬리퍼', '벽돌', '종량제 봉투', '화분',
  // 버킷 5 (32~63cm)
  '라바콘', '택배 상자', '소화기', '라이더 헬멧', '스티로폼 박스', '우산꽂이', '음식물 쓰레기통',
] as const;
/** 버킷 6~8 (63cm~5m). shapes.large.ts */
export const SHAPE_IDS_LARGE = [
  // 버킷 6 (63cm~1.26m)
  '포장마차 의자', '입간판', '전동 킥보드', '분리수거 통', '평상', '파라솔 받침', '정수기',
  // 버킷 7 (1.26~2.51m)
  '따릉이', '배달 오토바이', '에어간판', '자판기', '김치냉장고', '붕어빵 카트', '편의점 파라솔',
  // 버킷 8 (2.51~5m)
  '포장마차 천막', '마을버스 승강장', '전봇대', '은행나무', '아크릴 간판', '승용차', '주차 차단기',
] as const;

export const SHAPE_IDS = [...SHAPE_IDS_SMALL, ...SHAPE_IDS_MID, ...SHAPE_IDS_LARGE];

export type ShapeIdSmall = (typeof SHAPE_IDS_SMALL)[number];
export type ShapeIdMid = (typeof SHAPE_IDS_MID)[number];
export type ShapeIdLarge = (typeof SHAPE_IDS_LARGE)[number];
export type ShapeId = ShapeIdSmall | ShapeIdMid | ShapeIdLarge;

/** 기본 도형 + 전용 형태 = World가 만들어야 할 지오메트리 총 개수 */
export const TOTAL_GEOMETRY_COUNT = GEOMETRY_COUNT + SHAPE_IDS.length;

const SHAPE_INDEX = new Map<string, number>(
  SHAPE_IDS.map((id, i) => [id, GEOMETRY_COUNT + i]),
);

/**
 * 크기 구간별 이름. 구간 자체는 연속이고, 라벨만 로그 버킷으로 고른다.
 * 버킷 경계는 각각 약 2배씩 (1cm → 2 → 4 → 8 → 16 → 32 → 63cm → 1.26 → 2.51 → 5m).
 *
 * 새벽 4시 서울, 아파트 단지에서 골목과 상가로 이어지는 구역.
 * 랜드마크는 하나도 없다 — 도시는 생활 물건의 밀도로 드러나야 한다.
 * "동전, 우산, 의자"처럼 어느 도시에나 있는 물건으로 채우면 배경이 죽는다.
 */
export const LABEL_BUCKETS: readonly (readonly string[])[] = [
  // 1 ~ 2cm
  ['담배꽁초', '병뚜껑', '십원짜리', '이쑤시개', '은행알', '껌 종이', '옷핀'],
  // 2 ~ 4cm
  ['라이터', '오백원짜리', '건전지', '립밤', '열쇠', '페트병 뚜껑', '사탕'],
  // 4 ~ 8cm
  ['담뱃갑', '명함', '찌라시', '물티슈', '소주잔', '교통카드', '이어폰 케이스'],
  // 8 ~ 16cm
  ['종이컵', '탕후루 꼬치', '컵라면', '즉석밥 용기', '요구르트 줄', '마스크', '리모컨'],
  // 16 ~ 32cm
  ['소주병', '떡볶이 접시', '배달 용기', '슬리퍼', '벽돌', '종량제 봉투', '화분'],
  // 32 ~ 63cm
  ['라바콘', '택배 상자', '소화기', '라이더 헬멧', '스티로폼 박스', '우산꽂이', '음식물 쓰레기통'],
  // 63cm ~ 1.26m
  ['포장마차 의자', '입간판', '전동 킥보드', '분리수거 통', '평상', '파라솔 받침', '정수기'],
  // 1.26 ~ 2.51m
  ['따릉이', '배달 오토바이', '에어간판', '자판기', '김치냉장고', '붕어빵 카트', '편의점 파라솔'],
  // 2.51 ~ 5m
  ['포장마차 천막', '마을버스 승강장', '전봇대', '은행나무', '아크릴 간판', '승용차', '주차 차단기'],
];

/**
 * 방 하나의 배치 규칙. **손배치 스테이지 전용.**
 *
 * 도넛 공식(`placeCoef * size^placePower`)은 **경계 없는 평지**를 전제한다.
 * 벽으로 막힌 방에서는 성립하지 않는다 — 3cm 물체가 3m 밖 복도에 떨어지면
 * 거실에서 먹을 게 모자라 플레이어가 갇힌다.
 *
 * 그래서 크기 구간을 방에 **직접 못 박는다.** 사다리가 방마다 닫혀 있어야
 * "방에서 다 먹고 문이 열린다"는 원작 리듬이 나온다.
 *
 * 렌더 정보(바닥색·이름)는 여기 없다. `generation.ts`는 THREE를 모르는 파일이고,
 * 튜닝 스크립트가 게임과 **같은 숫자**를 읽는다는 규약이 그것에 달려 있다.
 */
export interface RoomPlacement {
  readonly id: string;
  /** 바닥 사각형 (x0, z0, x1, z1). 월드 좌표(m) */
  readonly rect: readonly [number, number, number, number];
  /** 이 방에 놓을 물체 크기 범위(m) */
  readonly sizeMin: number;
  readonly sizeMax: number;
  readonly count: number;
  /** 이 지름(m)에 도달해야 들어올 수 있는 방. 사다리 검사가 구간을 나눌 때 쓴다 */
  readonly openAt: number;
}

export const GENERATION = {
  count: 1400,

  /**
   * 크기는 로그 균등 분포로 뽑는다 — 옥타브당 개수가 일정.
   *
   * 이게 지수적 성장의 이론적 정답이다. 흡수 가능한 최대 크기는 반지름에 비례하고,
   * 그 크기 물체의 부피는 R³ ∝ V 이므로, 한 번 먹을 때마다 부피가 **일정 비율** 늘어난다.
   * → 두 배가 되는 데 필요한 개수가 반지름과 무관하게 일정해진다.
   */
  sizeMin: 0.01,
  sizeMax: 5.0,

  /**
   * 배치 반경 = placeCoef * size^placePower, 도넛 안쪽은 innerRatio.
   *
   * 이론적 기준선은 지수 1.0이다 (훑는 면적이 R²에 비례하므로 밀도가 1/s²이어야 함).
   * 하지만 실측하면 0.65가 더 매끄럽다 — 이론이 놓친 게 두 가지 있다:
   *   1. 큰 물체로 이동하는 시간이 순수 손실이라 멀수록 곡선이 늘어진다
   *   2. 큰 걸 먹으러 가는 길에 작은 걸 쓸어담아서 조우율이 이론보다 높다
   * tools/curve.ts로 재측정하면서 조정할 것.
   */
  placeCoef: 36,
  placePower: 0.65,
  placeInnerRatio: 0.15,
  placeMin: 0.4,
  placeMax: 190,

  /** 축별 비등방 스케일 범위 — 같은 크기라도 모양이 다양해 보이게 */
  aspectMin: 0.6,
  aspectMax: 1.5,

  /**
   * 겹침 완화 반복 횟수. 0이면 완화하지 않는다.
   *
   * 도구가 `{ relaxIterations: 0 }` 으로 **완화 전 대조군**을 만든다 —
   * "예전엔 9.1%였다"를 주석으로 적으면 도구가 자기 말을 증명하지 못한다.
   * 움직임이 없으면 조기 종료하므로 넉넉히 잡아도 비용이 늘지 않는다.
   */
  relaxIterations: 64,
} as const;

/** 오버라이드용. as const 때문에 리터럴 타입이 되는 걸 number로 넓힌다. */
export type GenerationParams = { -readonly [K in keyof typeof GENERATION]: number };

export interface ObjectSpec {
  x: number; y: number; z: number;
  sx: number; sy: number; sz: number;
  rotY: number;
  geo: number;
  color: number;
  /** 최대 변 길이 — 흡수 판정 기준 */
  size: number;
  volume: number;
  label: string;
}

/** 재현 가능한 난수. 같은 시드 = 같은 월드 (튜닝의 전제조건). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 물체를 놓으면 안 되는 자리 판정 (물 위, 건물 바닥면 안).
 *
 * 좌표는 **생성기 로컬** — 원점 기준이다. 월드가 나중에 스폰만큼 옮기므로
 * 호출자가 그 오프셋을 감안해서 넘겨야 한다.
 */
export type BlockedFn = (x: number, z: number) => boolean;

/**
 * 한 물체당 재배치 시도 상한.
 *
 * 앞쪽 `RETRY_ANGLE_ONLY` 회는 **각도만** 다시 뽑는다 —
 * placeCoef/placePower 로 튜닝한 반지름 분포가 곧 성장 곡선이라
 * dist 를 흔들면 곡선이 흔들린다.
 */
const RETRY_ANGLE_ONLY = 24;
const RETRY_MAX = 48;

/**
 * 방 안쪽으로 물러나는 고정 여유(m). 물체 반쪽(`base * 0.75`)에 더해서 쓴다.
 * 벽 두께 절반 + 벽에 딱 붙어 박히지 않을 만큼.
 */
const ROOM_MARGIN = 0.06;

export function generateWorld(
  seed = 1337,
  overrides: Partial<GenerationParams> = {},
  blocked?: BlockedFn,
  rooms?: readonly RoomPlacement[],
): ObjectSpec[] {
  const g = { ...GENERATION, ...overrides };
  const rand = mulberry32(seed);
  /**
   * 재배치 전용 난수. 메인 스트림과 **반드시 분리**한다.
   *
   * 메인에서 다시 뽑으면 막힌 물체 하나 때문에 그 뒤 전부의 크기·색·라벨이 밀린다.
   * 시드가 같아도 월드가 통째로 달라져서 ladder 로 재둔 분포와 비교가 불가능해진다.
   * 분리하면 **막히지 않은 물체는 이전과 비트 단위로 동일**하다.
   */
  const retry = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const specs: ObjectSpec[] = [];
  const logRatio = Math.log(g.sizeMax / g.sizeMin);

  /**
   * 물체 하나를 만든다. **위치를 정하는 방법만** 호출자가 넘긴다.
   *
   * `drawPos`가 난수 스트림 한가운데서 불리는 게 의도적이다. 도넛 배치는
   * 종횡비 다음에 dist·angle을 뽑았고, 그 **호출 순서를 바꾸면 시드가 같아도
   * 월드가 통째로 달라져서** ladder/curve로 재둔 이전 값과 비교가 불가능해진다.
   * 방 배치는 자기 스트림 위치에서 x·z를 뽑을 뿐 순서 규약은 그대로 따른다.
   *
   * @param u 전역 크기 축에서의 위치(0~1). 라벨 버킷이 이걸로 갈린다 —
   *          방마다 크기 범위가 달라도 "이 크기면 이 물건"은 하나로 유지된다.
   */
  const emit = (
    u: number, base: number,
    drawPos: () => readonly [number, number],
    retryPos?: (t: number) => readonly [number, number],
    /**
     * true면 종횡비를 정규화해서 **최대 변이 정확히 base** 가 된다.
     *
     * 도넛 배치에서는 `size`(최대 변)가 base × aspectMax 까지 커진다 — 넓은 평지라
     * 상관없다. 방에서는 다르다: "이 방엔 40cm까지"라고 적었는데 60cm가 나오면
     * 1.8m 복도에 안 들어간다. 방에서는 sizeMax 가 **실제 최대 변**을 뜻한다.
     */
    normalizeAspect = false,
  ): void => {
    const aspect = () => g.aspectMin + rand() * (g.aspectMax - g.aspectMin);
    const a1 = aspect(), a2 = aspect(), a3 = aspect();
    const k = normalizeAspect ? 1 / Math.max(a1, a2, a3) : 1;
    const sx = base * a1 * k;
    const sy = base * a2 * k;
    const sz = base * a3 * k;

    let [x, z] = drawPos();

    const bucket = Math.min(
      LABEL_BUCKETS.length - 1,
      Math.floor((u * LABEL_BUCKETS.length)),
    );
    const labels = LABEL_BUCKETS[bucket]!;

    // 난수를 뽑는 **순서**를 바꾸지 않는다 (위 주석 참고).
    // 라벨이 geo를 결정하니 조립만 뒤로 미룬다.
    const rotY = rand() * Math.PI * 2;
    const primitive = (rand() * GEOMETRY_COUNT) | 0;
    // 색 난수는 **여기서** 뽑는다 — 호출 순서를 바꾸면 안 되기 때문이다.
    // 쓰는 시점만 label 확정 뒤로 미룬다. 형태를 알아야 그 형태의 색을 고를 수 있다.
    const colorRoll = rand();
    const label = labels[(rand() * labels.length) | 0]!;

    // 형태별 고정 색. 표에 없는 라벨은 예전처럼 팔레트 전체에서 받는다.
    const choices = SHAPE_COLOR[label];
    const color = choices
      ? choices[(colorRoll * choices.length) | 0]!
      : (colorRoll * PALETTE.length) | 0;

    // 물 위·건물 안이면 다시 뽑는다. 버리지 않는다 — 개수가 줄면 밀도가 무너진다.
    if (blocked !== undefined && retryPos !== undefined && blocked(x, z)) {
      for (let t = 0; t < RETRY_MAX; t++) {
        [x, z] = retryPos(t);
        if (!blocked(x, z)) break;
      }
    }

    specs.push({
      x,
      y: sy / 2,
      z,
      sx, sy, sz,
      rotY,
      geo: SHAPE_INDEX.get(label) ?? primitive,
      color,
      size: Math.max(sx, sy, sz),
      volume: sx * sy * sz,
      label,
    });
  };

  // ── 방 배치 ────────────────────────────────────────────────
  //
  // 도넛 공식은 **경계 없는 평지**를 전제한다. 벽으로 막힌 방에서는 성립하지 않는다 —
  // 3cm 물체가 3m 밖 복도에 떨어지면 거실에서 먹을 게 모자라 플레이어가 갇힌다.
  if (rooms !== undefined) {
    /** specs 인덱스 → 그 물체가 사는 방. 완화가 끝난 뒤 되밀어 넣을 때 쓴다 */
    const owner: (readonly [number, number, number, number])[] = [];
    for (const room of rooms) {
      const logR = Math.log(room.sizeMax / room.sizeMin);
      const [rx0, rz0, rx1, rz1] = room.rect;
      for (let n = 0; n < room.count; n++) {
        const base = room.sizeMin * Math.exp(logR * rand());
        // 라벨 버킷은 **전역** 크기 축에서 고른다. 방 안의 상대 위치로 고르면
        // 화장실의 제일 큰 물건과 뒷마당의 제일 큰 물건이 같은 라벨을 받는다.
        const u = Math.min(1, Math.max(0, Math.log(base / g.sizeMin) / logRatio));
        // 물체 반쪽만큼 벽에서 물러난다. 방 배치에서는 base 가 곧 **최대 변**이다
        // (아래 emit 이 종횡비를 정규화한다).
        const m = base / 2 + ROOM_MARGIN;
        // 방이 여유보다 좁으면 가운데 한 점으로 접는다. 넓이가 음수가 되면
        // 좌표가 뒤집혀서 물체가 방 밖에 놓인다.
        const ax = Math.min(rx0 + m, (rx0 + rx1) / 2);
        const bx = Math.max(rx1 - m, (rx0 + rx1) / 2);
        const az = Math.min(rz0 + m, (rz0 + rz1) / 2);
        const bz = Math.max(rz1 - m, (rz0 + rz1) / 2);
        const pick = (r: () => number) => [ax + r() * (bx - ax), az + r() * (bz - az)] as const;
        emit(u, base, () => pick(rand), () => pick(retry), true);
        owner.push([ax, az, bx, bz]);
      }
    }
    relaxOverlaps(specs, g.relaxIterations, blocked, (i) => {
      const [ax, az, bx, bz] = owner[i]!;
      const s = specs[i]!;
      s.x = Math.min(bx, Math.max(ax, s.x));
      s.z = Math.min(bz, Math.max(az, s.z));
    });
    return specs;
  }

  for (let n = 0; n < g.count; n++) {
    // 로그 균등: s = min * (max/min)^u
    const u = rand();
    const base = g.sizeMin * Math.exp(logRatio * u);

    const outer = Math.min(Math.max(g.placeCoef * base ** g.placePower, g.placeMin), g.placeMax);
    const inner = outer * g.placeInnerRatio;
    // 재배치가 참고해야 해서 밖에 둔다 — 앞쪽 RETRY_ANGLE_ONLY 회는 **각도만** 다시 뽑고
    // 이 거리를 그대로 쓴다. placeCoef/placePower 로 튜닝한 반지름 분포가 곧 성장 곡선이라
    // dist 를 흔들면 곡선이 흔들린다.
    let dist = 0;

    emit(
      u, base,
      () => {
        // 도넛 안에서 면적 균등 샘플링
        dist = Math.sqrt(inner * inner + rand() * (outer * outer - inner * inner));
        const angle = rand() * Math.PI * 2;
        return [Math.cos(angle) * dist, Math.sin(angle) * dist] as const;
      },
      (t) => {
        const a2 = retry() * Math.PI * 2;
        const d2 = t < RETRY_ANGLE_ONLY
          ? dist
          : Math.sqrt(inner * inner + retry() * (outer * outer - inner * inner));
        return [Math.cos(a2) * d2, Math.sin(a2) * d2] as const;
      },
    );
  }

  // 위치만 민다. 개수·크기·색·라벨은 여기서 절대 안 바뀐다.
  // 물·건물 재배치가 남은 공간으로 물체를 몰아 겹침을 6%p 늘리므로 **그 뒤에** 돈다.
  relaxOverlaps(specs, g.relaxIterations, blocked);
  return specs;
}

/** 크기 비가 이보다 크면 안 민다 — 담배꽁초가 자판기 옆에 있는 건 겹침이 아니라 정상이다 */
const RELAX_SIZE_RATIO = 4;
/**
 * 브로드페이즈 격자 한 변(m).
 *
 * 8m 로 잡았다가 한 번 도는 데 1,170ms 가 나왔다. 작은 물체 수백 개가 스폰 주변
 * 한 셀에 몰려서 쌍 비교가 폭발한 탓이다 (셀 안 물체 n 개면 비교가 n²/2).
 * 1m 로 줄이면 큰 물체가 여러 셀에 걸치는 대신 셀당 물체가 적어져 **64ms** 가 된다.
 */
const RELAX_CELL = 1;


/**
 * 겹침 완화.
 *
 * 배치 반경은 `placeCoef · size^placePower` 로 커지는데 바닥면적은 size² 로 커진다.
 * 지수(0.65)가 곡선을 위해 택한 값이라, 큰 물체 구간은 점유율이 34%까지 올라가고
 * 무작위 배치로는 **반드시** 겹친다. placePower 를 올리면 겹침은 줄지만 곡선이 무너지므로
 * 지수는 두고, 놓은 뒤에 겹친 쌍을 **침투가 얕은 축으로 절반씩** 밀어 떼어놓는다.
 *
 * **난수를 한 번도 쓰지 않는다.** 메인 스트림을 건드리면 시드가 같아도 크기·색·라벨이
 * 통째로 밀려서 ladder/curve 로 재둔 값과 비교가 불가능해진다.
 * `npm run placecheck` 의 분포 불변 검사가 이걸 감시한다.
 *
 * **`blocked` 는 마지막에 한 번만 부른다.** 밀 때마다 부르면 물 폴리곤 23개 +
 * 건물 검사가 수만 번 돌아서 World 생성이 1.5초 → 11초가 된다(실측).
 * 완화는 자유롭게 돌리고, 끝난 뒤 물·건물에 빠진 것만 원위치로 되돌린다 —
 * 이동량이 1.3m 남짓이라 새로 빠지는 물체는 소수다.
 *
 * @returns 해소한 쌍의 누적 개수 (수렴하면 조기 종료)
 */
function relaxOverlaps(
  specs: ObjectSpec[],
  iterations: number,
  blocked?: BlockedFn,
  /**
   * 물체 i를 자기 구역 안으로 되밀어 넣는다. 방 배치 전용.
   *
   * **완화는 경계를 모른다.** 그냥 겹친 쌍을 서로 밀 뿐이라, 5.4m 거실에 430개를
   * 넣으면 벽을 뚫고 복도·집 밖까지 퍼진다 (실측 1,480개 중 1,250개 이탈).
   * `blocked`로는 못 막는다 — 벽 너머 빈 공간은 "막힌 자리"가 아니기 때문이다.
   * 그래서 **반복마다** 접어 넣는다. 마지막에 한 번만 접으면 그 접힘이
   * 새 겹침을 만들고 완화할 기회가 없다.
   */
  confine?: (i: number) => void,
): number {
  if (iterations <= 0) return 0;
  // 완화 전 위치. 이 좌표들은 이미 blocked 를 통과한 상태다.
  const safeX = specs.map((s) => s.x);
  const safeZ = specs.map((s) => s.z);
  let resolved = 0;

  // 직전 반복에서 움직인 물체. 처음에는 전부가 대상이다.
  //
  // 이게 없으면 후반 반복이 아무 일도 안 하면서 4,200개를 매번 다 훑는다.
  // 반복 64회에서 부팅이 2.4초 → 4.3초가 됐다. 겹침은 **움직인 물체 주변에서만**
  // 새로 생기므로, 한쪽이라도 직전에 움직인 쌍만 보면 된다.
  let active = new Uint8Array(specs.length).fill(1);

  for (let iter = 0; iter < iterations; iter++) {
    // 물체가 움직이므로 격자는 매 반복 다시 만든다
    const grid = new Map<number, number[]>();
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i]!;
      const gz1 = Math.floor((s.z + s.sz / 2) / RELAX_CELL);
      const gx1 = Math.floor((s.x + s.sx / 2) / RELAX_CELL);
      for (let gz = Math.floor((s.z - s.sz / 2) / RELAX_CELL); gz <= gz1; gz++) {
        for (let gx = Math.floor((s.x - s.sx / 2) / RELAX_CELL); gx <= gx1; gx++) {
          const key = gx * 100003 + gz;
          let cell = grid.get(key);
          if (!cell) grid.set(key, (cell = []));
          cell.push(i);
        }
      }
    }

    let moved = 0;
    const next = new Uint8Array(specs.length);
    const seen = new Set<number>();
    for (const cell of grid.values()) {
      for (let a = 0; a < cell.length; a++) {
        for (let b = a + 1; b < cell.length; b++) {
          const i = cell[a]!;
          const j = cell[b]!;
          // 둘 다 직전에 가만히 있었다면 겹침 상태가 변했을 리 없다
          if (active[i] === 0 && active[j] === 0) continue;
          // 큰 물체는 여러 셀에 걸치므로 같은 쌍이 여러 번 나온다. 한 번만 민다.
          const pair = i * specs.length + j;
          if (seen.has(pair)) continue;
          seen.add(pair);

          const s = specs[i]!;
          const t = specs[j]!;
          if (Math.max(s.size, t.size) > Math.min(s.size, t.size) * RELAX_SIZE_RATIO) continue;

          const ox = (s.sx + t.sx) / 2 - Math.abs(s.x - t.x);
          const oz = (s.sz + t.sz) / 2 - Math.abs(s.z - t.z);
          if (ox <= 0 || oz <= 0) continue;

          // 침투가 얕은 축으로 민다 — 이동량이 최소가 된다
          const alongX = ox < oz;
          const half = (alongX ? ox : oz) / 2 + 1e-4;
          const dir = alongX
            ? (s.x <= t.x ? -1 : 1)
            : (s.z <= t.z ? -1 : 1);
          if (alongX) {
            s.x += dir * half;
            t.x -= dir * half;
          } else {
            s.z += dir * half;
            t.z -= dir * half;
          }
          next[i] = 1;
          next[j] = 1;
          moved++;
        }
      }
    }

    if (confine !== undefined) {
      for (let i = 0; i < specs.length; i++) if (next[i] === 1) confine(i);
    }

    resolved += moved;
    if (moved === 0) break;   // 수렴
    active = next;
  }

  // 물·건물로 밀려 들어간 것만 되돌린다. 겹치는 게 호수에 빠지는 것보다 낫다.
  //
  // 통째로 원위치시키면 그 물체의 겹침이 전부 되살아난다(실측 1.5% → 2.4%).
  // 대신 원위치 쪽으로 **단계적으로 물러나며** 처음 안전해지는 지점에서 멈춘다 —
  // 밀어낸 거리의 일부라도 살린다. 물체당 최대 네 번만 더 검사한다.
  if (blocked !== undefined) {
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i]!;
      if (!blocked(s.x, s.z)) continue;
      const fx = s.x, fz = s.z;
      const bx = safeX[i]!, bz = safeZ[i]!;
      for (const t of [0.66, 0.33, 0]) {
        const nx = bx + (fx - bx) * t;
        const nz = bz + (fz - bz) * t;
        if (t === 0 || !blocked(nx, nz)) {
          s.x = nx;
          s.z = nz;
          break;
        }
      }
    }
  }
  return resolved;
}
