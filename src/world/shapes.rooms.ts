import {
  BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { ShapeIdRooms } from './generation';
import {
  assemble, DARK, hollow, INK, invert, METAL, part, SEG, soft, warp, WHITE, WOOD,
  type Part, type RGB,
} from './shapes.kit';
import { TILE } from './atlas';

/** X축으로 돌린 원기둥·토러스 — 축이 Z가 된다 */
const LIE_Z: readonly [number, number, number] = [Math.PI / 2, 0, 0];
/** 눕힌 원기둥. 원기둥 축은 Y라 Z로 90° 돌리면 X축이 된다 */
const LIE_X: readonly [number, number, number] = [0, 0, Math.PI / 2];

/** 욕조 굽 높이. 통을 이만큼 «들어 올려» 밑면이 굽과 같은 평면이 되지 않게 한다 */
const TUB_LIFT = 0.06;

/**
 * **파인 «사각» 통.** 개수통 · 욕조 · 변기통 · 세면대야가 이걸 쓴다.
 *
 * `shapes.kit.ts` 의 `hollow()` 는 원기둥이라 네모난 통을 못 만든다. 수법은 같다 —
 * 안쪽 벽을 `scale(-1, 1, 1)` 로 뒤집어야 «안»이 보인다. 인스턴스 머티리얼이
 * `FrontSide` 라 안 뒤집으면 통째로 컬링돼서 통 바닥이 뚫려 보인다.
 *
 * 벽 넷을 따로 세우는 대신 **바깥 상자 + 뒤집은 안쪽 상자 + 바닥**으로 만든다.
 * 뒤집은 상자는 여섯 면이 전부 «안»을 보므로 위쪽 면이 뚜껑처럼 남는데,
 * 그 면은 통 입구보다 위에 있어서 안 보인다.
 *
 * @param w·d  바깥 가로·세로   @param h 깊이   @param wall 벽 두께
 * @param inner 안쪽 색 — 바깥보다 어두워야 «파였다»가 읽힌다
 */
export function basin(
  w: number, d: number, h: number, wall: number, inner: RGB, rgb: RGB = WHITE,
  /** 바깥 벽 넷이 물 인쇄 칸. 통은 화면에서 넓은 면이라 재질이 붙어야 한다 */
  tile: number = TILE.BLANK,
): Part[] {
  /**
   * **겹면 4mm.** 뒤집은 안쪽 통의 옆면이 바깥 벽의 «안쪽 면»과 **좌표까지 같았다.**
   *
   *   세면대 basin(0.54, 0.44, 0.16, 0.045)
   *     바깥 +X 벽의 안쪽 면    x = (0.54−0.045)/2 − 0.045/2 = 0.225
   *     안쪽 통(뒤집힘)의 +X 면  x = (0.54 − 0.045·2)/2      = 0.225
   *
   * 둘 다 통 «안»을 보므로 후면 컬링이 하나도 안 걸러준다. 깊이값이 같으니
   * 픽셀마다 어느 쪽이 이길지 갈리고, 화면에서는 **격자무늬로 갈라진 도기**다.
   * 사용자가 「세면대는 그냥 다 깨져있다」라고 한 것이 이것이고, 욕조·싱크대의
   * 안쪽 벽에도 같은 무늬가 떠 있었다.
   *
   * 안쪽 통을 4mm «안»으로 넣고 바닥판을 4mm «위»로 올린다. 보는 사람은 통 안에
   * 있으므로 더 가까운 면이 이기고, 바깥 벽의 안쪽 면은 그 뒤에 숨는다.
   * (`Math.max(_, wall)` 이 남아 있어 얇은 통에서 뒤집힐 일은 없다.)
   */
  const SKIN = 0.004;
  const iw = Math.max(w - wall * 2 - SKIN * 2, wall);
  const id = Math.max(d - wall * 2 - SKIN * 2, wall);
  /**
   * **캐비티 높이가 `h - wall` 이다.** 처음엔 `h` 로 두고 `wall` 만큼 올려놨는데,
   * 그러면 뒤집은 상자의 «윗면»이 바깥 벽보다 `wall` 만큼 위로 삐져나온다.
   * 그 면은 안을 보므로 위에서는 컬링되지만 옆에서는 보여서, 화면에서 욕조가
   * **뚜껑 덮인 상자**로 나왔다. 캐비티 위는 벽 꼭대기와 딱 맞아야 한다.
   */
  const cav = Math.max(h - wall, wall);
  return [
    // 바깥 — 위가 뚫려야 하므로 벽 넷으로 두른다
    part(new BoxGeometry(w, h, wall), rgb, [0, h / 2, (d - wall) / 2], undefined, tile),
    part(new BoxGeometry(w, h, wall), rgb, [0, h / 2, -(d - wall) / 2], undefined, tile),
    part(new BoxGeometry(wall, h, d - wall * 2), rgb, [(w - wall) / 2, h / 2, 0], undefined, tile),
    part(new BoxGeometry(wall, h, d - wall * 2), rgb, [-(w - wall) / 2, h / 2, 0], undefined, tile),
    // **안쪽 — 뒤집은 상자.** 이게 「움푹하다」의 전부다.
    // 재질 인쇄는 안쪽에도 문다 — 같은 통의 같은 재료다
    part(invert(new BoxGeometry(iw, cav, id)), inner, [0, wall + cav / 2, 0], undefined, tile),
    // 바닥. 없으면 통을 통해 방바닥이 보인다. 안쪽 통 바닥(y = wall)보다 SKIN 만큼 위
    part(new BoxGeometry(iw, wall + SKIN, id), inner, [0, (wall + SKIN) / 2, 0], undefined, tile),
  ];
}

/**
 * 수도꼭지 — 기둥 + 굽은 주둥이 + 손잡이.
 *
 * **굵기를 1.5배로 올리고 손잡이를 어둡게 갈랐다.** 반지름 0.018 짜리 기둥에
 * 5·6면 곡면이라 화면에서는 「막대에 꽂힌 실오라기」였다. 곡면이 5~7면이면
 * 매끄러운 셰이딩에서 «물결치는 튜브»가 된다 — 이 씬의 오랜 규약이다.
 * 손잡이가 몸통과 같은 `METAL` 이면 크롬 덩어리 하나로 뭉친다.
 */
function tap(x: number, y: number, z: number, s: number): Part[] {
  /** 손잡이 — 몸통보다 짙게. 크롬 안에서 「돌리는 데」가 보여야 꼭지다 */
  const GRIP: RGB = [0.42, 0.44, 0.50];
  return [
    part(new CylinderGeometry(0.027 * s, 0.034 * s, 0.15 * s, 10), METAL, [x, y + 0.075 * s, z]),
    part(new TorusGeometry(0.058 * s, 0.026 * s, 8, 14, Math.PI / 2), METAL,
      [x, y + 0.15 * s, z - 0.058 * s], [0, Math.PI / 2, 0]),
    // 주둥이 끝 — 물 나오는 데. 끊긴 자리가 있어야 「토출구」로 읽힌다
    part(new CylinderGeometry(0.024 * s, 0.024 * s, 0.03 * s, 10), GRIP,
      [x, y + 0.145 * s, z - 0.116 * s]),
    part(new CylinderGeometry(0.018 * s, 0.018 * s, 0.06 * s, 8), METAL,
      [x, y + 0.185 * s, z + 0.004 * s]),
    /**
     * 손잡이 십자 — 두 막대. 하나면 「막대」고 둘이면 「돌리는 것」이다.
     * **두 번째 막대를 얇게 한다** — 같은 높이로 두면 겹치는 자리에서 위·아랫면이
     * 같은 평면을 공유해 z-fighting 이 뜬다(자가 `11×12` 로 잡았다).
     * 얇으면 겹치는 4mm 구간이 첫 막대 «안»으로 들어가 아예 안 보인다.
     */
    part(new BoxGeometry(0.10 * s, 0.018 * s, 0.024 * s), GRIP, [x, y + 0.215 * s, z]),
    part(new BoxGeometry(0.024 * s, 0.013 * s, 0.10 * s), GRIP, [x, y + 0.215 * s, z]),
  ];
}

/**
 * **나머지 여섯 방의 가구 — 손배치(`StageProp`) 전용.**
 *
 * ## 왜 이 파일이 생겼나
 *
 * 여섯 방의 가구가 전부 `CityBuilding`(압출 프리즘)이었다. 그 엔진은 2D 외곽선을
 * y=0 에서 위로 뽑는 것뿐이라 **프리즘밖에 못 만든다** — 그래서 변기가
 * 43×45×72cm 짜리 상자였고, 욕조도 싱크대도 깔아둔 이불도 상자였다.
 * 콘센트가 「바닥에 선 흰 덩어리」였던 것과 같은 계열이다.
 *
 * `shapes.furniture.ts` 는 거실 여섯을 갖고 있다. 여기 열일곱을 더 넣으면 한 파일이
 * 너무 길어져서 방별로 나눴다 — `shapes.house.ts` 가 「방 정체성 전용」인 것과 같은 이유다.
 *
 * ## 상자와 가구를 가르는 «한 끗»
 *
 *   싱크대 → 파인 개수통    변기 → 물탱크 + 타원 좌대    욕조 → 파인 통 + 수도꼭지
 *   세면대 → 기둥 + 파인 대야  냉장고 → 문 둘 + 손잡이     찬장 → 유리문 + 선반
 *   책상 → 상판 + 서랍       식탁 → 상판 + 다리 넷       이불 → 요 + 부픔 + 베개
 *   장난감 상자 → 열린 뚜껑   신발장 → 칸 셋 + 신발       우산꽂이 → 파인 통 + 우산
 *
 * 부품을 아끼면 그 한 끗이 먼저 죽는다. 가구는 화면에서 소품보다 훨씬 크게 보이고
 * 방마다 서넛뿐이라, 소품보다 부품을 넉넉히 써도 삼각형 예산에 여유가 있다.
 *
 * ## 규약
 *
 * 다른 빌더와 같다. `shapes.kit.ts` 만 import 한다(`shapes.ts` 를 물면 순환 참조).
 * 치수는 실제 감각으로 쓰고 `assemble()` 의 `normalize()` 가 최장축을 1.0 으로
 * 맞추면서 비율을 지오메트리에 굽는다.
 * **`part()` 의 5번째 인자는 배율이 아니라 인쇄 칸 번호다.**
 *
 * **`soft()` 는 회전해서 붙이는 부품에는 안 쓴다** — 깎인 모서리가 돌린 뒤 bbox 의
 * 극점이라 형태가 얇아진다(`shapes.kit.ts` 의 `soft()` 독스트링 참조).
 */
export const ROOM_BUILDERS: Record<ShapeIdRooms, () => BufferGeometry> = {

  // ─── 복도 ────────────────────────────────────────────────────

  /**
   * 신발장 (80cm). **칸이 뚫려 있고 거기 신발이 있어야 신발장이다.**
   * 통짜면 그냥 낮은 궤짝이다.
   */
  /**
   * 신발장 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/신발장/` (쇼와 짙은 나무 下駄箱, 폭 910 × 깊이 380 × 높이 1000mm)
   *
   * 앞의 것은 칸 셋이 트인 선반에 실내화 둘이었다. 사진은 문 달린 장이다:
   *   ① 허리 높이의 **짙은 초콜릿색 나무 상자** — 폭 : 높이 : 깊이 = 1 : 1.1 : 0.42
   *   ② 높이의 **0.74** 를 차지하는 여닫이문 두 짝, 맞닿는 선 좌우에 둥근 손잡이
   *   ③ 문짝 안에 **윗변이 아치로 솟은 볼록 판자**
   *   ④ 문 아래 둥근 손잡이 달린 **얕은 서랍 둘**(높이의 0.12), 좌우로 조금 나온 천판
   * 치수는 폭 = 1 로 쓴다(앞 +z).
   */
  신발장: () => {
    const W = 1, H = 1.1, D = 0.42;
    const CHOCO: RGB = [0.30, 0.25, 0.30];   // 거의 검은 초콜릿 — 밝으면 「붉은 중간 갈색」
    const PANEL: RGB = [0.36, 0.30, 0.36];   // 판자는 같은 색에 한 톤만 — 따로 칠하면 사진과 다르다
    const doorBot = 0.13 * H + 0.12 * H, doorTop = doorBot + 0.74 * H * 0.93;
    const doorH = doorTop - doorBot, doorW = W / 2 - 0.05;
    return assemble([
      part(soft(W, H - 0.03 * H - 0.05, D, 0.05), CHOCO, [0, 0.05 + (H - 0.03 * H - 0.05) / 2, 0], undefined, TILE.WOOD_C),
      // ④ 천판 — 좌우로 폭의 0.02 나온다
      part(soft(W + 0.04, 0.03 * H, D + 0.02, 0.2), CHOCO, [0, H - 0.015 * H, 0.01], undefined, TILE.WOOD_C),
      // 받침
      part(new BoxGeometry(W - 0.06, 0.05, D - 0.04), [0.30, 0.26, 0.30], [0, 0.025, 0]),
      // ② 문 두 짝 + ③ 아치 판자 + 손잡이
      ...([1, -1] as const).flatMap((s) => {
        const cx = s * (doorW / 2 + 0.01);
        return [
          part(new BoxGeometry(doorW, doorH, 0.015), CHOCO, [cx, (doorBot + doorTop) / 2, D / 2 + 0.008], undefined, TILE.WOOD_C),
          // ③ 윗변이 아치로 솟은 볼록 판자 — 판 하나의 윗변 정점을 휘어 올린다
          part(warp(new BoxGeometry(doorW * 0.64, doorH * 0.78, 0.025, 8, 1, 1), (x, y, z) =>
            [x, y > 0 ? y + doorH * 0.07 * Math.cos((x / (doorW * 0.32)) * Math.PI / 2) : y, z]),
            PANEL, [cx, doorBot + doorH * 0.44, D / 2 + 0.02]),
          part(new SphereGeometry(0.022, 8, 5), [0.40, 0.30, 0.26], [s * 0.045, (doorBot + doorTop) / 2, D / 2 + 0.03]),
          // ④ 서랍 + 손잡이
          part(new BoxGeometry(doorW, 0.11 * H, 0.015), CHOCO, [cx, 0.13 * H + 0.06 * H, D / 2 + 0.008], undefined, TILE.WOOD_C),
          part(new SphereGeometry(0.02, 8, 5), [0.40, 0.30, 0.26], [cx, 0.13 * H + 0.06 * H, D / 2 + 0.028]),
        ];
      }),
    ]);
  },

  /**
   * 우산꽂이 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/우산꽂이/` (신라쿠야키 도자기 우산꽂이, 지름 235 × 높이 445mm)
   *
   * 앞의 것은 푸른 플라스틱 통에 우산 둘을 곧게 꽂은 것이었다. 사진과 대보니:
   *   ① 높이가 지름의 **1.9배**인 곧은 **도자기 원통** — 짙은 청회색 얼룩 유약
   *   ② 몸통보다 **1.1배 넓게 말려 나온** 두툼한 입구 테
   *   ③ 위에서 높이의 0.28~0.41 사이를 두르는 **가는 음각 테 4줄**
   *   ④ 입구 뒤쪽에 기대 비죽 솟은 **접은 흰 우산 한 개**
   * 우산을 크게 기울이면 발자국이 넓어져 복도(1.8m)를 먹는다(예전 기록) — 6° 만 기울인다.
   * 치수는 지름 = 1 로 쓴다.
   */
  우산꽂이: () => {
    const H = 1.9, R = 0.5;
    const GLAZE: RGB = [0.62, 0.78, 0.88];   // 푸른 슬레이트빛 — 밝은 회색 팔레트에 곱한다
    return assemble([
      ...hollow(R, R * 0.98, H, 0.05, 0.08, 20, GLAZE, [0.55, 0.62, 0.62], TILE.STONE),
      // ② 말려 나온 입구 테
      part(new TorusGeometry(R * 1.02, 0.05, 6, 20), GLAZE, [0, H - 0.02, 0], [Math.PI / 2, 0, 0], TILE.STONE),
      // ③ 음각 테 넷 — 몸통보다 짙은 가는 고리
      ...[0.28, 0.325, 0.37, 0.41].map((f) =>
        part(new TorusGeometry(R + 0.003, 0.008, 3, 20), [0.55, 0.62, 0.62], [0, H * (1 - f), 0], [Math.PI / 2, 0, 0])),
      /**
       * ④ 접은 우산 — 입구 뒤쪽에 기대 6° 기운다. 원뿔 막대 하나는 판정자가 「연필꽂이에 꽂힌 막대」로 봤다.
       * 우산을 우산으로 만드는 건 **접힌 천의 주름(골 여덟)과 묶음 띠, 그리고 J 자로 굽은 손잡이**다.
       */
      part(warp(new CylinderGeometry(0.075, 0.13, 1.10, 16, 1), (x, y, z) => {
        const a = Math.atan2(z, x), k = 1 - 0.18 * Math.abs(Math.sin(4 * a));
        return [x * k, y, z * k];
      }), [1.30, 1.30, 1.28], [0.12, H - 0.10, -0.26], [0.10, 0, -0.06]),
      part(new CylinderGeometry(0.105, 0.105, 0.05, 10), [0.35, 0.40, 0.75], [0.105, H + 0.05, -0.23], [0.10, 0, -0.06]),
      part(new CylinderGeometry(0.022, 0.022, 0.26, 6), [0.30, 0.22, 0.18], [0.16, H + 0.56, -0.21], [0.10, 0, -0.06]),
      part(new TorusGeometry(0.075, 0.024, 5, 10, Math.PI), [0.30, 0.22, 0.18], [0.24, H + 0.69, -0.20], [0, 0, 0]),
    ]);
  },

  // ─── 아이 방 ─────────────────────────────────────────────────

  /**
   * 책상(학습 책상) — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/책상/` (1969 구로가네 철제 학습 책상 앞 · 옆 · 아래)
   *
   * 앞의 것은 상판에 다리 넷과 작은 서랍 하나였다. 사진은 쇼와 아이 방의 학습 책상이다:
   *   ① 상판 뒤에 올라앉아 **전체 높이의 0.56** 을 차지하는 위 선반 — 형광등 갓과 민트색 뒤판
   *   ② 상판 너비의 **0.38** 을 차지하고 바닥에서 떠 있는(책상면 높이의 0.30 틈) **오른쪽 서랍통 3단**
   *   ③ 너비 0.06 두께의 얇은 가운데 서랍 아래로 책상면 높이의 **0.86** 이 트인 무릎 자리
   *   ④ 나뭇결 갈색 상판 · 회베이지 철판 몸통 · 바닥에 누운 발 위에 선 기둥 다리
   * 위 선반까지 합친 높이가 최장축이 돼 책상 폭이 0.7m 로 작아진다. `size` 는 흡수 판정과
   * 성장 곡선에 들어가는 값이라 그대로 뒀다. 밑 통과 높이는 무릎 자리(0.86 × 0.46 = 0.40)로 맞췄다.
   * 치수는 책상 폭 = 1 로 쓴다(앞 +z).
   */
  책상: () => {
    const W = 1, D = 0.56, TOP = 0.66, HUTCH = 0.77;
    const STEEL: RGB = [0.87, 0.78, 0.82], MINT: RGB = [0.88, 1.15, 1.20], WOODTOP: RGB = [0.76, 0.83, 1.25];
    const PED_W = 0.38 * W, PED_BOT = 0.30 * TOP;
    return assemble([
      // ④ 상판
      part(soft(W, 0.026, D, 0.3), WOODTOP, [0, TOP - 0.013, 0], undefined, TILE.WOOD_C),
      // ③ 가운데 얇은 서랍
      part(soft(W * 0.47, 0.06, D * 0.9, 0.2), STEEL, [-W * 0.18, TOP - 0.056, 0]),
      // ② 오른쪽 서랍통 3단 — 바닥에서 떠 있다
      part(soft(PED_W, TOP - 0.03 - PED_BOT, D * 0.92, 0.1), STEEL, [W / 2 - PED_W / 2 - 0.02, PED_BOT + (TOP - 0.03 - PED_BOT) / 2, 0], undefined, TILE.PANEL),
      ...([0.62, 0.40, 0.14] as const).map((f) =>
        part(new BoxGeometry(PED_W * 0.4, 0.02, 0.02), [0.62, 0.52, 0.55], [W / 2 - PED_W / 2 - 0.02, PED_BOT + (TOP - PED_BOT) * f + 0.02, D * 0.47])),
      // ④ 왼쪽 기둥 다리 + 바닥에 누운 발, 서랍통 밑 다리
      part(new BoxGeometry(0.04, TOP - 0.06, 0.04), STEEL, [-W / 2 + 0.08, (TOP - 0.06) / 2, 0]),
      part(new BoxGeometry(0.05, 0.03, D * 0.9), STEEL, [-W / 2 + 0.08, 0.015, 0]),
      part(new BoxGeometry(0.05, PED_BOT, 0.04), STEEL, [W / 2 - 0.05, PED_BOT / 2, D * 0.35]),
      part(new BoxGeometry(0.05, PED_BOT, 0.04), STEEL, [W / 2 - 0.05, PED_BOT / 2, -D * 0.35]),
      part(new BoxGeometry(W * 0.62, 0.025, 0.03), STEEL, [-W * 0.12, 0.05, -D * 0.4]),
      // ① 위 선반 — 옆판 둘 · 민트 뒤판 · 선반 · 형광등 갓
      ...([1, -1] as const).map((s) => part(new BoxGeometry(0.03, HUTCH, D * 0.42), STEEL, [s * (W / 2 - 0.03), TOP + HUTCH / 2, -D * 0.29])),
      part(new BoxGeometry(W - 0.08, HUTCH * 0.55, 0.012), MINT, [0, TOP + HUTCH * 0.30, -D * 0.49]),
      part(new BoxGeometry(W - 0.06, 0.025, D * 0.42), STEEL, [0, TOP + HUTCH * 0.62, -D * 0.29]),
      part(new BoxGeometry(W - 0.06, 0.025, D * 0.42), STEEL, [0, TOP + HUTCH - 0.012, -D * 0.29]),
      part(new BoxGeometry(W - 0.12, 0.04, 0.06), [0.95, 0.92, 0.88], [0, TOP + HUTCH * 0.58, -D * 0.10]),
    ]);
  },

  /**
   * 이불 — **사진에서 잰 값으로 다시 만들었다.** 근거: `.design-bounce/ref/이불/` (다다미방에 깐 요 · 이불 · 베개)
   *
   * 앞의 것은 요 한 장에 작은 이불과 베개를 얹은 것이었다. 사진과 대보니:
   *   ① 요는 **청록 무늬 얇은 요 두 장**을 겹치고 흰 시트로 쌌다 — 옆면이 층진다
   *   ② 이불이 **요보다 1.35배 넓어** 가장자리가 다다미로 흘러내린다. 흰 홑청 가운데
   *      폭 0.57 창으로 **붉은 꽃무늬 겉감**이 보인다
   *   ③ 이불을 머리맡에서 **뒤로 반 접어 올려** 요 한 장의 3배 두께 덩어리가 된다
   *   ④ 머리맡에 요 폭의 0.57 인 흰 베개가 가로로 놓인다
   * 치수는 요 길이 = 1 로 쓴다(머리맡 −x).
   */
  이불: () => {
    const L = 1, W = 0.5, T = 0.03;
    const TEAL: RGB = [0.45, 0.78, 0.72], SHEET: RGB = [1.05, 1.06, 1.10], RED: RGB = [0.78, 0.30, 0.28];
    const CW = W * 1.35;
    return assemble([
      // ① 요 두 장 + 흰 시트
      part(soft(L, T, W, 0.45), TEAL, [0, T / 2, 0], undefined, TILE.CLOTH),
      part(soft(L * 0.99, T, W * 0.99, 0.45), TEAL, [0, T * 1.5, 0], undefined, TILE.CLOTH),
      part(soft(L * 0.99, 0.008, W * 0.99, 0.3), SHEET, [0, T * 2 + 0.004, 0]),
      // ② 이불 — 발치 절반을 덮고 가장자리가 다다미로 흘러내린다
      part(warp(new BoxGeometry(L * 0.55, 0.035, CW, 4, 1, 6), (x, y, z) =>
        [x, y - 0.05 * Math.max(0, Math.abs(z) / (CW / 2) - 0.72) / 0.28, z]), SHEET, [L * 0.2, T * 2 + 0.03, 0]),
      part(new BoxGeometry(L * 0.40, 0.004, CW * 0.57), RED, [L * 0.2, T * 2 + 0.05, 0], undefined, TILE.CLOTH),
      // ③ 반 접어 올린 덩어리 — 요 한 장의 3배 두께
      part(new CylinderGeometry(0.06, 0.06, CW * 0.95, 12).scale(1.3, 1, 1), SHEET, [-L * 0.08, T * 2 + 0.06, 0], [Math.PI / 2, 0, 0]),
      // ④ 베개 — 머리맡에 가로로
      part(new SphereGeometry(0.5, 12, 8).scale(0.16, 0.07, W * 0.57), [1.1, 1.1, 1.12], [-L * 0.38, T * 2 + 0.03, 0]),
    ]);
  },

  /**
   * 장난감 상자 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/장난감 상자/` (1976 산리오 등나무 장난감 상자, 52.5 × 37 × 38cm)
   *
   * 앞의 것은 골판지 상자에 비뚤게 덮인 뚜껑이었다. 사진과 대보니:
   *   ① 너비 : 높이 : 깊이 = **1 : 0.70 : 0.72**
   *   ② **새빨간 인쇄 뚜껑**과 **흰 엮음 몸통**(사이로 나무색 살이 비친다), 안은 초록 판
   *   ③ 양옆에서 앞뒤로 둥글게 넘어가며 뚜껑 위로 솟은 **굽힌 나무 손잡이**
   *   ④ 작은 나무 발 넷 · 뚜껑 앞 가운데 동그란 나무 꼭지
   * 사진은 뚜껑을 똑바로 세웠지만 그러면 높이가 최장축이 돼 상자가 쪼그라든다(예전 기록).
   * **32° 만 열어** 속의 장난감이 보이게 했다. 장난감은 다른 장난감 상자 사진(`toys.jpg`)을 따랐다.
   */
  '장난감 상자': () => {
    const W = 1, H = 0.70, D = 0.72, FEET = 0.05, LID_A = 0.56;
    const WEAVE: RGB = [1.08, 1.10, 1.12], WOODEN: RGB = [0.95, 0.70, 0.40], RED: RGB = [0.82, 0.27, 0.27];
    const top = FEET + H * 0.92;
    return assemble([
      // ② 흰 엮음 몸통 — 짚 짜임 인쇄, 안은 초록
      part(new BoxGeometry(W, H * 0.92, D), WEAVE, [0, FEET + H * 0.46, 0], undefined, TILE.STRAW),
      part(invert(new BoxGeometry(W - 0.06, H * 0.8, D - 0.06)), [0.30, 0.62, 0.20], [0, FEET + H * 0.52, 0]),
      part(new BoxGeometry(W - 0.06, 0.01, D - 0.06), [0.30, 0.62, 0.20], [0, FEET + H * 0.12, 0]),
      // 안에 든 장난감 — 테 위로 조금 솟는다
      part(new SphereGeometry(0.13, 10, 7), [1.1, 0.45, 0.35], [0.22, top + 0.02, 0.10]),
      part(new BoxGeometry(0.16, 0.16, 0.16), [0.35, 0.60, 1.05], [-0.20, top, -0.02], [0, 0.5, 0.3]),
      part(new CylinderGeometry(0.06, 0.06, 0.24, 8), [1.1, 0.95, 0.35], [-0.02, top + 0.02, 0.16], [0, 0, Math.PI / 2]),
      // ② 빨간 뚜껑 — 뒤 경첩에서 32° 들렸다. 안쪽 면은 초록
      part(new BoxGeometry(W + 0.02, 0.04, D + 0.02).translate(0, 0, (D + 0.02) / 2), RED,
        [0, top + 0.02, -D / 2], [-LID_A, 0, 0], TILE.CARDBOARD),
      // ③ 굽힌 나무 손잡이 — 양옆
      ...([1, -1] as const).map((s) =>
        part(new TorusGeometry(D * 0.42, 0.018, 4, 12, Math.PI), WOODEN, [s * (W / 2 + 0.02), top - D * 0.28, 0], [0, Math.PI / 2, 0])),
      // ④ 나무 발 넷
      ...([[1, 1], [-1, 1], [1, -1], [-1, -1]] as const).map(([sx, sz]) =>
        part(new CylinderGeometry(0.03, 0.035, FEET, 8), WOODEN, [sx * (W / 2 - 0.06), FEET / 2, sz * (D / 2 - 0.06)])),
    ]);
  },

  // ─── 부엌 ────────────────────────────────────────────────────

  /**
   * 싱크대 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/싱크대/` (高津装飾美術 「公団型流し台」 W1800 D550 H800 앞모습 + ガスミュージアム 昭和40年代 부엌)
   *
   * 앞의 것은 문 두 짝 달린 통짜 장 위 **왼쪽**에 개수통을 판 것이었다. 사진과 대보니:
   *   ① 폭 : 높이 : 깊이 = **1 : 0.44 : 0.31** — 앞의 것(1 : 0.5 : 0.35)보다 낮고 얕다
   *   ② 폭 0.31 사각 개수대가 **가운데(0.51)**, 뒤에 높이 0.11 짜리 턱
   *   ③ 통짜 장이 아니다 — 양 끝 폭 0.33 **나뭇결 수납장 둘** 사이 폭 0.28 **무릎 자리가 바닥까지 트였다**
   *   ④ 문 위쪽 0.15 높이에 한 쌍씩 달린 **V자 크롬 손잡이**, 주황빛 갈색 나뭇결 앞판 (115,60,28)
   * 은색 팔레트(6)는 나뭇결 문을 회색으로 누른다 — 팔레트는 흰색, 스테인리스·나무는 계수로.
   * 꼭지는 사진에 없지만(벽에서 나온다) 게임에서 개수대를 «물 쓰는 데»로 읽히게 뒤 턱에 작게 남겼다.
   * 치수는 폭 = 1 로 쓴다(앞 +z).
   */
  싱크대: () => {
    const H = 0.44, D = 0.31, BASE = 0.05 * H, DOOR = 0.69 * H, APRON = 0.23 * H;
    const yDoor = BASE, yApron = BASE + DOOR, yTop = yApron + APRON, TOP_T = H - yTop;
    const WOODEN: RGB = [0.47, 0.25, 0.12], STEEL: RGB = [0.40, 0.38, 0.36], CHROME: RGB = [1.05, 1.05, 1.08];
    const CAB = 0.332, CX = 0.5 - 0.017 - CAB / 2;               // 수납장 폭 · 중심(양 끝에서 0.017 들어온다)
    const BW = 0.31, BD = 0.20, BX = 0.01, BZ = 0.0;              // 개수대
    const FACE = D / 2 - 0.012;                                   // 문 · 앞판 앞면 — 상판이 0.012 내민다
    // V자 손잡이 — 짧은 막대 둘을 ±35° 로
    const vHandle = (x: number): Part[] => ([1, -1] as const).map((k) =>
      part(new CylinderGeometry(0.004, 0.004, 0.03, 5), CHROME, [x + k * 0.011, yApron - 0.15 * DOOR, FACE + 0.006], [0, 0, k * 1.0]));
    return assemble([
      // ③ 수납장 둘 — 몸통 + 문 두 짝 + 손잡이
      ...([1, -1] as const).flatMap((k) => [
        part(new BoxGeometry(CAB, DOOR, D / 2 + FACE - 0.008), WOODEN, [k * CX, yDoor + DOOR / 2, (FACE - 0.008 - D / 2) / 2], undefined, TILE.WOOD_C),
        ...([1, -1] as const).map((j) =>
          part(new BoxGeometry(CAB / 2 - 0.003, DOOR - 0.006, 0.008), WOODEN, [k * CX + j * CAB / 4, yDoor + DOOR / 2, FACE - 0.004], undefined, TILE.WOOD_C)),
        ...vHandle(k * CX - 0.053), ...vHandle(k * CX + 0.053),
        // 굽 — 문보다 조금 들어간 짙은 판
        part(new BoxGeometry(CAB - 0.02, BASE, D - 0.05), [0.23, 0.13, 0.09], [k * CX, BASE / 2, -0.02]),
      ]),
      // 앞판 띠 — 폭 전체, 가운데 가는 가로 홈
      part(new BoxGeometry(0.98, APRON, D / 2 + FACE), WOODEN, [0, yApron + APRON / 2, (FACE - D / 2) / 2], undefined, TILE.WOOD_C),
      part(new BoxGeometry(0.98, 0.004, 0.004), [0.20, 0.10, 0.05], [0, yApron + APRON * 0.62, FACE + 0.001]),
      // ② 스테인리스 상판 — 개수대 자리를 비운 네 조각(겹치지 않게)
      part(new BoxGeometry(1.0, TOP_T, D / 2 - BD / 2 - BZ), STEEL, [0, yTop + TOP_T / 2, (D / 2 + BD / 2 + BZ) / 2]),
      part(new BoxGeometry(1.0, TOP_T, D / 2 - BD / 2 + BZ), STEEL, [0, yTop + TOP_T / 2, -(D / 2 + BD / 2 - BZ) / 2]),
      part(new BoxGeometry(0.5 + BX - BW / 2, TOP_T, BD), STEEL, [(-0.5 + BX - BW / 2) / 2, yTop + TOP_T / 2, BZ]),
      part(new BoxGeometry(0.5 - BX - BW / 2, TOP_T, BD), STEEL, [(0.5 + BX + BW / 2) / 2, yTop + TOP_T / 2, BZ]),
      // 상판 앞 테 — 검게 비친다
      part(new BoxGeometry(1.0, TOP_T * 0.9, 0.004), [0.12, 0.12, 0.14], [0, yTop + TOP_T / 2, D / 2 + 0.002]),
      // 개수대 — 상판보다 조금 높게 앉힌다(드롭인 싱크의 뜬 턱)
      ...basin(BW, BD, 0.10, 0.012, [0.85, 0.85, 0.88], STEEL, TILE.METAL)
        .map((q) => part(q.geo, q.rgb, [BX, H - 0.10 + 0.003, BZ], undefined, q.tile)),
      // 뒤 턱 — 높이 0.11H, 양 끝에서 0.07 들어온다
      part(new BoxGeometry(0.86, 0.11 * H, 0.012), STEEL, [0, H + 0.11 * H / 2, -D / 2 + 0.006]),
      ...tap(BX, H, -BD / 2 - 0.02, 0.35),
    ]);
  },

  /**
   * 냉장고 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/냉장고/` (National NR-8180AF, 표기 W52 D61 H125 cm, 앞 · 옆)
   *
   * 앞의 것은 폭 : 높이 = 0.39 의 흰 상자에 문 둘과 **오른쪽** 세로 손잡이였다. 사진과 대보니:
   *   ① 폭 : 높이 : 깊이 = **1 : 2.4 : 1.17** — 깊다
   *   ② 위 **0.22** 냉동실 · 아래 **0.73** 냉장실, 그 사이 틈 0.011, 받침 0.034(네 귀퉁이 흰 발)
   *   ③ 손잡이는 **왼쪽** 가장자리에서 폭의 0.14 안쪽의 크롬 막대 — 문 틈에서 **검정 · 회색 삼각형**
   *      (밑변 폭의 0.23)이 마주 보아 나비넥타이가 된다
   *   ④ 몸통 양옆 앞 모서리를 위에서 아래까지 두른 **크롬 띠**, 냉동실 오른쪽 위 은색 상표판(폭의 0.18)
   * 문 모서리는 거의 직각이다 — 둥글린 상자(`soft`)를 버리고 곧은 상자로 만든다.
   * 치수는 높이 = 1 로 쓴다(앞 +z).
   */
  냉장고: () => {
    const W = 0.42, D = 0.49, FOOT = 0.034, FRIDGE = 0.73, GAP = 0.011, FREEZER = 0.22, T = 0.03;
    const yGap = FOOT + FRIDGE, yFrz = yGap + GAP;
    const BODY: RGB = [0.95, 0.93, 0.92], CHROME: RGB = [1.12, 1.12, 1.15], FRONT = D / 2;
    const HX = -W / 2 + 0.14 * W;                                  // ③ 손잡이 x
    // 삼각형 — 세 면 원기둥을 앞으로 눕힌 얇은 판. thetaStart π 면 꼭짓점이 위, 0 이면 아래
    const tri = (up: boolean, h: number, rgb: RGB, y: number): Part => {
      const r = 0.23 * W / Math.sqrt(3);
      const s = h / (1.5 * r);
      return part(new CylinderGeometry(r, r, 0.012, 3, 1, false, up ? Math.PI : 0).scale(1, 1, s), rgb,
        [HX, up ? y + 0.5 * r * s : y - 0.5 * r * s, FRONT + 0.006], [Math.PI / 2, 0, 0]);
    };
    return assemble([
      // 받침 — 가운데는 검게 들어가고 네 귀퉁이만 흰 발
      part(new BoxGeometry(W - 0.04, FOOT, D - 0.08), [0.12, 0.12, 0.13], [0, FOOT / 2, -0.02]),
      ...([[1, 1], [-1, 1], [1, -1], [-1, -1]] as const).map(([sx, sz]) =>
        part(new BoxGeometry(0.035, FOOT, 0.035), BODY, [sx * (W / 2 - 0.02), FOOT / 2, sz * (D / 2 - 0.05)])),
      // 몸통(문 뒤)
      part(new BoxGeometry(W, 1 - FOOT, D - T), BODY, [0, FOOT + (1 - FOOT) / 2, -T / 2], undefined, TILE.PANEL),
      // ② 문 둘 + 문 틈
      part(new BoxGeometry(W - 0.004, FRIDGE, T), BODY, [0, FOOT + FRIDGE / 2, FRONT - T / 2]),
      part(new BoxGeometry(W - 0.004, FREEZER, T), BODY, [0, yFrz + FREEZER / 2, FRONT - T / 2]),
      part(new BoxGeometry(W - 0.01, GAP, 0.02), [0.15, 0.15, 0.16], [0, yGap + GAP / 2, FRONT - 0.02]),
      // ④ 양옆 크롬 띠
      ...([1, -1] as const).map((k) =>
        part(new BoxGeometry(0.008, 1 - FOOT, 0.012), CHROME, [k * (W / 2 + 0.002), FOOT + (1 - FOOT) / 2, FRONT - 0.006])),
      // ③ 손잡이 — 냉동실 막대(위 끝 → 검은 삼각형) · 냉장실 막대(회색 삼각형 → 0.51)
      part(new BoxGeometry(0.010, 0.996 - 0.837, 0.012), CHROME, [HX, (0.996 + 0.837) / 2, FRONT + 0.012]),
      tri(true, 0.058, [0.08, 0.09, 0.10], yFrz),
      tri(false, 0.044, [0.40, 0.40, 0.41], yGap),
      part(new BoxGeometry(0.010, yGap - 0.044 - 0.513, 0.012), CHROME, [HX, (yGap - 0.044 + 0.513) / 2, FRONT + 0.012]),
      // 상표판 — 냉동실 오른쪽 위
      part(new BoxGeometry(0.18 * W, 0.022, 0.004), CHROME, [0.140, 0.963, FRONT + 0.002]),
    ]);
  },

  /**
   * 찬장(식기장) — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/찬장/` (1970년대 식기장 W86 D37 H180 cm, 앞모습 + 그릇 넣은 모습)
   *
   * 앞의 것은 나무 궤짝 위아래 통째에 유리문 두 짝이었다. 사진과 대보니 층이 다섯이다:
   *   ① 폭 : 높이 : 깊이 = **1 : 2.09 : 0.43**
   *   ② 위에서부터 미닫이 유리 **0.27** · 여닫이 유리문 두 짝 **0.28** · 트인 칸 **0.12** · 문 + 서랍 **0.23** · 굽 0.05
   *   ③ 가운데 유리문의 모서리 둥근 창과 맞닿는 선 옆 **크롬 둥근 손잡이 한 쌍**
   *   ④ 오른쪽 아래 사각 크롬 손잡이 **서랍 넷**(폭 0.52)과 왼쪽 여닫이문, 모든 문 가장자리의 **가는 흰 선**
   * 유리는 불투명이라 그릇을 안에 넣으면 안 보인다 — 유리 면에 비친 선반 · 그릇을 그린다(`TILE.CUPBOARD_GLASS`).
   * 흰 선은 곱셈으로 못 내므로 문 앞판은 판 색까지 인쇄가 정한다(`TILE.CUPBOARD_DOOR`).
   * 치수는 높이 = 1 로 쓴다(앞 +z).
   */
  찬장: () => {
    const W = 0.478, D = 0.206, FRONT = D / 2, SIDE = 0.018;
    const BROWN: RGB = [0.38, 0.25, 0.22], CHROME: RGB = [1.05, 1.05, 1.08], IW = W - SIDE * 2;
    // 층 경계(아래에서) — 굽 0.05 · 아래 칸 0.23 · 트인 칸 0.12 · 유리문 0.28 · 가운데 테 0.02 · 미닫이 0.27 · 윗테 0.03
    const Y = { base: 0.05, low: 0.28, open: 0.40, doors: 0.68, mid: 0.70, slide: 0.97 };
    const pane = (x: number, y: number, w: number, h: number, z = FRONT - 0.006): Part =>
      part(new BoxGeometry(w, h, 0.008), WHITE, [x, y, z], undefined, TILE.CUPBOARD_GLASS);
    const front = (x: number, y: number, w: number, h: number): Part =>
      part(new BoxGeometry(w, h, 0.012), WHITE, [x, y, FRONT - 0.006], undefined, TILE.CUPBOARD_DOOR);
    const DRAWER = (Y.low - Y.base) / 4;
    return assemble([
      // 몸통 — 옆판 둘 · 뒤판 · 굽 · 윗테 · 층 칸막이
      ...([1, -1] as const).map((k) => part(new BoxGeometry(SIDE, 1, D), BROWN, [k * (W / 2 - SIDE / 2), 0.5, 0], undefined, TILE.WOOD_C)),
      part(new BoxGeometry(IW, 1, 0.01), BROWN, [0, 0.5, -D / 2 + 0.005]),
      part(new BoxGeometry(IW, Y.base, D), BROWN, [0, Y.base / 2, 0]),
      part(new BoxGeometry(W, 1 - Y.slide, D), BROWN, [0, (1 + Y.slide) / 2, 0], undefined, TILE.WOOD_C),
      part(new BoxGeometry(IW, Y.mid - Y.doors, D), BROWN, [0, (Y.mid + Y.doors) / 2, 0]),
      part(new BoxGeometry(IW, 0.012, D), BROWN, [0, Y.open, 0]),
      part(new BoxGeometry(IW, 0.012, D), [0.93, 0.92, 0.90], [0, Y.low + 0.006, 0]),
      // ② 미닫이 유리 두 장 — 가운데서 겹친다(앞뒤로 비껴)
      pane(-IW / 4 - 0.005, (Y.mid + Y.slide) / 2, IW / 2 + 0.01, Y.slide - Y.mid - 0.01),
      pane(IW / 4 + 0.005, (Y.mid + Y.slide) / 2, IW / 2 + 0.01, Y.slide - Y.mid - 0.01, FRONT - 0.016),
      // ③ 여닫이 유리문 두 짝 — 짙은 문틀 위에 모서리 둥근 창 + 크롬 둥근 손잡이
      ...([1, -1] as const).flatMap((k) => [
        part(new BoxGeometry(IW / 2 - 0.003, Y.doors - Y.open - 0.008, 0.01), BROWN, [k * IW / 4, (Y.doors + Y.open) / 2, FRONT - 0.012]),
        pane(k * IW / 4, (Y.doors + Y.open) / 2, IW / 2 - 0.04, Y.doors - Y.open - 0.05),
        part(new SphereGeometry(0.008, 6, 4), CHROME, [k * 0.018, Y.doors - 0.39 * (Y.doors - Y.open), FRONT + 0.004]),
      ]),
      // 트인 칸 — 흰 속판과 유리 칸막이 한 장
      part(new BoxGeometry(IW, Y.open - Y.low, 0.006), [0.93, 0.92, 0.90], [0, (Y.open + Y.low) / 2, -D / 2 + 0.013]),
      part(new BoxGeometry(0.006, Y.open - Y.low - 0.012, D * 0.8), [0.78, 0.86, 0.88], [0.02, (Y.open + Y.low) / 2, 0]),
      // ④ 아래 칸 — 왼쪽 여닫이문(0.48) + 오른쪽 서랍 넷(0.52)
      front(-W / 2 + SIDE + IW * 0.24, (Y.base + Y.low) / 2, IW * 0.48 - 0.004, Y.low - Y.base - 0.004),
      part(new SphereGeometry(0.008, 6, 4), CHROME, [-W / 2 + SIDE + IW * 0.46, Y.low - 0.36 * (Y.low - Y.base), FRONT + 0.004]),
      ...[0, 1, 2, 3].flatMap((i) => {
        const y = Y.base + DRAWER * (i + 0.5), x = W / 2 - SIDE - IW * 0.26;
        return [
          front(x, y, IW * 0.52 - 0.004, DRAWER - 0.004),
          part(new BoxGeometry(0.12 * W, 0.012, 0.008), CHROME, [x, y, FRONT + 0.004]),
        ];
      }),
    ]);
  },

  /**
   * 식탁 — **사진에서 잰 값으로 다시 만들었다.** 밑이 뚫린다(`underPass`).
   * 근거: `.design-bounce/ref/식탁/` (쇼와 멜라민 식탁 W100 D70 H71.5 cm, 긴 쪽 · 짧은 쪽 · 비스듬히)
   *
   * 앞의 것은 두꺼운 나무 상판에 네모 나무 다리 넷과 가로대 둘이었다. 사진과 대보니:
   *   ① 나무가 아니다 — 갈색 나뭇결 **멜라민 상판**(131,109,95)을 가로 홈 **알루미늄 테**(두께 0.03)가 두른다
   *   ② 다리는 굵기 1.4cm 의 **가는 검은 쇠파이프** 넷 — 상판 밑 틀에서 이어져 바닥 쪽으로 약 5° 벌어진다
   *      (위는 끝에서 0.11 · 0.086 안쪽, 발끝은 0.055 · 0.047 안쪽)
   *   ③ 상판 아래 높이의 0.21 쯤에 **가로 봉 넷짜리 잡지 선반**, 그 밑은 바닥까지 트였다
   * **높이만 사진 비율(0.715)을 안 따랐다.** 손배치 크기가 1.2 m(`stage.house.ts` 식탁)라 사진 비율이면
   * 식탁 높이가 86cm 가 되어 싱크대(77cm)보다 높다. 실제 식탁 높이 71.5cm 에 맞춰 폭의 0.6 으로 두었다.
   * 선반 밑면은 0.47 — 손배치 크기 1.2 에서 0.564 m 라 `underPass: 0.55` 보다 높다.
   * 팔레트는 흰색 — 나무 팔레트(7)에 곱하면 알루미늄 테가 갈색이 된다. 치수는 폭 = 1 로 쓴다.
   */
  식탁: () => {
    const H = 0.6, D = 0.70, TOP_T = 0.022, R = 0.008;
    const STEEL: RGB = [0.18, 0.17, 0.18], ALU: RGB = [0.78, 0.79, 0.80];
    const yFrame = H - TOP_T - 0.012, RACK = 0.47;
    // ② 다리 — 위(틀) → 발끝으로 바깥으로 벌어진다
    const leg = (sx: number, sz: number): Part[] => {
      const x1 = sx * (0.5 - 0.11), z1 = sz * (D / 2 - 0.086), x2 = sx * (0.5 - 0.055), z2 = sz * (D / 2 - 0.047);
      const dy = yFrame, len = Math.hypot(x2 - x1, dy, z2 - z1);
      return [
        part(new CylinderGeometry(R, R, len, 6), STEEL, [(x1 + x2) / 2, dy / 2, (z1 + z2) / 2],
          [-Math.atan2(z2 - z1, dy), 0, Math.atan2(x2 - x1, dy)]),
        // 발끝 고무 마개 — 조금 굵다
        part(new CylinderGeometry(R * 1.5, R * 1.5, 0.02, 6), [0.08, 0.08, 0.08], [x2, 0.01, z2]),
      ];
    };
    return assemble([
      // ① 상판 — 알루미늄 테(몸) + 윗면 멜라민 한 장
      part(new BoxGeometry(1.0, TOP_T, D), ALU, [0, H - TOP_T / 2, 0], undefined, TILE.METAL),
      part(new BoxGeometry(0.99, 0.003, D - 0.01), [0.54, 0.45, 0.41], [0, H + 0.0015, 0], undefined, TILE.WOOD_F),
      // 상판 밑 쇠파이프 틀 — 긴 쪽 둘 · 짧은 쪽 둘
      ...([1, -1] as const).flatMap((k) => [
        part(new BoxGeometry(0.78, 0.014, 0.014), STEEL, [0, yFrame, k * (D / 2 - 0.086)]),
        part(new BoxGeometry(0.014, 0.014, D - 0.172), STEEL, [k * (0.5 - 0.11), yFrame, 0]),
      ]),
      ...([[1, 1], [-1, 1], [1, -1], [-1, -1]] as const).flatMap(([sx, sz]) => leg(sx, sz)),
      // ③ 잡지 선반 — 긴 쪽으로 누운 봉 넷 + 양 끝 받침 파이프
      ...[-0.16, -0.055, 0.055, 0.16].map((z) =>
        part(new CylinderGeometry(0.006, 0.006, 0.74, 5), STEEL, [0, RACK + 0.008, z], [0, 0, Math.PI / 2])),
      ...([1, -1] as const).map((k) =>
        part(new BoxGeometry(0.012, 0.012, D - 0.12), STEEL, [k * 0.37, RACK + 0.006, 0])),
    ]);
  },

  // ─── 화장실 ──────────────────────────────────────────────────

  /**
   * 욕조 (98cm). **파인 통과 수도꼭지**가 정체다.
   * 통짜 상자에 하늘색을 칠하면 그건 파란 벤치다.
   */
  욕조: () => assemble([
    /**
     * 굽. **바닥에 닿는 건 이것뿐이고 통은 그 «위»에 올라간다.**
     * 예전엔 굽과 통이 둘 다 y=0 에서 시작해 **밑면 두 장이 같은 평면**이었다 —
     * 자가 `5×19`·`4×19` 로 잡았다. 통을 굽 높이만큼 들어 올리면 맞닿는 두 면의
     * 법선이 서로 반대(↑ 와 ↓)가 되어 z-fighting 이 원리상 안 난다.
     */
    part(soft(0.92, TUB_LIFT, 0.60, 0.35), [0.26, 0.50, 0.60], [0, TUB_LIFT / 2, 0]),
    /**
     * 안쪽을 **거의 흰색으로** 올렸다. 예전 `[0.62,0.72,0.78]` 은 팔레트를 곱하면
     * 컴컴해서, 파놓은 통이 「물이 든 욕조」가 아니라 **구멍**으로 보였다.
     */
    ...basin(1.00, 0.68, 0.50, 0.06, [0.86, 0.94, 1.00], [0.34, 0.62, 0.72], TILE.CERAMIC)
      .map((p) => part(p.geo, p.rgb, [0, TUB_LIFT, 0], undefined, p.tile)),
    /**
     * **수면.** 이게 없으면 「물통인지 궤짝인지」 알 수 없다 — 사용자가 그렇게 말했다.
     * 턱보다 한 뼘 아래에 깐다. 안쪽 벽에서 6mm 만 띄운다 — 가장자리가 뜨면
     * 「떠 있는 판때기」가 되고, 딱 붙이면 벽과 겹면이 나서 격자무늬가 뜬다.
     *
     * **흰 통에는 물을 «어둡게» 넣어야 보인다.** 팔레트가 거의 흰색이라 1을 넘는
     * 계수는 전부 흰색으로 포화된다 — 밝게 만들려 할수록 통과 안 갈린다.
     *
     * 잔물결은 **부품이 아니라 인쇄**로 넣는다. 처음엔 「뜬 김」 판 둘을 얹었는데
     * 둘이 같은 평면에서 겹쳐 z-fighting 이 났다(자가 `7×8` 로 잡았다).
     * 인쇄면 삼각형도 안 늘고 겹칠 데도 없다.
     */
    part(new BoxGeometry(0.860, 0.014, 0.540), [0.55, 0.78, 0.95], [0, 0.40 + TUB_LIFT, 0],
      undefined, TILE.WATER),
    /**
     * 테두리 — 통 위를 «두르는» 턱. **판 한 장으로 두면 안 된다** —
     * 처음에 1.04 × 0.72 짜리 판을 얹었더니 파놓은 통을 통째로 덮어서
     * 화면에서 「뚜껑 덮인 상자」로 나왔다. 띠 넷으로 두른다.
     */
    part(soft(1.04, 0.045, 0.08, 0.35), [0.30, 0.58, 0.68], [0, 0.515 + TUB_LIFT, 0.32], undefined, TILE.CERAMIC),
    part(soft(1.04, 0.045, 0.08, 0.35), [0.30, 0.58, 0.68], [0, 0.515 + TUB_LIFT, -0.32]),
    part(soft(0.08, 0.045, 0.58, 0.35), [0.30, 0.58, 0.68], [0.48, 0.515 + TUB_LIFT, 0]),
    part(soft(0.08, 0.045, 0.58, 0.35), [0.30, 0.58, 0.68], [-0.48, 0.515 + TUB_LIFT, 0]),
    // 꼭지를 작게. 욕조 꼭지는 턱 바로 위에 붙는다
    ...tap(0, 0.53 + TUB_LIFT, -0.28, 0.7),
  ]),

  /**
   * 변기 (72cm). **물탱크 + 타원 좌대 + 젖힌 뚜껑** 셋이 정체다.
   * 하나만 빠져도 상자거나 의자로 보인다.
   */
  변기: () => assemble([
    part(soft(0.44, 0.42, 0.24, 0.16), WHITE, [0, 0.72, -0.29], undefined, TILE.CERAMIC), // 물탱크
    part(soft(0.48, 0.05, 0.28, 0.35), WHITE, [0, 0.955, -0.29]),        // 탱크 뚜껑
    /**
     * 물 내리는 손잡이. **6면 짜리 반지름 0.026 막대를 키우고 색을 갈랐다** —
     * 화면에서는 탱크에 붙은 점 하나였다.
     */
    part(new CylinderGeometry(0.030, 0.030, 0.06, 10), [0.52, 0.54, 0.58],
      [0.15, 0.86, -0.14], LIE_Z),
    part(new BoxGeometry(0.11, 0.032, 0.032), [0.52, 0.54, 0.58], [0.15, 0.86, -0.10]),
    // 몸통 — 위가 넓고 아래로 좁아지는 도기
    part(new CylinderGeometry(0.30, 0.20, 0.44, SEG.MID).scale(1, 1, 1.15), WHITE, [0, 0.22, 0.02],
      undefined, TILE.CERAMIC),
    // 파인 변기통 — **여기가 없으면 스툴이다**. 안쪽은 밝아야 «파였다»가 읽힌다
    part(invert(new CylinderGeometry(0.255, 0.17, 0.20, SEG.MID), 1, 1.15),
      [0.74, 0.78, 0.82], [0, 0.35, 0.02]),
    // 고인 물 — 욕조와 같은 이유다. 안이 비면 그냥 구멍이다
    part(new CylinderGeometry(0.175, 0.175, 0.012, SEG.SMALL).scale(1, 1, 1.15),
      [0.60, 0.80, 0.95], [0, 0.28, 0.02], undefined, TILE.WATER),
    // 좌대 — 타원 링. 이게 변기의 실루엣이다. 굵혀야 「앉는 데」로 읽힌다
    part(new TorusGeometry(0.28, 0.046, 8, 18).scale(1, 1, 1.15), [0.84, 0.86, 0.88],
      [0, 0.47, 0.02], LIE_Z),
    /**
     * 젖혀 세운 뚜껑. **예전엔 반지름 0.29 짜리 «원반»이라 물탱크보다 커서
     * 화면에서 「떠 있는 접시」로 보였다.** 좌대와 같은 타원으로 줄이고
     * 뒤로 기울여 탱크에 기대게 한다. `.scale` 을 y 가 아니라 z 에 걸어야
     * 두께가 아니라 «타원»이 된다 — 예전 것은 그냥 두꺼운 원반이었다.
     */
    part(new CylinderGeometry(0.265, 0.245, 0.032, SEG.MID).scale(1, 1, 1.15),
      [0.84, 0.86, 0.88], [0, 0.68, -0.165], [Math.PI / 2 - 0.16, 0, 0]),
  ]),

  /**
   * 세면대 (78cm). **기둥 위의 파인 대야**가 정체다.
   * 상자를 벽에 붙이면 그건 선반이다.
   */
  세면대: () => assemble([
    // 기둥 — 아래로 갈수록 넓어지는 도기 페디스털
    part(new CylinderGeometry(0.15, 0.21, 0.58, SEG.MID), WHITE, [0, 0.29, 0], undefined, TILE.CERAMIC),
    /**
     * 대야. **「깨져 보인다」의 나머지 절반이 여기였다.**
     *
     * 예전엔 네모 `basin(0.54, 0.44, …)` 위에 `TorusGeometry(0.28, 0.022)` 를 얹었는데,
     * 링 바깥 반지름이 **0.302** 이고 통 반쪽은 **0.270** 이라 좌우·앞뒤로 3.2cm 씩
     * 삐져나왔다. 네모 통을 꿰뚫고 나온 타원 링 — 그게 화면에서 깨진 그릇이었다.
     *
     * `hollow()` 은 바깥벽·안쪽벽·**테두리**가 전부 같은 `rTop` 에서 파생된다.
     * 어긋날 데가 원리상 없다. 그리고 **`p.tile` 을 그대로 넘긴다** —
     * 예전 `.map()` 은 인쇄 칸을 통째로 버리고 있었다.
     */
    ...hollow(0.31, 0.23, 0.19, 0.032, 0.05, SEG.MID, WHITE, [0.74, 0.79, 0.84], TILE.CERAMIC)
      .map((p) => part(p.geo, p.rgb, [0, 0.56, 0], undefined, p.tile)),
    // 뒤쪽 선반 — 꼭지가 서는 자리. 없으면 꼭지가 허공에 꽂힌 막대다
    part(soft(0.40, 0.075, 0.14, 0.30), WHITE, [0, 0.785, -0.24]),
    ...tap(0, 0.82, -0.235, 1.0),
    // 배수구 + 넘침 구멍 — 도기에 «구멍 둘»이 있어야 세면대다
    part(new CylinderGeometry(0.030, 0.030, 0.010, 10), METAL, [0, 0.620, 0]),
    part(new CylinderGeometry(0.026, 0.026, 0.014, 10), INK, [0, 0.705, 0.252], LIE_Z),
  ]),

  // ─── 뒷마당 ──────────────────────────────────────────────────

  /**
   * 개집 (90cm). **박공 지붕과 뚫린 입구**가 정체다.
   * 상자에 색만 칠하면 그건 궤짝이고, 입구가 안 뚫리면 개가 못 들어간다.
   */
  개집: () => assemble([
    // 몸통 — **마루 «위»에서 시작한다.** 둘 다 y=0 이면 밑면 두 장이 같은 평면이다
    part(soft(0.94, 0.52, 0.86, 0.10), WOOD, [0, 0.31, 0], undefined, TILE.WOOD_C),
    // 박공 지붕 — 두 경사면. **여기가 개집을 개집으로 만든다**
    // 지붕 — 몸통(WOOD)과 대비가 0.04 였다. 지붕은 함석이니 «밝게» 간다
    part(new BoxGeometry(1.00, 0.05, 0.62), [1.15, 0.72, 0.58], [0, 0.72, 0.24], [0.62, 0, 0], TILE.WOOD_C),
    part(new BoxGeometry(0.96, 0.05, 0.62), [1.15, 0.72, 0.58], [0, 0.72, -0.24], [-0.62, 0, 0]),
    // 박공 삼각면 둘 — 지붕 옆을 막는다
    // 박공 삼각면 둘 — 지붕판 «안»으로 물린다. 폭이 지붕과 같으면 옆면이 같은 평면이다
    part(new CylinderGeometry(0.34, 0.34, 0.04, 14), WOOD, [0.455, 0.72, 0], [0, 0, Math.PI / 2]),
    part(new CylinderGeometry(0.34, 0.34, 0.04, 14), WOOD, [-0.465, 0.72, 0], [0, 0, Math.PI / 2]),
    // 뚫린 입구 — 뒤집은 원기둥으로 «안»을 만든다
    // 뚫린 입구 «안» — 개집 안은 깜깜하다. 0.30 으로는 몸통과 대비가 0.07 이었다
    part(invert(new CylinderGeometry(0.24, 0.24, 0.30, 14, 1, true)),
      [0.09, 0.07, 0.06], [0, 0.30, 0.285], LIE_Z),
    part(new CylinderGeometry(0.235, 0.235, 0.02, 14), [0.09, 0.07, 0.06], [0, 0.30, 0.16], LIE_Z),
    // 마루 — 바닥에서 살짝 띄운다
    part(soft(0.98, 0.05, 0.90, 0.35), WOOD, [0, 0.025, 0]),
  ]),

  /**
   * 창고 (180cm) — 골함석 헛간. **골이 있어야 함석이다.**
   * 민짜 상자에 금속색을 칠하면 그건 컨테이너다.
   */
  창고: () => assemble([
    part(soft(0.89, 1.00, 0.75, 0.06), METAL, [0, 0.50, 0], undefined, TILE.METAL),
    // 골함석 — 세로 골 다섯. 옆면에 세로선이 그어져야 함석으로 읽힌다
    // 골함석 — 세로 골 다섯. 길이를 몸통보다 짧게(같으면 끝면이 같은 평면이다)
    ...([-0.32, -0.16, 0, 0.16, 0.32] as const).map((x) =>
      part(new CylinderGeometry(0.022, 0.022, 0.92, 6), [0.86, 0.88, 0.90], [x, 0.50, 0.385], undefined, TILE.WOOD_C)),
    // 한쪽으로 흐르는 지붕 — 평지붕이면 상자다
    // 지붕 — 벽(METAL)과 대비가 0.08 이라 몸통과 한 덩어리였다. 지붕은 «녹슨» 쪽이다
    part(new BoxGeometry(0.98, 0.05, 0.84), [0.34, 0.30, 0.27], [0, 1.03, 0], [0.10, 0, 0]),
    // 여닫이문 둘 + 빗장
    // 여닫이문 둘 — 깊이를 골보다 살짝 앞으로 빼서 같은 평면을 안 만든다
    part(soft(0.32, 0.68, 0.02, 0.20), [0.55, 0.50, 0.44], [-0.17, 0.36, 0.394]),
    part(soft(0.32, 0.66, 0.02, 0.20), [0.55, 0.50, 0.44], [0.17, 0.36, 0.394]),
    part(new CylinderGeometry(0.016, 0.016, 0.24, 6), DARK, [0, 0.44, 0.40], LIE_X),
  ]),

  /**
   * 마당 나무 (260cm). **줄기 + 잎 덩어리 넷.**
   *
   * `size` 는 안 건드린다 — 「이 그루 때문에 `ladder` 가 꼭대기 칸을 얇음으로 잡지만
   * 그 칸은 아무도 안 밟는다」는 판단이 `stage.house.ts` 에 이미 적혀 있다.
   * 이번 작업은 **형상만** 바꾼다.
   */
  나무: () => assemble([
    // 줄기 — 몸통이 «잎 덩어리»라 그것과 갈려야 한다. `WOOD`(0.40)로는 대비가 0.10 이다
    // 줄기 — **뿌리목 «위»에서 시작한다.** 둘 다 y=0 이면 밑면 두 장이 같은 평면이다
    part(new CylinderGeometry(0.09, 0.15, 1.05, 20), [0.34, 0.24, 0.16], [0, 0.625, 0],
      undefined, TILE.WOOD_C),
    // 갈라진 가지 둘 — 줄기 하나면 기둥이다
    part(new CylinderGeometry(0.045, 0.07, 0.50, 14), [0.34, 0.24, 0.16], [0.14, 1.20, 0.04], [0, 0, -0.42]),
    part(new CylinderGeometry(0.045, 0.07, 0.46, 14), [0.34, 0.24, 0.16], [-0.13, 1.18, -0.05], [0, 0, 0.40]),
    // 잎 덩어리 넷 — 하나면 사탕, 넷이면 나무다
    part(new SphereGeometry(0.36, 20, 13).scale(1, 0.86, 1), [0.36, 0.62, 0.28], [0, 1.72, 0],
      undefined, TILE.LEAF),
    // 아래쪽 잎 덩어리는 «그늘»이다. 0.30 은 큰 덩어리와 대비가 0.06 이라
    // 넷이 한 덩어리로 뭉쳤다 — 그늘답게 확실히 내린다
    part(new SphereGeometry(0.26, 20, 13).scale(1, 0.86, 1), [0.18, 0.34, 0.14], [0.30, 1.46, 0.08]),
    part(new SphereGeometry(0.24, 20, 13).scale(1, 0.86, 1), [0.18, 0.34, 0.14], [-0.28, 1.42, -0.10]),
    part(new SphereGeometry(0.22, 20, 13).scale(1, 0.86, 1), [0.56, 0.92, 0.42], [0.10, 2.00, -0.12]),
    // 뿌리목 — 바닥에서 벌어진다
    part(new CylinderGeometry(0.20, 0.28, 0.10, 20), [0.34, 0.24, 0.16], [0, 0.05, 0]),
  ]),

  /**
   * 평상 (110cm) — 마당에 놓는 나무 평상. **널 다섯 장과 다리 넷.**
   * 통짜 판이면 대(臺)가 아니라 상자다. **밑이 뚫린다**(`underPass`).
   */
  평상: () => assemble([
    // 널 다섯 — 사이 틈이 「평상」을 만든다
    ...([-0.40, -0.20, 0, 0.20, 0.40] as const).map((z) =>
      part(soft(1.00, 0.05, 0.17, 0.30), WOOD, [0, 0.325, z], undefined, TILE.WOOD_C)),
    // 테두리 두 줄
    // 테두리 두 줄 — 널(WOOD)과 대비가 0.02 였다. 테두리는 «짙은» 마구리다
    part(soft(1.00, 0.055, 0.04, 0.35), [0.24, 0.17, 0.11], [0, 0.325, 0.48]),
    part(soft(1.00, 0.055, 0.04, 0.35), [0.24, 0.17, 0.11], [0, 0.325, -0.48]),
    // 다리 넷
    ...([[0.44, 0.42], [-0.44, 0.42], [0.44, -0.42], [-0.44, -0.42]] as const).map(
      ([x, z]) => part(soft(0.08, 0.30, 0.08, 0.30), WOOD, [x, 0.15, z])),
  ]),

  /**
   * 빨래 기둥 (170cm). **T자 가로대**가 정체다.
   * 기둥 하나면 그냥 막대고, 가로대가 있어야 빨랫줄을 거는 것으로 읽힌다.
   * (줄 자체는 «공중에 뜬 면»이라 못 만든다 — 밥상 상판과 같은 한계다)
   */
  '빨래 기둥': () => assemble([
    // 기둥 — **밑동 «위»에서 시작한다.** 둘 다 y=0 이면 밑면 두 장이 같은 평면이다
    part(new CylinderGeometry(0.035, 0.045, 0.94, 10), METAL, [0, 0.53, 0]),
    // 가로대 + 끝 마개 둘
    part(new CylinderGeometry(0.026, 0.026, 0.34, 10), METAL, [0, 0.97, 0], LIE_X),
    part(new SphereGeometry(0.034, 10, 7), METAL, [0.17, 0.97, 0], undefined, TILE.METAL),
    part(new SphereGeometry(0.034, 10, 7), METAL, [-0.17, 0.97, 0]),
    // 버팀대 둘 — 기둥이 안 흔들리게
    part(new CylinderGeometry(0.016, 0.016, 0.26, 6), METAL, [0.07, 0.86, 0], [0, 0, -0.62]),
    part(new CylinderGeometry(0.016, 0.016, 0.26, 6), METAL, [-0.07, 0.86, 0], [0, 0, 0.62]),
    // 콘크리트 밑동
    // 콘크리트 밑동 — `METAL`(0.72,0.74,0.78)과 대비가 0.02 였다. 콘크리트는 «칙칙»하다
    part(new CylinderGeometry(0.13, 0.17, 0.12, 14), [0.36, 0.35, 0.33], [0, 0.06, 0], undefined, TILE.STONE),
  ]),
};
