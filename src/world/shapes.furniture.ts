import {
  BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { ShapeIdFurniture } from './generation';
import { assemble, DARK, PAPER, part, WHITE, WOOD } from './shapes.kit';
import { TILE } from './atlas';

/** X축으로 돌린 원기둥·토러스 — 축이 Z가 된다 */
const LIE_Z: readonly [number, number, number] = [Math.PI / 2, 0, 0];
/** 눕힌 원기둥. 원기둥 축은 Y라 Z로 90° 돌리면 X축이 된다 */
const LIE_X: readonly [number, number, number] = [0, 0, Math.PI / 2];

/**
 * **거실 가구 형상 — 여섯 종.**
 *
 * ## 왜 이 파일이 생겼나
 *
 * 거실 가구는 `CityBuilding` 이었다 — 2D 외곽선을 y=0부터 위로 뽑는 것뿐이라
 * **프리즘밖에 못 만든다.** 그래서 화면에서 텔레비전이 상자 두 개, 서랍장이 상자
 * 세 개, 밥상이 각기둥 넷에 상판은 떠 있는 텍스처였다.
 *
 * **그런데 형상 자체는 이미 있었다.** `shapes.large.ts` 의 텔레비전은 다이얼 둘과
 * 안테나 둘까지 붙은 9부품이고, 서랍장은 서랍 3단, 스탠드는 갓과 전구가 있다.
 * 거실이 그걸 안 쓰고 있었을 뿐이다 — 손으로 「여기에 이 형상을 놓아라」고 말할
 * 경로가 없었기 때문이다(`StageProp` 이 그걸 뚫었다).
 *
 * 그래서 여기 있는 건 **그 목록에 아예 없던 것들**뿐이다:
 * TV장 · 책장 · 밥상 · 신문더미 · 화분대 · 방석더미.
 *
 * ## 상자와 가구를 가르는 것
 *
 * 덩어리 하나로는 절대 안 읽힌다. 그 물건을 그 물건으로 만드는 **한 끗**이 있다:
 *
 *   책장 → 선반 칸       밥상 → 상판       TV장 → 뚫린 아래 칸
 *   신문더미 → 어긋난 겹  화분대 → 다리 셋   방석더미 → 어긋나게 포갠 세 장
 *
 * 부품을 아끼면 그 한 끗이 먼저 죽는다. 가구는 화면에서 소품보다 훨씬 크게 보이고
 * 방마다 열댓 개뿐이라, 소품보다 부품을 넉넉히 써도 삼각형 예산에 여유가 있다.
 *
 * ## 규약
 *
 * 기존 빌더와 같다. `shapes.kit.ts` 만 import 하고(`shapes.ts` 를 import 하면 순환 참조),
 * 치수는 실제 cm 감각으로 쓰며, `assemble()` 의 `normalize()` 가 최장축을 1.0으로 맞춘다.
 * **`part()` 의 5번째 인자는 배율이 아니라 인쇄 칸 번호다.**
 */
export const FURNITURE_BUILDERS: Record<ShapeIdFurniture, () => BufferGeometry> = {

  /**
   * TV 받침대 (100cm).
   *
   * **아래 칸이 뚫려 있어야 장식장으로 읽힌다** — 통짜면 그냥 상자고, 그게 여태
   * 거실에 서 있던 것이다. 상판·측판·선반·뒷판을 따로 세워 칸을 만든다.
   */
  TV장: () => assemble([
    part(new BoxGeometry(1.00, 0.05, 0.46), WHITE, [0, 0.42, 0]),        // 상판
    part(new BoxGeometry(0.05, 0.40, 0.46), WHITE, [-0.475, 0.20, 0]),   // 측판
    part(new BoxGeometry(0.05, 0.40, 0.46), WHITE, [0.475, 0.20, 0]),
    part(new BoxGeometry(0.90, 0.035, 0.44), WOOD, [0, 0.20, 0]),        // 가운데 선반
    part(new BoxGeometry(0.90, 0.36, 0.03), WOOD, [0, 0.22, -0.215]),    // 뒷판
    // 굽 넷. 바닥에 딱 붙으면 상자로 보인다
    ...([[0.42, 0.18], [-0.42, 0.18], [0.42, -0.18], [-0.42, -0.18]] as const).map(
      ([x, z]) => part(new BoxGeometry(0.06, 0.06, 0.06), DARK, [x, 0.03, z])),
  ]),

  /**
   * 책장 (105cm).
   *
   * **선반이 가로선을 그어야 칸이 생긴다.** 측판·뒷판만 있으면 벽에 붙은 판때기다.
   * 여태 거실 책장은 압출 조각 넷이라 세로선만 있었다.
   */
  책장: () => assemble([
    part(new BoxGeometry(0.05, 1.00, 0.32), WHITE, [-0.34, 0.50, 0]),    // 측판
    part(new BoxGeometry(0.05, 1.00, 0.32), WHITE, [0.34, 0.50, 0]),
    part(new BoxGeometry(0.73, 0.04, 0.32), WHITE, [0, 0.98, 0]),        // 위 마감
    part(new BoxGeometry(0.68, 0.98, 0.03), PAPER, [0, 0.50, -0.155]),   // 뒷판
    // 선반 셋 — 이게 책장의 정체다
    ...([0.30, 0.56, 0.82] as const).map((y) =>
      part(new BoxGeometry(0.68, 0.032, 0.30), WOOD, [0, y, 0])),
    part(new BoxGeometry(0.73, 0.06, 0.32), WOOD, [0, 0.03, 0]),         // 굽
  ]),

  /**
   * 차부다이 (95cm) — 상에 둘러앉는 낮은 원형 상.
   *
   * **여태 이건 각기둥 넷이었고 상판은 그 위에 떠 있는 텍스처 평면이었다.**
   * 나무 판때기가 하나도 없었다. 상판 없는 상은 상이 아니다.
   */
  밥상: () => assemble([
    part(new CylinderGeometry(0.50, 0.50, 0.05, 20), WHITE, [0, 0.325, 0]),
    // 테두리 — 상판 옆면에 한 줄을 그어야 판이 두께를 갖는다
    part(new TorusGeometry(0.49, 0.022, 4, 20), WOOD, [0, 0.325, 0], LIE_Z),
    // 다리 넷. 상판 지름(1.0)보다 안쪽에 모아야 상다리로 보인다
    ...([[0.30, 0.30], [-0.30, 0.30], [0.30, -0.30], [-0.30, -0.30]] as const).map(
      ([x, z]) => part(new CylinderGeometry(0.030, 0.024, 0.30, 6), WOOD, [x, 0.15, z])),
    // 다리를 잇는 가로대. 없으면 다리가 허공에 꽂힌 막대로 보인다
    part(new BoxGeometry(0.58, 0.025, 0.025), WOOD, [0, 0.08, 0.30]),
    part(new BoxGeometry(0.58, 0.025, 0.025), WOOD, [0, 0.08, -0.30]),
  ]),

  /**
   * 쌓아둔 신문 (45cm).
   *
   * **겹이 어긋나야 더미로 읽힌다** — 반듯하게 쌓으면 그냥 상자다.
   * 신문·찌라시 인쇄를 번갈아 물려 층마다 다른 지면이 나오게 한다.
   */
  신문더미: () => assemble([
    part(new BoxGeometry(1.00, 0.09, 0.66), WHITE, [0, 0.045, 0], [0, 0.04, 0], TILE.NEWSPAPER),
    part(new BoxGeometry(0.96, 0.08, 0.64), PAPER, [0.02, 0.13, 0.02], [0, -0.06, 0]),
    part(new BoxGeometry(0.98, 0.08, 0.62), WHITE, [-0.02, 0.21, -0.01], [0, 0.09, 0], TILE.FLYER),
    part(new BoxGeometry(0.92, 0.07, 0.60), PAPER, [0.03, 0.28, 0.01], [0, -0.03, 0]),
    // 묶은 끈 둘. 더미를 묶어야 더미다
    part(new BoxGeometry(0.05, 0.34, 0.70), [0.55, 0.42, 0.30], [-0.24, 0.16, 0]),
    part(new BoxGeometry(0.05, 0.34, 0.70), [0.55, 0.42, 0.30], [0.24, 0.16, 0]),
  ]),

  /**
   * 화분대 (55cm) — 다리 셋짜리 낮은 원형 스탠드.
   * 아래 선반이 있어야 「대」로 읽힌다.
   */
  화분대: () => assemble([
    part(new CylinderGeometry(0.34, 0.34, 0.045, 20), WHITE, [0, 0.98, 0]),  // 상판
    part(new TorusGeometry(0.33, 0.018, 4, 20), WOOD, [0, 0.98, 0], LIE_Z),
    // 다리 셋. 120°씩
    ...([0, 2.0944, 4.1888] as const).map((a) =>
      part(new CylinderGeometry(0.028, 0.022, 0.96, 6), WOOD,
        [Math.cos(a) * 0.26, 0.48, Math.sin(a) * 0.26])),
    part(new CylinderGeometry(0.20, 0.20, 0.03, 14), WOOD, [0, 0.26, 0]),    // 아래 선반
    // 다리를 묶는 가로대 — 없으면 다리 셋이 따로 논다
    part(new TorusGeometry(0.255, 0.014, 4, 20), WOOD, [0, 0.62, 0], LIE_Z),
  ]),

  /**
   * 개어 쌓아둔 방석 (50cm).
   * 세 장이 **어긋나게** 포개져야 쌓인 것으로 읽힌다.
   */
  방석더미: () => assemble([
    part(new SphereGeometry(0.5, 16, 10).scale(1, 0.20, 1), WHITE, [0, 0.05, 0]),
    part(new SphereGeometry(0.48, 16, 10).scale(1, 0.20, 1), PAPER, [0.03, 0.14, 0.02], [0, 0.22, 0]),
    part(new SphereGeometry(0.46, 16, 10).scale(1, 0.20, 1), WHITE, [-0.02, 0.23, -0.02], [0, -0.16, 0]),
    // 가장자리 시접 — 방석을 방석으로 만드는 테두리
    part(new TorusGeometry(0.42, 0.024, 4, 20), PAPER, [0, 0.045, 0], LIE_Z),
    part(new TorusGeometry(0.39, 0.022, 4, 20), PAPER, [-0.02, 0.235, -0.02], LIE_Z),
    part(new CylinderGeometry(0.04, 0.04, 0.02, 8), PAPER, [-0.02, 0.29, -0.02]),   // 단추
    part(new CylinderGeometry(0.012, 0.012, 0.10, 5), PAPER, [0.30, 0.05, 0.30], LIE_X),  // 술
  ]),
};
