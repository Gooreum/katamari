import {
  BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { ShapeIdWorld } from './generation';
import { assemble, DARK, GLASS, METAL, part, PAPER, WHITE, WOOD } from './shapes.kit';

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
  벽돌: () => assemble([
    // 구멍 셋이 실루엣의 전부다. 없으면 그냥 상자다.
    part(new BoxGeometry(1.0, 0.42, 0.46), WHITE),
    part(new BoxGeometry(0.16, 0.44, 0.16), DARK, [-0.26, 0, 0]),
    part(new BoxGeometry(0.16, 0.44, 0.16), DARK, [0, 0, 0]),
    part(new BoxGeometry(0.16, 0.44, 0.16), DARK, [0.26, 0, 0]),
  ]),

  축구공: () => assemble([
    part(new SphereGeometry(0.5, 16, 10), WHITE),
    // 검은 조각 다섯. 구면에 살짝 박아 실루엣은 안 건드린다 —
    // 밖으로 튀어나오면 normalize() 가 그만큼 전체를 줄여서 공이 작아진다.
    part(new SphereGeometry(0.15, 12, 8), DARK, [0, 0.44, 0]),
    part(new SphereGeometry(0.13, 12, 8), DARK, [0.40, 0.10, 0.22]),
    part(new SphereGeometry(0.13, 12, 8), DARK, [-0.40, 0.10, 0.22]),
    part(new SphereGeometry(0.13, 12, 8), DARK, [0.22, 0.05, -0.42]),
    part(new SphereGeometry(0.13, 12, 8), DARK, [-0.22, 0.05, -0.42]),
  ]),

  // ── 33~61cm (주유소·노변) ─────────────────────────────────
  타이어: () => assemble([
    // 눕혀 놓은 폐타이어. Torus 는 기본이 XY 평면(구멍이 Z축)이라
    // 세로로 서 있다 — 눕히려면 LIE_Z 를 걸어야 한다.
    part(new TorusGeometry(0.34, 0.16, 6, 20), DARK, [0, 0, 0], LIE_Z),
    // 가운데 휠. 이게 없으면 도넛 구멍이 뚫린 링이라 타이어로 안 읽힌다
    part(new CylinderGeometry(0.20, 0.20, 0.22, 14), WHITE),
  ]),

  // ── 61cm~1.15m (거리 설비) ────────────────────────────────
  소화전: () => assemble([
    part(new CylinderGeometry(0.10, 0.13, 0.14, 14), METAL, [0, -0.43, 0]),
    part(new CylinderGeometry(0.17, 0.19, 0.62, 14), WHITE, [0, -0.05, 0]),
    part(new SphereGeometry(0.17, 14, 9), WHITE, [0, 0.26, 0]),
    part(new CylinderGeometry(0.05, 0.05, 0.10, 10), METAL, [0, 0.40, 0]),
    // 양옆 배출구가 소화전을 소화전으로 만든다. 이게 없으면 볼라드와 구별이 안 된다
    part(new CylinderGeometry(0.08, 0.08, 0.16, 10), METAL, [0.22, 0.02, 0], LIE_X),
    part(new CylinderGeometry(0.08, 0.08, 0.16, 10), METAL, [-0.22, 0.02, 0], LIE_X),
  ]),

  볼라드: () => assemble([
    part(new CylinderGeometry(0.13, 0.15, 0.86, 14), WHITE, [0, -0.05, 0]),
    part(new SphereGeometry(0.13, 14, 9), WHITE, [0, 0.38, 0]),
    // 반사띠 둘 — 이게 없으면 그냥 기둥이다
    part(new CylinderGeometry(0.145, 0.145, 0.09, 14), PAPER, [0, 0.20, 0]),
    part(new CylinderGeometry(0.155, 0.155, 0.09, 14), PAPER, [0, -0.10, 0]),
  ]),

  입간판: () => assemble([
    // A자 간판. **회전 부호가 이 형태의 전부다.** `part` 는 회전을 먼저 적용하므로
    // rotateX(+θ) 는 판의 윗변을 +z 로 보낸다. 거기에 +z 이동까지 더하면 위가
    // 벌어져 V자 — 등을 바닥에 대고 펼친 책이 된다. 처음에 그렇게 나왔고
    // (위 0.649 벌어짐 · 아래 0.084) 렌더에서는 그냥 판자로 보였다.
    // 부호를 뒤집어야 위끝이 z≈0 에 모여 옆에서 삼각형으로 읽힌다.
    //
    // 각도 0.32rad(18°)는 실물에서 왔다 — 입간판은 높이 0.9m · 밑변 0.6m 라
    // **깊이/높이가 0.65** 다. 조립·정규화까지 마친 지오메트리로 재서 고른 값이다.
    // 판 하나만 재면 0.38 이 맞아 보이는데, 그건 판 두께가 깊이에 더해지는 걸
    // 빼먹은 계산이다 (0.38 로는 0.76 이 나왔다).
    part(new BoxGeometry(0.66, 0.86, 0.05), WHITE, [0, 0, 0.115], [-0.32, 0, 0]),
    part(new BoxGeometry(0.66, 0.86, 0.05), WHITE, [0, 0, -0.115], [0.32, 0, 0]),
    // 종이는 판의 **바깥면 법선**을 따라 0.035 띄운다 — 판 두께 절반이 0.025라
    // 그보다 작으면 면 안에 파묻혀 안 보인다
    part(new BoxGeometry(0.52, 0.30, 0.02), PAPER, [0, 0.068, 0.129], [-0.32, 0, 0]),
    // 경첩은 두 판의 **실제 윗끝**(y≈0.41)에 온다. 예전엔 0.36 이었는데
    // 그 높이에서 두 판이 한참 벌어져 있어 아무것도 잇지 않았다
    part(new CylinderGeometry(0.02, 0.02, 0.30, 6), WOOD, [0, 0.41, 0], LIE_X),
  ]),

  // ── 버킷 5 (1.15~2.14m) ───────────────────────────────────
  자전거: () => assemble([
    // 바퀴 둘이 실루엣의 전부다. 프레임은 그 사이를 잇는 선이면 족하다.
    // **바퀴에 LIE_Z 를 걸면 안 된다** — Torus 는 기본이 XY 평면(구멍이 Z축)이라
    // 그대로 두면 서 있고, 눕히면 바닥에 붙은 팬케이크가 된다 (처음에 그렇게 나왔다).
    // **바퀴 간격이 반지름보다 커야 한다.** `normalize()` 가 최장축을 1.0으로 줄이는데,
    // 처음엔 간격 0.34 · 반지름 0.30이라 줄이고 나니 두 바퀴가 겹쳐 안경처럼 보였다.
    part(new TorusGeometry(0.26, 0.06, 5, 20), DARK, [-0.44, 0.26, 0]),
    part(new TorusGeometry(0.26, 0.06, 5, 20), DARK, [0.44, 0.26, 0]),
    // 프레임은 **굵어야 남는다** — 0.028은 이 크기에서 사라졌다
    part(new CylinderGeometry(0.05, 0.05, 0.80, 14), WHITE, [0, 0.42, 0], LIE_X),
    part(new CylinderGeometry(0.05, 0.05, 0.44, 14), WHITE, [-0.24, 0.32, 0], [0, 0, 0.7]),
    part(new CylinderGeometry(0.05, 0.05, 0.48, 14), WHITE, [0.26, 0.38, 0], [0, 0, -0.6]),
    // 안장 + 핸들
    part(new BoxGeometry(0.22, 0.07, 0.12), DARK, [-0.10, 0.62, 0]),
    part(new CylinderGeometry(0.035, 0.035, 0.36, 10), METAL, [0.44, 0.64, 0], LIE_Z),
    part(new CylinderGeometry(0.04, 0.04, 0.24, 10), METAL, [0.44, 0.54, 0]),
  ]),

  오토바이: () => assemble([
    part(new TorusGeometry(0.24, 0.09, 5, 14), DARK, [-0.42, 0.24, 0]),
    part(new TorusGeometry(0.24, 0.09, 5, 14), DARK, [0.42, 0.24, 0]),
    // 자전거보다 몸통이 굵다 — 그게 구분점이다
    part(new BoxGeometry(0.72, 0.26, 0.26), WHITE, [0, 0.40, 0]),
    part(new BoxGeometry(0.30, 0.18, 0.28), WHITE, [-0.26, 0.58, 0]),
    part(new CylinderGeometry(0.035, 0.035, 0.34, 10), METAL, [0.42, 0.62, 0], LIE_Z),
    part(new CylinderGeometry(0.06, 0.06, 0.34, 14), METAL, [0.40, 0.44, 0], [0, 0, -0.4]),
    part(new SphereGeometry(0.12, 14, 9), GLASS, [0.50, 0.50, 0]),
  ]),

  우체통: () => assemble([
    // 기둥 위에 둥근 통. 동네의 그것보다 크고 다리가 보인다
    part(new CylinderGeometry(0.10, 0.12, 0.44, 14), METAL, [0, 0.22, 0]),
    part(new BoxGeometry(0.44, 0.46, 0.34), WHITE, [0, 0.66, 0]),
    part(new CylinderGeometry(0.22, 0.22, 0.34, 20, 1, false, 0, Math.PI), WHITE, [0, 0.89, 0], LIE_Z),
    // 투입구
    part(new BoxGeometry(0.30, 0.05, 0.36), DARK, [0, 0.80, 0]),
  ]),

  표지판: () => assemble([
    part(new CylinderGeometry(0.045, 0.045, 1.10, 10), METAL, [0, 0.55, 0]),
    part(new CylinderGeometry(0.34, 0.34, 0.06, 20), WHITE, [0, 1.02, 0], LIE_Z),
    part(new CylinderGeometry(0.24, 0.24, 0.08, 20), PAPER, [0, 1.02, 0], LIE_Z),
    part(new BoxGeometry(0.30, 0.05, 0.30), METAL, [0, 0.025, 0]),
  ]),

  드럼통: () => assemble([
    part(new CylinderGeometry(0.40, 0.40, 1.00, 20), WHITE, [0, 0.50, 0]),
    // 테 둘 — 이게 있어야 드럼통이다
    part(new TorusGeometry(0.41, 0.035, 4, 20), METAL, [0, 0.28, 0], LIE_Z),
    part(new TorusGeometry(0.41, 0.035, 4, 20), METAL, [0, 0.72, 0], LIE_Z),
    part(new CylinderGeometry(0.38, 0.38, 0.05, 20), METAL, [0, 1.00, 0]),
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
    part(new CylinderGeometry(0.05, 0.05, 1.15, 10), METAL, [-0.46, 0.56, 0.26], [0.42, 0, 0]),
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

  정글짐: () => assemble([
    // 기둥 4 + 가로대 8. 빈 격자라 실루엣이 곧 구조다 —
    // 면으로 채우면 그냥 상자가 되어 미끄럼틀과 구별이 안 된다.
    // 원작 어친타운의 선물 위치가 "정글짐 옆"이다.
    ...[[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].map(([x, z]) =>
      part(new CylinderGeometry(0.035, 0.035, 1.0, 14), WHITE, [x!, 0, z!])),
    ...[0.16, -0.30].flatMap((y) => [
      part(new CylinderGeometry(0.03, 0.03, 0.8, 14), WHITE, [0, y, -0.4], LIE_X),
      part(new CylinderGeometry(0.03, 0.03, 0.8, 14), WHITE, [0, y, 0.4], LIE_X),
      part(new CylinderGeometry(0.03, 0.03, 0.8, 14), WHITE, [-0.4, y, 0], LIE_Z),
      part(new CylinderGeometry(0.03, 0.03, 0.8, 14), WHITE, [0.4, y, 0], LIE_Z),
    ]),
  ]),

  사람: () => assemble([
    // 카타마리에서 사람은 배경이 아니라 **물건**이다. 서 있는 자세
    part(new CylinderGeometry(0.11, 0.11, 0.44, 14), WHITE, [0, 0.22, -0.06]),
    part(new CylinderGeometry(0.11, 0.11, 0.44, 14), WHITE, [0, 0.22, 0.06]),
    part(new BoxGeometry(0.30, 0.46, 0.20), WHITE, [0, 0.66, 0]),
    part(new SphereGeometry(0.15, 14, 9), [0.95, 0.8, 0.7], [0, 1.02, 0]),
    part(new SphereGeometry(0.16, 14, 9).scale(1, 0.6, 1), DARK, [0, 1.10, 0]),
    // 팔 둘
    part(new CylinderGeometry(0.06, 0.06, 0.42, 14), WHITE, [0, 0.64, -0.21], [0.12, 0, 0]),
    part(new CylinderGeometry(0.06, 0.06, 0.42, 14), WHITE, [0, 0.64, 0.21], [-0.12, 0, 0]),
  ]),

  승용차: () => assemble([
    // 낮은 물체라 위쪽을 비운다 (shapes.kit 규약 2번)
    part(new BoxGeometry(1.30, 0.30, 0.60), WHITE, [0, 0.30, 0]),
    part(new BoxGeometry(0.66, 0.26, 0.54), GLASS, [-0.06, 0.56, 0]),
    part(new BoxGeometry(0.60, 0.22, 0.56), WHITE, [-0.06, 0.58, 0]),
    ...[[-0.42, 0.31], [-0.42, -0.31], [0.42, 0.31], [0.42, -0.31]].map(
      ([x, z]) => part(new CylinderGeometry(0.17, 0.17, 0.10, 20), DARK, [x!, 0.17, z!], LIE_Z),
    ),
    part(new SphereGeometry(0.07, 14, 9), PAPER, [0.64, 0.32, 0.20]),
    part(new SphereGeometry(0.07, 14, 9), PAPER, [0.64, 0.32, -0.20]),
  ]),

  가로수: () => assemble([
    part(new CylinderGeometry(0.10, 0.14, 0.62, 20), WOOD, [0, 0.31, 0]),
    // 잎은 덩어리 셋 — 하나면 사탕처럼 보인다
    part(new SphereGeometry(0.40, 20, 13), WHITE, [0, 0.86, 0]),
    part(new SphereGeometry(0.28, 20, 13), WHITE, [-0.26, 0.72, 0.10]),
    part(new SphereGeometry(0.26, 20, 13), WHITE, [0.24, 0.76, -0.12]),
  ]),
};
