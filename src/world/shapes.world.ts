import {
  BoxGeometry, CylinderGeometry, LatheGeometry, SphereGeometry, TorusGeometry, Vector2,
  type BufferGeometry,
} from 'three';
import type { ShapeIdWorld } from './generation';
import { assemble, DARK, GLASS, METAL, part, WHITE, WOOD, WRAP, type RGB } from './shapes.kit';
import { TILE } from './atlas';

const LIE_X: readonly [number, number, number] = [0, 0, Math.PI / 2];
const LIE_Z: readonly [number, number, number] = [Math.PI / 2, 0, 0];

/**
 * World 맵(Urchin Town) 전용 형태 — **19cm ~ 4m**.
 *
 * 동네에서 이만한 것들은 전부 `CityBuilding`(못 먹는 배경)이었다.
 * World는 공이 **50cm에서 시작**해 6m까지 가므로 여기서는 **먹는 물건**이다.
 * 그래서 실루엣이 배경보다 또렷해야 한다 — 바퀴·다리·기둥이 보여야 한다.
 *
 * 원작 Urchin Town 특징(양쪽 끝의 공원과 학교, 주유소, 정글짐)에서 뽑았다.
 * 규약은 `shapes.kit.ts` 그대로 — 단위 정육면체, 바닥 y=−0.5, 최장축 1.0.
 *
 * **아래쪽(19cm~1.15m)이 나중에 붙었다.** 처음에는 1.15m 위쪽만 만들고 그 아래를
 * 집 표로 때웠는데, 50cm에서 시작하는 광장에 의자·주전자·물뿌리개가 깔렸다.
 * 거리 스케일에서 자주 밟히는 구간이라 오히려 여기가 더 눈에 띈다.
 */
