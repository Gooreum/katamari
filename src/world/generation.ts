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
 * **서울 새벽 길거리에서 원작 가정집으로 갈아엎었다.** 예전 팔레트는
 * "회색·검정·흰색·베이지가 기본, 채도는 실제로 튀는 것에만"이라는 전제였다.
 * 집 안은 반대다 — 크레용·캐러멜·장난감·과일이라 채도가 기본이고
 * 무채색이 예외다. 원작 화면이 알록달록한 건 조명이 아니라 물건 때문이다.
 */
export const PALETTE = [
  // ── 중성 0~7 ────────────────────────────────────────────────
  0xf4f1e8, // 0  종이 흰색   신문·찌라시·휴지·접시
  0xe3d9c0, // 1  미색       쌀알·각설탕·달팽이 껍데기
  0xc7a878, // 2  크라프트   상자·골판지
  0xb0aca4, // 3  밝은 회색  콘센트·플라스틱
  0x5c5954, // 4  회색       리모컨·전화기
  0x2f2e2c, // 5  검정       개미·TV·클립
  0xc9ccd1, // 6  은색       나사·압정·주전자
  0x9a6b3f, // 7  나무       의자·서랍장·마루
  // ── 포인트 8~19 ─────────────────────────────────────────────
  0xe0483c, // 8  빨강       크레용·사과·주사위 점
  0xef7d24, // 9  주황       크레용·감·물뿌리개
  0xf5c22b, // 10 노랑       크레용·캐러멜·연필
  0x4fa845, // 11 초록       크레용·완두콩
  0x8fcf3a, // 12 연두       청개구리
  0x3fbfc4, // 13 민트       칫솔·컵
  0x2f6fb5, // 14 파랑       크레용·슬리퍼·방석
  0xe58aa8, // 15 분홍       지우개·사탕·고양이 코
  0x7b4fa0, // 16 보라       크레용·포도 사탕
  0x8a4f2a, // 17 적갈       화분·간장
  0xdca87a, // 18 살구       고양이·소시지
  0xf0e2b8, // 19 다다미     방석·돗자리
] as const;

/**
 * 형태별 본체 색 — PALETTE 인덱스.
 *
 * 배열인 이유는 같은 물건이 여러 색으로 나오기 때문이다. 크레용이 전부 빨강이면
 * 크레용 통이 아니라 빨간 막대 더미가 된다. 압정처럼 실제로 한 색뿐인 것은 하나만 둔다.
 *
 * **같은 값을 두 번 넣으면 그 색의 확률이 올라간다** — `choices[(roll * len) | 0]` 로
 * 뽑기 때문이다. `[5, 5, 0]` 이면 검정 2/3, 흰색 1/3. 가중치용 문법이 따로 필요 없다.
 *
 * WHITE 부품이 없는 형태도 값이 필요하다 — PAPER·WOOD·METAL 계수에도
 * 이 색이 곱해지므로, 그런 형태에는 중성색을 준다.
 *
 * 여기 없는 형태는 팔레트 전체에서 무작위로 받는다.
 * tools/shapecheck.ts 가 빠진 형태를 잡아낸다.
 */
