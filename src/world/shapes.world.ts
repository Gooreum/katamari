import {
  BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { ShapeIdWorld } from './generation';
import { assemble, DARK, GLASS, METAL, part, PAPER, WHITE, WOOD } from './shapes.kit';

const LIE_X: readonly [number, number, number] = [0, 0, Math.PI / 2];
const LIE_Z: readonly [number, number, number] = [Math.PI / 2, 0, 0];

/**
 * World 맵(Urchin Town) 전용 형태 — **1.15m ~ 4m**.
 *
 * 동네에서 이만한 것들은 전부 `CityBuilding`(못 먹는 배경)이었다.
 * World는 공이 **50cm에서 시작**해 6m까지 가므로 여기서는 **먹는 물건**이다.
 * 그래서 실루엣이 배경보다 또렷해야 한다 — 바퀴·다리·기둥이 보여야 한다.
 *
 * 원작 Urchin Town 특징(양쪽 끝의 공원과 학교, 주유소, 정글짐)에서 뽑았다.
 * 규약은 `shapes.kit.ts` 그대로 — 단위 정육면체, 바닥 y=−0.5, 최장축 1.0.
 */
export const WORLD_BUILDERS: Record<ShapeIdWorld, () => BufferGeometry> = {
  // ── 버킷 5 (1.15~2.14m) ───────────────────────────────────
  자전거: () => assemble([
    // 바퀴 둘이 실루엣의 전부다. 프레임은 그 사이를 잇는 선이면 족하다.
    // **바퀴에 LIE_Z 를 걸면 안 된다** — Torus 는 기본이 XY 평면(구멍이 Z축)이라
    // 그대로 두면 서 있고, 눕히면 바닥에 붙은 팬케이크가 된다 (처음에 그렇게 나왔다).
    // **바퀴 간격이 반지름보다 커야 한다.** `normalize()` 가 최장축을 1.0으로 줄이는데,
    // 처음엔 간격 0.34 · 반지름 0.30이라 줄이고 나니 두 바퀴가 겹쳐 안경처럼 보였다.
    part(new TorusGeometry(0.26, 0.06, 5, 14), DARK, [-0.44, 0.26, 0]),
    part(new TorusGeometry(0.26, 0.06, 5, 14), DARK, [0.44, 0.26, 0]),
    // 프레임은 **굵어야 남는다** — 0.028은 이 크기에서 사라졌다
    part(new CylinderGeometry(0.05, 0.05, 0.80, 5), WHITE, [0, 0.42, 0], LIE_X),
    part(new CylinderGeometry(0.05, 0.05, 0.44, 5), WHITE, [-0.24, 0.32, 0], [0, 0, 0.7]),
    part(new CylinderGeometry(0.05, 0.05, 0.48, 5), WHITE, [0.26, 0.38, 0], [0, 0, -0.6]),
    // 안장 + 핸들
    part(new BoxGeometry(0.22, 0.07, 0.12), DARK, [-0.10, 0.62, 0]),
    part(new CylinderGeometry(0.035, 0.035, 0.36, 5), METAL, [0.44, 0.64, 0], LIE_Z),
    part(new CylinderGeometry(0.04, 0.04, 0.24, 5), METAL, [0.44, 0.54, 0]),
  ]),

  오토바이: () => assemble([
    part(new TorusGeometry(0.24, 0.09, 5, 12), DARK, [-0.42, 0.24, 0]),
    part(new TorusGeometry(0.24, 0.09, 5, 12), DARK, [0.42, 0.24, 0]),
    // 자전거보다 몸통이 굵다 — 그게 구분점이다
    part(new BoxGeometry(0.72, 0.26, 0.26), WHITE, [0, 0.40, 0]),
    part(new BoxGeometry(0.30, 0.18, 0.28), WHITE, [-0.26, 0.58, 0]),
    part(new CylinderGeometry(0.035, 0.035, 0.34, 5), METAL, [0.42, 0.62, 0], LIE_Z),
    part(new CylinderGeometry(0.06, 0.06, 0.34, 6), METAL, [0.40, 0.44, 0], [0, 0, -0.4]),
    part(new SphereGeometry(0.12, 7, 5), GLASS, [0.50, 0.50, 0]),
  ]),

  우체통: () => assemble([
    // 기둥 위에 둥근 통. 동네의 그것보다 크고 다리가 보인다
    part(new CylinderGeometry(0.10, 0.12, 0.44, 8), METAL, [0, 0.22, 0]),
    part(new BoxGeometry(0.44, 0.46, 0.34), WHITE, [0, 0.66, 0]),
    part(new CylinderGeometry(0.22, 0.22, 0.34, 10, 1, false, 0, Math.PI), WHITE, [0, 0.89, 0], LIE_Z),
    // 투입구
    part(new BoxGeometry(0.30, 0.05, 0.36), DARK, [0, 0.80, 0]),
  ]),

  표지판: () => assemble([
    part(new CylinderGeometry(0.045, 0.045, 1.10, 6), METAL, [0, 0.55, 0]),
    part(new CylinderGeometry(0.34, 0.34, 0.06, 12), WHITE, [0, 1.02, 0], LIE_Z),
    part(new CylinderGeometry(0.24, 0.24, 0.08, 12), PAPER, [0, 1.02, 0], LIE_Z),
    part(new BoxGeometry(0.30, 0.05, 0.30), METAL, [0, 0.025, 0]),
  ]),

  드럼통: () => assemble([
    part(new CylinderGeometry(0.40, 0.40, 1.00, 12), WHITE, [0, 0.50, 0]),
    // 테 둘 — 이게 있어야 드럼통이다
    part(new TorusGeometry(0.41, 0.035, 4, 12), METAL, [0, 0.28, 0], LIE_Z),
    part(new TorusGeometry(0.41, 0.035, 4, 12), METAL, [0, 0.72, 0], LIE_Z),
    part(new CylinderGeometry(0.38, 0.38, 0.05, 12), METAL, [0, 1.00, 0]),
  ]),

  벤치: () => assemble([
    part(new BoxGeometry(1.20, 0.08, 0.40), WOOD, [0, 0.44, 0]),
    part(new BoxGeometry(1.20, 0.34, 0.07), WOOD, [0, 0.64, -0.17]),
    // 다리 넷 — 주철 느낌으로 어둡게
    ...[[-0.50, 0.15], [-0.50, -0.15], [0.50, 0.15], [0.50, -0.15]].map(
      ([x, z]) => part(new BoxGeometry(0.08, 0.44, 0.08), DARK, [x!, 0.22, z!]),
    ),
  ]),

  그네: () => assemble([
    // **판이 커야 그네로 읽힌다.** 처음엔 A자 프레임만 보이고 판이 안 보여서
    // 뒤집힌 A 두 개처럼 읽혔다 — 판을 키우고 줄을 굵혔다.
    part(new CylinderGeometry(0.05, 0.05, 1.15, 6), METAL, [-0.46, 0.56, 0.26], [0.42, 0, 0]),
    part(new CylinderGeometry(0.05, 0.05, 1.15, 6), METAL, [-0.46, 0.56, -0.26], [-0.42, 0, 0]),
    part(new CylinderGeometry(0.05, 0.05, 1.15, 6), METAL, [0.46, 0.56, 0.26], [0.42, 0, 0]),
    part(new CylinderGeometry(0.05, 0.05, 1.15, 6), METAL, [0.46, 0.56, -0.26], [-0.42, 0, 0]),
    part(new CylinderGeometry(0.055, 0.055, 1.05, 6), METAL, [0, 1.08, 0], LIE_Z),
    part(new CylinderGeometry(0.028, 0.028, 0.58, 4), DARK, [-0.24, 0.78, 0]),
    part(new CylinderGeometry(0.028, 0.028, 0.58, 4), DARK, [0.24, 0.78, 0]),
    part(new BoxGeometry(0.66, 0.09, 0.30), WHITE, [0, 0.48, 0]),
  ]),

  // ── 버킷 6 (2.14~4m) ──────────────────────────────────────
  자판기: () => assemble([
    part(new BoxGeometry(0.66, 1.10, 0.44), WHITE, [0, 0.55, 0]),
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
    part(new BoxGeometry(0.10, 1.00, 0.10), METAL, [-0.44, 0.50, 0.22]),
    part(new BoxGeometry(0.10, 1.00, 0.10), METAL, [-0.44, 0.50, -0.22]),
    part(new BoxGeometry(0.40, 0.06, 0.54), WHITE, [-0.44, 1.00, 0]),
    // 경사판 + 난간
    part(new BoxGeometry(1.10, 0.06, 0.50), WHITE, [0.16, 0.56, 0], [0, 0, -0.52]),
    part(new BoxGeometry(1.10, 0.14, 0.05), METAL, [0.16, 0.66, 0.25], [0, 0, -0.52]),
    part(new BoxGeometry(1.10, 0.14, 0.05), METAL, [0.16, 0.66, -0.25], [0, 0, -0.52]),
    // 사다리 발판
    ...[0, 1, 2].map((i) => part(
      new BoxGeometry(0.34, 0.04, 0.04), METAL, [-0.44, 0.28 + i * 0.24, 0],
    )),
  ]),

  사람: () => assemble([
    // 카타마리에서 사람은 배경이 아니라 **물건**이다. 서 있는 자세
    part(new CylinderGeometry(0.11, 0.11, 0.44, 7), WHITE, [0, 0.22, -0.06]),
    part(new CylinderGeometry(0.11, 0.11, 0.44, 7), WHITE, [0, 0.22, 0.06]),
    part(new BoxGeometry(0.30, 0.46, 0.20), WHITE, [0, 0.66, 0]),
    part(new SphereGeometry(0.15, 8, 6), [0.95, 0.8, 0.7], [0, 1.02, 0]),
    part(new SphereGeometry(0.16, 7, 5).scale(1, 0.6, 1), DARK, [0, 1.10, 0]),
    // 팔 둘
    part(new CylinderGeometry(0.06, 0.06, 0.42, 6), WHITE, [0, 0.64, -0.21], [0.12, 0, 0]),
    part(new CylinderGeometry(0.06, 0.06, 0.42, 6), WHITE, [0, 0.64, 0.21], [-0.12, 0, 0]),
  ]),

  승용차: () => assemble([
    // 낮은 물체라 위쪽을 비운다 (shapes.kit 규약 2번)
    part(new BoxGeometry(1.30, 0.30, 0.60), WHITE, [0, 0.30, 0]),
    part(new BoxGeometry(0.66, 0.26, 0.54), GLASS, [-0.06, 0.56, 0]),
    part(new BoxGeometry(0.60, 0.22, 0.56), WHITE, [-0.06, 0.58, 0]),
    ...[[-0.42, 0.31], [-0.42, -0.31], [0.42, 0.31], [0.42, -0.31]].map(
      ([x, z]) => part(new CylinderGeometry(0.17, 0.17, 0.10, 9), DARK, [x!, 0.17, z!], LIE_Z),
    ),
    part(new SphereGeometry(0.07, 5, 4), PAPER, [0.64, 0.32, 0.20]),
    part(new SphereGeometry(0.07, 5, 4), PAPER, [0.64, 0.32, -0.20]),
  ]),

  가로수: () => assemble([
    part(new CylinderGeometry(0.10, 0.14, 0.62, 7), WOOD, [0, 0.31, 0]),
    // 잎은 덩어리 셋 — 하나면 사탕처럼 보인다
    part(new SphereGeometry(0.40, 9, 7), WHITE, [0, 0.86, 0]),
    part(new SphereGeometry(0.28, 8, 6), WHITE, [-0.26, 0.72, 0.10]),
    part(new SphereGeometry(0.26, 8, 6), WHITE, [0.24, 0.76, -0.12]),
  ]),
};
