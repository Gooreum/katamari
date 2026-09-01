import {
  BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { ShapeIdSmall } from './generation';
import {
  assemble, DARK, GLASS, INK, METAL, PAPER, part, WHITE, WRAP, soft,
  type RGB,
} from './shapes.kit';
import { TILE } from './atlas';

/** 눕힌 원기둥을 만들 때 쓰는 회전. 원기둥 축은 Y라 Z로 90° 돌리면 X축이 된다. */
const LIE_X: readonly [number, number, number] = [0, 0, Math.PI / 2];
/** X축에 눕힌 원기둥의 뚜껑을 +X 쪽 바깥으로 향하게 하는 회전 */
const CAP_X: readonly [number, number, number] = [0, 0, -Math.PI / 2];

/**
 * 침·핀의 강철. `METAL`(0.72)보다 짙다 — 압정·압핀 머리는 팔레트가 색색이라
 * 0.72 로는 대비가 0.08 밖에 안 나서 침이 머리와 한 덩어리로 뭉쳤다.
 */
const PIN: RGB = [0.42, 0.44, 0.50];

/**
 * 버킷 0~2 (1~8cm) 형태 — 원작 타케다 저택 물건.
 *
 * **작은 물체에 부품을 많이 쓰지 않는다.** 개미와 쌀알은 화면에서 몇 픽셀이고,
 * 49종을 다 채우면 이 파일의 21종이 전체 물체의 절반 가까이를 차지한다.
 * 여기서 아낀 삼각형이 고양이·서랍장의 예산이 된다.
 *
 * 치수는 **실제 크기(cm 감각)** 로 쓴다 — normalize()가 어차피 규약에 맞추므로
 * 0~1로 환산할 필요가 없고, 그러면 비율이 눈에 안 보인다.
 */
export const SMALL_BUILDERS: Record<ShapeIdSmall, () => BufferGeometry> = {
  // ─── 버킷 0 (1~2cm) ──────────────────────────────────────────

  개미: () => assemble([
    /**
     * 머리·가슴·배 세 마디 + 뻗은 다리. **세 마디가 붙으면 검은 덩어리 둘**이다 —
     * 화면에서 실제로 그랬다. 마디 사이를 벌리고 가슴을 제일 가늘게 해서
     * «허리»를 만든다. 그게 개미를 개미로 만드는 유일한 선이다.
     */
    part(new SphereGeometry(0.19, 8, 6), WHITE, [0.42, 0.21, 0]),
    part(new SphereGeometry(0.12, 8, 6).scale(1.4, 1, 1), WHITE, [0.12, 0.20, 0]),
    part(new SphereGeometry(0.27, 8, 6).scale(1.15, 0.95, 1), WHITE, [-0.32, 0.23, 0]),
    /**
     * 다리 — 몸 «밖으로» 뻗는다. 예전엔 몸통 밑에 깐 판이라 실루엣이 안 바뀌었다.
     * 여섯을 따로 세우면 이 크기에서 삼각형만 먹으므로 좌우 한 장씩으로 뭉친다.
     */
    ...([1, -1] as const).map((k) => part(
      new BoxGeometry(0.62, 0.035, 0.10), INK, [0.06, 0.11, k * 0.26], [0, 0, 0], )),
    // 더듬이 둘 — 머리 «앞으로». 개미와 콩을 가르는 게 이 둘이다
    ...([1, -1] as const).map((k) => part(
      new CylinderGeometry(0.022, 0.016, 0.30, 6), INK,
      [0.58, 0.31, k * 0.07], [0, 0, -0.9])),
  ]),

  쌀알: () => assemble([
    /**
     * **길고 가늘어야 한다.** 예전 반지름 0.17 은 통통해서 알약으로 보였다.
     * 그리고 쌀알에는 **세로 홈**이 하나 있다 — 그 선 하나가 「낟알」을 만든다.
     */
    part(new CylinderGeometry(0.13, 0.13, 0.60, 8), WHITE, [0, 0.13, 0], LIE_X),
    part(new ConeGeometry(0.13, 0.24, 8), WHITE, [0.42, 0.13, 0], CAP_X),
    part(new ConeGeometry(0.13, 0.20, 8), WHITE, [-0.40, 0.13, 0], LIE_X),
    // 배 쪽 홈. 몸통보다 짙어야 «파인 선»으로 읽힌다
    part(new BoxGeometry(0.66, 0.035, 0.05), [0.74, 0.71, 0.64], [0, 0.13, 0.115]),
  ]),

  팥: () => assemble([
    /**
     * 팥은 구가 아니라 **길쭉한 타원**이다. 그리고 옆구리에 흰 배꼽줄(제)이 있다 —
     * 팥과 콩을 가르는 건 그 줄 하나인데, 예전 계수 `[0.9,0.88,0.82]` 는
     * 팔레트를 곱하면 몸통과 **대비 0.10** 이라 화면에서 안 보였다.
     * 1을 넘는 `WRAP` 으로 바꾸고 몸통 밖으로 살짝 튀어나오게 한다.
     */
    part(new SphereGeometry(0.5, 12, 8).scale(1.0, 0.78, 0.72), WHITE, [0, 0.39, 0]),
    part(new BoxGeometry(0.74, 0.11, 0.09), WRAP, [0, 0.39, 0.345]),
  ]),

  클립: () => assemble([
    /**
     * 겹친 고리 둘. **원이 아니라 «길쭉한» 고리**다 — 종이 클립은 늘어난 모양이고,
     * 정원 두 개를 겹치면 안경이 된다. 그리고 관 굵기 0.035 에 4분할이라
     * 화면에서 실오라기였다. 굵히고 8분할로 올린다.
     */
    part(new TorusGeometry(0.30, 0.055, 8, 16).scale(1.55, 1, 1), METAL,
      [0.08, 0.055, 0], [Math.PI / 2, 0, 0]),
    // 안쪽 고리 — 바깥보다 «짙게». 같은 METAL 이면 두 겹이 한 덩어리로 뭉친다
    part(new TorusGeometry(0.19, 0.050, 8, 14).scale(1.55, 1, 1), [0.44, 0.46, 0.52],
      [-0.10, 0.055, 0], [Math.PI / 2, 0, 0]),
    part(new CylinderGeometry(0.050, 0.050, 0.34, 8), METAL, [0.06, 0.055, 0.235], LIE_X),
  ]),

  압정: () => assemble([
    /**
     * 넓은 머리 + 짧은 침. **침을 굵히고 짙게 했다** — `METAL`(0.72)은 색색인
     * 압정 머리 팔레트 위에서 대비가 0.08 이라 화면에서 머리와 한 덩어리였다.
     * 머리 테두리 홈도 하나 넣는다. 압정은 위에서 보면 그 링이 먼저 보인다.
     */
    part(new CylinderGeometry(0.5, 0.46, 0.16, 20), WHITE, [0, 0.42, 0]),
    part(new TorusGeometry(0.44, 0.035, 6, 20), PIN, [0, 0.48, 0], [Math.PI / 2, 0, 0]),
    part(new CylinderGeometry(0.075, 0.075, 0.36, 8), PIN, [0, 0.17, 0]),
    part(new ConeGeometry(0.075, 0.12, 8), PIN, [0, 0.05, 0], [Math.PI, 0, 0]),
  ]),

  단추: () => assemble([
    /**
     * 구멍 넷 + 테두리 홈. **구멍이 판 밑면까지 뚫고 나가 있었다** —
     * 원기둥 밑면이 단추 밑면과 «같은 평면»이라 z-fighting 이 넷 났다(자가 잡았다).
     * 구멍을 판 «안»에 가두고, 대신 지름을 키워 화면에서 보이게 한다.
     */
    part(new CylinderGeometry(0.5, 0.5, 0.14, 20), WHITE, [0, 0.07, 0], undefined, TILE.BUTTON),
    // 구멍 넷 — **판 «안»에 가둔다.** 밑면까지 뚫으면 단추 밑면과 같은 평면이 돼서
    // z-fighting 이 넷 난다(자가 잡았다). 파인 깊이는 인쇄가 이어서 그려 준다
    ...([[0.17, 0.17], [-0.17, 0.17], [0.17, -0.17], [-0.17, -0.17]] as const).map(
      ([x, z]) => part(new CylinderGeometry(0.095, 0.095, 0.09, 8), INK, [x, 0.075, z])),
  ]),

  도장: () => assemble([
    /**
     * 나무 몸통 + 붉은 인면 + **손가락 홈**. 예전엔 매끈한 원기둥이라
     * 화면에서 그냥 막대였다. 가운데를 잘록하게 하면 「쥐는 것」이 된다.
     */
    part(new CylinderGeometry(0.22, 0.22, 0.34, 14), WHITE, [0, 0.21, 0]),
    part(new CylinderGeometry(0.185, 0.185, 0.26, 14), [0.72, 0.62, 0.48], [0, 0.51, 0]),
    part(new CylinderGeometry(0.22, 0.22, 0.30, 14), WHITE, [0, 0.79, 0]),
    // 인면 — 붉은 인주가 묻은 쪽. 여기가 도장의 정체다
    part(new CylinderGeometry(0.245, 0.245, 0.10, 14), [0.85, 0.30, 0.26], [0, 0.05, 0]),
    part(new CylinderGeometry(0.19, 0.22, 0.09, 14), WRAP, [0, 0.955, 0]),
  ]),

  // ─── 버킷 1 (2~4cm) ──────────────────────────────────────────

  주사위: () => assemble([
    // **눈을 인쇄로 새긴다.** 예전엔 원기둥 셋을 박아 윗면 1점·앞면 2점만 냈다 —
    // 나머지 네 면은 민짜였고, 그 셋이 삼각형 예산의 절반을 먹었다.
    // 아틀라스 한 칸이 여섯 면을 다 덮으면서 부품이 하나로 준다.
    part(soft(0.9, 0.9, 0.9, 0.12), WHITE, [0, 0.45, 0], undefined, TILE.DICE),
  ]),

  나사: () => assemble([
    /**
     * 십자 머리 + 몸통. 나사산은 안 판다 — 3cm 에서 안 보인다.
     * **십자의 두 번째 막대를 얇게 한다** — 같은 높이면 겹치는 자리에서
     * 위·아랫면이 같은 평면이라 z-fighting 이 뜬다(자가 `1×2` 로 잡았다).
     */
    part(new CylinderGeometry(0.22, 0.20, 0.12, 14), WHITE, [0, 0.92, 0]),
    part(new BoxGeometry(0.34, 0.06, 0.08), INK, [0, 0.965, 0]),
    part(new BoxGeometry(0.08, 0.045, 0.34), INK, [0, 0.965, 0]),
    part(new CylinderGeometry(0.09, 0.09, 0.76, 8), WHITE, [0, 0.50, 0]),
    part(new ConeGeometry(0.09, 0.14, 8), WHITE, [0, 0.07, 0], [Math.PI, 0, 0]),
  ]),

  압핀: () => assemble([
    // 손잡이가 위로 솟은 압핀. 압정과 실루엣이 달라야 둘 다 두는 의미가 있다
    part(new CylinderGeometry(0.26, 0.30, 0.34, 20), WHITE, [0, 0.72, 0]),
    part(new CylinderGeometry(0.34, 0.34, 0.12, 20), WHITE, [0, 0.50, 0]),
    part(new CylinderGeometry(0.05, 0.05, 0.40, 8), PIN, [0, 0.24, 0]),
    part(new ConeGeometry(0.05, 0.10, 8), PIN, [0, 0.045, 0], [Math.PI, 0, 0]),
  ]),

  지우개: () => assemble([
    // 모서리가 닳은 직육면체 + 종이 띠. 띠가 있어야 지우개로 읽힌다.
    // **그 띠를 인쇄로 바꿨다** — PAPER 계수는 본체 대비 1.2:1 이라
    // 「띠가 있어야 읽힌다」고 적어놓고 실제로는 안 보이고 있었다.
    part(soft(0.94, 0.36, 0.44, 0.2), WHITE, [0, 0.18, 0]),
    part(soft(0.52, 0.38, 0.46, 0.16), WHITE, [0.04, 0.18, 0], undefined, TILE.ERASER),
    part(new BoxGeometry(0.20, 0.30, 0.40), WHITE, [-0.50, 0.15, 0], [0, 0, 0.22]),
  ]),

  각설탕: () => assemble([
    // 정육면체 하나. 알갱이 결을 살짝만 낸다
    part(soft(0.86, 0.80, 0.86, 0.16), WHITE, [0, 0.40, 0]),
    part(soft(0.30, 0.10, 0.30, 0.3), WHITE, [0.18, 0.82, -0.14], [0, 0.4, 0]),
    part(soft(0.22, 0.10, 0.22, 0.3), WHITE, [-0.22, 0.80, 0.18], [0, 0.9, 0]),
  ]),

  사탕: () => assemble([
    // 알맹이 + 양쪽으로 꼬인 포장지. 이 실루엣이 사탕의 전부다
    part(new SphereGeometry(0.34, 16, 10), WHITE, [0, 0.34, 0]),
    part(new ConeGeometry(0.30, 0.30, 6), PAPER, [0.44, 0.34, 0], CAP_X),
    part(new ConeGeometry(0.30, 0.30, 6), PAPER, [-0.44, 0.34, 0], LIE_X),
  ]),

  성냥: () => assemble([
    part(soft(0.92, 0.06, 0.06, 0.35), WHITE, [0, 0.03, 0]),
    // 빨간 머리. 성냥과 이쑤시개를 가르는 유일한 부품이다
    part(new SphereGeometry(0.075, 6, 4), [0.86, 0.28, 0.22], [0.47, 0.05, 0]),
  ]),

  // ─── 버킷 2 (4~8cm) ──────────────────────────────────────────

  크레용: () => assemble([
    // 몸통 + 종이 라벨 + 깎인 끝. 원작 크레용은 색이 곧 정체성이라
    // SHAPE_COLOR 에 6색을 넣어뒀다
    part(new CylinderGeometry(0.14, 0.14, 0.74, 14), WHITE, [-0.08, 0.14, 0], LIE_X),
    part(new CylinderGeometry(0.152, 0.152, 0.46, 14), PAPER, [-0.14, 0.14, 0], LIE_X),
    part(new ConeGeometry(0.14, 0.24, 9), WHITE, [0.41, 0.14, 0], CAP_X),
  ]),

  캐러멜: () => assemble([
    // 포장지에 싸인 직육면체. 양끝을 접어 눌렀다
    part(soft(0.62, 0.34, 0.40, 0.25), WHITE, [0, 0.17, 0]),
    part(soft(0.18, 0.20, 0.40, 0.25), PAPER, [0.38, 0.11, 0]),
    part(soft(0.18, 0.20, 0.40, 0.25), PAPER, [-0.38, 0.11, 0]),
  ]),

  체온계: () => assemble([
    // 유리 막대 + 은색 구슬. 원작 집 서랍에 있는 그것
    part(new CylinderGeometry(0.055, 0.055, 0.80, 7), GLASS, [0.06, 0.06, 0], LIE_X),
    part(new SphereGeometry(0.085, 7, 5), METAL, [-0.40, 0.06, 0]),
    part(new BoxGeometry(0.60, 0.02, 0.06), [0.9, 0.2, 0.18], [0.08, 0.10, 0]),
  ]),

  '간장 팩': () => assemble([
    // 도시락에 들어 있는 물고기 모양 간장통. 원작에도 있다
    part(new SphereGeometry(0.24, 12, 8), WHITE, [0, 0.16, 0]),
    part(new ConeGeometry(0.20, 0.34, 7), WHITE, [0.34, 0.16, 0], CAP_X),
    part(new ConeGeometry(0.16, 0.22, 5), WHITE, [-0.30, 0.16, 0], LIE_X),
    part(new CylinderGeometry(0.07, 0.07, 0.12, 6), [0.9, 0.5, 0.2], [0.50, 0.16, 0], LIE_X),
  ]),

  청개구리: () => assemble([
    // 몸통 + 눈 둘 + 접힌 뒷다리. 원작 마당에 있는 그 개구리(7.4cm)
    part(new SphereGeometry(0.34, 16, 10), WHITE, [0, 0.28, 0]),
    part(new SphereGeometry(0.20, 12, 8), WHITE, [0.24, 0.34, 0]),
    part(new SphereGeometry(0.09, 6, 4), [0.95, 0.9, 0.3], [0.32, 0.46, 0.13]),
    part(new SphereGeometry(0.09, 6, 4), [0.95, 0.9, 0.3], [0.32, 0.46, -0.13]),
    part(new SphereGeometry(0.14, 12, 8), WHITE, [-0.20, 0.16, 0.24]),
    part(new SphereGeometry(0.14, 12, 8), WHITE, [-0.20, 0.16, -0.24]),
  ]),

  성냥갑: () => assemble([
    // 서랍이 살짝 빠진 갑. 빠진 단이 있어야 상자가 아니라 성냥갑이다
    part(soft(0.86, 0.24, 0.56, 0.16), WHITE, [0, 0.12, 0], undefined, TILE.MATCHBOX),
    part(soft(0.34, 0.20, 0.52, 0.16), PAPER, [0.52, 0.11, 0]),
    // 옆면 마찰지
    part(new BoxGeometry(0.86, 0.16, 0.02), DARK, [0, 0.12, 0.285]),
  ]),

  건전지: () => assemble([
    part(new CylinderGeometry(0.28, 0.28, 0.86, 20), WHITE, [0, 0.43, 0], undefined, TILE.BATTERY),
    // +극 돌기. 이거 하나로 건전지가 된다
    part(new CylinderGeometry(0.10, 0.10, 0.08, 7), METAL, [0, 0.89, 0]),
    part(new CylinderGeometry(0.285, 0.285, 0.10, 20), METAL, [0, 0.06, 0]),
  ]),

  화투: () => assemble([
    // 흩어진 낱장 석 장 (5.5cm). **겹쳐야 카드로 읽힌다** — 한 장이면 그냥 얇은 판이다.
    // 원작 거실 바닥에 이렇게 흩어져 있고, 공에 붙으면 납작한 면이 밖으로 선다.
    part(new BoxGeometry(0.62, 0.03, 0.96), WHITE, [0, 0.015, 0], undefined, TILE.CARD),
    part(new BoxGeometry(0.62, 0.03, 0.96), WHITE, [0.10, 0.045, 0.06], [0, 0.32, 0], TILE.CARD),
    part(new BoxGeometry(0.62, 0.03, 0.96), WHITE, [-0.08, 0.075, -0.05], [0, -0.18, 0], TILE.CARD),
  ]),
};