export const SHAPE_COLOR: Record<string, readonly number[]> = {
  // ── 버킷 0 (1~2cm) ──────────────────────────────────────────
  개미: [5], 쌀알: [0], 팥: [17], 클립: [6], 압정: [8, 11, 14], 단추: [0, 5, 14], 도장: [7],
  // ── 버킷 1 (2~4cm) ──────────────────────────────────────────
  주사위: [0], 나사: [6], 압핀: [8, 10, 13], 지우개: [15, 0], 각설탕: [0],
  사탕: [8, 10, 16], 성냥: [2],
  // ── 버킷 2 (4~8cm) ──────────────────────────────────────────
  크레용: [8, 9, 10, 11, 14, 16], 캐러멜: [10], 체온계: [0], '간장 팩': [17],
  청개구리: [12], 성냥갑: [8], 건전지: [5, 10],
  // ── 버킷 3 (8~16cm) ─────────────────────────────────────────
  소시지: [18], 껌: [13, 0], 달팽이: [1], '캐러멜 상자': [10], 사과: [8],
  찻잔: [0, 13], 전구: [0],
  // ── 버킷 4 (16~32cm) ────────────────────────────────────────
  찌라시: [0], 신문: [0], 연필깎이: [3, 8], 'RC 컨트롤러': [5], 접시: [0],
  슬리퍼: [14, 15], '두루마리 휴지': [0],
  // ── 버킷 5 (30~60cm) ────────────────────────────────────────
  방석: [19, 14, 8], 백팩: [14, 8], 휴지통: [3, 11], 전화기: [4], 밥솥: [0, 6],
  화분: [17], 주전자: [6],
  // ── 버킷 6 (60cm~1.2m) ──────────────────────────────────────
  고양이: [18, 5, 0], 의자: [7], 스툴: [7], 텔레비전: [5], 서랍장: [7],
  스탠드: [3], 물뿌리개: [9, 11],
  // ── 동네 맵 전용 ────────────────────────────────────────────
  꽃잎: [8, 10, 13], 자갈: [3, 4], 병뚜껑: [8, 11], 도토리: [7], 솔방울: [7],
  동전: [6], 꽃: [8, 10, 13, 16], '연어 캔': [6, 11], 쥐: [5], 골프공: [0],
  참새: [7], 페트병: [12, 0], 모종삽: [6], 비둘기: [3, 6], 삽: [6, 7],
  개밥그릇: [11, 8], 양동이: [11], 모래성: [9], 삼각콘: [8], 개: [7, 0],
  // ── World 맵 전용 ───────────────────────────────────────────
  // 타이어에 팔레트 검정(5)을 주면 DARK 정점색(0.18)과 곱해져 형체가 사라진다.
  // 오토바이가 검정이면 DARK 바퀴와 뭉쳐 덩어리가 되는 것과 같은 이유다.
  벽돌: [17], 축구공: [0], 타이어: [3],
  소화전: [8], 볼라드: [10, 0], 입간판: [7], 정글짐: [11, 8],
  자전거: [4, 8], 오토바이: [8, 14], 우체통: [8], 표지판: [8, 14], 드럼통: [11, 8],
  벤치: [7], 그네: [3, 11], 자판기: [8, 14], 미끄럼틀: [10, 11], 사람: [14, 8, 11],
  승용차: [0, 8, 14], 가로수: [11],
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
  '개미', '쌀알', '팥', '클립', '압정', '단추', '도장',
  // 버킷 1 (2~4cm)
  '주사위', '나사', '압핀', '지우개', '각설탕', '사탕', '성냥',
  // 버킷 2 (4~8cm)
  '크레용', '캐러멜', '체온계', '간장 팩', '청개구리', '성냥갑', '건전지',
] as const;
/** 버킷 3~5 (8~60cm). shapes.mid.ts */
export const SHAPE_IDS_MID = [
  // 버킷 3 (8~16cm)
  '소시지', '껌', '달팽이', '캐러멜 상자', '사과', '찻잔', '전구',
  // 버킷 4 (16~30cm)
  '찌라시', '신문', '연필깎이', 'RC 컨트롤러', '접시', '슬리퍼', '두루마리 휴지',
  // 버킷 5 (30~60cm)
  '방석', '백팩', '휴지통', '전화기', '밥솥', '화분', '주전자',
] as const;
/** 버킷 6 (60cm~1.2m). shapes.large.ts */
export const SHAPE_IDS_LARGE = [
  '고양이', '의자', '스툴', '텔레비전', '서랍장', '스탠드', '물뿌리개',
] as const;
/**
 * 동네 맵 전용 형태. shapes.town.ts 가 전부 구현해야 한다.
 *
 * **집 표와 겹치는 물건은 여기 없다** — 화분·휴지통·고양이처럼 마당에 있어도
 * 어색하지 않은 것은 기존 형태를 그대로 쓴다. 여기 있는 건 집에는 없는 것들이다.
 * 원작 「별을 만들어라 3」 동선에 이름이 나온 물건을 우선했다:
 * 꽃 · 연어 캔 · 공 · 삽 · 개밥그릇 · 페트병 · 쥐 · 개 · 모래성.
 */
export const SHAPE_IDS_TOWN = [
  // 버킷 0~1 (1~4cm)
  '꽃잎', '자갈', '병뚜껑', '도토리', '솔방울', '동전',
  // 버킷 2~3 (4~16cm)
  '꽃', '연어 캔', '쥐', '골프공', '참새', '페트병', '모종삽',
  // 버킷 4~5 (16~60cm)
  '비둘기', '삽', '개밥그릇', '양동이', '모래성', '삼각콘',
  // 버킷 6 (60cm~1.2m)
  '개',
] as const;