export const WORLD_BUILDERS: Record<ShapeIdWorld, () => BufferGeometry> = {
  // ── 19~32cm (길바닥) ──────────────────────────────────────
  /**
   * 벽돌 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/벽돌/` (흰 배경에 한 장 놓인 점토 벽돌, 위·옆면이 함께 보이는 각도)
   *
   * 앞의 것은 1 : 0.42 : 0.46 인 상자에 **구멍 셋**을 뚫은 것이었다 — 콘크리트 블록이지 벽돌이 아니다.
   * 사진의 벽돌은 통짜다. 사진과 대보니:
   *   ① 길이 : 폭 : 높이 = **1 : 0.48 : 0.30**(사진에서 잰 0.617 : 0.437 은 긴 모서리가 뒤로
   *      물러나 줄어든 값이라 그대로 쓰면 안 된다)
   *   ② 여섯 면이 다 평면이고 구멍이 없다 — 구멍을 판 순간 실루엣이 블록이 된다
   *   ③ 표면이 모래알 요철로 거칠어 모서리 선이 미세하게 들쭉날쭉하다
   *   ④ 붉은 벽돌이 아니라 **누런 모래색**(243,215,137) — 적갈 팔레트(17)를 곱하면 팥색이 된다
   * 치수는 길이 = 1 로 쓴다.
   */
  벽돌: () => assemble([
    part(new BoxGeometry(1.0, 0.30, 0.48), [0.98, 0.87, 0.56], undefined, undefined, TILE.STONE),
  ]),

  /**
   * 축구공 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/축구공/` (1974 아디다스 텔스타 두를라스트 정면)
   *
   * 앞의 것은 흰 구에 **검은 구 다섯을 박은** 것이었다 — 조각이 둥글어 점박이 공이었다. 사진과 대보니:
   *   ① 검은 조각은 **정오각형 12 장**이고 서로 변을 맞대지 않는다. 마주보는 꼭짓점 사이 폭이
   *      공 지름의 **0.34**
   *   ② 오각형은 정이십면체 꼭짓점 방향에 하나씩 놓인다 — 그 배치라야 어느 방향에서 봐도
   *      「오각형이 육각형에 둘러싸인」 그림이 나온다
   *   ③ 조각 경계마다 박음질 실선이 이어지고 그 자리에서 가죽이 안으로 꺼진다(`TILE.COVER`)
   *   ④ 흰 조각은 순백이 아니라 회색끼가 돌고(201,203,205) 검은 조각은 거의 순검정(14,15,19)
   * 치수는 지름 = 1 로 쓴다.
   */
  축구공: () => {
    const PHI = (1 + Math.sqrt(5)) / 2, RP = 0.17;
    // ② 정이십면체 꼭짓점 12 개 — (0, ±1, ±φ) 의 세 순환
    const dirs: [number, number, number][] = [];
    for (const [a, b] of [[1, PHI], [-1, PHI], [1, -PHI], [-1, -PHI]] as const) {
      dirs.push([0, a, b], [a, b, 0], [b, 0, a]);
    }
    const L = Math.hypot(1, PHI);
    return assemble([
      part(new SphereGeometry(0.5, 16, 10), [0.80, 0.81, 0.82], undefined, undefined, TILE.COVER),
      // ① 오각 조각 — 구면에 반쯤 박아 실루엣은 안 건드린다
      ...dirs.map(([x, y, z]) => {
        const d: [number, number, number] = [x / L, y / L, z / L];
        const depth = Math.sqrt(0.25 - RP * RP) - 0.01;
        return part(new CylinderGeometry(RP, RP, 0.06, 5), DARK,
          [d[0] * depth, d[1] * depth, d[2] * depth],
          [Math.acos(d[1]), Math.atan2(d[0], d[2]), 0], TILE.RUBBER);
      }),
    ]);
  },

  // ── 33~61cm (주유소·노변) ─────────────────────────────────
  /**
   * 타이어 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/타이어/` (승용차 바퀴 정측면, 브리지스톤 + 알루미늄 휠)
   *
   * 앞의 것은 단면이 동그란 도넛(튜브 0.16)이라 접지면이 없는 **튜브 링**이었다. 사진과 대보니:
   *   ① 바깥 지름 : 휠 앞면 지름 = 1 : **0.71**, 그 사이 고무 옆벽이 지름의 **0.14**
   *   ② 옆벽은 평평하지 않고 바깥 지름의 0.8 언저리가 제일 불룩하다 — 단면이 원이 아니라
   *      **배부른 사다리꼴**이고 접지면은 평평하다
   *   ③ 접지면에 굴러가는 방향을 따라 세로 홈이 끊기지 않고 이어진다 — 홈 사이 어깨 블록을 띠로 얹는다
   *   ④ 고무가 중성 회색이 아니라 **따뜻한 갈색끼**를 띤다(35,25,21)
   * 치수는 바깥 지름 = 1 로 쓴다(눕혀 놓는다).
   */
  타이어: () => {
    const RUB: RGB = [0.24, 0.19, 0.16], RIM = 0.355;
    // ② 단면 — 안쪽 테에서 옆벽이 부풀었다가 평평한 접지면으로. 눕혀 놓으므로 돌림축이 y 다
    const prof = [[RIM, 0.105], [0.45, 0.145], [0.492, 0.132], [0.5, 0.09], [0.5, -0.09],
      [0.492, -0.132], [0.45, -0.145], [RIM, -0.105]].map(([r, y]) => new Vector2(r!, y!));
    return assemble([
      part(new LatheGeometry(prof, 20), RUB, [0, 0, 0], undefined, TILE.RUBBER),
      // ③ 접지면 어깨 블록 — 세로 홈 넷을 사이에 두고 다섯 줄
      ...[-0.072, -0.036, 0, 0.036, 0.072].map((y) =>
        part(new TorusGeometry(0.502, 0.013, 3, 20), [0.30, 0.24, 0.20], [0, y, 0], LIE_Z)),
      // ① 휠 — 바깥 지름의 0.71. 이게 없으면 도넛 구멍이 뚫린 링이라 타이어로 안 읽힌다
      part(new CylinderGeometry(RIM + 0.005, RIM + 0.005, 0.20, 18), [0.66, 0.56, 0.50], undefined, undefined, TILE.METAL),
      part(new CylinderGeometry(0.10, 0.10, 0.22, 12), [0.52, 0.46, 0.44]),
    ]);
  },

  // ── 61cm~1.15m (거리 설비) ────────────────────────────────
  /**
   * 소화전 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/소화전/` (하코다테식 세 방향 지상식 소화전)
   *
   * 앞의 것은 매끈한 원기둥에 반구 머리와 양옆 짧은 배출구를 단 것이었다. 사진과 대보니:
   *   ① 높이 : 몸통 지름 = 1 : **0.169** — 앞의 0.19 보다 훨씬 가늘고 길다
   *   ② 위에서 아래로 **사각 조작 너트 → 납작한 뚜껑 원판(몸통의 0.54) → 세로 주름 돔(1.08)
   *      → 볼트 박힌 넓은 플랜지(1.32) → 민 몸통(1.00) → 바닥 플랜지(1.53)** 로 굵기가 오르내린다.
   *      이 오르내림이 볼라드와 소화전을 가르는 전부다
   *   ③ 높이의 위쪽 0.45 자리에서 토출구가 **세 방향**으로 나오고, 앞 토출구 마개는 몸통의 0.73 인
   *      **주름진 원판**이라 정면 실루엣에서 가장 눈에 띈다
   *   ④ 몸통 겉면에 세로 홈이 촘촘해 매끈하지 않다 — 면 수를 12 로 낮춰 각을 살린다
   *   ⑤ 하코다테 소화전은 빨강이 아니라 **진한 노랑**이다(팔레트 8 → 10)
   * 치수는 높이 = 1 로 쓴다.
   */
  소화전: () => {
    const D = 0.169, R = D / 2, YEL: RGB = [0.96, 0.92, 0.76], yOut = 0.55;
    return assemble([
      // ② 바닥 플랜지 → 몸통
      part(new CylinderGeometry(R * 1.53, R * 1.53, 0.045, 12), YEL, [0, 0.022, 0], undefined, TILE.METAL),
      part(new CylinderGeometry(R, R, 0.50, 12), YEL, [0, 0.29, 0], undefined, TILE.METAL),
      // ② 볼트 박힌 넓은 플랜지
      part(new CylinderGeometry(R * 1.32, R * 1.32, 0.035, 12), YEL, [0, 0.555, 0]),
      ...Array.from({ length: 6 }, (_, k) => (k * Math.PI) / 3).map((a) =>
        part(new CylinderGeometry(0.008, 0.008, 0.012, 5), [0.70, 0.52, 0.30],
          [Math.cos(a) * R * 1.15, 0.575, Math.sin(a) * R * 1.15])),
      // ③ 토출구 — 앞 · 좌 · 우 세 방향. 앞 마개가 주름진 원판이다
      part(new CylinderGeometry(R * 0.55, R * 0.62, R * 1.5, 10), YEL, [0, yOut, R * 0.8], LIE_Z),
      part(new CylinderGeometry(R * 0.73, R * 0.73, 0.022, 12), YEL, [0, yOut, R * 1.55], LIE_Z),
      ...([1, -1] as const).map((k) =>
        part(new CylinderGeometry(R * 0.45, R * 0.52, R * 1.2, 8), YEL, [k * R * 0.9, yOut + 0.02, 0], LIE_X)),
      // ② 세로 주름 돔 → 뚜껑 원판 → 조작 너트
      part(new SphereGeometry(R * 1.08, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.5, 1), YEL, [0, 0.60, 0], undefined, TILE.METAL),
      part(new CylinderGeometry(R * 0.54, R * 0.54, 0.02, 12), YEL, [0, 0.735, 0]),
      part(new BoxGeometry(R * 0.5, 0.035, R * 0.5), [0.45, 0.45, 0.45], [0, 0.757, 0]),
    ]);
  },

  /**
   * 볼라드(차 막는 기둥) — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/볼라드/` (지바시 보도에 쇠사슬로 이어진 주철 볼라드 줄)
   *
   * 앞의 것은 굵은 흰 기둥에 반구 머리와 **반사 띠 둘**을 두른 플라스틱 기둥이었다. 사진과 대보니:
   *   ① 높이 : 몸통 지름 = **6.1 : 1** — 앞의 3.3 : 1 보다 훨씬 가늘다
   *   ② 머리는 반구가 아니라 **몸통의 1.18 배 굵기인 짧은 테두리 고리 + 평평한 뚜껑**이다
   *   ③ 바닥에도 몸통의 1.25 배인 낮은 받침 단이 있어 보도에 박힌 것처럼 보인다
   *   ④ 테두리 바로 아래 양옆에 **쇠사슬 고리**가 달린다. 반사 띠는 이 주철 기둥에 없다
   *   ⑤ 순검정이 아니라 어두운 무채색 주철(93,86,74)~(34,33,32) — 노랑 팔레트(10)를 흰색으로 옮겼다
   * 치수는 높이 = 1 로 쓴다.
   */
  볼라드: () => {
    const D = 0.164, R = D / 2, IRON: RGB = [0.30, 0.29, 0.27];
    return assemble([
      // ③ 받침 단 → ① 가는 몸통
      part(new CylinderGeometry(R * 1.25, R * 1.25, 0.035, 12), IRON, [0, 0.017, 0], undefined, TILE.METAL),
      part(new CylinderGeometry(R, R * 1.04, 0.90, 12), IRON, [0, 0.47, 0], undefined, TILE.METAL),
      // ② 머리 — 짧은 테두리 고리와 평평한 뚜껑
      part(new CylinderGeometry(R * 1.18, R * 1.18, 0.055, 12), [0.26, 0.25, 0.24], [0, 0.945, 0]),
      part(new CylinderGeometry(R * 1.10, R * 1.18, 0.028, 12), [0.26, 0.25, 0.24], [0, 0.986, 0]),
      // ④ 쇠사슬 고리 — 테두리 바로 아래 양옆
      ...([1, -1] as const).map((k) =>
        part(new TorusGeometry(0.016, 0.006, 3, 8), [0.52, 0.50, 0.48], [k * R * 1.05, 0.85, 0], LIE_Z)),
    ]);
  },

  /**
   * 입간판(A 자 간판) — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/입간판/` (상점가 보도의 「市営 駐輪場」 A 자 간판)
   *
   * 앞의 것은 폭 0.66 × 높이 0.86 판 둘이 위에서 만나 바로 바닥까지 닿는 꼴이었다. 사진과 대보니:
   *   ① 앞판 폭 : 높이 = 1 : **1.52** 로 세로가 길다
   *   ② 판 아래로 **판 높이의 0.27 만큼 짧은 다리**가 따로 나온다 — 판이 바닥에 닿지 않는다
   *   ③ 다리는 옆으로 거의 안 벌어지고 앞뒤로만 A 자로 벌어져, 정면에서는 판 폭의 0.10 인
   *      얇은 옆면 띠 하나만 보인다
   *   ④ 두 판을 잇는 **경첩 막대가 판 윗변 위로 삐져나온다**
   *   ⑤ 판은 흰색이 아니라 누렇게 바랜 크림색(209,194,148), 요금 띠만 채도 높은 주황(198,104,36)
   * 나무 팔레트(7)를 곱하면 크림색 판이 나무판이 된다 — 팔레트는 흰색.
   * 치수는 전체 높이 = 1 로 쓴다.
   */
  입간판: () => {
    const H = 0.78, W = H / 1.52, TILT = 0.20, CREAM: RGB = [0.85, 0.79, 0.60];
    const yMid = 0.21 + H / 2;
    // ③ 앞뒤 두 판 — 위에서 만나 아래로 벌어진다. 폭을 달리해야 옆면 두 장이 같은 평면이 아니다
    const board = (k: 1 | -1, w: number) => part(new BoxGeometry(w, H, 0.022), CREAM,
      [0, yMid, k * Math.sin(TILT) * H / 2], [-k * TILT, 0, 0], TILE.PAPER);
    return assemble([
      board(1, W), board(-1, W * 0.97),
      // ⑤ 요금 띠 — 판 폭의 0.90 × 판 높이의 0.12, 판 위에서 0.57 자리
      part(new BoxGeometry(W * 0.90, H * 0.12, 0.014), [0.84, 0.44, 0.15],
        [0, yMid + H * 0.07 - H * 0.57 + H * 0.5 - H * 0.5, Math.sin(TILT) * H / 2 + 0.014],
        [-TILT, 0, 0]),
      // ② 다리 넷 — 판 아래로 판 높이의 0.27. 앞뒤로만 벌어진다
      ...([1, -1] as const).flatMap((k) => ([1, -1] as const).map((j) =>
        part(new CylinderGeometry(0.012, 0.012, 0.23, 6), [0.62, 0.62, 0.60],
          [j * W * 0.42, 0.115, k * 0.075], [-k * TILT, 0, 0]))),
      // ④ 경첩 막대 — 판 윗변 위로 삐져나온다
      part(new CylinderGeometry(0.013, 0.013, W * 1.06, 6), [0.62, 0.62, 0.60], [0, 0.995, 0], LIE_X, TILE.METAL),
      // 옆모서리 손잡이 고리
      part(new TorusGeometry(0.03, 0.006, 3, 8), [0.62, 0.62, 0.60], [W * 0.5, yMid, 0.03], [0, Math.PI / 2, 0]),
    ]);
  },

  // ── 버킷 5 (1.15~2.14m) ───────────────────────────────────
  /**
   * 자전거(시티 자전거) — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/자전거/` (일본 주택가의 하늘색 ママチャリ)
   *
   * 앞의 것은 바퀴 둘 사이를 굵은 막대 셋으로 이은 것이라 **가위 같은 실루엣**이었다. 사진과 대보니:
   *   ① 바퀴 지름 : 안장 높이 : 핸들 높이 = 1 : **1.44 : 1.74** — 바퀴가 크고 안장이 낮다
   *   ② **앞바구니**가 바퀴 지름의 0.49 × 0.38 로 앞바퀴 바로 위, 핸들보다 낮게 얹힌다.
   *      이 바구니가 시티 자전거의 정체다
   *   ③ 프레임은 안장 밑이 **뻥 뚫린 열린 꼴**(발을 넘기는 자리) — 윗관이 앞에서 뒤로 내려간다
   *   ④ 뒤 짐받이가 안장보다 낮게 거의 수평으로 뻗고, 그 아래 뒷바퀴 절반을 덮는 흙받이가 이어진다
   *   ⑤ 프레임만 연한 하늘빛(113,154,172)이고 흙받이 · 짐받이 · 핸들 · 바퀴테는 도장 없는 은색
   * 치수는 전체 길이 = 1 로 쓴다(앞바퀴 +x).
   */
  자전거: () => {
    const W = 0.37, RW = W / 2, BASE = 0.593, XF = 0.29, XR = XF - BASE;
    const SKY: RGB = [0.44, 0.60, 0.67], SIL: RGB = [0.72, 0.73, 0.74], TIRE: RGB = [0.14, 0.14, 0.13];
    const wheel = (x: number) => [
      part(new TorusGeometry(RW, 0.017, 4, 18), TIRE, [x, RW, 0], undefined, TILE.RUBBER),
      part(new TorusGeometry(RW * 0.86, 0.008, 3, 18), SIL, [x, RW, 0]),
      // 바퀴살 — 여섯이면 «바퀴»로 읽히고 스물이면 면만 는다
      ...Array.from({ length: 6 }, (_, k) => (k * Math.PI) / 6).map((a) =>
        part(new CylinderGeometry(0.004, 0.004, RW * 1.7, 4), SIL, [x, RW, 0], [0, 0, a])),
    ];
    return assemble([
      ...wheel(XF), ...wheel(XR),
      // ④ 흙받이 — 바퀴 위 절반을 덮는 테
      ...[XF, XR].map((x) =>
        part(new TorusGeometry(RW * 1.08, 0.014, 3, 12, Math.PI * 0.9).scale(1, 1, 2.4), SIL,
          [x, RW, 0], [0, 0, Math.PI * 0.05])),
      // ③ 열린 프레임 — 앞 머리관에서 뒤로 내려가는 윗관 · 아래관 · 시트관 · 체인스테이
      part(new CylinderGeometry(0.011, 0.011, 0.44, 6), SKY, [XF - 0.20, 0.30, 0], [0, 0, 0.42]),
      part(new CylinderGeometry(0.013, 0.013, 0.46, 6), SKY, [XF - 0.24, 0.20, 0], [0, 0, 0.95]),
      part(new CylinderGeometry(0.011, 0.011, 0.33, 6), SKY, [XR + 0.12, 0.33, 0], [0, 0, 0.32]),
      part(new CylinderGeometry(0.010, 0.010, 0.30, 6), SKY, [XR + 0.15, 0.11, 0], [0, 0, 1.45]),
      // 앞 포크 · 머리관
      part(new CylinderGeometry(0.011, 0.011, 0.40, 6), SIL, [XF - 0.03, 0.30, 0], [0, 0, 0.15]),
      // ② 앞바구니 — 바퀴 지름의 0.49 × 0.38, 앞바퀴 바로 위
      part(new BoxGeometry(W * 0.49, W * 0.38, W * 0.44), [0.62, 0.60, 0.52],
        [XF - 0.02, 0.50, 0], undefined, TILE.METAL),
      // 핸들 — 지면에서 바퀴 지름의 1.74
      part(new CylinderGeometry(0.010, 0.010, 0.30, 6), SIL, [XF - 0.06, 0.645, 0], LIE_Z),
      part(new CylinderGeometry(0.010, 0.010, 0.10, 6), SIL, [XF - 0.06, 0.60, 0]),
      // ① 안장 — 지면에서 바퀴 지름의 1.44
      part(new SphereGeometry(1, 8, 5).scale(0.055, 0.020, 0.032), [0.27, 0.29, 0.31], [XR + 0.20, 0.533, 0]),
      part(new CylinderGeometry(0.009, 0.009, 0.12, 6), SIL, [XR + 0.20, 0.47, 0]),
      // ④ 뒤 짐받이 — 안장보다 낮게 거의 수평
      part(new BoxGeometry(0.16, 0.012, 0.09), SIL, [XR + 0.06, 0.44, 0], undefined, TILE.METAL),
      // 크랭크 · 페달
      part(new CylinderGeometry(0.035, 0.035, 0.012, 10), SIL, [XR + 0.20, 0.11, 0.02], LIE_Z),
      part(new BoxGeometry(0.05, 0.010, 0.025), [0.22, 0.22, 0.22], [XR + 0.22, 0.07, 0.05]),
    ]);
  },

  /**
   * 오토바이(슈퍼커브) — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/오토바이/` (혼다 슈퍼커브 1 세대 C100, 1958, 왼쪽 정측면)
   *
   * 앞의 것은 바퀴 둘 위에 굵은 상자 둘을 얹은 것이었다. 사진과 대보니:
   *   ① 바퀴 지름 : 전체 길이 = 1 : **2.97** 이고 앞뒤 바퀴 지름이 거의 같다. 바퀴가 크고 얇다
   *   ② 앞바퀴 뒤에서 핸들까지 솟은 **다리가리개**가 위는 좁고 아래로 퍼지는 한 장짜리 곡면이고,
   *      그 뒤는 발 올리는 자리라 **뻥 뚫려** 안장 앞쪽 바닥이 비어 보인다 — 커브의 정체다
   *   ③ 안장이 한 사람용 덩어리로 따로 얹히고 그 뒤에 안장보다 낮은 평평한 짐받이가 붙는다
   *   ④ 헤드라이트가 핸들이 아니라 **앞 덮개 안**에 박혀 지면에서 바퀴 지름의 1.47 높이에 온다
   *   ⑤ 다리가리개 · 흙받이는 밝은 회백색이고 뒤 차체는 짙은 남색, 안장만 적갈색이다
   * 치수는 전체 길이 = 1 로 쓴다(앞바퀴 +x).
   */
  오토바이: () => {
    const W = 0.337, RW = W / 2, XF = 0.33, XR = XF - 0.684;
    const PALE: RGB = [0.72, 0.77, 0.78], NAVY: RGB = [0.30, 0.31, 0.34], SEAT: RGB = [0.42, 0.25, 0.20];
    const TIRE: RGB = [0.13, 0.13, 0.11], CHROME: RGB = [0.82, 0.83, 0.84];
    const wheel = (x: number) => [
      part(new TorusGeometry(RW, 0.026, 4, 16), TIRE, [x, RW, 0], undefined, TILE.RUBBER),
      part(new TorusGeometry(RW * 0.72, 0.010, 3, 16), CHROME, [x, RW, 0]),
      ...Array.from({ length: 5 }, (_, k) => (k * Math.PI) / 5).map((a) =>
        part(new CylinderGeometry(0.004, 0.004, RW * 1.4, 4), CHROME, [x, RW, 0], [0, 0, a])),
      part(new CylinderGeometry(0.035, 0.035, 0.05, 8), CHROME, [x, RW, 0], LIE_Z),
    ];
    return assemble([
      ...wheel(XF), ...wheel(XR),
      // 흙받이 — 앞은 바퀴를 깊게 덮고 뒤는 짐받이까지 이어진다
      part(new TorusGeometry(RW * 1.12, 0.022, 3, 12, Math.PI * 0.8).scale(1, 1, 2.6), PALE, [XF, RW, 0], [0, 0, Math.PI * 0.1]),
      part(new TorusGeometry(RW * 1.12, 0.022, 3, 12, Math.PI * 0.7).scale(1, 1, 2.6), NAVY, [XR, RW, 0], [0, 0, Math.PI * 0.25]),
      // ② 다리가리개 — 위는 좁고 아래로 퍼지는 한 장. 그 뒤는 발판이라 비어 있다
      part(new BoxGeometry(0.055, 0.30, 0.13).scale(1, 1, 1), PALE, [XF - 0.10, 0.34, 0], [0, 0, 0.30]),
      part(new BoxGeometry(0.11, 0.10, 0.17), PALE, [XF - 0.15, 0.20, 0], [0, 0, 0.55]),
      part(new BoxGeometry(0.20, 0.022, 0.13), NAVY, [XF - 0.27, 0.155, 0]),
      // ③ 차체 — 안장 밑 덩어리 · 안장 · 짐받이
      part(new BoxGeometry(0.24, 0.13, 0.13), NAVY, [XR + 0.20, 0.30, 0]),
      part(new SphereGeometry(1, 8, 5).scale(0.085, 0.030, 0.055), SEAT, [XR + 0.22, 0.385, 0]),
      part(new BoxGeometry(0.13, 0.015, 0.10), NAVY, [XR + 0.06, 0.345, 0], undefined, TILE.METAL),
      // 엔진 · 체인케이스
      part(new SphereGeometry(1, 8, 6).scale(0.055, 0.050, 0.045), CHROME, [XF - 0.30, 0.16, 0]),
      part(new BoxGeometry(0.26, 0.045, 0.030), NAVY, [XR + 0.16, 0.14, 0.04], [0, 0, -0.06]),
      // ④ 헤드라이트 — 앞 덮개 안, 지면에서 바퀴 지름의 1.47
      part(new CylinderGeometry(0.038, 0.034, 0.05, 10), NAVY, [XF - 0.055, 0.495, 0], LIE_X),
      part(new CylinderGeometry(0.030, 0.030, 0.012, 10), [1.0, 0.98, 0.88], [XF - 0.028, 0.495, 0], LIE_X),
      // 핸들
      part(new CylinderGeometry(0.009, 0.009, 0.26, 6), NAVY, [XF - 0.085, 0.575, 0], LIE_Z),
      part(new CylinderGeometry(0.012, 0.012, 0.10, 6), NAVY, [XF - 0.085, 0.53, 0], [0, 0, 0.12]),
    ]);
  },

  우체통: () => assemble([
    // 기둥 위에 둥근 통. 동네의 그것보다 크고 다리가 보인다
    part(new CylinderGeometry(0.10, 0.12, 0.44, 14), METAL, [0, 0.22, 0], undefined, TILE.METAL),
    // 통 + 둥근 뚜껑. **폭이 같으면 옆면 두 장이 같은 평면이다** — 뚜껑을 살짝 좁힌다
    part(new BoxGeometry(0.44, 0.46, 0.34), WHITE, [0, 0.66, 0], undefined, TILE.METAL),
    part(new CylinderGeometry(0.22, 0.22, 0.325, 20, 1, false, 0, Math.PI), WHITE,
      [0, 0.89, 0], LIE_Z, TILE.WOOD_C),
    // 투입구
    part(new BoxGeometry(0.30, 0.05, 0.36), DARK, [0, 0.80, 0]),
  ]),

  표지판: () => assemble([
    // 기둥 — **밑판 «위»에서 시작한다.** 둘 다 y=0 이면 밑면 두 장이 같은 평면이다
    part(new CylinderGeometry(0.045, 0.045, 1.06, 10), METAL, [0, 0.58, 0], undefined, TILE.METAL),
    // 표지 판 + 안쪽 원. **두께가 같으면 옆면이 같은 평면이다** — 안쪽을 얇게
    // 앞으로 내고, `PAPER`(대비 0.04) 대신 확실히 갈리는 색으로 간다
    part(new CylinderGeometry(0.34, 0.34, 0.06, 20), WHITE, [0, 1.02, 0], LIE_Z, TILE.METAL),
    part(new CylinderGeometry(0.24, 0.24, 0.05, 20), [0.86, 0.28, 0.22], [0, 1.02, 0.022], LIE_Z),
    part(new BoxGeometry(0.30, 0.05, 0.30), METAL, [0, 0.025, 0]),
  ]),

  드럼통: () => assemble([
    // 몸통에 «금속» 인쇄를 문다 — 민짜 원통은 그냥 통이고, 테 둘은 얇아서 표식이 못 된다
    part(new CylinderGeometry(0.40, 0.40, 1.00, 20), WHITE, [0, 0.50, 0], undefined, TILE.METAL),
    // 테 둘 — 이게 있어야 드럼통이다
    part(new TorusGeometry(0.41, 0.035, 4, 20), METAL, [0, 0.28, 0], LIE_Z, TILE.METAL),
    part(new TorusGeometry(0.41, 0.035, 4, 20), METAL, [0, 0.72, 0], LIE_Z),
    part(new CylinderGeometry(0.38, 0.38, 0.05, 20), METAL, [0, 1.00, 0]),
  ]),

  벤치: () => assemble([
    // 앉는 판 + 등받이. **길이가 같으면 끝면 두 장이 같은 평면이다**
    part(new BoxGeometry(1.20, 0.08, 0.40), WOOD, [0, 0.44, 0], undefined, TILE.WOOD_C),
    part(new BoxGeometry(1.14, 0.34, 0.07), WOOD, [0, 0.64, -0.17], undefined, TILE.WOOD_C),
    // 다리 넷 — 주철 느낌으로 어둡게
    ...[[-0.50, 0.15], [-0.50, -0.15], [0.50, 0.15], [0.50, -0.15]].map(
      ([x, z]) => part(new BoxGeometry(0.08, 0.44, 0.08), DARK, [x!, 0.22, z!]),
    ),
  ]),

  그네: () => assemble([
    // **판이 커야 그네로 읽힌다.** 처음엔 A자 프레임만 보이고 판이 안 보여서
    // 뒤집힌 A 두 개처럼 읽혔다 — 판을 키우고 줄을 굵혔다.
    part(new CylinderGeometry(0.05, 0.05, 1.15, 10), METAL, [-0.46, 0.56, 0.26], [0.42, 0, 0], TILE.METAL),
    part(new CylinderGeometry(0.05, 0.05, 1.15, 10), METAL, [-0.46, 0.56, -0.26], [-0.42, 0, 0]),
    part(new CylinderGeometry(0.05, 0.05, 1.15, 10), METAL, [0.46, 0.56, 0.26], [0.42, 0, 0]),
    part(new CylinderGeometry(0.05, 0.05, 1.15, 10), METAL, [0.46, 0.56, -0.26], [-0.42, 0, 0]),
    part(new CylinderGeometry(0.055, 0.055, 1.05, 10), METAL, [0, 1.08, 0], LIE_Z),
    part(new CylinderGeometry(0.028, 0.028, 0.58, 10), DARK, [-0.24, 0.78, 0]),
    part(new CylinderGeometry(0.028, 0.028, 0.58, 10), DARK, [0.24, 0.78, 0]),
    part(new BoxGeometry(0.66, 0.09, 0.30), WHITE, [0, 0.48, 0]),
  ]),

  // ── 버킷 6 (2.14~4m) ──────────────────────────────────────
  자판기: () => assemble([
    part(new BoxGeometry(0.66, 1.10, 0.44), WHITE, [0, 0.55, 0], undefined, TILE.PANEL),
    // 앞면 유리 + 진열 칸
    part(new BoxGeometry(0.44, 0.62, 0.04), GLASS, [-0.06, 0.66, 0.23]),
    ...[0, 1, 2].map((i) => part(
      new BoxGeometry(0.40, 0.05, 0.03), METAL, [-0.06, 0.44 + i * 0.20, 0.245],
    )),
    // 동전 투입구·배출구
    part(new BoxGeometry(0.14, 0.24, 0.03), DARK, [0.24, 0.68, 0.235]),
    part(new BoxGeometry(0.50, 0.16, 0.05), DARK, [0, 0.20, 0.23]),
  ]),

  미끄럼틀: () => assemble([
    // 원작 MaS3 선물이 미끄럼틀 위에 있었다. 여기선 먹는 물건이다
    // 기둥 둘 + 발판. **기둥 꼭대기(1.00)와 발판 밑면이 같은 평면**이면 z-fighting 이다
    part(new BoxGeometry(0.10, 1.00, 0.10), METAL, [-0.44, 0.50, 0.22]),
    part(new BoxGeometry(0.10, 1.00, 0.10), METAL, [-0.44, 0.50, -0.22]),
    part(new BoxGeometry(0.40, 0.06, 0.54), WHITE, [-0.44, 1.05, 0]),
    // 경사판 + 난간
    part(new BoxGeometry(1.10, 0.06, 0.50), WHITE, [0.16, 0.56, 0], [0, 0, -0.52], TILE.METAL),
    part(new BoxGeometry(1.10, 0.14, 0.05), METAL, [0.16, 0.66, 0.25], [0, 0, -0.52]),
    part(new BoxGeometry(1.10, 0.14, 0.05), METAL, [0.16, 0.66, -0.25], [0, 0, -0.52]),
    // 사다리 발판
    ...[0, 1, 2].map((i) => part(
      new BoxGeometry(0.34, 0.04, 0.04), METAL, [-0.44, 0.28 + i * 0.24, 0],
    )),
  ]),

  정글짐: () => assemble([
    // 기둥 4 + 가로대 8. 빈 격자라 실루엣이 곧 구조다 —
    // 면으로 채우면 그냥 상자가 되어 미끄럼틀과 구별이 안 된다.
    // 원작 어친타운의 선물 위치가 "정글짐 옆"이다.
    ...[[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].map(([x, z]) =>
      part(new CylinderGeometry(0.035, 0.035, 1.0, 14), WHITE, [x!, 0, z!], undefined, TILE.METAL)),
    ...[0.16, -0.30].flatMap((y) => [
      part(new CylinderGeometry(0.03, 0.03, 0.8, 14), WHITE, [0, y, -0.4], LIE_X),
      part(new CylinderGeometry(0.03, 0.03, 0.8, 14), WHITE, [0, y, 0.4], LIE_X),
      part(new CylinderGeometry(0.03, 0.03, 0.8, 14), WHITE, [-0.4, y, 0], LIE_Z),
      part(new CylinderGeometry(0.03, 0.03, 0.8, 14), WHITE, [0.4, y, 0], LIE_Z),
    ]),
  ]),

  사람: () => assemble([
    // 카타마리에서 사람은 배경이 아니라 **물건**이다. 서 있는 자세
    // 다리 둘. **굵기를 다르게** — 같으면 옆면 두 장이 같은 평면이고 z 로 겹친다
    // 다리 둘. **z 로도 안 겹치게 벌린다** — 밑면 두 장이 같은 평면(y=0)인데
    // 발판이 겹치면 z-fighting 이다
    part(new CylinderGeometry(0.095, 0.095, 0.44, 14), WHITE, [0, 0.22, -0.105]),
    part(new CylinderGeometry(0.095, 0.095, 0.44, 14), WHITE, [0, 0.22, 0.105]),
    part(new BoxGeometry(0.30, 0.46, 0.20), WHITE, [0, 0.66, 0], undefined, TILE.CLOTH),
    // 얼굴 — 옷(WHITE)과 대비가 0.08 이었다. 살빛은 옷보다 확실히 짙거나 밝아야 한다
    // 얼굴 — 인쇄를 뺀다. `TILE.CLOTH`(천 짜임)를 물려놨더니 얼굴에 격자가 찍혔다
    part(new SphereGeometry(0.15, 14, 9), [0.74, 0.56, 0.44], [0, 1.02, 0]),
    // 머리 — 얼굴을 다 덮으면 안 된다. 위 절반만 얹는다
    part(new SphereGeometry(0.155, 14, 9).scale(1, 0.52, 1), DARK, [0, 1.10, 0]),
    // 눈 둘 — 이게 있어야 이쪽이 «앞»이다
    ...([1, -1] as const).map((k) =>
      part(new SphereGeometry(0.022, 6, 5), DARK, [0.135, 1.03, k * 0.055])),
    // 팔 둘
    part(new CylinderGeometry(0.06, 0.06, 0.42, 14), WHITE, [0, 0.64, -0.21], [0.12, 0, 0]),
    part(new CylinderGeometry(0.06, 0.06, 0.42, 14), WHITE, [0, 0.64, 0.21], [-0.12, 0, 0]),
  ]),

  승용차: () => assemble([
    // 낮은 물체라 위쪽을 비운다 (shapes.kit 규약 2번)
    /**
     * 몸통 + 유리 + 지붕. **화면에서 「창도 앞유리도 없는 베이지 상자」였다** —
     * 유리 띠(`GLASS`)가 몸통보다 «넓어야» 창으로 보이는데 0.54 로 몸통(0.60)보다
     * 좁았고, 지붕이 그 위를 0.56 으로 덮어서 유리가 4mm 만 보였다.
     * 유리를 몸통 폭까지 넓히고 지붕을 좁혀 «창 띠»가 한 바퀴 돌게 한다.
     */
    part(new BoxGeometry(1.30, 0.30, 0.60), WHITE, [0, 0.30, 0], undefined, TILE.METAL),
    part(new BoxGeometry(0.70, 0.24, 0.605), [0.26, 0.30, 0.36], [-0.06, 0.57, 0]),
    // 지붕 — 유리보다 «좁아야» 창이 한 바퀴 도는 걸로 보인다
    part(new BoxGeometry(0.60, 0.09, 0.545), WHITE, [-0.06, 0.665, 0]),
    // 앞유리 — 비스듬히 눕는다. 상자 셋을 쌓으면 트럭이고, 이 경사 하나가 «승용차»다
    part(new BoxGeometry(0.24, 0.05, 0.575), [0.26, 0.30, 0.36], [0.34, 0.58, 0], [0, 0, -0.62]),
    ...[[-0.42, 0.31], [-0.42, -0.31], [0.42, 0.31], [0.42, -0.31]].map(
      ([x, z]) => part(new CylinderGeometry(0.17, 0.17, 0.10, 20), DARK, [x!, 0.17, z!], LIE_Z),
    ),
    // 헤드라이트 둘 — `PAPER`(대비 0.04)로는 차체와 안 갈린다. 등은 «빛난다»
    // 헤드라이트 — 차체 팔레트가 밝은 쪽이라 `WRAP` 도 대비가 0.06 이다.
    // 등은 «테두리가 짙어야» 등으로 읽힌다
    part(new SphereGeometry(0.085, 20, 13), [0.34, 0.36, 0.40], [0.635, 0.32, 0.20]),
    part(new SphereGeometry(0.085, 20, 13), [0.34, 0.36, 0.40], [0.635, 0.32, -0.20]),
    part(new SphereGeometry(0.058, 14, 9), WRAP, [0.665, 0.32, 0.20], undefined, TILE.GLASSY),
    part(new SphereGeometry(0.058, 14, 9), WRAP, [0.665, 0.32, -0.20]),
    // 범퍼 — 앞뒤에 짙은 띠 하나면 「차 앞」이 어디인지 읽힌다
    // 범퍼 — 차체 밑면(y 0.15)보다 위에서 시작해야 밑면이 같은 평면이 안 된다
    part(new BoxGeometry(0.06, 0.10, 0.50), [0.34, 0.35, 0.38], [0.65, 0.23, 0]),
  ]),

  가로수: () => assemble([
    part(new CylinderGeometry(0.10, 0.14, 0.62, 20), WOOD, [0, 0.31, 0], undefined, TILE.WOOD_C),
    // 잎은 덩어리 셋 — 하나면 사탕처럼 보인다
    part(new SphereGeometry(0.40, 20, 13), WHITE, [0, 0.86, 0], undefined, TILE.LEAF),
    part(new SphereGeometry(0.28, 20, 13), WHITE, [-0.26, 0.72, 0.10]),
    part(new SphereGeometry(0.26, 20, 13), WHITE, [0.24, 0.76, -0.12]),
  ]),
};
