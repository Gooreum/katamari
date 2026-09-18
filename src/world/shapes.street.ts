import {
  BoxGeometry, CircleGeometry, CylinderGeometry, ExtrudeGeometry, Shape, SphereGeometry,
  type BufferGeometry,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ShapeIdStreet } from './generation';
import { assemble, part, type RGB } from './shapes.kit';
import { TILE } from './atlas';

/**
 * 동네 맵의 **손배치 설비.** 난수로는 안 뽑힌다 — `TOWN_PROPS`(stage.town.ts)만 쓴다.
 *
 * ## 왜 따로 있나
 *
 * `SHAPE_IDS_SMALL/MID/LARGE` 는 **크기 축**이고 1.2m 에서 끝난다. 여기 있는 것들은
 * 1.5~2.6m 라 그 축에 안 들어가고, `SHAPE_IDS_WORLD`(어친타운 전용)도 아니다.
 * 거실 가구가 `SHAPE_IDS_FURNITURE` 로 갈라진 것과 같은 이유다 —
 * **난수 표가 절대 안 건드리는 목록**이라 버킷 경계를 안 흔든다.
 *
 * ## 이것들은 전부 «상자였다»
 *
 * `CityBuilding` 은 2D 외곽선을 y=0 부터 위로 뽑는 것뿐이라 프리즘밖에 못 만든다.
 * 그래서 전봇대도 텐트도 캠프파이어도 단색 직육면체였다.
 *
 * 규약은 `shapes.kit.ts` 그대로 — 최장축 1.0, 바닥 y=−0.5,
 * 색은 절대색이 아니라 팔레트에 곱해지는 계수.
 */

const CANVAS: RGB = [0.95, 0.86, 0.48];
const WOODY: RGB = [0.46, 0.34, 0.22];
const BARK: RGB = [0.38, 0.30, 0.22];
const CUT: RGB = [0.78, 0.66, 0.48];
const RIVER_STONE: RGB = [0.44, 0.40, 0.34];
const EMBER: RGB = [1.60, 0.72, 0.24];
const CHAR: RGB = [0.14, 0.12, 0.10];
const STEEL_RED: RGB = [0.68, 0.16, 0.16];
const RUSTY: RGB = [0.32, 0.25, 0.18];
const PIPE_OUT: RGB = [0.97, 0.76, 0.25];
const PIPE_IN: RGB = [0.40, 0.17, 0.06];