/**
 * World 맵 전용 형태. shapes.world.ts 가 전부 구현해야 한다.
 *
 * World는 공이 **50cm에서 시작**해 6m까지 간다. 그 크기대의 물건은 집·동네 표에 없다 —
 * 동네에서 이만한 것들은 전부 `CityBuilding`(못 먹는 배경)이었는데, 여기서는 먹는다.
 * 원작 Urchin Town 특징(양쪽 끝의 **공원과 학교**, 주유소, 정글짐)에서 뽑았다.
 *
 * **19cm~4m 를 덮는다.** 처음에는 1.15m 위쪽만 만들었는데, 그 아래를 집 표로
 * 때우니 광장에 의자·주전자·물뿌리개가 깔렸다. 거리에는 거리 물건이 있어야 한다.
 */
export const SHAPE_IDS_WORLD = [
  // 19~32cm — 길바닥
  '벽돌', '축구공',
  // 33~61cm — 주유소·노변
  '타이어',
  // 61cm~1.15m — 거리 설비
  '소화전', '볼라드', '입간판',
  // 1.15~2.14m
  '자전거', '오토바이', '우체통', '표지판', '드럼통', '벤치', '그네',
  // 2.14~4m
  '자판기', '미끄럼틀', '정글짐', '사람', '승용차', '가로수',
] as const;

export const SHAPE_IDS = [
  ...SHAPE_IDS_SMALL, ...SHAPE_IDS_MID, ...SHAPE_IDS_LARGE,
  ...SHAPE_IDS_TOWN, ...SHAPE_IDS_WORLD,
];

export type ShapeIdSmall = (typeof SHAPE_IDS_SMALL)[number];
export type ShapeIdMid = (typeof SHAPE_IDS_MID)[number];
export type ShapeIdLarge = (typeof SHAPE_IDS_LARGE)[number];
export type ShapeIdTown = (typeof SHAPE_IDS_TOWN)[number];
export type ShapeIdWorld = (typeof SHAPE_IDS_WORLD)[number];
export type ShapeId = ShapeIdSmall | ShapeIdMid | ShapeIdLarge | ShapeIdTown | ShapeIdWorld;

/** 기본 도형 + 전용 형태 = World가 만들어야 할 지오메트리 총 개수 */
export const TOTAL_GEOMETRY_COUNT = GEOMETRY_COUNT + SHAPE_IDS.length;

const SHAPE_INDEX = new Map<string, number>(
  SHAPE_IDS.map((id, i) => [id, GEOMETRY_COUNT + i]),
);

/**
 * 크기 구간별 이름. 구간 자체는 연속이고, 라벨만 로그 버킷으로 고른다.
 *
 * 버킷 경계는 `sizeMin`~`sizeMax`의 로그 범위를 버킷 수로 나눈 것이다.
 * 1cm ~ 1.2m 를 7등분하면 옥타브당 약 ×1.98 —
 * 1 → 2 → 3.9 → 7.8 → 15.4 → 30.5 → 60.4 → 120cm.
 *
 * **원작 塊魂의 타케다 저택 물건들이다.** 크기는 원작 실측값에 맞췄다:
 * 도장 2cm · 짧은 나사 2.5cm · 주사위 2.8cm · 압정 3.1cm · 압핀 3.5cm ·
 * 크레용 3.7~5.9cm · 캐러멜 4.4cm · 체온계 4.9cm · 간장 팩 5.6cm ·
 * 청개구리 7.4cm · 소시지 8.3cm · 껌 8.5cm · 달팽이 9.8cm ·
 * 캐러멜 상자 11.3cm · 찌라시 16.8cm · 신문 21.5cm · 연필깎이 26.2cm ·
 * RC 컨트롤러 30.1cm.
 *
 * 랜드마크는 없다. 집은 생활 물건의 밀도로 드러나야 한다.
 */
/**
 * 라벨 버킷이 덮는 크기 범위(m). **`GENERATION.sizeMax` 와 분리돼 있다.**
 *
 * 둘을 묶어놨더니 집 맵 상한(1.2m)에 맞춰 `sizeMax` 를 내리는 순간
 * 잠실(도넛 경로) 길거리 상한이 7m → 2m 로 같이 내려가서 최소 건물(6m)과의
 * 이음매가 끊겼다. `ladder -- --city jamsil` 이 "2m~5m 완전히 비어 있음"으로 잡았다.
 *
 * 라벨은 **물건의 정체**고 배치 범위는 **스테이지 설정**이다. 다른 것이다.
 * 이 범위를 넘는 크기는 마지막 버킷으로 접힌다 — 잠실에 5m짜리 서랍장이
 * 굴러다니게 되지만, 거긴 렌더 경로가 살아 있는지 보는 보조 모드다.
 */
