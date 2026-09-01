import {
  BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { ShapeIdTown } from './generation';
import {
  assemble, DARK, GLASS, METAL, normalize, part, soft, WHITE, WOOD, WRAP,
  type RGB,
} from './shapes.kit';

/**
 * 쥐·참새의 살빛 — 털 위에서 «확실히» 밝아야 귀·코가 보인다.
 *
 * **2를 넘겨야 했다.** 쥐 팔레트가 중간 회색(0x5c5954, 밝기 0.36)이라
 * 계수 1.55 로는 곱한 뒤 대비가 0.06 이다 — 채널이 1에서 잘리기 때문에
 * 팔레트가 어두울수록 «잘리기 전»의 여유를 크게 잡아야 한다.
 */
const PINK: RGB = [2.3, 1.7, 1.6];
import { TILE } from './atlas';

const LIE_X: readonly [number, number, number] = [0, 0, Math.PI / 2];
const LIE_Z: readonly [number, number, number] = [Math.PI / 2, 0, 0];

/**
 * 동네 맵(Pigeon Town) 전용 형태.
 *
 * **집 표와 겹치는 건 여기 없다.** 화분·휴지통·고양이처럼 마당에 있어도 어색하지
 * 않은 것은 기존 형태를 그대로 쓴다 — 같은 물건을 두 벌 만들 이유가 없다.
 *
 * 우선순위는 **원작 「별을 만들어라 3」 동선에 이름이 나온 물건**이다:
 * 꽃 · 연어 캔 · 공 · 삽 · 개밥그릇 · 페트병 · 쥐 · 개 · 모래성.
 * 나머지(꽃잎·자갈·도토리·솔방울·비둘기·참새·삼각콘·양동이·동전·병뚜껑·모종삽)는
 * 마을 광장과 공사장을 채우는 흔한 것들이다.
 *
 * 규약은 `shapes.kit.ts` 그대로 — 단위 정육면체, 바닥 y=−0.5, 최장축 1.0,
 * 색은 절대색이 아니라 팔레트에 곱해지는 계수.
 */
export const TOWN_BUILDERS: Record<ShapeIdTown, () => BufferGeometry> = {
  // ── 버킷 0 (1~2cm) ────────────────────────────────────────
  // **`assemble()` 뒤에 `scale()`을 걸면 안 된다** — 정규화가 이미 끝난 뒤라
  // 최장축 1.0·바닥 −0.5 규약이 깨진다 (shapecheck 이 이걸 잡았다).
  // 눌러야 하면 다시 `normalize()` 를 태운다.
  꽃잎: () => normalize(assemble([
    // 납작한 타원 한 장. 얇아야 꽃잎으로 읽힌다.
    // **결 인쇄를 문다** — 얇은 판에는 표식을 붙일 데가 없다
    part(new SphereGeometry(0.5, 14, 10), WHITE, undefined, undefined, TILE.LEAF),
    part(new CylinderGeometry(0.03, 0.05, 0.22, 6), [0.42, 0.52, 0.22], [-0.42, 0, 0], LIE_X),
  ]).scale(1, 0.16, 0.62)),

  자갈: () => normalize(assemble([
    // 각진 돌. 구를 저해상도로 뽑으면 그 자체로 자갈이다
    part(new SphereGeometry(0.5, 16, 10), WHITE, undefined, undefined, TILE.STONE),
  ]).scale(1, 0.72, 0.86)),

  병뚜껑: () => assemble([
    // **윗면에 인쇄를 문다** — 납작한 원반에는 표식을 붙일 데가 없다
    part(new CylinderGeometry(0.5, 0.5, 0.26, 20), WHITE, undefined, undefined, TILE.COVER),
    // 옆면 주름 — 병뚜껑은 이게 있어야 병뚜껑이다. 몸통과 «확실히» 갈려야 한다
    part(new TorusGeometry(0.49, 0.055, 6, 20), [0.42, 0.44, 0.48], [0, -0.06, 0], LIE_Z),
  ]),

  도토리: () => assemble([
    part(new SphereGeometry(0.36, 16, 10).scale(1, 1.25, 1), WHITE, [0, 0.30, 0]),
    // 깍정이
    part(new SphereGeometry(0.38, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), WOOD, [0, 0.52, 0], undefined, TILE.WOOD_C),
    part(new CylinderGeometry(0.05, 0.05, 0.16, 6), WOOD, [0, 0.78, 0]),
  ]),

  솔방울: () => assemble([
    // **원뿔을 쌓으면 크리스마스 트리가 된다.** 두 번 그렇게 만들어보고 버렸다 —
    // 각 층의 뾰족한 끝이 위층 밑으로 삐져나와 그대로 나무 실루엣이 된다.
    // 달걀 하나에 비늘 링을 둘러야 솔방울로 읽힌다.
    part(new SphereGeometry(0.30, 16, 10).scale(1, 1.75, 1), WHITE, [0, 0.55, 0]),
    part(new TorusGeometry(0.25, 0.05, 4, 20), WOOD, [0, 0.34, 0], LIE_Z),
    part(new TorusGeometry(0.28, 0.05, 4, 20), WOOD, [0, 0.55, 0], LIE_Z),
    part(new TorusGeometry(0.24, 0.05, 4, 14), WOOD, [0, 0.76, 0], LIE_Z),
    part(new CylinderGeometry(0.05, 0.05, 0.14, 6), WOOD, [0, 0.02, 0]),
  ]),

  동전: () => assemble([
    // 안쪽 원반이 몸통과 «같은 두께로 겹쳐» 위·아랫면이 같은 평면이었다.
    // 얇게 얹어 도드라지게 한다 — 실제 동전도 안쪽이 한 단 낮다
    part(new CylinderGeometry(0.5, 0.5, 0.08, 20), METAL, undefined, undefined, TILE.METAL),
    part(new CylinderGeometry(0.34, 0.34, 0.05, 20), [0.52, 0.53, 0.56], [0, 0.022, 0]),
  ]),

  // ── 버킷 2~3 (4~16cm) ─────────────────────────────────────
  꽃: () => assemble([
    // 원작 MaS3 초반의 그 꽃. 꽃잎 다섯 + 심 + 줄기 + 잎
    part(new CylinderGeometry(0.035, 0.05, 0.62, 6), [0.35, 0.6, 0.3], [0, -0.19, 0]),
    part(new SphereGeometry(0.09, 6, 5), [1, 0.85, 0.3], [0, 0.16, 0]),
    ...[0, 1, 2, 3, 4].map((i) => part(
      new SphereGeometry(0.13, 12, 8).scale(1, 0.4, 1),
      WHITE,
      [Math.cos(i * 1.2566) * 0.17, 0.16, Math.sin(i * 1.2566) * 0.17],
    )),
    part(new SphereGeometry(0.11, 6, 4).scale(1.6, 0.25, 0.7), [0.35, 0.6, 0.3], [0.13, -0.24, 0]),
  ]),

  '연어 캔': () => assemble([
    // 납작한 원통 + 뚜껑 링 + 따개 고리
    part(new CylinderGeometry(0.5, 0.5, 0.36, 20), WHITE),
    part(new CylinderGeometry(0.46, 0.46, 0.06, 20), METAL, [0, 0.19, 0]),
    part(new TorusGeometry(0.12, 0.025, 4, 14), METAL, [0.12, 0.24, 0], LIE_Z),
  ]),

  /**
   * 쥐. 머리 중심(x 0.34)이 몸통 타원체(x 반지름 0.45) **안**에 있었다 —
   * 중심 거리 0.392 < 표면까지 0.446. 몸통과 머리가 한 덩어리로 녹아
   * 「귀 달린 감자」였다. 머리를 밖으로 내고 목으로 잇는다.
   */
  쥐: () => assemble([
    // 원작 동선에 "공을 나르는 쥐"가 나온다
    part(new SphereGeometry(0.30, 16, 10).scale(1.5, 0.9, 1), WHITE, [-0.05, 0.30, 0]),
    // 목 — 몸통에서 머리로 좁아진다
    part(new CylinderGeometry(0.15, 0.22, 0.14, 14), WHITE, [0.34, 0.28, 0], [0, 0, -1.45]),
    part(new SphereGeometry(0.19, 14, 9), WHITE, [0.50, 0.28, 0]),
    /**
     * 코·귀·꼬리. **`[0.95,0.7,0.7]` 은 계수만 보면 대비가 있어 보이지만
     * 쥐 팔레트가 어두운 회색이라 곱하고 나면 0.04 다** — 화면에서는 몸통과
     * 똑같은 회색이었다. 이 형상이 자에 「팔레트를 곱해서 재라」를 가르쳐 준 것이다.
     * 쥐의 귀·코·발은 털이 없어 «살빛»이고, 어두운 털 위에서 확실히 밝다.
     */
    part(new ConeGeometry(0.085, 0.17, 8), PINK, [0.68, 0.24, 0], [0, 0, -Math.PI / 2]),
    // 큰 귀 둘 — 쥐는 귀가 실루엣이다
    part(new CylinderGeometry(0.14, 0.14, 0.04, 14), PINK, [0.46, 0.47, 0.15], LIE_Z),
    part(new CylinderGeometry(0.14, 0.14, 0.04, 14), PINK, [0.46, 0.47, -0.15], LIE_Z),
    // 꼬리
    part(new CylinderGeometry(0.02, 0.035, 0.42, 6), PINK, [-0.42, 0.16, 0], [0, 0, 0.7]),
    part(new SphereGeometry(0.07, 6, 4), PINK, [-0.05, 0.06, 0.20]),
    part(new SphereGeometry(0.07, 6, 4), PINK, [-0.05, 0.06, -0.20]),
    // 눈 — 어두운 털 위에서는 «검은 점»이 오히려 안 보인다. 흰 테를 두른다
    ...([1, -1] as const).map((k) =>
      part(new SphereGeometry(0.045, 6, 5), PINK, [0.60, 0.33, k * 0.09])),
  ]),

  골프공: () => assemble([
    /**
     * **딤플을 인쇄로 옮겼다.** 반지름 0.07 짜리 구 넷을 박아놨는데 계수가
     * `[0.85,0.85,0.85]` 라 대비가 0.05 였다 — 「전부 찍으면 폴리곤만 늘고
     * 안 보인다」고 적어놓고, 넷을 찍었는데도 안 보였다. 인쇄면 온 면에 다 찍힌다.
     */
    part(new SphereGeometry(0.5, 16, 10), WHITE, undefined, undefined, TILE.GOLF),
  ]),

  /**
   * 참새. **목이 있어야 새다.**
   *
   * 예전엔 머리 중심(x 0.28)이 몸통 타원체(x 반지름 0.39) **안**에 있어서
   * 두 구가 하나로 녹아 「깃털 달린 감자」였다. 머리를 몸통 밖으로 내고
   * 그 사이를 좁아지는 목으로 잇는다 — 목에서 굵기가 꺾이는 게 «단»이다.
   */
  참새: () => assemble([
    part(new SphereGeometry(0.30, 16, 10).scale(1.3, 1, 1), WHITE, [-0.02, 0.34, 0]),
    // 목 — 몸통(0.30)에서 머리(0.20)로 좁아진다
    part(new CylinderGeometry(0.16, 0.24, 0.16, 14), WHITE, [0.26, 0.46, 0], [0, 0, -0.55]),
    part(new SphereGeometry(0.20, 14, 9), WHITE, [0.42, 0.54, 0]),
    // 부리 — 밝게 갔더니 팔레트가 밝은 쪽이라 여전히 0.07 이었다. 참새 부리는
    // 원래 «뿔빛»으로 짙다 — 밝은 몸 위에서는 짙은 쪽이 답이다
    part(new ConeGeometry(0.075, 0.19, 8), [0.30, 0.22, 0.12], [0.60, 0.52, 0], [0, 0, -Math.PI / 2]),
    // 날개 둘 — 몸에 붙여 접은 상태
    part(new SphereGeometry(0.22, 12, 8).scale(1.2, 0.35, 0.6), WOOD, [-0.05, 0.38, 0.22]),
    part(new SphereGeometry(0.22, 12, 8).scale(1.2, 0.35, 0.6), WOOD, [-0.05, 0.38, -0.22]),
    part(new ConeGeometry(0.13, 0.30, 4).scale(1, 1, 0.4), WOOD, [-0.36, 0.32, 0], [0, 0, Math.PI / 2]),
    part(new CylinderGeometry(0.025, 0.025, 0.18, 6), [0.30, 0.22, 0.12], [0.02, 0.11, 0.08]),
    part(new CylinderGeometry(0.025, 0.025, 0.18, 6), [0.30, 0.22, 0.12], [0.02, 0.11, -0.08]),
  ]),

  페트병: () => assemble([
    // 몸통 + 어깨 + 목 + 뚜껑. 원작 동선의 "플라스틱 병"
    part(new CylinderGeometry(0.30, 0.30, 0.56, 20), GLASS, [0, 0.28, 0], undefined, TILE.PLASTIC),
    // SEAM-OK: 몸통과 어깨는 «한 장으로 성형된» 면이다. 페트병에는 그 자리에
    // 단이 없고, 병으로 읽히게 하는 건 아래 라벨(0.32)이 만드는 턱이다
    part(new CylinderGeometry(0.14, 0.30, 0.20, 20), GLASS, [0, 0.66, 0]),
    part(new CylinderGeometry(0.12, 0.12, 0.14, 14), GLASS, [0, 0.83, 0]),
    part(new CylinderGeometry(0.14, 0.14, 0.10, 14), WHITE, [0, 0.95, 0]),
    // 라벨 — 병은 라벨이 있어야 병으로 읽힌다
    part(new CylinderGeometry(0.32, 0.32, 0.22, 20), WHITE, [0, 0.30, 0]),
  ]),

  모종삽: () => assemble([
    part(new SphereGeometry(0.30, 16, 10).scale(1, 0.32, 0.7), METAL, [0.28, 0.06, 0]),
    part(new CylinderGeometry(0.05, 0.05, 0.34, 6), METAL, [-0.10, 0.10, 0], LIE_X),
    part(new CylinderGeometry(0.09, 0.07, 0.30, 7), WHITE, [-0.40, 0.10, 0], LIE_X, TILE.METAL),
  ]),

  // ── 버킷 4~5 (16~60cm) ────────────────────────────────────
  비둘기: () => assemble([
    // 이 동네의 이름이다. 참새보다 크고 목이 굵다
    part(new SphereGeometry(0.32, 16, 10).scale(1.4, 1, 1), WHITE, [-0.04, 0.36, 0]),
    part(new CylinderGeometry(0.16, 0.20, 0.20, 14), WHITE, [0.24, 0.56, 0]),
    part(new SphereGeometry(0.20, 12, 8), WHITE, [0.32, 0.70, 0], undefined, TILE.STRAW),
    part(new ConeGeometry(0.06, 0.18, 5), [0.85, 0.8, 0.75], [0.50, 0.68, 0], [0, 0, -Math.PI / 2]),
    part(new SphereGeometry(0.26, 16, 10).scale(1.3, 0.32, 0.55), [0.55, 0.6, 0.7], [-0.06, 0.42, 0.24]),
    part(new SphereGeometry(0.26, 16, 10).scale(1.3, 0.32, 0.55), [0.55, 0.6, 0.7], [-0.06, 0.42, -0.24]),
    part(new ConeGeometry(0.16, 0.34, 4).scale(1, 1, 0.35), [0.55, 0.6, 0.7], [-0.42, 0.34, 0], [0, 0, Math.PI / 2]),
    part(new CylinderGeometry(0.03, 0.03, 0.20, 6), [0.9, 0.45, 0.4], [0.0, 0.12, 0.09]),
    part(new CylinderGeometry(0.03, 0.03, 0.20, 6), [0.9, 0.45, 0.4], [0.0, 0.12, -0.09]),
  ]),

  삽: () => assemble([
    // 원작 동선의 삽. 자루가 길어서 최장축이 세로다
    part(new BoxGeometry(0.30, 0.36, 0.05), METAL, [0, 0.16, 0]),
    part(new ConeGeometry(0.17, 0.14, 4).scale(1, 1, 0.3), METAL, [0, -0.06, 0], [Math.PI, 0, 0]),
    part(new CylinderGeometry(0.045, 0.045, 0.86, 7), WOOD, [0, 0.74, 0]),
    // D자 손잡이
    part(new TorusGeometry(0.11, 0.03, 4, 8), WOOD, [0, 1.18, 0], LIE_Z, TILE.METAL),
  ]),

  개밥그릇: () => assemble([
    part(new CylinderGeometry(0.5, 0.36, 0.34, 20), WHITE, [0, 0.17, 0]),
    part(new CylinderGeometry(0.44, 0.30, 0.30, 20), DARK, [0, 0.22, 0]),
    part(new TorusGeometry(0.49, 0.04, 4, 20), WHITE, [0, 0.33, 0], LIE_Z, TILE.CERAMIC),
  ]),

  양동이: () => assemble([
    part(new CylinderGeometry(0.44, 0.34, 0.72, 20), WHITE, [0, 0.36, 0]),
    part(new CylinderGeometry(0.39, 0.30, 0.62, 20), DARK, [0, 0.40, 0]),
    part(new TorusGeometry(0.44, 0.035, 4, 20), METAL, [0, 0.72, 0], LIE_Z, TILE.METAL),
    // 손잡이 — 반원
    part(new TorusGeometry(0.44, 0.03, 4, 10, Math.PI), METAL, [0, 0.74, 0]),
  ]),

  모래성: () => assemble([
    // 원작 동선의 모래성. 원통 본체 + 탑 넷 + 총안
    part(new CylinderGeometry(0.42, 0.5, 0.52, 20), WHITE, [0, 0.26, 0]),
    ...[[0.34, 0.34], [-0.34, 0.34], [0.34, -0.34], [-0.34, -0.34]].map(
      ([x, z]) => part(new CylinderGeometry(0.13, 0.15, 0.34, 14), WHITE, [x!, 0.60, z!]),
    ),
    ...[[0.34, 0.34], [-0.34, 0.34], [0.34, -0.34], [-0.34, -0.34]].map(
      ([x, z]) => part(new ConeGeometry(0.16, 0.20, 7), WOOD, [x!, 0.86, z!], undefined, TILE.DIRT),
    ),
    part(new CylinderGeometry(0.30, 0.30, 0.22, 20), WHITE, [0, 0.62, 0]),
  ]),

  삼각콘: () => assemble([
    part(new BoxGeometry(0.72, 0.09, 0.72), WHITE, [0, 0.045, 0]),
    part(new ConeGeometry(0.28, 0.86, 8), WHITE, [0, 0.52, 0], undefined, TILE.PLASTIC),
    // 반사 띠 둘 — 이게 있어야 공사장 콘이다
    // 반사 띠 둘 — `PAPER`(대비 0.04)로는 콘과 안 갈린다. 반사 띠는 «흰색»이다
    part(new ConeGeometry(0.205, 0.14, 8), WRAP, [0, 0.60, 0]),
    part(new ConeGeometry(0.135, 0.10, 8), WRAP, [0, 0.78, 0]),
  ]),

  // ── 버킷 6 (60cm~1.2m) ────────────────────────────────────
  개: () => assemble([
    // 원작 MaS3에서 피해 다녀야 하는 그 개. 서 있는 자세
    part(new SphereGeometry(0.30, 20, 13).scale(1.7, 1, 1.05), WHITE, [-0.06, 0.56, 0]),
    part(new SphereGeometry(0.22, 20, 13), WHITE, [0.44, 0.70, 0]),
    part(soft(0.22, 0.14, 0.18, 0.45), WHITE, [0.62, 0.62, 0]),
    part(new SphereGeometry(0.05, 14, 9), DARK, [0.73, 0.64, 0], undefined, TILE.STRAW),
    // 늘어진 귀 둘
    part(new SphereGeometry(0.13, 20, 13).scale(0.5, 1.3, 0.8), WOOD, [0.42, 0.72, 0.20]),
    part(new SphereGeometry(0.13, 20, 13).scale(0.5, 1.3, 0.8), WOOD, [0.42, 0.72, -0.20]),
    // 다리 넷
    ...[[0.30, 0.17], [0.30, -0.17], [-0.34, 0.17], [-0.34, -0.17]].map(
      ([x, z]) => part(new CylinderGeometry(0.075, 0.065, 0.50, 20), WHITE, [x!, 0.25, z!]),
    ),
    // 치켜든 꼬리
    part(new CylinderGeometry(0.04, 0.06, 0.34, 14), WOOD, [-0.52, 0.72, 0], [0, 0, 0.9]),
  ]),
};
