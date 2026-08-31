import {
  BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { ShapeIdGarden } from './generation';
import {
  assemble, DARK, hollow, part, soft, WHITE, WOOD,
  type Part, type RGB,
} from './shapes.kit';

/** X축으로 돌린 원기둥·토러스 — 축이 Z가 된다 */
const LIE_Z: readonly [number, number, number] = [Math.PI / 2, 0, 0];
/** 눕힌 원기둥. 원기둥 축은 Y라 Z로 90° 돌리면 X축이 된다 */
const LIE_X: readonly [number, number, number] = [0, 0, Math.PI / 2];

/**
 * ── 일본식 정원 물건 일곱 ────────────────────────────────────
 *
 * 뒷마당이 흙바닥 한 장에 페트병·연어 캔·양동이가 널린 재활용 수거장이었다.
 * 이끼와 자갈(`floors.ts`)이 «땅»을 고쳤고, 이 파일이 «서 있는 것»을 고친다.
 *
 * ## 색은 팔레트가 아니라 계수로 벌린다
 *
 * 한 형상에 재질이 둘 이상이면(석등의 돌+구멍, 대나무의 줄기+잎) 팔레트에 색을
 * 실으면 **전부 그 색이 된다** — 찬장 유리가 갈색이 되고, 나무 줄기가 초록이 되고,
 * 욕조 안이 안 보이던 게 전부 이 실수였다. **세 번 겪었다.**
 * 그래서 여기 일곱은 `SHAPE_COLOR` 를 중성색으로 두고 아래 계수로 재질을 만든다.
 */
/** 화강암 — 석등·물확·징검돌의 돌 */
const STONE: RGB = [0.78, 0.77, 0.73];
/** 그늘진 돌 — 파인 자리·아랫면. 같은 회색이라도 어두워야 «깊이»가 생긴다 */
const STONE_DARK: RGB = [0.52, 0.52, 0.50];
/** 이끼 낀 돌 — 징검돌 윗면. 바닥색(`F_MOSS`)과 같은 결이다 */
const MOSS: RGB = [0.42, 0.55, 0.28];
/** 대나무 줄기 — 마른 연둣빛 */
const BAMBOO: RGB = [0.70, 0.74, 0.42];
/** 대나무 마디 — 줄기보다 짙어야 «마디»로 읽힌다 */
const BAMBOO_NODE: RGB = [0.52, 0.56, 0.30];
/** 잎 — 대나무·소나무 공통 */
const LEAF: RGB = [0.28, 0.46, 0.24];
/** 솔잎 — 대나무 잎보다 짙고 푸르다 */
const PINE: RGB = [0.22, 0.40, 0.26];

/**
 * 대나무 줄기 한 대 — 마디 링을 `n` 개 두른 원기둥.
 *
 * **마디가 대나무의 정체다.** 매끈한 원기둥은 그냥 초록 막대고, 일정 간격
 * 도톰한 링이 있어야 대나무가 된다. `tap()`(수도꼭지)이 「기둥+주둥이+손잡이 셋이
 * 있어야 꼭지로 읽힌다」와 같은 이야기다.
 */
function culm(
  x: number, z: number, h: number, r: number, tilt: number, nodes: number,
  /**
   * 마디 위상(0~1). **대마다 달라야 한다** — 세 대의 마디 높이가 같으면
   * 링이 가로로 줄을 맞춰서 「사다리 가로대」로 읽힌다. 화면이 잡은 결함이다.
   */
  phase = 0,
): Part[] {
  const p: Part[] = [
    part(new CylinderGeometry(r * 0.82, r, h, 7), BAMBOO, [x, h / 2, z], [0, 0, tilt]),
  ];
  for (let i = 1; i <= nodes; i++) {
    const y = (h * (i - 1 + phase + 0.6)) / (nodes + 1);
    // 기울인 줄기를 따라가야 마디가 «줄기 위»에 남는다 — 안 따라가면 공중에 뜬 고리다
    // **링은 (3, 6) 이다.** (4, 7) 로 두면 링 하나가 56 삼각형이고, 세 대에
    // 열두 마디면 그것만 672 개다 — 대나무 한 종이 리포 최대(`가로수` 920)를
    // 넘겼다. 마디는 «있다/없다»가 전부라 해상도를 올릴 값어치가 없다.
    p.push(part(new TorusGeometry(r * 0.94, r * 0.20, 3, 6), BAMBOO_NODE,
      [x - Math.sin(tilt) * y, y, z], [Math.PI / 2, 0, tilt]));
  }
  return p;
}

/**
 * 이어지는 줄기 한 토막.
 *
 * **끝점을 계산해서 넘겨줘야 한다.** 처음엔 토막마다 중심 좌표를 손으로 적었는데,
 * 원기둥은 «자기 중심»을 기준으로 회전하므로 기울인 토막의 끝이 다음 토막의 시작과
 * 안 맞았다 — 화면에서 소나무가 **부러진 막대 셋**으로 나왔다.
 * `rotation.z = a` 는 +Y 축을 (−sin a, cos a) 로 돌린다.
 */
function stem(
  from: readonly [number, number, number], a: number, h: number,
  rBot: number, rTop: number,
): { part: Part; end: readonly [number, number, number] } {
  const dx = -Math.sin(a) * h, dy = Math.cos(a) * h;
  return {
    part: part(new CylinderGeometry(rTop, rBot, h, 7), WOOD,
      [from[0] + dx / 2, from[1] + dy / 2, from[2]], [0, 0, a]),
    end: [from[0] + dx, from[1] + dy, from[2]],
  };
}

export const GARDEN_BUILDERS: Record<ShapeIdGarden, () => BufferGeometry> = {
  /**
   * 석등 (115cm) — 카스가도로(春日灯籠).
   *
   * **정원의 초점이다.** 여섯 마디가 다 있어야 석등으로 읽힌다:
   * 기단(基礎) · 간(竿, 기둥) · 중대(中台) · 화사석(火袋, 불집) · 갓(笠) · 보주(宝珠).
   * 하나라도 빼면 「돌기둥에 뭘 얹은 것」이 된다. 특히 **갓이 처마처럼 넓어야** 한다 —
   * 좁으면 버섯이다.
   */
  석등: () => assemble([
    // 기단 — 아래가 넓은 8각 받침
    part(new CylinderGeometry(0.15, 0.19, 0.09, 8), STONE, [0, 0.045, 0]),
    part(new CylinderGeometry(0.13, 0.15, 0.04, 8), STONE_DARK, [0, 0.11, 0]),
    // 간 — 기둥. 가운데가 살짝 잘록해야 «깎은 돌»이다
    part(new CylinderGeometry(0.062, 0.072, 0.20, 8), STONE, [0, 0.23, 0]),
    part(new TorusGeometry(0.068, 0.014, 4, 8), STONE_DARK, [0, 0.33, 0], LIE_Z),
    part(new CylinderGeometry(0.072, 0.062, 0.16, 8), STONE, [0, 0.41, 0]),
    // 중대 — 화사석 받침. 위로 퍼진다
    part(new CylinderGeometry(0.125, 0.085, 0.06, 8), STONE, [0, 0.52, 0]),
    // 화사석 — 불집. **네 벽 사이가 뚫려야 «불이 드는 집»이다**
    ...([0, Math.PI / 2] as const).flatMap((a) => [
      part(new BoxGeometry(0.19, 0.17, 0.030), STONE, [0, 0.635, 0.080], [0, a, 0]),
      part(new BoxGeometry(0.19, 0.17, 0.030), STONE, [0, 0.635, -0.080], [0, a, 0]),
    ]),
    // 안쪽 어둠 — 뒤집은 상자. 없으면 구멍 너머로 하늘이 보여서 «집»이 안 된다
    part(new BoxGeometry(0.13, 0.16, 0.13).scale(-1, 1, 1), [0.22, 0.20, 0.17],
      [0, 0.635, 0]),
    // 갓 — 8각 처마. 넓어야 석등이다
    part(new CylinderGeometry(0.145, 0.115, 0.035, 8), STONE, [0, 0.738, 0]),
    part(new CylinderGeometry(0.055, 0.150, 0.085, 8), STONE, [0, 0.798, 0]),
    // 갓 끝 반전(蕨手) — 여덟 귀퉁이가 살짝 들린다
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return part(new SphereGeometry(0.024, 5, 4), STONE,
        [Math.cos(a) * 0.148, 0.762, Math.sin(a) * 0.148]);
    }),
    // 보주 — 꼭대기 구슬
    part(new CylinderGeometry(0.030, 0.048, 0.028, 8), STONE_DARK, [0, 0.855, 0]),
    part(new SphereGeometry(0.042, 8, 6), STONE, [0, 0.905, 0]),
  ]),

  /**
   * 물확 / 쓰쿠바이 (55cm) — 손 씻는 돌그릇.
   *
   * **셋이 한 벌이다**: 파인 그릇 · 앞에 딛는 납작 돌(前石) · 물을 떨구는 대나무 물대.
   * 그릇만 두면 「구멍 난 돌」이고, 물대가 있어야 물이 흐르는 곳으로 읽힌다.
   * `hollow()` 는 원기둥이라 둥근 돌그릇에 그대로 맞는다.
   */
  물확: () => assemble([
    // 그릇 — 위가 뚫린 원통. 안쪽을 어둡게 해야 «파였다»가 읽힌다
    ...hollow(0.24, 0.26, 0.20, 0.045, 0.05, 12, STONE, [0.30, 0.33, 0.30]),
    // 밑에 괸 돌 — 그릇이 흙에 박힌 게 아니라 «놓인» 것으로 보이게
    part(new CylinderGeometry(0.27, 0.30, 0.05, 10), STONE_DARK, [0, 0.025, 0]),
    // 앞에 딛는 납작 돌
    part(new CylinderGeometry(0.15, 0.16, 0.045, 7), STONE, [0.34, 0.022, 0.16]),
    // 대나무 물대 — 세운 대 + 기울여 뻗은 홈통. 끝이 그릇 위에 와야 한다
    ...culm(-0.30, -0.12, 0.46, 0.032, 0, 2),
    part(new CylinderGeometry(0.028, 0.028, 0.34, 7), BAMBOO,
      [-0.17, 0.455, -0.06], [0.32, 0.42, 0.30]),
    part(new TorusGeometry(0.032, 0.010, 4, 7), BAMBOO_NODE, [-0.30, 0.46, -0.12], LIE_Z),
  ]),

  /**
   * 징검돌 (30cm) — 도비이시(飛石).
   *
   * **높이가 5cm 다.** 공이 마당에 들어오는 건 지름 10cm 때인데, 발판이 두꺼우면
   * 열린 마당 한가운데 걸림돌 일곱이 생긴다. 낮게 깔고 윗면에 이끼를 한 겹 얹어
   * 「길」로 읽히게 한다 — 이끼가 없으면 그냥 회색 원반이다.
   */
  징검돌: () => assemble([
    part(new CylinderGeometry(0.145, 0.155, 0.036, 7), STONE_DARK, [0, 0.018, 0]),
    part(new CylinderGeometry(0.150, 0.145, 0.016, 7), STONE, [0, 0.044, 0]),
    // 이끼 — 가장자리에만 낀다. 가운데는 밟아서 닳는다
    part(new CylinderGeometry(0.152, 0.150, 0.006, 7), MOSS, [0, 0.049, 0]),
    part(new CylinderGeometry(0.112, 0.112, 0.008, 7), STONE, [0.008, 0.052, -0.006]),
  ]),

  /**
   * 대나무 (190cm) — 세 대가 한 떨기.
   *
   * **한 대만 세우면 장대다.** 굵기·높이·기울기가 다른 세 대가 있어야 떨기가 되고,
   * 그게 담장 앞에 심는 대나무의 모양이다.
   */
  대나무: () => assemble([
    ...culm(0, 0, 1.00, 0.038, 0.02, 4, 0.0),
    ...culm(-0.085, 0.055, 0.86, 0.031, -0.06, 3, 0.45),
    ...culm(0.075, -0.045, 0.72, 0.027, 0.09, 3, 0.75),
    /**
     * 잎. **위쪽 «절반»을 두른다** — 처음엔 꼭대기에만 얹었더니 화면에서
     * 「장대 셋에 우산」이었다. 대나무는 밑동이 훤하되 잎은 위 절반에 걸쳐
     * 층층이 늘어진다. 아래로 갈수록 작고 밖으로 벌어진다.
     */
    ...([
      [0.00, 1.00, 0.00, 0.19, 0.4], [-0.11, 0.90, 0.07, 0.17, -0.6],
      [0.12, 0.84, -0.06, 0.16, 1.1], [0.02, 0.76, 0.11, 0.15, 2.0],
      [-0.14, 0.71, -0.05, 0.14, -1.5], [0.13, 0.63, 0.08, 0.13, 0.8],
      [-0.05, 0.56, -0.11, 0.12, 2.6], [0.09, 0.49, 0.03, 0.10, -2.2],
    ] as const).map(([x, y, z, r, a]) =>
      part(new SphereGeometry(r, 5, 4).scale(1, 0.34, 1), LEAF, [x, y, z], [0.18, a, 0.22])),
  ]),

  /**
   * 소나무 (145cm) — 전정목(仕立て松).
   *
   * **일본 정원의 초록은 «층»이다.** 기존 `나무` 는 둥근 막대사탕이라
   * 「나무」로만 읽힌다. 굽은 줄기에 납작한 잎 덩이를 층층이 얹어야
   * 「사람이 다듬었다」가 보이고, 그게 없으면 이끼를 깔아도 그냥 초록 마당이다.
   */
  소나무: () => {
    /**
     * 줄기 — 토막 넷을 **끝점을 물려가며** 잇는다. 각도를 좌우로 번갈아 꺾어야
     * 굽은 것으로 읽힌다(한 방향이면 그냥 기울어진 막대다). 각 토막을 손으로
     * 앉히면 원기둥이 자기 중심을 기준으로 돌아서 **끝이 안 맞고 부러진다.**
     */
    const s0 = stem([0, 0, 0], 0.15, 0.32, 0.065, 0.052);
    const s1 = stem(s0.end, -0.26, 0.28, 0.052, 0.043);
    const s2 = stem(s1.end, 0.30, 0.24, 0.043, 0.034);
    const s3 = stem(s2.end, -0.14, 0.18, 0.034, 0.026);
    /**
     * 잎 층. **두께가 0.30 이면 접시고, 0.44 라야 덩이다.**
     * 첫 판에서 얇게(0.30) 만들었더니 화면에서 「막대기에 얹은 접시」였다.
     * 층 중심이 줄기에서 «반지름의 절반 안»에 있어야 덩이가 줄기를 물고 있다.
     */
    const tuft = (
      at: readonly [number, number, number], dx: number, dz: number, r: number,
    ): Part[] => [
      // 가지 — 잎 덩이가 «공중에» 뜨지 않게 줄기에서 뻗어 받친다
      part(new CylinderGeometry(0.016, 0.022, Math.hypot(dx, dz) * 1.9, 6), WOOD,
        [at[0] + dx * 0.5, at[1] - 0.02, at[2] + dz * 0.5],
        [0, Math.atan2(dx, dz), Math.PI / 2 - 0.25]),
      part(new SphereGeometry(r, 8, 5).scale(1, 0.44, 1), PINE,
        [at[0] + dx, at[1] + 0.045, at[2] + dz]),
    ];
    return assemble([
      s0.part, s1.part, s2.part, s3.part,
      // 아래가 넓고 위가 좁다 — 다듬은 나무의 실루엣이 그것이다
      ...tuft(s0.end, 0.17, -0.05, 0.235),
      ...tuft(s1.end, -0.19, 0.07, 0.200),
      ...tuft(s2.end, 0.14, 0.04, 0.165),
      // 꼭대기 — 가지 없이 줄기 끝에 바로 얹는다
      part(new SphereGeometry(0.125, 8, 5).scale(1, 0.46, 1), PINE,
        [s3.end[0], s3.end[1] + 0.02, s3.end[2]]),
    ]);
  },

  /**
   * 게타 (24cm) — 나막신.
   *
   * 툇마루·평상 앞에 벗어둔다. **굽 둘이 정체다** — 바닥판만 있으면 슬리퍼고,
   * 판을 띄우는 이(歯) 두 개가 있어야 게타다.
   */
  게타: () => assemble([
    part(soft(0.098, 0.020, 0.235, 0.24), WOOD, [0, 0.058, 0]),
    // 이(歯) 둘 — 앞뒤로 떨어져야 «띄운» 것으로 보인다
    part(new BoxGeometry(0.090, 0.048, 0.020), [0.42, 0.31, 0.21], [0, 0.024, 0.062]),
    part(new BoxGeometry(0.090, 0.048, 0.020), [0.42, 0.31, 0.21], [0, 0.024, -0.055]),
    // 하나오(끈) — 앞코에서 갈라져 양옆으로. 검은 끈이 나막신을 신발로 만든다
    part(new CylinderGeometry(0.007, 0.007, 0.075, 5), DARK,
      [0.021, 0.078, 0.055], [0.55, 0.55, 0]),
    part(new CylinderGeometry(0.007, 0.007, 0.075, 5), DARK,
      [-0.021, 0.078, 0.055], [0.55, -0.55, 0]),
    part(new SphereGeometry(0.011, 5, 4), DARK, [0, 0.072, 0.093]),
  ]),

  /**
   * 갈퀴 (85cm) — 대나무 갈퀴.
   *
   * 자갈에 고랑을 긋는 물건이라 이 마당에 있어야 할 이유가 분명하다.
   * **부챗살이 정체다** — 자루 끝에 살 다섯이 부채꼴로 벌어져야 갈퀴다.
   */
  갈퀴: () => assemble([
    ...culm(0, 0, 0.74, 0.017, 0, 3),
    // 살 다섯 — 부채꼴. 각도를 벌려 심는다
    ...([-0.42, -0.21, 0, 0.21, 0.42] as const).map((a) =>
      part(new CylinderGeometry(0.006, 0.008, 0.20, 4), BAMBOO,
        [Math.sin(a) * 0.10, 0.80, 0], [0, 0, a])),
    // 살을 묶는 가로대 둘
    part(new CylinderGeometry(0.006, 0.006, 0.17, 4), BAMBOO_NODE, [0, 0.755, 0], LIE_X),
    part(new CylinderGeometry(0.005, 0.005, 0.22, 4), BAMBOO_NODE, [0, 0.845, 0], LIE_X),
    // 자루 끝 손잡이 마개
    part(new SphereGeometry(0.020, 6, 5), BAMBOO_NODE, [0, 0.005, 0]),
  ]),
};

void WHITE;