export const LABEL_SIZE_MIN = 0.01;
export const LABEL_SIZE_MAX = 1.2;

export const LABEL_BUCKETS: readonly (readonly string[])[] = [
  // 1 ~ 2cm
  ['개미', '쌀알', '팥', '클립', '압정', '단추', '도장'],
  // 2 ~ 4cm
  ['주사위', '나사', '압핀', '지우개', '각설탕', '사탕', '성냥'],
  // 4 ~ 8cm
  ['크레용', '캐러멜', '체온계', '간장 팩', '청개구리', '성냥갑', '건전지'],
  // 8 ~ 15cm
  ['소시지', '껌', '달팽이', '캐러멜 상자', '사과', '찻잔', '전구'],
  // 15 ~ 30cm
  ['찌라시', '신문', '연필깎이', 'RC 컨트롤러', '접시', '슬리퍼', '두루마리 휴지'],
  // 30 ~ 60cm
  ['방석', '백팩', '휴지통', '전화기', '밥솥', '화분', '주전자'],
  // 60cm ~ 1.2m
  ['고양이', '의자', '스툴', '텔레비전', '서랍장', '스탠드', '물뿌리개'],
];

/**
 * 동네 맵(Pigeon Town)의 라벨 표.
 *
 * **버킷 개수와 크기 경계는 위 표와 똑같다** — 이름만 다르다.
 * 라벨은 물건의 정체고 경계는 사다리라, 경계까지 스테이지마다 바꾸면
 * `ladder`가 맵마다 다른 자를 대게 된다.
 *
 * 절반은 기존 형태를 그대로 쓴다 (개미·클립·화분·고양이…). 마당·공원에 있어도
 * 어색하지 않은 것들이고, 같은 물건을 두 벌 만들 이유가 없다.
 * 집 전용(밥솥·서랍장·텔레비전·다다미 계열)은 여기 없다.
 */
export const TOWN_BUCKETS: readonly (readonly string[])[] = [
  // 1 ~ 2cm
  ['개미', '꽃잎', '자갈', '병뚜껑', '클립', '단추', '도토리'],
  // 2 ~ 4cm
  ['나사', '지우개', '사탕', '솔방울', '동전', '압정', '성냥'],
  // 4 ~ 8cm
  ['꽃', '연어 캔', '청개구리', '쥐', '골프공', '건전지', '성냥갑'],
  // 8 ~ 15cm
  ['참새', '페트병', '달팽이', '사과', '찻잔', '모종삽', '전구'],
  // 15 ~ 30cm
  ['비둘기', '삽', '개밥그릇', '신문', '접시', '슬리퍼', '두루마리 휴지'],
  // 30 ~ 60cm
  ['양동이', '모래성', '삼각콘', '휴지통', '백팩', '화분', '주전자'],
  // 60cm ~ 1.2m
  // **다섯 종뿐이다.** 이 크기의 집 물건(서랍장·텔레비전·스탠드·방석)은 전부
  // 실내 전용이라 못 쓴다. 억지로 채우면 마당에 座布團이 굴러다니게 된다.
  // 의자·스툴은 공원 벤치 자리로 읽히고, 물뿌리개는 마당 물건이다.
  ['개', '고양이', '의자', '스툴', '물뿌리개'],
];

/**
 * 스테이지의 라벨 표 — **이름과 크기 경계를 함께** 들고 있다.
 *
 * 예전에는 이름만 스테이지가 갖고 경계는 `LABEL_SIZE_MIN/MAX`(0.01~1.2m) 고정이었다.
 * World 맵은 공이 50cm에서 시작해 6m까지 가므로 그 경계로는 소품 절반이 마지막
 * 버킷에 뭉쳐서 전부 「고양이·의자·스툴」이 된다.
 *
 * **버킷 개수는 표마다 달라도 되지만, 한 표 안에서는 경계가 로그 등분이다.**
 */
export interface LabelTable {
  readonly buckets: readonly (readonly string[])[];
  /** 첫 버킷이 시작하는 크기(m). 이보다 작으면 첫 버킷으로 접힌다 */
  readonly min: number;
  /** 마지막 버킷이 끝나는 크기(m). 이보다 크면 마지막 버킷으로 접힌다 */
  readonly max: number;
}

