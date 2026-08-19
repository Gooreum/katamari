import {
  BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { ShapeIdTown } from './generation';
import { assemble, DARK, GLASS, METAL, part, PAPER, WHITE, WOOD } from './shapes.kit';

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
  꽃잎: () => assemble([
    // 납작한 타원 한 장. 얇아야 꽃잎으로 읽힌다
    part(new SphereGeometry(0.5, 7, 5), WHITE, [0, 0, 0], [0, 0, 0]),
    part(new CylinderGeometry(0.03, 0.05, 0.22, 4), WOOD, [-0.42, 0, 0], LIE_X),
  ]).scale(1, 0.16, 0.62),

  자갈: () => assemble([
    // 각진 돌. 구를 저해상도로 뽑으면 그 자체로 자갈이다
    part(new SphereGeometry(0.5, 6, 4), WHITE),
  ]).scale(1, 0.72, 0.86),

  병뚜껑: () => assemble([
    part(new CylinderGeometry(0.5, 0.5, 0.26, 12), WHITE),
    // 옆면 주름 — 병뚜껑은 이게 있어야 병뚜껑이다
    part(new TorusGeometry(0.48, 0.05, 4, 12), METAL, [0, -0.06, 0], LIE_Z),
  ]),

  도토리: () => assemble([
    part(new SphereGeometry(0.36, 8, 6).scale(1, 1.25, 1), WHITE, [0, 0.30, 0]),
    // 깍정이
    part(new SphereGeometry(0.38, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), WOOD, [0, 0.52, 0]),
    part(new CylinderGeometry(0.05, 0.05, 0.16, 5), WOOD, [0, 0.78, 0]),
  ]),

  솔방울: () => assemble([
    // 비늘을 층으로 쌓는다. 원뿔 하나면 그냥 원뿔이다
    part(new ConeGeometry(0.34, 0.30, 7), WOOD, [0, 0.66, 0]),
    part(new ConeGeometry(0.42, 0.30, 7), WHITE, [0, 0.44, 0]),
    part(new ConeGeometry(0.46, 0.30, 7), WOOD, [0, 0.22, 0]),
    part(new ConeGeometry(0.40, 0.30, 7), WHITE, [0, 0.02, 0]),
  ]),

  동전: () => assemble([
    part(new CylinderGeometry(0.5, 0.5, 0.08, 14), METAL),
    part(new CylinderGeometry(0.34, 0.34, 0.10, 12), WHITE, [0, 0.01, 0]),
  ]),

  // ── 버킷 2~3 (4~16cm) ─────────────────────────────────────
  꽃: () => assemble([
    // 원작 MaS3 초반의 그 꽃. 꽃잎 다섯 + 심 + 줄기 + 잎
    part(new CylinderGeometry(0.035, 0.05, 0.62, 5), [0.35, 0.6, 0.3], [0, -0.19, 0]),
    part(new SphereGeometry(0.09, 6, 5), [1, 0.85, 0.3], [0, 0.16, 0]),
    ...[0, 1, 2, 3, 4].map((i) => part(
      new SphereGeometry(0.13, 6, 5).scale(1, 0.4, 1),
      WHITE,
      [Math.cos(i * 1.2566) * 0.17, 0.16, Math.sin(i * 1.2566) * 0.17],
    )),
    part(new SphereGeometry(0.11, 5, 4).scale(1.6, 0.25, 0.7), [0.35, 0.6, 0.3], [0.13, -0.24, 0]),
  ]),

  '연어 캔': () => assemble([
    // 납작한 원통 + 뚜껑 링 + 따개 고리
    part(new CylinderGeometry(0.5, 0.5, 0.36, 14), WHITE),
    part(new CylinderGeometry(0.46, 0.46, 0.06, 14), METAL, [0, 0.19, 0]),
    part(new TorusGeometry(0.12, 0.025, 4, 8), METAL, [0.12, 0.24, 0], LIE_Z),
  ]),

  쥐: () => assemble([
    // 원작 동선에 "공을 나르는 쥐"가 나온다
    part(new SphereGeometry(0.30, 8, 6).scale(1.5, 0.9, 1), WHITE, [-0.05, 0.30, 0]),
    part(new SphereGeometry(0.19, 7, 6), WHITE, [0.34, 0.26, 0]),
    part(new ConeGeometry(0.08, 0.14, 5), [0.95, 0.7, 0.7], [0.52, 0.22, 0], [0, 0, -Math.PI / 2]),
    // 큰 귀 둘 — 쥐는 귀가 실루엣이다
    part(new CylinderGeometry(0.13, 0.13, 0.04, 8), [0.95, 0.7, 0.7], [0.28, 0.44, 0.14], LIE_Z),
    part(new CylinderGeometry(0.13, 0.13, 0.04, 8), [0.95, 0.7, 0.7], [0.28, 0.44, -0.14], LIE_Z),
    // 꼬리
    part(new CylinderGeometry(0.02, 0.035, 0.42, 5), [0.95, 0.7, 0.7], [-0.42, 0.16, 0], [0, 0, 0.7]),
    part(new SphereGeometry(0.07, 5, 4), WHITE, [-0.05, 0.06, 0.20]),
    part(new SphereGeometry(0.07, 5, 4), WHITE, [-0.05, 0.06, -0.20]),
  ]),

  골프공: () => assemble([
    part(new SphereGeometry(0.5, 10, 8), WHITE),
    // 딤플 몇 개만 — 전부 찍으면 폴리곤만 늘고 안 보인다
    ...[[0.3, 0.3, 0.25], [-0.3, 0.28, -0.2], [0.05, 0.45, -0.15], [-0.2, 0.1, 0.4]].map(
      ([x, y, z]) => part(new SphereGeometry(0.07, 4, 3), [0.85, 0.85, 0.85], [x!, y!, z!]),
    ),
  ]),

  참새: () => assemble([
    part(new SphereGeometry(0.30, 8, 6).scale(1.3, 1, 1), WHITE, [-0.02, 0.34, 0]),
    part(new SphereGeometry(0.20, 7, 6), WHITE, [0.28, 0.50, 0]),
    part(new ConeGeometry(0.07, 0.16, 4), [0.9, 0.75, 0.3], [0.46, 0.48, 0], [0, 0, -Math.PI / 2]),
    // 날개 둘 — 몸에 붙여 접은 상태
    part(new SphereGeometry(0.22, 6, 4).scale(1.2, 0.35, 0.6), WOOD, [-0.05, 0.38, 0.22]),
    part(new SphereGeometry(0.22, 6, 4).scale(1.2, 0.35, 0.6), WOOD, [-0.05, 0.38, -0.22]),
    part(new ConeGeometry(0.13, 0.30, 4).scale(1, 1, 0.4), WOOD, [-0.36, 0.32, 0], [0, 0, Math.PI / 2]),
    part(new CylinderGeometry(0.025, 0.025, 0.18, 4), [0.9, 0.75, 0.3], [0.02, 0.11, 0.08]),
    part(new CylinderGeometry(0.025, 0.025, 0.18, 4), [0.9, 0.75, 0.3], [0.02, 0.11, -0.08]),
  ]),

  페트병: () => assemble([
    // 몸통 + 어깨 + 목 + 뚜껑. 원작 동선의 "플라스틱 병"
    part(new CylinderGeometry(0.30, 0.30, 0.56, 10), GLASS, [0, 0.28, 0]),
    part(new CylinderGeometry(0.14, 0.30, 0.20, 10), GLASS, [0, 0.66, 0]),
    part(new CylinderGeometry(0.12, 0.12, 0.14, 10), GLASS, [0, 0.83, 0]),
    part(new CylinderGeometry(0.14, 0.14, 0.10, 10), WHITE, [0, 0.95, 0]),
    // 라벨 — 병은 라벨이 있어야 병으로 읽힌다
    part(new CylinderGeometry(0.32, 0.32, 0.22, 10), WHITE, [0, 0.30, 0]),
  ]),

  모종삽: () => assemble([
    part(new SphereGeometry(0.30, 7, 5).scale(1, 0.32, 0.7), METAL, [0.28, 0.06, 0]),
    part(new CylinderGeometry(0.05, 0.05, 0.34, 6), METAL, [-0.10, 0.10, 0], LIE_X),
    part(new CylinderGeometry(0.09, 0.07, 0.30, 7), WHITE, [-0.40, 0.10, 0], LIE_X),
  ]),

  // ── 버킷 4~5 (16~60cm) ────────────────────────────────────
  비둘기: () => assemble([
    // 이 동네의 이름이다. 참새보다 크고 목이 굵다
    part(new SphereGeometry(0.32, 9, 7).scale(1.4, 1, 1), WHITE, [-0.04, 0.36, 0]),
    part(new CylinderGeometry(0.16, 0.20, 0.20, 8), WHITE, [0.24, 0.56, 0]),
    part(new SphereGeometry(0.20, 8, 6), WHITE, [0.32, 0.70, 0]),
    part(new ConeGeometry(0.06, 0.18, 5), [0.85, 0.8, 0.75], [0.50, 0.68, 0], [0, 0, -Math.PI / 2]),
    part(new SphereGeometry(0.26, 7, 5).scale(1.3, 0.32, 0.55), [0.55, 0.6, 0.7], [-0.06, 0.42, 0.24]),
    part(new SphereGeometry(0.26, 7, 5).scale(1.3, 0.32, 0.55), [0.55, 0.6, 0.7], [-0.06, 0.42, -0.24]),
    part(new ConeGeometry(0.16, 0.34, 4).scale(1, 1, 0.35), [0.55, 0.6, 0.7], [-0.42, 0.34, 0], [0, 0, Math.PI / 2]),
    part(new CylinderGeometry(0.03, 0.03, 0.20, 5), [0.9, 0.45, 0.4], [0.0, 0.12, 0.09]),
    part(new CylinderGeometry(0.03, 0.03, 0.20, 5), [0.9, 0.45, 0.4], [0.0, 0.12, -0.09]),
  ]),

  삽: () => assemble([
    // 원작 동선의 삽. 자루가 길어서 최장축이 세로다
    part(new BoxGeometry(0.30, 0.36, 0.05), METAL, [0, 0.16, 0]),
    part(new ConeGeometry(0.17, 0.14, 4).scale(1, 1, 0.3), METAL, [0, -0.06, 0], [Math.PI, 0, 0]),
    part(new CylinderGeometry(0.045, 0.045, 0.86, 7), WOOD, [0, 0.74, 0]),
    // D자 손잡이
    part(new TorusGeometry(0.11, 0.03, 4, 8), WOOD, [0, 1.18, 0], LIE_Z),
  ]),

  개밥그릇: () => assemble([
    part(new CylinderGeometry(0.5, 0.36, 0.34, 12), WHITE, [0, 0.17, 0]),
    part(new CylinderGeometry(0.44, 0.30, 0.30, 12), DARK, [0, 0.22, 0]),
    part(new TorusGeometry(0.49, 0.04, 4, 12), WHITE, [0, 0.33, 0], LIE_Z),
  ]),

  양동이: () => assemble([
    part(new CylinderGeometry(0.44, 0.34, 0.72, 12), WHITE, [0, 0.36, 0]),
    part(new CylinderGeometry(0.39, 0.30, 0.62, 12), DARK, [0, 0.40, 0]),
    part(new TorusGeometry(0.44, 0.035, 4, 12), METAL, [0, 0.72, 0], LIE_Z),
    // 손잡이 — 반원
    part(new TorusGeometry(0.44, 0.03, 4, 10, Math.PI), METAL, [0, 0.74, 0]),
  ]),

  모래성: () => assemble([
    // 원작 동선의 모래성. 원통 본체 + 탑 넷 + 총안
    part(new CylinderGeometry(0.42, 0.5, 0.52, 10), WHITE, [0, 0.26, 0]),
    ...[[0.34, 0.34], [-0.34, 0.34], [0.34, -0.34], [-0.34, -0.34]].map(
      ([x, z]) => part(new CylinderGeometry(0.13, 0.15, 0.34, 7), WHITE, [x!, 0.60, z!]),
    ),
    ...[[0.34, 0.34], [-0.34, 0.34], [0.34, -0.34], [-0.34, -0.34]].map(
      ([x, z]) => part(new ConeGeometry(0.16, 0.20, 7), WOOD, [x!, 0.86, z!]),
    ),
    part(new CylinderGeometry(0.30, 0.30, 0.22, 9), WHITE, [0, 0.62, 0]),
  ]),

  삼각콘: () => assemble([
    part(new BoxGeometry(0.72, 0.09, 0.72), WHITE, [0, 0.045, 0]),
    part(new ConeGeometry(0.28, 0.86, 8), WHITE, [0, 0.52, 0]),
    // 반사 띠 둘 — 이게 있어야 공사장 콘이다
    part(new ConeGeometry(0.20, 0.14, 8), PAPER, [0, 0.60, 0]),
    part(new ConeGeometry(0.13, 0.10, 8), PAPER, [0, 0.78, 0]),
  ]),

  // ── 버킷 6 (60cm~1.2m) ────────────────────────────────────
  개: () => assemble([
    // 원작 MaS3에서 피해 다녀야 하는 그 개. 서 있는 자세
    part(new SphereGeometry(0.30, 9, 7).scale(1.7, 1, 1.05), WHITE, [-0.06, 0.56, 0]),
    part(new SphereGeometry(0.22, 8, 6), WHITE, [0.44, 0.70, 0]),
    part(new BoxGeometry(0.22, 0.14, 0.18), WHITE, [0.62, 0.62, 0]),
    part(new SphereGeometry(0.05, 5, 4), DARK, [0.73, 0.64, 0]),
    // 늘어진 귀 둘
    part(new SphereGeometry(0.13, 6, 5).scale(0.5, 1.3, 0.8), WOOD, [0.42, 0.72, 0.20]),
    part(new SphereGeometry(0.13, 6, 5).scale(0.5, 1.3, 0.8), WOOD, [0.42, 0.72, -0.20]),
    // 다리 넷
    ...[[0.30, 0.17], [0.30, -0.17], [-0.34, 0.17], [-0.34, -0.17]].map(
      ([x, z]) => part(new CylinderGeometry(0.075, 0.065, 0.50, 7), WHITE, [x!, 0.25, z!]),
    ),
    // 치켜든 꼬리
    part(new CylinderGeometry(0.04, 0.06, 0.34, 6), WOOD, [-0.52, 0.72, 0], [0, 0, 0.9]),
  ]),
};