export const STREET_BUILDERS: Record<ShapeIdStreet, () => BufferGeometry> = {
  /**
   * 전봇대 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/전봇대/` (하코다테 최고(最古) 콘크리트 전주 + 변압기 상세)
   *
   *   ① **기둥이 극단적으로 가늘다** — 전체 높이 : 밑동 지름 = **1 : 0.029**.
   *      2.4m 짜리 상자였던 것이 실제로는 «선»이다
   *   ② 위아래 지름이 **2.1 : 1** 의 아주 완만한 직선 테이퍼(1/47) —
   *      눈으로는 「거의 원통인데 밑이 살짝 굵다」
   *   ③ 완목(가로대) 길이 = 전체 높이의 **0.24**, 기둥 지름의 23배.
   *      꼭대기에서 높이의 0.045 지점을 가로지른다
   *   ④ **부속이 전부 위쪽 0.10 안에** 몰려 있다 — 애자 여섯, 기둥보다 굵은 변압기
   *
   * 나무 전주가 아니라 **콘크리트 전주**다. 옹이도 휨도 없이 한 줄로 곧다.
   */
  전봇대: () => {
    const H = 1.0;
    const RB = H * 0.029 / 2, RT = RB / 2.1;      // ②
    const ARM = H * 0.24, yArm = H * (1 - 0.045); // ③
    const INSUL: RGB = [0.92, 0.90, 0.86];
    const CONC: RGB = [0.66, 0.65, 0.62];
    return assemble([
      // ①② 기둥 — 이 물건의 실루엣은 사실상 이것 하나다
      part(new CylinderGeometry(RT, RB, H, 10), CONC, [0, H / 2, 0], undefined, TILE.CORRUGATE),
      // ③ 완목 — 꼭대기를 가로지르는 T
      part(new BoxGeometry(ARM, RB * 1.1, RB * 1.3), [0.52, 0.50, 0.46], [0, yArm, 0]),
      // ④ 애자 여섯 — 완목 위에 줄지어. 흰 점이 있어야 전봇대로 읽힌다
      ...[-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map((i) => part(
        new CylinderGeometry(RB * 0.62, RB * 0.78, RB * 1.6, 6), INSUL,
        [i * (ARM / 6), yArm + RB * 1.3, 0])),
      // ④ 주상 변압기 — 기둥보다 굵은 회색 통. 위쪽 0.10 안에 있다
      part(new CylinderGeometry(RB * 2.1, RB * 2.1, H * 0.052, 10), [0.58, 0.58, 0.56],
        [RB * 2.4, H * 0.925, 0], undefined, TILE.METAL),
      part(new BoxGeometry(RB * 1.6, RB * 1.2, RB * 1.2), [0.50, 0.49, 0.47], [RB * 1.3, H * 0.925, 0]),
    ]);
  },

  /**
   * 가로등 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/가로등/` (일본 주택가 공원 가로등 + 원반갓형 곁사진)
   *
   *   ① **가는 선 위에 공 하나** — 전체 높이 : 기둥 지름 = **1 : 0.016**.
   *      기둥만으로 전체의 **0.88** 을 쓴다
   *   ② 등갓 지름 = 전체 높이의 **0.106**, 기둥 지름의 **6.7배**
   *   ③ 아래 **0.36** 구간이 2.1배로 굵어지는 **2단 기둥**
   *   ④ 기둥은 거의 검고 갓만 밝다 — 그 대비가 이 물건의 정체다
   *
   * 과제에서 바란 「꺾인 팔 + 갓」형은 커먼즈에서 못 찾았다(`intent.md`).
   * 공원등(구형)으로 간다 — 광장·호숫가에 서는 것이라 오히려 맞는다.
   */
  가로등: () => {
    const H = 1.0, RP = H * 0.016 / 2;
    const RG = H * 0.106 / 2;                     // ② 등갓 반지름
    const BASE = H * 0.36;                        // ③ 굵은 아랫단
    const POLE: RGB = [0.16, 0.16, 0.17];
    const LAMP: RGB = [1.50, 1.44, 1.10];
    return assemble([
      part(new CylinderGeometry(RP * 2.1, RP * 2.4, BASE, 8), POLE, [0, BASE / 2, 0]),
      part(new CylinderGeometry(RP, RP * 2.1, H - BASE - RG, 8), POLE, [0, BASE + (H - BASE - RG) / 2, 0]),
      // 갓 밑 금구 — 기둥과 공 사이를 잇는다
      part(new CylinderGeometry(RG * 0.34, RG * 0.5, RG * 0.5, 8), POLE, [0, H - RG * 2.1, 0]),
      // ②④ 등갓 — 이 물건에서 유일하게 밝은 덩어리
      part(new SphereGeometry(RG, 12, 9), LAMP, [0, H - RG, 0]),
      // 기초판 — 사진의 콘크리트 받침
      part(new CylinderGeometry(RP * 3.4, RP * 3.8, H * 0.02, 8), [0.60, 0.59, 0.56], [0, H * 0.01, 0]),
    ]);
  },

  /**
   * 게시판 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/게시판/` (나고야 하나초 반상회 광보판)
   *
   *   ① 전체 높이 : 지붕 폭 = **1 : 0.91** — 거의 정사각형 덩어리다
   *   ② 지붕이 본체보다 좌우로 각 **0.10** 씩 내민 **차양**
   *   ③ 본체는 **가로로 긴**(폭 : 높이 = 1 : 0.78) 게시면 + 위에 이름 머리판
   *   ④ 다리가 전체의 **0.33**, 두께는 본체 폭의 0.02~0.04 로 아주 가늘고
   *      **본체 폭 끝까지 벌어져** 있다 — 「□ 위에 □, 밑에 ㅠ」 실루엣
   */
  게시판: () => {
    const H = 1.0, W = H * 0.91;
    const BW = W / 1.10, BH = BW * 0.78;          // ②③ 본체
    const LEG = H * 0.33, T = BW * 0.030;
    const FRAME: RGB = [0.88, 0.84, 0.74];
    const BOARD: RGB = [0.30, 0.34, 0.30];
    const POST: RGB = [0.42, 0.40, 0.36];
    return assemble([
      // ④ 다리 둘 — 본체 폭 끝까지 벌어진다
      ...([1, -1] as const).map((k) => part(
        new BoxGeometry(T, LEG, T * 1.2), POST, [k * (BW / 2 - T), LEG / 2, 0])),
      // ③ 본체 — 크림 테두리 + 어두운 게시면
      part(new BoxGeometry(BW, BH, T * 1.6), FRAME, [0, LEG + BH / 2, 0]),
      part(new BoxGeometry(BW * 0.93, BH * 0.78, T * 0.5), BOARD,
        [0, LEG + BH * 0.46, T * 0.9], undefined, TILE.PAPER),
      // ③ 이름 머리판
      part(new BoxGeometry(BW * 0.93, BH * 0.13, T * 0.5), [0.96, 0.94, 0.88],
        [0, LEG + BH * 0.90, T * 0.9], undefined, TILE.PAPER),
      // ② 차양 지붕 — 본체보다 넓다. 앞으로도 내민다
      part(new BoxGeometry(W, T * 1.4, T * 3.4), POST, [0, LEG + BH + T * 0.7, T * 0.6]),
    ]);
  },

  /**
   * 분수대 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/분수대/` (이시오카 고쿠후공원 분수, 물 나오는 상태)
   *
   *   ① **기둥 하나에 원형 수반 둘** — 위가 아래의 **0.51**, 딱 절반쯤
   *   ② 아래 수반 지름 : 기둥 지름 = **1 : 0.32**, 기둥은 아래로 벌어지는 나팔
   *   ③ 높이 : 아래 수반 지름 = **1 : 1.62** — 세로로 안 솟는 **납작한** 덩어리다.
   *      로마식 대형 분수가 아니다
   *   ④ 수반 **테두리 전체에서** 물이 커튼처럼 떨어진다
   */
  분수대: () => {
    const RL = 0.5;                               // 아래 수반 반지름 = 최장축의 절반
    const H = RL * 2 / 1.62;                      // ③ 납작하다
    const RU = RL * 0.51;
    const yL = H * 0.42, yU = H * 0.92;
    const STONE: RGB = [0.76, 0.74, 0.70];
    const WATER: RGB = [0.58, 0.82, 1.05];
    return assemble([
      // 기단 — 수면과 못
      part(new CylinderGeometry(RL * 1.18, RL * 1.24, H * 0.12, 16), STONE, [0, H * 0.06, 0], undefined, TILE.STONE),
      part(new CylinderGeometry(RL * 1.10, RL * 1.10, 0.01, 16), WATER, [0, H * 0.125, 0]),
      // ② 나팔 기둥
      part(new CylinderGeometry(RL * 0.32, RL * 0.46, yL, 12), STONE, [0, yL / 2, 0], undefined, TILE.STONE),
      // ① 아래 수반 — 접시처럼 얕다
      part(new CylinderGeometry(RL, RL * 0.72, H * 0.13, 20), STONE, [0, yL + H * 0.065, 0], undefined, TILE.STONE),
      part(new CylinderGeometry(RL * 0.90, RL * 0.90, 0.008, 20), WATER, [0, yL + H * 0.125, 0]),
      // 윗대
      part(new CylinderGeometry(RL * 0.17, RL * 0.22, yU - yL - H * 0.13, 10), STONE,
        [0, (yU + yL + H * 0.13) / 2, 0], undefined, TILE.STONE),
      // ① 위 수반
      part(new CylinderGeometry(RU, RU * 0.70, H * 0.10, 16), STONE, [0, yU, 0], undefined, TILE.STONE),
      part(new CylinderGeometry(RU * 0.88, RU * 0.88, 0.006, 16), WATER, [0, yU + H * 0.052, 0]),
      // ④ 떨어지는 물 커튼 — 수반 테두리 «전체»에서 떨어진다. 낱줄기로 세우지 않는다
      part(new CylinderGeometry(RU * 0.97, RU * 0.97, yL + H * 0.13 - yU, 16, 1, true), WATER,
        [0, (yU + yL + H * 0.13) / 2, 0]),
      part(new CylinderGeometry(RL * 0.97, RL * 0.97, yL - H * 0.06, 20, 1, true), WATER,
        [0, (yL + H * 0.06) / 2 + H * 0.06, 0]),
    ]);
  },

  /**
   * 정자 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/정자/` (일본 주택가 공원의 아즈마야(四阿) + 목조 곁사진)
   *
   *   ① **벽이 없다.** 기둥 넷 위에 모임지붕 하나 — 그 사이로 배경이 보이는 게 정체다
   *   ② 지붕 폭 : 전체 높이 = **1 : 0.70** — 옆으로 퍼진 비례
   *   ③ 기둥 높이 : 폭 = **3.7 : 1** 로 굵고 뭉툭하다
   *   ④ 지붕 물매가 **약 26°** 로 완만하고, 처마가 기둥 폭의 **1.6배** 내민다
   *   ⑤ 안에 평상(벤치)이 있다
   */
  정자: () => {
    const W = 1.0, H = W * 0.70;                  // ②
    const RH = H * 0.32;                          // 지붕 높이(기둥의 0.32)
    const PH = H - RH;                            // 기둥 높이
    const PW = PH / 3.7;                          // ③
    const SPAN = W * 0.62;                        // 기둥 중심 간격
    const TIMBER: RGB = [0.52, 0.40, 0.28];
    const ROOF: RGB = [0.34, 0.33, 0.35];
    const DECK: RGB = [0.62, 0.50, 0.36];
    return assemble([
      // ③ 기둥 넷
      ...([1, -1] as const).flatMap((sx) => ([1, -1] as const).map((sz) => part(
        new BoxGeometry(PW, PH, PW), TIMBER,
        [sx * SPAN / 2, PH / 2, sz * SPAN / 2], undefined, TILE.WOOD_F))),
      // ⑤ 안의 평상
      part(new BoxGeometry(SPAN * 0.82, PH * 0.055, SPAN * 0.82), DECK,
        [0, PH * 0.30, 0], undefined, TILE.WOOD_C),
      // 처마 도리 — 기둥 머리를 잇는다. 없으면 지붕이 공중에 뜬 판이 된다
      ...([1, -1] as const).flatMap((s) => [
        part(new BoxGeometry(SPAN + PW, PW * 0.6, PW * 0.6), TIMBER, [0, PH - PW * 0.3, s * SPAN / 2]),
        part(new BoxGeometry(PW * 0.6, PW * 0.6, SPAN + PW), TIMBER, [s * SPAN / 2, PH - PW * 0.3, 0]),
      ]),
      // ④ 모임지붕 — 네모뿔. 물매 26°, 처마가 기둥 폭의 1.6배 내민다
      part(new CylinderGeometry(0.0, W * 0.72, RH, 4), ROOF,
        [0, PH + RH / 2, 0], [0, Math.PI / 4, 0], TILE.STONE),
      // 지붕 밑 그늘판 — 밑에서 올려다봤을 때 뚫려 보이지 않게
      part(new BoxGeometry(W * 0.98, PW * 0.25, W * 0.98), [0.40, 0.33, 0.26],
        [0, PH + PW * 0.12, 0], undefined, TILE.WOOD_F),
    ]);
  },

  /**
   * 텐트 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/텐트/` (1971년 가미코치 야영장, 노란 A형 두 동)
   *
   * 앞의 것은 2.2m 짜리 «상자»였다. 사진과 대보니:
   *   ① **옆벽이 없다.** 사면이 용마루에서 땅까지 곧게 내려오는 삼각 단면이다 —
   *      요즘 돔형이 아니라 A형이고, 사면 기울기가 **약 58°**
   *   ② 밑변 : 높이 = **1 : 0.82**, 용마루 길이 : 높이 = **2.3 : 1** 이상
   *   ③ 자락이 땅에 닿는 데서 **밖으로 퍼져** 바닥에 깔린다 — 실루엣 밑변이 몸통보다 넓다
   *   ④ 마구리 밖으로 **장대**가 서고 거기서 땅으로 **당김줄**이 뻗는다
   *   ⑤ 노랑 단색 한 가지. 두 사면의 밝기 차가 9 밖에 안 돼서
   *      면 나눔이 색이 아니라 **모서리 선**으로 읽힌다 — 그래서 사면에 색차를 안 준다
   */
  텐트: () => {
    const H = 0.40, L = 0.92;                     // 높이 · 용마루 길이(2.3 : 1)
    const HB = H / 0.82 / 2;                      // 반폭 — 밑변 : 높이 = 1 : 0.82
    const slant = Math.hypot(HB, H);
    const lean = Math.atan2(HB, H);               // 수직에서 기운 각 ≈ 31° → 사면 59°
    const T = 0.018;

    /** 마구리 삼각형 한 장 */
    const gable = (): BufferGeometry => {
      const s = new Shape();
      s.moveTo(-HB, 0); s.lineTo(HB, 0); s.lineTo(0, H); s.closePath();
      return mergeVertices(new ExtrudeGeometry(s, { depth: T, bevelEnabled: false }));
    };

    return assemble([
      // ① 사면 둘 — 용마루에서 땅까지. 두 장 다 같은 색이다(모서리로 갈린다)
      ...([1, -1] as const).map((k) => part(
        new BoxGeometry(slant, T, L), CANVAS,
        [(k * HB) / 2, H / 2, 0], [0, 0, k * (Math.PI / 2 - lean)], TILE.CLOTH)),
      // 마구리 둘
      ...([1, -1] as const).map((k) => part(
        gable(), CANVAS, [0, 0, k * (L / 2) - (k > 0 ? 0 : T)], undefined, TILE.CLOTH)),
      // ③ 땅에 퍼진 자락 — 실루엣 밑변을 몸통보다 넓게 만든다
      part(new BoxGeometry(HB * 2.5, 0.012, L * 1.06), CANVAS, [0, 0.006, 0], undefined, TILE.CLOTH),
      // ② 용마루 — 가운데가 살짝 처져 있지만 이 크기에서는 곧은 선으로 충분하다
      part(new CylinderGeometry(0.016, 0.016, L * 1.02, 6), CANVAS,
        [0, H - 0.006, 0], [Math.PI / 2, 0, 0]),
      // ④ 마구리 밖 장대 — 비스듬히 선다
      part(new CylinderGeometry(0.011, 0.013, H * 1.15, 6), WOODY,
        [0, H * 0.54, L / 2 + 0.10], [0.42, 0, 0]),
      // ④ 당김줄 — 장대 끝에서 땅으로. 말뚝은 이 크기에서 점이라 안 만든다
      part(new CylinderGeometry(0.005, 0.005, 0.30, 4), [0.86, 0.82, 0.72],
        [0, H * 0.58, L / 2 + 0.24], [0.95, 0, 0]),
    ]);
  },

  /**
   * 장작더미 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/장작더미/` (숲길 옆 장작 벽 + 마구리 접사 `face.jpg`)
   *
   *   ① **마구리(잘린 단면)가 보는 쪽을 향한다** — 옆으로 누운 통나무가 아니라
   *      동그라미·반달이 빽빽한 면이 먼저 읽힌다
   *   ② 높이 : 통나무 지름 = **11.6 : 1**(약 12켜), 윗면이 **칼로 자른 듯 수평**
   *   ③ 장작 길이 : 지름 = **4.8 : 1**
   *   ④ 양 끝은 장작을 **직각으로 엇갈려 쌓아 기둥처럼** 세운다
   *
   * 사진은 끝이 화면 밖으로 나가는 긴 벽이라 **한 아름짜리 짧은 더미의 가로세로 비는
   * 못 쟀다**(`intent.md` 의 「못 찾은 것」). 원작에 맞춰 **폭 : 높이 = 1.35 : 1** 로
   * 잡는다 — 길이(4.8 : 1)가 최장축이 되면 통나무 한 개짜리 다발이 되어 버린다.
   */
  장작더미: () => {
    const ROWS = 10, D = 0.070;                   // 켜 수 · 통나무 지름
    const H = ROWS * D, W = H * 1.35, LEN = D * 4.8;
    const COLS = Math.round(W / D);

    /**
     * **통나무를 한 개씩 세우지 않는다.** 처음엔 원통 192개를 쌓았는데
     * 삼각형이 4,556개로 상한(3,000)을 넘었다 — 옆면은 사진에서도
     * 「자잘한 얼룩의 질감 한 덩어리」라 개별 장작이 안 보인다.
     *
     * 몸통은 상자 하나로 두고, **마구리에만 원판을 박는다** —
     * 그쪽이 이 물건의 정체다(①). 원판은 6각이라 한 장에 삼각형 6개다.
     */
    const face = ([] as ReturnType<typeof part>[]);
    for (const s of [1, -1] as const) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const k = ((r * 7 + c * 13 + (s > 0 ? 0 : 4)) % 9) / 9;
          // 켜 경계가 완전히 수평이 아니라 들쭉날쭉하다(face.jpg)
          const y = D / 2 + r * D + (k - 0.5) * D * 0.16;
          const x = -W / 2 + D / 2 + c * D + (r % 2) * D * 0.10;
          // **`CircleGeometry` 다.** 처음엔 납작한 원기둥을 썼는데 캡이 붙어
          // 한 장에 삼각형 24개가 들고, 260장이면 6,972개로 상한을 또 넘었다.
          // 원판은 한 장에 6개다
          face.push(part(
            new CircleGeometry(D * 0.46, 6), k < 0.35 ? BARK : CUT,
            [x, y, s * (LEN / 2 + 0.004)], [0, s > 0 ? 0 : Math.PI, k * 1.1], TILE.WOOD_C));
        }
      }
    }
    return assemble([
      // 몸통 — 옆면은 어두운 한 덩어리다. 질감은 인쇄가 진다
      part(new BoxGeometry(W, H, LEN), BARK, [0, H / 2, 0], undefined, TILE.WOOD_C),
      ...face,
      // ④ 양 끝 엇갈림 기둥 — 무너짐을 막는 마감. 한 켜씩 방향이 90° 돌아간다
      ...([1, -1] as const).flatMap((s) =>
        [0, 1, 2, 3, 4].map((i) => part(
          new CylinderGeometry(D * 0.48, D * 0.48, LEN * 0.94, 6), BARK,
          [s * (W / 2 + D * 0.42), D / 2 + i * D * 2, 0],
          [0, i % 2 ? Math.PI / 2 : 0, Math.PI / 2], TILE.WOOD_C))),
    ]);
  },

  /**
   * 캠프파이어 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/캠프파이어/` (숲속 빈터의 돌 화덕 + 원뿔로 세운 장작)
   *
   *   ① **돌 테두리 + 그 안의 원뿔**, 두 덩어리다
   *   ② 돌은 **한 겹만** 깔린다 — 쌓아 올린 담이 아니다.
   *      테두리 지름의 **1/10** 크기 돌이 **30개쯤**, 서로 닿게
   *   ③ 둥근 강돌(1 : 0.67 의 납작한 타원). 모난 깬돌이 아니다
   *   ④ 원뿔 높이 = 테두리 지름의 **0.53**, 원뿔 밑동 = 테두리의 **0.67**
   *      — 장작 밑동이 돌에 닿지 않고 **안쪽에** 선다
   *   ⑤ 불빛이 원뿔 **안**에서 터져 장작이 검은 막대로 읽힌다 —
   *      그래서 장작은 어둡게, 안쪽 잉걸만 밝게 준다
   *
   * 우물정(井)식 사진은 못 찾아 원뿔식 하나로 간다(`intent.md`).
   */
  캠프파이어: () => {
    const R = 0.5;                                // 테두리 반지름 = 최장축의 절반
    const SR = R * 0.10;                          // 돌 한 개 — 지름의 1/10
    const N = 28;
    const CONE_H = R * 2 * 0.53, CONE_R = R * 0.67;
    const stones = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const k = ((i * 7) % 5) / 5;
      stones.push(part(
        new SphereGeometry(1, 7, 5).scale(SR * (0.86 + k * 0.28), SR * 0.67, SR * (0.9 + k * 0.2)),
        RIVER_STONE, [Math.cos(a) * (R - SR), SR * 0.55, Math.sin(a) * (R - SR)],
        [0, a + k, 0], TILE.STONE));
    }
    return assemble([
      ...stones,
      // ⑤ 잉걸 — 원뿔 안에서 터지는 빛. 장작보다 «먼저» 넣어 안쪽에 둔다
      part(new SphereGeometry(1, 8, 6).scale(CONE_R * 0.62, CONE_H * 0.26, CONE_R * 0.62),
        EMBER, [0, CONE_H * 0.14, 0]),
      // 재 — 고리 안쪽 바닥
      part(new CylinderGeometry(R - SR * 1.4, R - SR * 1.4, 0.012, 16), CHAR, [0, 0.006, 0], undefined, TILE.DIRT),
      // ④ 장작 원뿔 — 쪼갠 조각이라 평평한 면이 안쪽을 향한다. 여섯 대
      ...[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        return part(
          new BoxGeometry(0.034, CONE_H * 1.02, 0.022), CHAR,
          [Math.cos(a) * CONE_R * 0.52, CONE_H / 2, Math.sin(a) * CONE_R * 0.52],
          [Math.sin(a) * 0.46, -a, -Math.cos(a) * 0.46], TILE.WOOD_F);
      }),
    ]);
  },

  /**
   * 컨테이너 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/컨테이너/` (40 ft 해상 컨테이너 + 현장사무소 곁사진)
   *
   *   ① **세로 골이 옆면 전체를 위아래로 관통한다.** 둥근 물결이 아니라
   *      평평한 마루와 빗면으로 된 사다리꼴이고, **높이의 1/6~1/7 간격**
   *   ② 위·아래 **가로 레일 두 줄**이 골보다 한 단 튀어나와 골을 끊는다
   *   ③ 네 귀퉁이 **코너 캐스팅** 여덟 개 — 실루엣 모서리가 각지게 뭉툭해지는 이유
   *   ④ 마구리는 **골 없는 평평한 문짝 두 장** + **세로 잠금봉 네 개**
   *   ⑤ 길이 : 높이 = **1 : 0.75**
   *
   * 골 자체는 부품으로 만들지 않고 **인쇄(`TILE.CORRUGATE`)로 준다** —
   * 무늬를 부품으로 세우면 혹이 된다(`object-legibility.md` 4-d).
   * 사진의 마구리 비율(0.74 : 1)은 원근에 눌린 값이라 **규격(0.94 : 1)으로 보정**했다.
   */
  컨테이너: () => {
    const L = 1.0, H = L * 0.75, W = H * 0.94;
    const RAIL = H * 0.055, CC = H * 0.11;        // 레일 두께 · 코너 캐스팅
    return assemble([
      // ① 몸통 — 골은 인쇄가 진다
      part(new BoxGeometry(L, H - RAIL * 2, W), STEEL_RED, [0, H / 2, 0], undefined, TILE.CORRUGATE),
      // ② 위·아래 레일. 골보다 한 단 나와야 골이 «끊겨» 보인다
      ...([1, -1] as const).map((k) => part(
        new BoxGeometry(L * 1.004, RAIL, W * 1.01), RUSTY,
        [0, H / 2 + k * (H / 2 - RAIL / 2), 0])),
      // ④ 마구리 문짝 둘 — 평평하다. 가운데 틈이 두 장을 가른다
      ...([1, -1] as const).map((k) => part(
        new BoxGeometry(L * 0.012, H * 0.86, W * 0.47), [0.62, 0.11, 0.13],
        [-L / 2 - L * 0.004, H / 2, k * W * 0.245])),
      // ④ 세로 잠금봉 넷 — 문짝당 둘
      ...([-0.36, -0.14, 0.14, 0.36] as const).map((z) => part(
        new CylinderGeometry(H * 0.012, H * 0.012, H * 0.80, 6), RUSTY,
        [-L / 2 - L * 0.012, H / 2, z * W])),
      // ③ 코너 캐스팅 여덟 — 골 면보다 밖으로 나온 모난 쇠 덩어리
      ...([1, -1] as const).flatMap((sx) => ([1, -1] as const).flatMap((sz) =>
        ([1, -1] as const).map((sy) => part(
          new BoxGeometry(CC, CC, CC), RUSTY,
          [sx * (L / 2 - CC * 0.4), H / 2 + sy * (H / 2 - CC * 0.4), sz * (W / 2 - CC * 0.4)])))),
    ]);
  },

  /**
   * 파이프 더미 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/파이프 더미/` (공사 야적장의 강관 더미, 단면이 정면)
   *
   *   ① **단면의 원 배열이 정체다** — 옆으로 뻗은 원통이 아니라
   *      보는 쪽에 동그라미가 가득한 면이 먼저 읽힌다
   *   ② **육각 최밀 배열** — 한 단 안에서는 원이 맞닿고, 위 단은 아래 단의 골에
   *      **반 지름 어긋나** 내려앉는다(세로 피치 = 지름 × **√3/2 = 0.87**).
   *      바둑판으로 쌓으면 안 된다
   *   ③ 6단(높이 = 지름의 5.1배), 끝은 **약 63°** 로 깎여 옆 실루엣이 사다리꼴
   *   ④ **관이 비어 있는 게 보인다** — 바깥 노랑과 안쪽 짙은 주황의 색차가 커서
   *      구멍이 색만으로 읽힌다
   *
   * 비계 단관(48.6mm) 더미 사진은 못 찾아 대구경 강관으로 잰 값이다(`intent.md`).
   */
  /**
   * 오리배 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/오리배/` (유원지 호수의 백조 페달보트)
   *
   *   ① **수면 위 몸통이 전고의 0.48 밖에 안 되고 나머지 절반을 목과 머리가 먹는다** —
   *      목을 잘라내면 그냥 보트다
   *   ② 목은 수직이 아니라 앞으로 기울었다가 위에서 뒤로 꺾이는 **S자**.
   *      몸통에서 나올 때 굵고(전장의 0.09) 머리 아래에서 가늘어진다(0.08)
   *   ③ **머리 길이가 목 굵기의 3.4배** — 목 끝에 눈에 띄게 큰 덩어리가 달린다
   *   ④ 등이 꼬리 쪽으로 한 번 부풀었다가 선미에서 뚝 떨어진다
   *   ⑤ 전장 : 전고 = **1 : 0.60**
   */
  오리배: () => {
    const L = 1.0, H = L * 0.60;
    const BODY_H = H * 0.48;                      // ①
    const NECK = L * 0.085;                       // ②
    const HEAD = NECK * 3.4;                      // ③
    const HULL: RGB = [1.00, 0.99, 0.97];
    const BILL: RGB = [1.05, 0.62, 0.14];
    const EYE: RGB = [0.10, 0.09, 0.09];
    return assemble([
      // ④ 몸통 — 뒤로 갈수록 부푼다. 앞은 뱃머리라 좁다
      part(new SphereGeometry(1, 14, 9).scale(L * 0.50, BODY_H * 0.92, L * 0.20),
        HULL, [0, BODY_H * 0.52, 0]),
      // ④ 등의 봉우리 — 선미 쪽에서 한 번 솟는다
      part(new SphereGeometry(1, 12, 8).scale(L * 0.22, BODY_H * 0.62, L * 0.19),
        HULL, [-L * 0.20, BODY_H * 0.86, 0]),
      // ② S자 목 — 두 토막으로 꺾는다. 앞으로 기울었다가 위에서 뒤로
      part(new CylinderGeometry(NECK * 0.82, NECK, H * 0.30, 9), HULL,
        [L * 0.16, BODY_H + H * 0.12, 0], [0, 0, -0.34]),
      part(new CylinderGeometry(NECK * 0.78, NECK * 0.86, H * 0.20, 9), HULL,
        [L * 0.235, BODY_H + H * 0.36, 0], [0, 0, 0.26]),
      // ③ 머리 — 목 굵기의 3.4배짜리 덩어리
      part(new SphereGeometry(1, 10, 8).scale(HEAD * 0.5, HEAD * 0.34, HEAD * 0.34),
        HULL, [L * 0.205, H * 0.90, 0]),
      part(new SphereGeometry(1, 8, 6).scale(HEAD * 0.30, HEAD * 0.13, HEAD * 0.15),
        BILL, [L * 0.205 + HEAD * 0.42, H * 0.865, 0]),
      ...([1, -1] as const).map((k) => part(
        new SphereGeometry(1, 6, 5).scale(HEAD * 0.07, HEAD * 0.07, HEAD * 0.05),
        EYE, [L * 0.205 + HEAD * 0.16, H * 0.925, k * HEAD * 0.16])),
      // 차양 — 사람이 앉는 자리 위. 몸통 가운데를 덮는다
      part(new CylinderGeometry(L * 0.20, L * 0.20, H * 0.03, 10), [0.92, 0.36, 0.34],
        [-L * 0.02, H * 0.60, 0]),
      ...([1, -1] as const).map((k) => part(
        new CylinderGeometry(NECK * 0.22, NECK * 0.22, H * 0.28, 5), [0.86, 0.86, 0.88],
        [-L * 0.02, H * 0.46, k * L * 0.14])),
    ]);
  },

  /**
   * 보트 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/보트/` (이노카시라 연못 대여 보트, 위에서 비스듬히)
   *
   *   ① 평면 실루엣이 **좌우대칭 물방울** — 뱃머리가 뾰족하고 가장 넓은 곳이
   *      중간보다 **뒤쪽**이며, 고물은 잘린 직선(트랜섬)이고 그 폭이 최대 폭의 **0.79**
   *   ② 뱃전에 폭의 **0.09** 짜리 **흰 테두리**가 둘레를 한 바퀴 두른다 —
   *      위에서 보면 윤곽선처럼 보인다
   *   ③ 안은 텅 비고 **가로 좌석 두세 줄**과 나무 바닥판뿐이다. 지붕도 엔진도 없다
   *   ④ **노 두 자루가 X자로** 걸쳐 배 밖으로 삐져나온다
   *
   * 부감 사진이라 **전장 : 전폭을 못 쟀다**(`intent.md`). 가로로 잰 값만 쓴다.
   */
  보트: () => {
    const L = 1.0, W = L * 0.38, H = L * 0.13;
    const RIM = W * 0.09;
    const HULL: RGB = [0.30, 0.46, 0.62];
    const RIM_C: RGB = [1.05, 1.03, 0.98];
    const PLANK: RGB = [0.60, 0.46, 0.30];

    /** ① 물방울 평면 — 뱃머리 뾰족, 최대 폭이 뒤쪽, 고물은 잘린 직선 */
    const plan = (k: number): Shape => {
      const s = new Shape();
      const hw = (W / 2) * k, tr = hw * 0.79;
      s.moveTo(L * 0.50 * k, 0);                          // 뱃머리
      s.bezierCurveTo(L * 0.30 * k, hw * 0.75, L * 0.02 * k, hw, -L * 0.14 * k, hw);
      s.lineTo(-L * 0.50 * k, tr);                        // 트랜섬
      s.lineTo(-L * 0.50 * k, -tr);
      s.lineTo(-L * 0.14 * k, -hw);
      s.bezierCurveTo(L * 0.02 * k, -hw, L * 0.30 * k, -hw * 0.75, L * 0.50 * k, 0);
      return s;
    };
    const solid = (k: number, d: number): BufferGeometry =>
      mergeVertices(new ExtrudeGeometry(plan(k), { depth: d, bevelEnabled: false, curveSegments: 5 }));

    return assemble([
      // 선체 — 아래로 좁아지게 두 켜로 쌓는다
      part(solid(0.80, H * 0.55), HULL, [0, 0, 0], [-Math.PI / 2, 0, 0], TILE.WOOD_F),
      part(solid(1.0, H * 0.45), HULL, [0, H * 0.55, 0], [-Math.PI / 2, 0, 0], TILE.WOOD_F),
      // ② 흰 뱃전 테두리 — 둘레를 한 바퀴. 위에서 보면 윤곽선이다
      part(solid(1.0, RIM * 0.5), RIM_C, [0, H, 0], [-Math.PI / 2, 0, 0]),
      // ③ 속을 판다 — 테두리 안쪽을 어둡게 눌러 «빈 배»로 만든다
      part(solid(0.84, H * 0.42), [0.20, 0.30, 0.40], [0, H * 0.58, 0], [-Math.PI / 2, 0, 0]),
      part(solid(0.80, 0.008), PLANK, [0, H * 0.58, 0], [-Math.PI / 2, 0, 0], TILE.WOOD_C),
      // ③ 가로 좌석 둘
      ...([0.10, -0.16] as const).map((x) => part(
        new BoxGeometry(W * 0.16, H * 0.10, W * 0.78), PLANK,
        [L * x, H * 0.86, 0], undefined, TILE.WOOD_C)),
      // ④ 노 두 자루 — X자로 걸쳐 배 밖으로 나간다
      ...([1, -1] as const).map((k) => part(
        new CylinderGeometry(W * 0.026, W * 0.026, L * 0.86, 6), PLANK,
        [-L * 0.04, H * 1.02, 0], [0, k * 0.42, Math.PI / 2], TILE.WOOD_F)),
      ...([1, -1] as const).map((k) => part(
        new BoxGeometry(L * 0.10, 0.008, W * 0.16), PLANK,
        [-L * 0.04 + Math.cos(k * 0.42) * L * 0.40, H * 1.02, -Math.sin(k * 0.42) * L * 0.40],
        [0, k * 0.42, 0], TILE.WOOD_F)),
    ]);
  },

  /**
   * 자전거 보관대 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/자전거 보관대/` (앞바퀴 거치형 + 일본 2단식 곁사진)
   *
   *   ① 땅에 납작한 프레임이 깔리고 거기서 같은 굵기의 **관 루프가 줄줄이** 솟는다 —
   *      기둥도 지붕도 없다
   *   ② 루프는 **높이 : 폭 = 6 : 1** 의 길쭉한 U자. 폭을 넓히면 이 물건이 아니다
   *   ③ **반복 자체가 실루엣이다** — 하나만 놓으면 못 알아본다. 최소 대여섯 개
   *   ④ 관 굵기가 루프 폭의 **0.26** 으로 두껍다. 가는 철사가 아니다
   *
   * 일본 1970~80년대 주륜 랙 사진은 커먼즈에 없어 독일 거치대로 잰 값이다.
   * 그 사진은 제목부터 「간격이 지나치게 좁다」를 지적하는 것이라
   * **루프 간격만은 일반값이 아니다**(`intent.md`).
   */
  '자전거 보관대': () => {
    const L = 1.0, N = 7;
    const LH = L * 0.30, LW = LH * 0.17;          // ② 6 : 1
    const R = LW * 0.26 / 2;                      // ④
    const PITCH = L / N;
    const STEEL: RGB = [0.60, 0.62, 0.66];
    const loops = [];
    for (let i = 0; i < N; i++) {
      const z = -L / 2 + PITCH / 2 + i * PITCH;
      // ② U자 — 다리 둘 + 위를 잇는 가로대. 폭이 좁아 «홈»으로 읽힌다
      loops.push(
        ...([1, -1] as const).map((k) => part(
          new CylinderGeometry(R, R, LH - LW / 2, 6), STEEL,
          [k * (LW / 2 - R), (LH - LW / 2) / 2, z], undefined, TILE.METAL)),
        part(new CylinderGeometry(R, R, LW - R * 2, 6), STEEL,
          [0, LH - LW / 2, z], [0, 0, Math.PI / 2], TILE.METAL),
      );
    }
    return assemble([
      // ① 바닥 프레임 — 납작하다
      ...([1, -1] as const).map((k) => part(
        new BoxGeometry(R * 2.4, R * 2.2, L), STEEL,
        [k * (LW / 2 - R), R * 1.1, 0], undefined, TILE.METAL)),
      // 가로 연결관 한 줄 — 사진의 중간 띠
      ...([1, -1] as const).map((k) => part(
        new CylinderGeometry(R * 0.8, R * 0.8, L, 6), STEEL,
        [k * (LW / 2 - R), LH * 0.44, 0], [Math.PI / 2, 0, 0], TILE.METAL)),
      ...loops,
    ]);
  },

  /**
   * 모래 포대 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/모래 포대/` (제방 쌓기용 토낭 더미 + 자루 근접)
   *
   *   ① 자루가 공처럼 둥글지 않다 — **길이가 두께의 6.6배인 눌린 베개**다.
   *      가운데가 불룩하고 양 끝이 얇아진다
   *   ② 같은 방향으로 눕혀 층층이 포개고, **층마다 안으로 들여** 옆에서 보면
   *      폭 : 높이 = **1 : 0.80** 의 사다리꼴
   *   ③ 자루 양 끝 **묶은 자리가 귀처럼** 삐져나와 옆면에 들쭉날쭉한 돌기를 만든다 —
   *      이게 없으면 그냥 매트리스 더미다
   *   ④ 맨 아래는 땅이 아니라 **팔레트 위**라 더미가 한 단 떠 있다
   */
  '모래 포대': () => {
    const W = 1.0, H = W * 0.80;
    const ROWS = 7;
    const PAL = H * 0.115;                        // ④ 팔레트 — 자루 한 장 두께
    const T = (H - PAL) / ROWS;                   // 자루 두께
    const SACK: RGB = [0.90, 0.86, 0.74];
    const bags = [];
    for (let r = 0; r < ROWS; r++) {
      const inset = r * (W * 0.032);              // ② 층마다 들여 쌓는다
      const len = W - inset * 2;
      const n = Math.max(2, Math.round(len / (T * 6.6)));
      for (let c = 0; c < n; c++) {
        const k = ((r * 5 + c * 11) % 7) / 7;
        const bw = len / n;
        const x = -len / 2 + bw / 2 + c * bw;
        const y = PAL + T / 2 + r * T;
        // ① 눌린 베개 — 가운데가 불룩하다
        bags.push(part(
          new SphereGeometry(1, 8, 6).scale(bw * 0.49, T * 0.52, W * 0.20),
          SACK, [x, y, 0], [0, (k - 0.5) * 0.24, 0], TILE.CLOTH));
        // ③ 묶은 귀 — 옆면의 돌기. 이게 정체를 만든다
        bags.push(part(
          new SphereGeometry(1, 5, 4).scale(bw * 0.10, T * 0.22, W * 0.05),
          SACK, [x + bw * (0.44 - k * 0.06), y + T * 0.12, W * 0.19]));
      }
    }
    return assemble([
      // ④ 팔레트
      part(new BoxGeometry(W * 0.98, PAL, W * 0.44), [0.56, 0.44, 0.30],
        [0, PAL / 2, 0], undefined, TILE.WOOD_C),
      ...bags,
    ]);
  },

  '파이프 더미': () => {
    const D = 0.10, R = D / 2, ROWS = 6;
    const LEN = 1.0;                              // 최장축 = 관 길이
    const pipes = [];
    for (let r = 0; r < ROWS; r++) {
      // ③ 단마다 반 지름씩 물러난다 → 63° 경사, 사다리꼴 실루엣
      const n = ROWS - r;
      for (let c = 0; c < n; c++) {
        const x = (c - (n - 1) / 2) * D;
        const y = R + r * D * (Math.sqrt(3) / 2);  // ② 세로 피치 = 지름 × √3/2
        pipes.push(part(
          new CylinderGeometry(R, R, LEN, 12, 1, true), PIPE_OUT,
          [x, y, 0], [Math.PI / 2, 0, 0], TILE.METAL));
        // ④ 안쪽 — 바깥보다 훨씬 어둡게. 이 색차가 «구멍»을 만든다
        pipes.push(part(
          new CylinderGeometry(R * 0.82, R * 0.82, LEN * 0.985, 12), PIPE_IN,
          [x, y, 0], [Math.PI / 2, 0, 0]));
      }
    }
    return assemble(pipes);
  },
};