/** 집 맵 — 예전 기본값 그대로다 */
export const HOUSE_TABLE: LabelTable = {
  buckets: LABEL_BUCKETS, min: LABEL_SIZE_MIN, max: LABEL_SIZE_MAX,
};
/** 동네 맵 — 경계는 집과 같고 이름만 다르다 */
export const TOWN_TABLE: LabelTable = {
  buckets: TOWN_BUCKETS, min: LABEL_SIZE_MIN, max: LABEL_SIZE_MAX,
};

/**
 * World 맵(Urchin Town)의 라벨 표.
 *
 * **경계가 다르다** — 5cm ~ 4m를 7등분하면 옥타브비가 약 1.87×다.
 * 공이 50cm에서 시작하므로 집·동네의 1cm~1.2m 경계로는 소품 절반이
 * 마지막 버킷에 뭉쳐 전부 「고양이·의자·스툴」이 된다.
 *
 *   5~9.4cm · 9.4~17.5 · 17.5~32.8 · 32.8~61.3 · 61.3cm~1.15m · 1.15~2.14m · 2.14~4m
 *
 * 앞 다섯 버킷은 **기존 형태를 그대로 쓴다** — 길에 있어도 어색하지 않은 것들이다.
 * 뒤 두 버킷만 새로 만들었다.
 */
export const WORLD_BUCKETS: readonly (readonly string[])[] = [
  // 5 ~ 9.4cm
  ['크레용', '캐러멜', '체온계', '청개구리', '성냥갑', '건전지', '연어 캔'],
  // 9.4 ~ 17.5cm
  ['소시지', '껌', '달팽이', '사과', '찻잔', '전구', '페트병'],
  // 17.5 ~ 32.8cm
  ['신문', '연필깎이', '접시', '슬리퍼', '두루마리 휴지', '비둘기', '삽'],
  // 32.8 ~ 61.3cm
  ['백팩', '휴지통', '화분', '주전자', '양동이', '모래성', '삼각콘'],
  // 61.3cm ~ 1.15m
  ['고양이', '개', '의자', '스툴', '스탠드', '물뿌리개', '개밥그릇'],
  // 1.15 ~ 2.14m
  ['자전거', '오토바이', '우체통', '표지판', '드럼통', '벤치', '그네'],
  // 2.14 ~ 4m
  ['자판기', '미끄럼틀', '사람', '승용차', '가로수'],
];

export const WORLD_TABLE: LabelTable = {
  buckets: WORLD_BUCKETS, min: 0.05, max: 4.0,
};

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
  /**
   * **도넛 배치(OSM 도시) 전용 상한.** 손배치 스테이지는 방마다 자기 범위를 갖는다.
   *
   * 이 값은 라벨 버킷 경계와 **무관하다** (`LABEL_SIZE_MAX` 참고).
   * 예전에는 둘이 묶여 있어서, 집 맵에 맞춰 이걸 내리는 순간 잠실 사다리에
   * 2m~5m 구멍이 뚫렸다.
   */
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
  /** 이 스테이지의 라벨 표(이름 + 크기 경계). 없으면 집 물건. */
  table: LabelTable = HOUSE_TABLE,
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
  const labelRatio = Math.log(table.max / table.min);
  /** 크기(m) → 라벨 축 위치 0~1. 범위를 벗어나면 양끝으로 접는다 */
  const labelU = (m: number): number =>
    Math.min(1, Math.max(0, Math.log(m / table.min) / labelRatio));

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
      table.buckets.length - 1,
      Math.floor((u * table.buckets.length)),
    );
    const labels = table.buckets[bucket]!;

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
        // 라벨 버킷은 **라벨 축**에서 고른다. 방 안의 상대 위치로 고르면
        // 화장실의 제일 큰 물건과 뒷마당의 제일 큰 물건이 같은 라벨을 받는다.
        const u = labelU(base);
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
    // 라벨은 **라벨 축**에서 고른다. 배치 범위(sizeMax)와 다른 축이다.
    const lu = labelU(base);

    const outer = Math.min(Math.max(g.placeCoef * base ** g.placePower, g.placeMin), g.placeMax);
    const inner = outer * g.placeInnerRatio;
    // 재배치가 참고해야 해서 밖에 둔다 — 앞쪽 RETRY_ANGLE_ONLY 회는 **각도만** 다시 뽑고
    // 이 거리를 그대로 쓴다. placeCoef/placePower 로 튜닝한 반지름 분포가 곧 성장 곡선이라
    // dist 를 흔들면 곡선이 흔들린다.
    let dist = 0;

    emit(
      lu, base,
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
