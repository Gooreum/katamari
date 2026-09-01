import {
  BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { ShapeIdLarge } from './generation';
import { assemble, DARK, INK, METAL, part, SEG, WHITE, WOOD, WRAP, soft, lip,
} from './shapes.kit';
import { TILE } from './atlas';

const LIE_X: readonly [number, number, number] = [0, 0, Math.PI / 2];
const LIE_Z: readonly [number, number, number] = [Math.PI / 2, 0, 0];

/**
 * 버킷 6 (60cm~1.2m) 형태 — 원작 타케다 저택의 가구·동물.
 *
 * **집 맵에서 제일 큰 것들이다.** 예전 이 파일에는 승용차·전봇대 같은
 * 2.5~5m 물건이 있었는데, 그건 동네 맵의 크기다. 집 안에서 제일 큰 건
 * 서랍장·텔레비전이고 그게 1m 남짓이다.
 *
 * 7종뿐이라 종당 부품을 넉넉히 쓴다 — 이 크기에서는 실루엣만으로 안 되고
 * 다리·서랍·손잡이가 보여야 가구로 읽힌다.
 */
export const LARGE_BUILDERS: Record<ShapeIdLarge, () => BufferGeometry> = {
  고양이: () => assemble([
    /**
     * 웅크린 자세. **인쇄 타일을 구에서 뗐다.**
     * 근거: `.design-bounce/ref/고양이/` (위키미디어)
     *
     * 정답을 모르는 판정자가 이름은 맞히면서 근거에 「몸통은 **격자 무늬가 촘촘한
     * 큰 구체**」라고 적었다. `TILE.CLOTH` 가 구면 uv 에 감기면서 바둑판이 되어
     * 짠 바구니처럼 보인 것이다. 이름을 맞혀도 실물과 다르면 틀린 것이다.
     *
     * 인쇄는 **평평한 면에서만** 쓴다. 털은 무늬 대신 «가로 줄무늬 띠»로 만든다 —
     * 사진에서 줄무늬가 등과 옆구리를 가로로 감고 있다.
     */
    part(new SphereGeometry(0.30, 20, 13).scale(1.0, 0.92, 1.0), WHITE, [-0.10, 0.31, 0]),
    part(soft(0.44, 0.34, 0.34, 0.45), WHITE, [0.12, 0.30, 0]),
    /**
     * 줄무늬는 **뺐다.** 상자 셋을 등에 얹어 가로줄을 만들려 했는데, 구면 위에서
     * 상자는 어디선가 반드시 삐져나온다 — 판정자가 「등에 작은 **사각 돌기** 4개」로
     * 읽었다. 무늬를 «부품»으로 만들면 무늬가 아니라 혹이 된다.
     * 털무늬는 인쇄로 풀어야 할 문제이고, 구면 uv 에 감기는 인쇄는
     * 바둑판이 되므로(그게 앞의 결함이었다) 지금은 무지로 둔다.
     */
    /**
     * **목.** 검사는 통과했지만(머리가 몸통 밖에 있다) 화면에서는 몸통과 머리가
     * 「두 덩이」로 따로 놀았다 — 사이를 잇는 게 아무것도 없어서다.
     * 몸통(0.22)에서 머리(0.20)로 좁아지는 목이 둘을 한 마리로 묶는다.
     */
    part(new CylinderGeometry(0.15, 0.22, 0.18, SEG.MID), WHITE, [0.30, 0.44, 0], [0, 0, -0.7]),
    // 머리 + 귀 둘 + 코
    part(new SphereGeometry(0.22, SEG.MID, 9), WHITE, [0.44, 0.56, 0]),
    part(new ConeGeometry(0.09, 0.17, 5), WHITE, [0.38, 0.76, 0.11]),
    part(new ConeGeometry(0.09, 0.17, 5), WHITE, [0.38, 0.76, -0.11]),
    /**
      * 얼굴. **코 하나로는 얼굴이 안 된다** — 화면에서 「귀 달린 베이지 덩어리」였다.
      * 눈 둘 + 코 + 주둥이 넷이 있어야 이쪽이 «앞»인 걸 안다.
      */
    // 주둥이 — 고양이 팔레트는 살구·검정·흰색 셋이다. `WRAP` 은 밝은 둘에서 포화되고
    // 짙은 쪽은 검정에서 안 갈린다. **과반(살구·흰색)에서 도는 중간 톤**으로 간다
    part(new SphereGeometry(0.10, SEG.SMALL, 7).scale(1, 0.8, 1.25), [0.55, 0.46, 0.42],
      [0.60, 0.50, 0]),
    part(new SphereGeometry(0.05, SEG.TINY, 5), [0.92, 0.48, 0.55], [0.66, 0.53, 0]),
    ...([1, -1] as const).map((k) =>
      part(new SphereGeometry(0.055, SEG.TINY, 5), INK, [0.58, 0.62, k * 0.10])),
    // 귀 «안». 짙어야 귀가 두 겹으로 읽힌다
    ...([1, -1] as const).map((k) =>
      part(new ConeGeometry(0.05, 0.11, SEG.TINY), [0.86, 0.52, 0.52], [0.40, 0.755, k * 0.11])),
    // 앞다리 둘
    ...([0.12, -0.12] as const).map((z) =>
      part(new CylinderGeometry(0.07, 0.07, 0.26, SEG.SMALL), WHITE, [0.34, 0.13, z])),
    // 몸을 감은 꼬리
    part(new TorusGeometry(0.22, 0.05, 4, 10, Math.PI * 1.2), WHITE, [-0.10, 0.10, 0], LIE_Z),
  ]),

  의자: () => assemble([
    // 등받이 있는 나무 의자. 다리 넷이 보여야 의자다
    part(soft(0.62, 0.08, 0.58, 0.3), WHITE, [0, 0.52, 0], undefined, TILE.WOOD_C),
    part(soft(0.62, 0.60, 0.08, 0.3), WHITE, [0, 0.82, -0.25], undefined, TILE.WOOD_C),
    part(soft(0.52, 0.08, 0.06, 0.3), WHITE, [0, 0.66, -0.25]),
    part(soft(0.07, 0.52, 0.07, 0.3), WOOD, [0.26, 0.26, 0.24]),
    part(soft(0.07, 0.52, 0.07, 0.3), WOOD, [-0.26, 0.26, 0.24]),
    part(soft(0.07, 0.52, 0.07, 0.3), WOOD, [0.26, 0.26, -0.24]),
    part(soft(0.07, 0.52, 0.07, 0.3), WOOD, [-0.26, 0.26, -0.24]),
  ]),

  스툴: () => assemble([
    // 등받이 없는 둥근 걸상. 의자와 실루엣이 달라야 둘 다 두는 의미가 있다
    part(new CylinderGeometry(0.34, 0.34, 0.10, 20), WHITE, [0, 0.55, 0], undefined, TILE.WOOD_C),
    part(new CylinderGeometry(0.30, 0.30, 0.06, 20), WHITE, [0, 0.62, 0]),
    part(new CylinderGeometry(0.05, 0.06, 0.52, 20), WOOD, [0.20, 0.26, 0.20], [0.06, 0, -0.06], TILE.WOOD_C),
    part(new CylinderGeometry(0.05, 0.06, 0.52, 20), WOOD, [-0.20, 0.26, 0.20], [0.06, 0, 0.06]),
    part(new CylinderGeometry(0.05, 0.06, 0.52, 20), WOOD, [0.20, 0.26, -0.20], [-0.06, 0, -0.06]),
    part(new CylinderGeometry(0.05, 0.06, 0.52, 20), WOOD, [-0.20, 0.26, -0.20], [-0.06, 0, 0.06]),
    // 가로대 — 다리만 넷이면 허공에 뜬 판으로 보인다
    part(new CylinderGeometry(0.025, 0.025, 0.40, 14), WOOD, [0, 0.16, 0.20], LIE_X),
    part(new CylinderGeometry(0.025, 0.025, 0.40, 14), WOOD, [0, 0.16, -0.20], LIE_X),
  ]),

  /**
   * 브라운관 TV — **실물 사진을 보고 다시 만들었다.**
   * 근거: `.design-bounce/ref/텔레비전/` (위키미디어)
   *
   * 정답을 모르는 판정자가 근거에 「검은 상자 앞면에 **큰 검은 사각 패널**」이라고
   * 적었다. 이름은 맞혔지만 화면과 캐비닛이 한 덩어리라는 뜻이다.
   *
   * 사진에서 확인한 둘:
   *   ① **꺼진 화면은 검정이 아니라 옅은 회녹색이다.** 검정 캐비닛에 검정 화면을
   *      넣으면 안테나만 남는다. 팔레트를 검정(5)에서 나무(7)로 옮기고
   *      화면을 «밝은» 쪽으로 보낸다 — 정점색이 곱하는 계수라 나무 위에서
   *      회녹색을 만들려면 파랑 계수가 1을 크게 넘어야 한다
   *   ② **화면은 앞판의 71%만 차지한다.** 나머지 오른쪽은 튜너 다이얼과
   *      세로살 스피커망이 있는 조작판 «기둥»이다. 앞판을 화면으로 다 덮으면
   *      옛날 텔레비전이 아니라 요즘 모니터가 된다
   */
  텔레비전: () => assemble([
    // 캐비닛 — 나뭇결. 브라운관 TV 는 나무 상자다
    part(soft(0.86, 0.66, 0.62, 0.14), WHITE, [0, 0.42, 0], undefined, TILE.WOOD_C),
    // 검은 베젤 — 화면이 이 «안쪽»으로 움푹 들어가야 유리로 읽힌다
    part(new BoxGeometry(0.60, 0.54, 0.035), [0.26, 0.27, 0.30], [-0.10, 0.44, 0.315],
      undefined, TILE.PANEL),
    /**
     * 화면 유리. 나무 팔레트(0.60, 0.42, 0.25)에 이 계수를 곱하면
     * (0.73, 0.79, 0.75) — 옅은 회녹색이 된다. 사진의 꺼진 브라운관 색이다.
     */
    part(new BoxGeometry(0.52, 0.46, 0.03), [1.22, 1.88, 3.00], [-0.10, 0.44, 0.336],
      undefined, TILE.SCREEN),
    /**
     * 오른쪽 조작판 기둥. 사진에서 앞판의 29%를 차지하고 화면과 «세로로 갈린다».
     * 황동빛이라 캐비닛보다 밝고 노랗다.
     */
    part(new BoxGeometry(0.19, 0.54, 0.028), [1.34, 1.42, 0.92], [0.30, 0.44, 0.316],
      undefined, TILE.PANEL),
    // 튜너 다이얼 — 눈금 링이 둘린 원형 손잡이. 기둥 «위쪽»에 하나뿐이다
    part(new CylinderGeometry(0.072, 0.072, 0.03, 12), [1.55, 1.62, 1.05],
      [0.30, 0.60, 0.336], LIE_Z, TILE.PANEL),
    part(new CylinderGeometry(0.030, 0.030, 0.045, 8), INK, [0.30, 0.60, 0.345], LIE_Z),
    /**
     * 스피커망 — **촘촘한 세로살**이다. 사진에서 다이얼 아래를 길게 채운다.
     * 살 다섯이면 「망」으로 읽히고 삼각형도 안 늘어난다.
     */
    ...([-0.064, -0.032, 0, 0.032, 0.064] as const).map((dx) =>
      part(new BoxGeometry(0.012, 0.30, 0.012), INK, [0.30 + dx, 0.33, 0.330])),
    /**
     * 안테나. 팔레트를 검정에서 «나무»로 옮겼으므로 계수도 같이 바꾼다 —
     * `SHINE`(2.6, 2.55, 2.4)을 나무(0.60, 0.42, 0.25)에 곱하면 주황빛으로 포화된다.
     * 파랑 쪽을 더 올려 은색으로 뺀다: (0.60, 0.42, 0.25) × 아래 = (0.99, 0.97, 0.90)
     */
    ...([[0.16, 0.3], [-0.16, -0.3]] as const).map(([x, rz]) =>
      part(new CylinderGeometry(0.022, 0.016, 0.52, 6), [1.65, 2.30, 3.60],
        [x, 0.98, -0.16], [0.3, 0, rz])),
    part(soft(0.10, 0.14, 0.10, 0.3), WHITE, [0.30, 0.05, 0.20]),
    part(soft(0.10, 0.14, 0.10, 0.3), WHITE, [-0.30, 0.05, 0.20]),
  ]),

  서랍장: () => assemble([
    // 3단 나무 서랍장. 손잡이가 서랍을 서랍으로 만든다
    part(soft(0.82, 0.94, 0.46, 0.1), WHITE, [0, 0.50, 0], undefined, TILE.WOOD_C),
    part(soft(0.86, 0.06, 0.50, 0.35), WHITE, [0, 1.00, 0]),
    for3Drawers(0.78),
    for3Drawers(0.50),
    for3Drawers(0.22),
    part(soft(0.12, 0.10, 0.06, 0.3), WOOD, [0, 0.06, 0.22]),
  ].flat()),

  /**
   * 갓 달린 스탠드. 갓과 가는 기둥이 실루엣이다.
   *
   * **갓을 좁혔다 (지름 0.68 → 0.46).** 예전 갓은 «키의 57%» 였는데 실물 플로어
   * 스탠드는 27% 쯤이다. 그 차이가 화면이 아니라 **충돌 상자**에서 터졌다 —
   * 손배치 스탠드(size 1.20)의 AABB 가 0.83m 라
   *   ① 거실 동벽 안쪽 면(x 2.63)을 **0.21m 뚫고** 나갔고
   *   ② `spot-shelf-front`(책장 앞 책 10권)를 **통째로 덮어** 공이 못 닿았다.
   * 둘 다 화면으로는 안 보이는 결함이고, `buildBlocked` 가 손배치 발판을 보게
   * 되면서 처음 드러났다.
   */
  스탠드: () => assemble([
    part(new CylinderGeometry(0.22, 0.22, 0.06, 20), WHITE, [0, 0.03, 0], undefined, TILE.CLOTH),
    part(new CylinderGeometry(0.035, 0.035, 0.62, 10), METAL, [0, 0.35, 0]),
    part(new CylinderGeometry(0.23, 0.14, 0.36, 20), WHITE, [0, 0.82, 0], undefined, TILE.CLOTH),
    // 갓 안쪽 — 밝게 둬야 불이 켜진 것처럼 보인다
    // 갓 «안». 불이 켜져 있으니 바깥보다 훨씬 밝아야 한다 — `[1,0.95,0.75]` 는
    // 갓 천과 대비가 0.04 라 그냥 같은 색이었다
    // 갓 «안» — 바닥면이 갓 아래 테와 같은 평면이면 z-fighting 이다. 살짝 위로
    part(new CylinderGeometry(0.20, 0.12, 0.04, 20), WRAP, [0, 0.685, 0]),
    part(new SphereGeometry(0.09, 14, 9), WRAP, [0, 0.72, 0], undefined, TILE.METAL),
    // 갓 위아래 테. **갓의 윤곽을 그리는 건 천이 아니라 이 테다** —
    // 원뿔대 하나만 있으면 옆에서 사다리꼴 색면으로 보인다.
    // `PAPER`(대비 0.05)를 짙은 쪽으로 바꿔야 그 윤곽이 실제로 그려진다
    part(new TorusGeometry(0.228, 0.018, 6, 20), [0.52, 0.48, 0.42], [0, 0.64, 0], LIE_Z),
    part(new TorusGeometry(0.138, 0.016, 6, 14), [0.52, 0.48, 0.42], [0, 1.00, 0], LIE_Z),
  ]),

  물뿌리개: () => assemble([
    // 뒷마당 것. 긴 주둥이와 장미꼭지가 실루엣의 전부다
    part(new CylinderGeometry(0.30, 0.34, 0.56, 20), WHITE, [0, 0.30, 0], undefined, TILE.METAL),
    // 말린 테두리 — 양철 물뿌리개는 입이 말려 있다. 없으면 몸통과 어깨가 한 덩어리다
    part(lip(0.30, 0.030, 20), WHITE, [0, 0.595, 0]),
    part(new CylinderGeometry(0.24, 0.28, 0.10, 20), WHITE, [0, 0.66, 0]),
    part(new CylinderGeometry(0.11, 0.11, 0.10, 20), DARK, [0, 0.74, 0]),
    // 주둥이 — 아래에서 위로 뻗는다
    part(new CylinderGeometry(0.06, 0.08, 0.74, 20), WHITE, [0.40, 0.48, 0], [0, 0, -0.7]),
    part(new CylinderGeometry(0.14, 0.06, 0.10, 20), WHITE, [0.66, 0.70, 0], [0, 0, -0.7]),
    // 손잡이 둘
    part(new TorusGeometry(0.20, 0.04, 4, 10, Math.PI), WHITE, [-0.28, 0.62, 0], [0, Math.PI / 2, 0.4], TILE.METAL),
    part(new TorusGeometry(0.16, 0.04, 4, 10, Math.PI), WHITE, [0, 0.74, 0], [0, Math.PI / 2, 0]),
  ]),
};

/**
 * 서랍 한 단 — 앞판 + 손잡이 둘.
 *
 * 세 단이 같은 구성이라 함수로 뺀다. `assemble` 은 평평한 배열을 받으므로
 * 호출부에서 `.flat()` 한다.
 */
function for3Drawers(y: number) {
  return [
    part(new BoxGeometry(0.70, 0.24, 0.03), WOOD, [0, y, 0.235]),
    part(new CylinderGeometry(0.045, 0.045, 0.06, 14), METAL, [0.18, y, 0.27], LIE_Z),
    part(new CylinderGeometry(0.045, 0.045, 0.06, 14), METAL, [-0.18, y, 0.27], LIE_Z),
  ];
}
