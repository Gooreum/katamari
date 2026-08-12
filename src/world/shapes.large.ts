import {
  BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { ShapeIdLarge } from './generation';
import { assemble, DARK, GLASS, METAL, part, WHITE, WOOD } from './shapes.kit';

/**
 * 버킷 6~8 (63cm~5m) 형태.
 *
 * 화면을 채우는 것들이라 삼각형 예산을 여기에 쓴다.
 * 다만 따릉이가 532로 경고선(550)에 가장 가깝다 — 부품을 추가할 때마다
 * `npm run shapecheck` 로 확인할 것.
 */
export const LARGE_BUILDERS: Record<ShapeIdLarge, () => BufferGeometry> = {
  // ─── 버킷 6 (63cm~1.26m) ───────────────────────────────────────

  '포장마차 의자': () => assemble([
    part(new CylinderGeometry(0.5, 0.48, 0.1, 12), WHITE, [0, 0.85, 0]),             // 좌판
    part(new CylinderGeometry(0.46, 0.46, 0.05, 12), [0.85, 0.6, 0.45], [0, 0.92, 0]), // 방석
    // 다리는 밖으로 벌어져야 넘어지지 않는 의자로 보인다
    ...([[0.32, 0.32], [0.32, -0.32], [-0.32, 0.32], [-0.32, -0.32]] as const).map(
      ([x, z]) => part(new CylinderGeometry(0.05, 0.06, 0.86, 6), METAL,
        [x, 0.43, z], [z * 0.28, 0, -x * 0.28])),
    ...([0.24, -0.24] as const).flatMap((s) => [
      part(new BoxGeometry(0.7, 0.04, 0.04), METAL, [0, 0.3, s * 1.4]),              // 가로대
      part(new BoxGeometry(0.04, 0.04, 0.7), METAL, [s * 1.4, 0.3, 0]),
    ]),
  ]),

  입간판: () => assemble([
    // A자로 벌린 판 두 장 — 평평한 판 하나면 간판이 아니라 문짝이다
    ...([0.22, -0.22] as const).map(
      (a) => part(new BoxGeometry(0.72, 1.1, 0.05), WHITE, [Math.sin(a) * 0.3, 0.55, 0], [0, 0, a])),
    part(new CylinderGeometry(0.04, 0.04, 0.7, 6), METAL, [0, 1.1, 0], [Math.PI / 2, 0, 0]), // 경첩
    ...([0.22, -0.22] as const).flatMap((a) => ([0.3, -0.3] as const).map(
      (z) => part(new BoxGeometry(0.06, 1.1, 0.06), [0.7, 0.7, 0.72],
        [Math.sin(a) * 0.3 + Math.cos(a) * 0.33, 0.55, z], [0, 0, a]))),            // 세로 프레임
    ...([0.78, 0.5, 0.24] as const).map(
      (y) => part(new BoxGeometry(0.5, 0.09, 0.02), [0.35, 0.35, 0.4], [0.18, y, 0.16], [0, 0, 0.22])), // 글자 줄
    part(new BoxGeometry(0.2, 0.06, 0.06), METAL, [0, 1.2, 0]),                      // 드는 손잡이
    part(new BoxGeometry(0.5, 0.1, 0.5), [0.55, 0.55, 0.6], [0, 0.05, 0]),           // 바닥 무게추
  ]),

  '전동 킥보드': () => assemble([
    part(new BoxGeometry(1.0, 0.09, 0.32), WHITE, [0, 0.14, 0]),                     // 데크
    part(new BoxGeometry(0.9, 0.03, 0.26), [0.35, 0.35, 0.38], [0, 0.2, 0]),         // 미끄럼 방지 패드
    ...([[0.56, 0.24], [-0.56, 0.24]] as const).map(
      ([x, r]) => part(new CylinderGeometry(r, r, 0.14, 10), DARK, [x, r, 0], [Math.PI / 2, 0, 0])), // 바퀴
    ...([0.56, -0.56] as const).map(
      (x) => part(new CylinderGeometry(0.1, 0.1, 0.06, 8), METAL, [x, 0.24, 0], [Math.PI / 2, 0, 0])), // 허브
    part(new BoxGeometry(0.1, 0.9, 0.1), WHITE, [0.56, 0.66, 0], [0, 0, -0.14]),     // 스템
    part(new BoxGeometry(0.06, 0.06, 0.62), DARK, [0.68, 1.1, 0]),                   // 핸들바
    ...([0.28, -0.28] as const).map(
      (z) => part(new BoxGeometry(0.08, 0.08, 0.14), [0.3, 0.3, 0.32], [0.68, 1.1, z])), // 그립
    part(new BoxGeometry(0.14, 0.1, 0.12), [1, 0.95, 0.7], [0.74, 0.98, 0]),         // 헤드라이트
    ...([0.62, -0.62] as const).map(
      (x) => part(new BoxGeometry(0.3, 0.04, 0.2), [0.6, 0.6, 0.62], [x, 0.42, 0])), // 흙받이
  ]),

  '분리수거 통': () => assemble([
    part(new BoxGeometry(0.72, 1.0, 0.6), WHITE, [0, 0.6, 0]),                       // 몸통
    part(new BoxGeometry(0.76, 0.08, 0.64), [0.85, 0.85, 0.88], [0, 1.14, 0]),       // 뚜껑
    part(new CylinderGeometry(0.2, 0.2, 0.12, 10), DARK, [0, 1.16, 0]),              // 둥근 투입구
    part(new BoxGeometry(0.5, 0.24, 0.02), [0.3, 0.4, 0.7], [0, 0.9, 0.31]),         // 분리배출 라벨
    ...([0.28, -0.28] as const).map(
      (z) => part(new CylinderGeometry(0.11, 0.11, 0.08, 8), DARK, [-0.3, 0.11, z], [Math.PI / 2, 0, 0])), // 바퀴
    part(new BoxGeometry(0.06, 0.28, 0.5), METAL, [0.38, 1.2, 0]),                   // 손잡이
  ]),

  평상: () => assemble([
    // 널판 다섯 장 사이가 벌어져 있어야 평상이다. 통짜 상판이면 탁자로 보인다
    ...([-0.4, -0.2, 0, 0.2, 0.4] as const).map(
      (z) => part(new BoxGeometry(1.0, 0.07, 0.17), WOOD, [0, 0.42, z])),
    ...([[0.42, 0.42], [0.42, -0.42], [-0.42, 0.42], [-0.42, -0.42]] as const).map(
      ([x, z]) => part(new BoxGeometry(0.1, 0.4, 0.1), WOOD, [x, 0.2, z])),          // 다리
    ...([0.42, -0.42] as const).flatMap((s) => [
      part(new BoxGeometry(0.96, 0.06, 0.06), [0.42, 0.32, 0.22], [0, 0.14, s]),     // 가로대
      part(new BoxGeometry(0.06, 0.06, 0.9), [0.42, 0.32, 0.22], [s, 0.14, 0]),
    ]),
  ]),

  '파라솔 받침': () => assemble([
    part(new CylinderGeometry(0.5, 0.5, 0.16, 16), WHITE, [0, 0.08, 0]),             // 원판
    part(new CylinderGeometry(0.42, 0.5, 0.1, 16), [0.85, 0.85, 0.87], [0, 0.21, 0]), // 경사면
    part(new CylinderGeometry(0.13, 0.13, 0.36, 10), METAL, [0, 0.44, 0]),           // 중앙 관
    part(new CylinderGeometry(0.15, 0.15, 0.06, 10), [0.6, 0.6, 0.64], [0, 0.6, 0]), // 관 테두리
    part(new BoxGeometry(0.16, 0.08, 0.08), METAL, [0.18, 0.44, 0]),                 // 조임 나사
    part(new TorusGeometry(0.07, 0.02, 4, 8), METAL, [0.27, 0.44, 0], [0, Math.PI / 2, 0]), // 나사 손잡이
  ]),

  정수기: () => assemble([
    part(new BoxGeometry(0.62, 1.05, 0.5), WHITE, [0, 0.53, 0]),                     // 몸통
    part(new BoxGeometry(0.66, 0.14, 0.54), [0.88, 0.88, 0.9], [0, 1.12, 0]),        // 상단 패널
    part(new CylinderGeometry(0.26, 0.3, 0.5, 12), GLASS, [0, 1.44, 0]),             // 물통
    part(new CylinderGeometry(0.14, 0.14, 0.1, 10), [0.6, 0.65, 0.75], [0, 1.74, 0]), // 물통 뚜껑
    ...([0.14, -0.14] as const).map(
      (z) => part(new CylinderGeometry(0.04, 0.04, 0.2, 6), METAL, [0.28, 0.72, z], [0, 0, 1.1])), // 코크
    ...([[0.14, 1, 0.45, 0.4], [-0.14, 0.5, 0.6, 1]] as const).map(
      ([z, r, g, b]) => part(new BoxGeometry(0.08, 0.08, 0.1), [r, g, b], [0.32, 0.88, z])), // 온·냉 버튼
    part(new BoxGeometry(0.28, 0.04, 0.4), [0.5, 0.5, 0.55], [0.3, 0.5, 0]),         // 물받이 트레이
  ]),

  // ─── 버킷 7 (1.26~2.51m) ───────────────────────────────────────

  따릉이: () => assemble([
    // 바퀴 = 타이어(토러스) + 허브 + 스포크.
    // 토러스는 XY 평면에 놓이고 구멍이 Z축을 향한다 — 자전거가 X로 달리므로 회전이 필요 없다.
    // 스포크는 두 개만 있어도 '빈 원'이 '바퀴'로 읽힌다.
    ...([0.55, -0.55] as const).flatMap((x) => [
      part(new TorusGeometry(0.34, 0.032, 4, 10), DARK, [x, 0.34, 0]),
      part(new CylinderGeometry(0.05, 0.05, 0.09, 6), METAL, [x, 0.34, 0], [Math.PI / 2, 0, 0]),
      // 스포크는 바퀴당 한 줄만. 두 줄이면 삼각형 556으로 상한(550)을 넘는다 —
      // shapecheck 가 잡아줬다. 한 줄이어도 '빈 원'이 '바퀴'로 읽히는 목적은 달성된다.
      part(new BoxGeometry(0.62, 0.018, 0.018), METAL, [x, 0.34, 0], [0, 0, 0.5]),
    ]),
    // 프레임 튜브는 **관절점에서 역산**한다. 눈대중 좌표로 놓으면 튜브 끝이 안 만나서
    // 각도만 비슷한 막대들이 겹쳐 보인다 (첫 시도가 그래서 엉켜 보였다).
    //   크랭크축 (0, 0.30) · 뒷허브 (-0.55, 0.34) · 앞허브 (0.55, 0.34)
    //   헤드튜브 (0.52, 0.62)~(0.52, 0.86) · 안장 (-0.22, 0.92)
    part(new BoxGeometry(0.611, 0.07, 0.07), WHITE, [0.260, 0.460, 0], [0, 0, 0.552]),  // 다운튜브
    part(new BoxGeometry(0.658, 0.06, 0.06), WHITE, [-0.110, 0.610, 0], [0, 0, 1.912]), // 시트튜브
    part(new BoxGeometry(0.742, 0.06, 0.06), WHITE, [0.150, 0.890, 0], [0, 0, -0.081]), // 탑튜브
    ...([0.055, -0.055] as const).flatMap((z) => [
      part(new BoxGeometry(0.551, 0.04, 0.04), WHITE, [-0.275, 0.320, z], [0, 0, 3.069]), // 체인스테이
      part(new BoxGeometry(0.667, 0.04, 0.04), WHITE, [-0.385, 0.630, z], [0, 0, -2.088]), // 시트스테이
      part(new BoxGeometry(0.282, 0.045, 0.045), WHITE, [0.535, 0.480, z], [0, 0, -1.464]), // 포크
    ]),
    part(new BoxGeometry(0.240, 0.07, 0.07), WHITE, [0.520, 0.740, 0], [0, 0, 1.571]),  // 헤드튜브
    part(new CylinderGeometry(0.03, 0.03, 0.14, 6), WHITE, [0.52, 0.93, 0]),          // 스템
    part(new BoxGeometry(0.05, 0.05, 0.52), DARK, [0.52, 1.00, 0]),                   // 핸들바
    ...([0.24, -0.24] as const).map(
      (z) => part(new BoxGeometry(0.06, 0.06, 0.12), [0.3, 0.3, 0.32], [0.52, 1.00, z])), // 그립
    part(new BoxGeometry(0.05, 0.20, 0.05), WHITE, [-0.22, 0.98, 0]),                 // 시트포스트
    part(new BoxGeometry(0.26, 0.06, 0.11), DARK, [-0.24, 1.08, 0]),                  // 안장
    part(new BoxGeometry(0.30, 0.22, 0.34), WHITE, [0.72, 0.86, 0]),                  // 앞바구니
    part(new BoxGeometry(0.30, 0.03, 0.34), [0.8, 0.8, 0.8], [0.72, 0.76, 0]),        // 바구니 바닥
    part(new CylinderGeometry(0.075, 0.075, 0.05, 6), METAL, [0, 0.30, 0], [Math.PI / 2, 0, 0]), // 크랭크축
    ...([[0.09, 0.11], [-0.09, -0.11]] as const).map(
      ([dy, z]) => part(new BoxGeometry(0.045, 0.20, 0.045), METAL, [0, 0.30 + dy, z])), // 크랭크암
    ...([[0.16, 0.13], [-0.16, -0.13]] as const).map(
      ([dy, z]) => part(new BoxGeometry(0.16, 0.03, 0.08), DARK, [0, 0.30 + dy, z])), // 페달
  ]),

  '배달 오토바이': () => assemble([
    ...([[0.62, 0.3], [-0.62, 0.3]] as const).flatMap(([x, r]) => [
      part(new CylinderGeometry(r, r, 0.16, 10), DARK, [x, r, 0], [Math.PI / 2, 0, 0]), // 바퀴
      part(new CylinderGeometry(0.12, 0.12, 0.18, 6), METAL, [x, r, 0], [Math.PI / 2, 0, 0]), // 허브
    ]),
    part(new BoxGeometry(0.9, 0.16, 0.28), WHITE, [0, 0.5, 0]),                      // 프레임 하부
    part(new BoxGeometry(0.44, 0.22, 0.3), WHITE, [-0.2, 0.68, 0]),                  // 시트 아래
    part(new BoxGeometry(0.5, 0.1, 0.3), DARK, [-0.24, 0.83, 0]),                    // 시트
    part(new BoxGeometry(0.3, 0.4, 0.26), WHITE, [0.42, 0.62, 0], [0, 0, -0.2]),     // 앞 카울
    ...([0.09, -0.09] as const).map(
      (z) => part(new BoxGeometry(0.44, 0.07, 0.07), METAL, [0.56, 0.5, z], [0, 0, 1.3])), // 포크
    part(new BoxGeometry(0.06, 0.06, 0.6), DARK, [0.6, 0.98, 0]),                    // 핸들
    ...([0.26, -0.26] as const).map(
      (z) => part(new BoxGeometry(0.08, 0.08, 0.14), [0.3, 0.3, 0.32], [0.6, 0.98, z])), // 그립
    ...([0.3, -0.3] as const).map(
      (z) => part(new BoxGeometry(0.06, 0.2, 0.06), METAL, [0.6, 1.14, z], [0, 0, 0.2])), // 미러 대
    part(new CylinderGeometry(0.14, 0.14, 0.08, 8), [1, 0.96, 0.75], [0.66, 0.78, 0], [0, 0, Math.PI / 2]), // 헤드라이트
    // 배달통이 오토바이를 '배달 오토바이'로 만든다
    part(new BoxGeometry(0.46, 0.42, 0.42), WHITE, [-0.52, 1.12, 0]),
    part(new BoxGeometry(0.48, 0.05, 0.44), [0.85, 0.85, 0.88], [-0.52, 1.35, 0]),   // 배달통 뚜껑
    part(new CylinderGeometry(0.06, 0.06, 0.4, 6), METAL, [-0.4, 0.4, -0.16], [0, 0, Math.PI / 2]), // 머플러
  ]),

  에어간판: () => assemble([
    // 마디를 굵기 다르게 쌓아야 바람에 흔들리는 튜브로 읽힌다
    ...([[0.7, 0.3, 0.26], [1.5, 0.26, 0.22], [2.3, 0.22, 0.18]] as const).map(
      ([y, rb, rt]) => part(new CylinderGeometry(rt, rb, 0.8, 10), WHITE, [0, y, 0])),
    part(new SphereGeometry(0.26, 8, 6), WHITE, [0, 2.82, 0]),                       // 머리
    ...([0.6, -0.6] as const).map(
      (a) => part(new CylinderGeometry(0.1, 0.14, 0.9, 8), [0.9, 0.9, 0.92],
        [Math.sin(a) * 0.5, 2.2, 0], [0, 0, a])),                                    // 팔
    part(new CylinderGeometry(0.42, 0.5, 0.3, 12), [0.6, 0.6, 0.64], [0, 0.15, 0]),  // 송풍기 받침
    ...([[0.1, 0.4, 0.9], [-0.1, 0.15, 0.15]] as const).map(
      ([z, g, b]) => part(new BoxGeometry(0.24, 0.1, 0.06), [0.9, g, b], [0, 2.5, z * 2.6])), // 눈
  ]),

  자판기: () => assemble([
    part(new BoxGeometry(1.0, 1.9, 0.75), WHITE, [0, 0.95, 0]),                      // 몸통
    part(new BoxGeometry(0.62, 1.25, 0.04), GLASS, [-0.16, 1.15, 0.38]),             // 전면 유리
    // 상품 칸 — 유리 안쪽에 6칸. 이게 있어야 '흰 상자'가 '자판기'가 된다
    ...([0, 1, 2] as const).flatMap((r) => ([-0.30, 0.02] as const).map(
      (x) => part(new BoxGeometry(0.24, 0.30, 0.06), [0.7, 0.72, 0.75],
        [x - 0.16, 0.68 + r * 0.38, 0.34]))),
    ...([0, 1, 2] as const).flatMap((r) => ([0.30, 0.40] as const).map(
      (x) => part(new BoxGeometry(0.06, 0.06, 0.05), [1, 0.5, 0.45],
        [x, 0.75 + r * 0.34, 0.38]))),                                               // 버튼 6
    part(new BoxGeometry(0.52, 0.22, 0.10), DARK, [-0.16, 0.28, 0.36]),              // 배출구
    part(new BoxGeometry(0.10, 0.24, 0.05), METAL, [0.35, 1.55, 0.38]),              // 코인 투입
    part(new BoxGeometry(1.0, 0.26, 0.78), WHITE, [0, 2.03, 0]),                     // 상단 간판
  ]),

  김치냉장고: () => assemble([
    part(new BoxGeometry(1.0, 1.5, 0.78), WHITE, [0, 0.79, 0]),                      // 몸통
    ...([0.25, -0.25] as const).map(
      (x) => part(new BoxGeometry(0.47, 1.3, 0.05), [0.93, 0.93, 0.95], [x, 0.82, 0.4])), // 문 2
    ...([0.04, -0.04] as const).map(
      (x) => part(new BoxGeometry(0.05, 0.9, 0.07), METAL, [x, 0.82, 0.45])),        // 손잡이 2
    part(new BoxGeometry(1.02, 0.12, 0.8), [0.85, 0.85, 0.88], [0, 1.6, 0]),         // 상단 패널
    part(new BoxGeometry(0.3, 0.1, 0.03), [0.4, 0.45, 0.6], [0, 1.42, 0.43]),        // 로고
    ...([[0.42, 0.32], [0.42, -0.32], [-0.42, 0.32], [-0.42, -0.32]] as const).map(
      ([x, z]) => part(new CylinderGeometry(0.06, 0.06, 0.08, 6), DARK, [x, 0.04, z])), // 발
  ]),

  '붕어빵 카트': () => assemble([
    part(new BoxGeometry(1.0, 0.14, 0.6), WHITE, [0, 0.62, 0]),                      // 수레 상판
    part(new BoxGeometry(0.9, 0.44, 0.5), [0.85, 0.85, 0.88], [0, 0.38, 0]),         // 아래 수납
    ...([0.3, -0.3] as const).map(
      (z) => part(new CylinderGeometry(0.16, 0.16, 0.08, 10), DARK, [-0.34, 0.16, z], [Math.PI / 2, 0, 0])), // 바퀴
    part(new BoxGeometry(0.56, 0.06, 0.44), DARK, [0.14, 0.72, 0]),                  // 붕어빵 철판
    // 붕어빵 여섯 — 철판만 있으면 그냥 불판이다
    ...([0, 1, 2] as const).flatMap((c) => ([0.11, -0.11] as const).map(
      (z) => part(new BoxGeometry(0.13, 0.06, 0.08), [0.9, 0.7, 0.35],
        [-0.04 + c * 0.18, 0.78, z]))),
    ...([0.4, -0.4] as const).map(
      (z) => part(new CylinderGeometry(0.03, 0.03, 0.8, 6), METAL, [0.2, 1.1, z])),  // 차양 기둥
    part(new BoxGeometry(0.8, 0.05, 0.9), [0.9, 0.5, 0.45], [0.14, 1.5, 0]),         // 차양
    part(new BoxGeometry(0.06, 0.06, 0.5), METAL, [-0.54, 0.8, 0], [0, 0, 0.5]),     // 미는 손잡이
    part(new CylinderGeometry(0.13, 0.13, 0.34, 8), [0.6, 0.62, 0.68], [-0.3, 0.34, 0]), // 가스통
  ]),

  '편의점 파라솔': () => assemble([
    part(new CylinderGeometry(0.05, 0.06, 2.0, 8), METAL, [0, 1.0, 0]),              // 기둥
    part(new CylinderGeometry(0.36, 0.36, 0.08, 10), [0.6, 0.6, 0.64], [0, 0.04, 0]), // 받침
    part(new ConeGeometry(1.0, 0.5, 12), WHITE, [0, 2.2, 0]),                        // 캐노피
    // 살 여섯 — 매끈한 원뿔이면 파라솔이 아니라 고깔이다
    ...([0, 1, 2, 3, 4, 5] as const).map(
      (i) => part(new BoxGeometry(1.0, 0.03, 0.04), [0.82, 0.82, 0.84],
        [Math.cos(i * Math.PI / 3) * 0.5, 2.06, Math.sin(i * Math.PI / 3) * 0.5],
        [0, -i * Math.PI / 3, -0.24])),
    part(new CylinderGeometry(1.0, 0.98, 0.09, 12), [0.9, 0.5, 0.45], [0, 1.99, 0]), // 가장자리 띠
    part(new CylinderGeometry(0.09, 0.09, 0.18, 8), METAL, [0, 2.5, 0]),             // 꼭지
  ]),

  // ─── 버킷 8 (2.51~5m) ──────────────────────────────────────────

  전봇대: () => assemble([
    part(new CylinderGeometry(0.13, 0.20, 9, 8), WHITE, [0, 4.5, 0]),                 // 기둥(아래가 굵다)
    part(new BoxGeometry(0.14, 0.13, 2.4), WHITE, [0, 8.40, 0]),                      // 가로대 1
    part(new BoxGeometry(0.14, 0.13, 2.0), WHITE, [0, 7.70, 0]),                      // 가로대 2
    part(new BoxGeometry(0.14, 0.13, 1.6), WHITE, [0, 7.00, 0]),                      // 가로대 3
    ...([[8.58, 1.02], [8.58, 0], [8.58, -1.02], [7.88, 0.84], [7.88, 0], [7.88, -0.84]] as const)
      .map(([y, z]) => part(new CylinderGeometry(0.085, 0.10, 0.24, 6), GLASS, [0, y, z])), // 애자
    // 변압기가 서울 전봇대의 실루엣을 결정한다. 이거 하나로 '기둥'이 '전봇대'가 된다.
    part(new CylinderGeometry(0.34, 0.34, 0.90, 8), [0.66, 0.67, 0.70], [0, 6.0, 0.42]),
    ...([2.2, 2.9, 3.6, 4.3] as const).map(
      (y) => part(new BoxGeometry(0.05, 0.05, 0.42), [0.6, 0.6, 0.62], [0, y, 0])),   // 발판 볼트
    part(new BoxGeometry(0.06, 0.50, 0.34), WHITE, [0.10, 3.2, 0]),                   // 표지판
  ]),

  승용차: () => assemble([
    part(new BoxGeometry(4.5, 0.42, 1.82), WHITE, [0, 0.62, 0]),                      // 하부 차체
    part(new BoxGeometry(1.5, 0.30, 1.74), WHITE, [1.35, 0.95, 0]),                   // 보닛
    part(new BoxGeometry(1.0, 0.30, 1.74), WHITE, [-1.65, 0.95, 0]),                  // 트렁크
    part(new BoxGeometry(1.5, 0.42, 1.66), GLASS, [-0.2, 1.25, 0]),                   // 옆유리
    part(new BoxGeometry(1.15, 0.10, 1.60), WHITE, [-0.22, 1.52, 0]),                 // 지붕
    // 유리를 눕히는 게 밀도 상향의 핵심이다. 축에 나란한 상자만 쓰면 차가 벽돌로 보인다.
    part(new BoxGeometry(0.78, 0.06, 1.62), GLASS, [0.62, 1.28, 0], [0, 0, -0.85]),   // 앞유리
    part(new BoxGeometry(0.62, 0.06, 1.62), GLASS, [-1.05, 1.28, 0], [0, 0, 0.95]),   // 뒷유리
    part(new BoxGeometry(0.22, 0.28, 1.80), [0.72, 0.72, 0.74], [2.16, 0.55, 0]),     // 앞 범퍼
    part(new BoxGeometry(0.22, 0.28, 1.80), [0.72, 0.72, 0.74], [-2.16, 0.55, 0]),    // 뒷 범퍼
    ...([0.6, -0.6] as const).map(
      (z) => part(new BoxGeometry(0.10, 0.18, 0.42), WHITE, [2.20, 0.84, z])),        // 헤드램프
    // 정점색은 계수라 절대 빨강을 못 만든다. 대신 R만 남기고 G·B를 눌러 팔레트 색을 붉게 치우치게 한다.
    ...([0.62, -0.62] as const).map(
      (z) => part(new BoxGeometry(0.09, 0.16, 0.34), [1, 0.35, 0.3], [-2.20, 0.84, z])), // 테일램프
    ...([0.98, -0.98] as const).map(
      (z) => part(new BoxGeometry(0.10, 0.12, 0.22), WHITE, [0.95, 1.16, z])),        // 사이드미러
    // 바퀴 — 원기둥 축이 Y라 X로 90° 돌려야 축이 Z(차 폭 방향)가 된다.
    // 허브가 있어야 '검은 원기둥'이 '바퀴'로 읽힌다.
    ...([[1.45, 0.86], [1.45, -0.86], [-1.45, 0.86], [-1.45, -0.86]] as const).flatMap(
      ([x, z]) => [
        part(new CylinderGeometry(0.36, 0.36, 0.26, 10), DARK, [x, 0.36, z], [Math.PI / 2, 0, 0]),
        part(new CylinderGeometry(0.17, 0.17, 0.28, 6), METAL, [x, 0.36, z], [Math.PI / 2, 0, 0]),
      ]),
  ]),

  '포장마차 천막': () => assemble([
    ...([[0.85, 0.6], [0.85, -0.6], [-0.85, 0.6], [-0.85, -0.6]] as const).map(
      ([x, z]) => part(new CylinderGeometry(0.045, 0.045, 1.9, 6), METAL, [x, 0.95, z])), // 기둥
    // 맞배지붕 — 평평한 판 하나면 천막이 아니라 차양이다
    ...([0.35, -0.35] as const).map(
      (a) => part(new BoxGeometry(1.9, 0.06, 0.78), [0.95, 0.5, 0.45],
        [0, 2.06 + Math.cos(a) * 0.02, Math.sin(a) * 0.36], [a, 0, 0])),
    part(new BoxGeometry(1.86, 0.5, 0.05), [0.9, 0.46, 0.42], [0, 1.72, 0.66]),      // 앞 가림막
    ...([0.62, -0.62] as const).map(
      (z) => part(new BoxGeometry(0.05, 0.75, 0.55), [0.9, 0.46, 0.42], [-0.88, 1.55, z])), // 옆 천막
    part(new BoxGeometry(1.7, 0.1, 0.55), WOOD, [0, 1.0, -0.1]),                     // 매대 상판
    part(new BoxGeometry(1.7, 0.5, 0.06), [0.42, 0.32, 0.22], [0, 0.72, -0.34]),     // 매대 앞판
    // 알전구 — 포장마차의 정체성이다
    ...([-0.55, 0, 0.55] as const).map(
      (x) => part(new SphereGeometry(0.09, 6, 5), [1, 0.94, 0.7], [x, 1.82, 0.5])),
  ]),

  '마을버스 승강장': () => assemble([
    part(new BoxGeometry(2.0, 0.1, 0.95), WHITE, [0, 2.1, 0]),                       // 지붕
    ...([0.5, -0.5] as const).map(
      (z) => part(new BoxGeometry(2.04, 0.09, 0.07), [0.75, 0.75, 0.78], [0, 2.02, z])), // 지붕 테두리
    ...([0.92, -0.92] as const).map(
      (x) => part(new BoxGeometry(0.11, 2.05, 0.11), METAL, [x, 1.03, -0.36])),      // 기둥
    part(new BoxGeometry(1.95, 1.5, 0.05), GLASS, [0, 1.3, -0.45]),                  // 뒷벽 유리
    part(new BoxGeometry(0.9, 1.2, 0.04), [0.9, 0.75, 0.4], [-0.5, 1.35, -0.47]),    // 광고판
    part(new BoxGeometry(1.5, 0.09, 0.35), WOOD, [0, 0.52, -0.22]),                  // 벤치
    ...([0.55, -0.55] as const).map(
      (x) => part(new BoxGeometry(0.08, 0.5, 0.3), METAL, [x, 0.25, -0.22])),        // 벤치 다리
    part(new CylinderGeometry(0.05, 0.05, 2.4, 8), METAL, [1.15, 1.2, 0.3]),         // 표지판 기둥
    part(new BoxGeometry(0.06, 0.4, 0.5), [0.3, 0.5, 0.85], [1.15, 2.3, 0.3]),       // 노선 표지판
  ]),


  은행나무: () => assemble([
    part(new CylinderGeometry(0.16, 0.3, 2.2, 8), WOOD, [0, 1.1, 0]),                // 테이퍼 줄기
    // 가지 넷을 사방으로 — 줄기만 있으면 나무가 아니라 기둥이다
    ...([0, 1, 2, 3] as const).map((i) => {
      const a = i * Math.PI / 2 + 0.4;
      return part(new CylinderGeometry(0.05, 0.1, 0.9, 6), WOOD,
        [Math.cos(a) * 0.3, 2.15, Math.sin(a) * 0.3],
        [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6]);
    }),
    // 잎 덩어리 넷. 한 덩어리면 막대사탕이라 여러 개를 엇갈리게 얹는다
    ...([[0, 3.1, 0, 0.95], [0.62, 2.7, 0.2, 0.6], [-0.5, 2.65, -0.35, 0.62], [0.1, 2.6, -0.6, 0.55]] as const)
      .map(([x, y, z, r]) => part(new SphereGeometry(r, 7, 5), WHITE, [x, y, z])),
  ]),

  '아크릴 간판': () => assemble([
    part(new BoxGeometry(2.0, 0.62, 0.12), WHITE, [0, 0.31, 0]),                     // 판
    // 프레임 넷 — 판만 있으면 그냥 널빤지다
    ...([0.33, -0.33] as const).map(
      (y) => part(new BoxGeometry(2.05, 0.07, 0.16), METAL, [0, 0.31 + y, 0])),
    ...([1.0, -1.0] as const).map(
      (x) => part(new BoxGeometry(0.07, 0.68, 0.16), METAL, [x, 0.31, 0])),
    // 글자 넷 — 크기가 달라야 상호로 읽힌다
    ...([[-0.6, 0.3], [-0.15, 0.34], [0.3, 0.3], [0.7, 0.26]] as const).map(
      ([x, h]) => part(new BoxGeometry(0.26, h, 0.05), [0.35, 0.4, 0.6], [x, 0.31, 0.08])),
    part(new BoxGeometry(1.7, 0.1, 0.2), [1, 0.96, 0.8], [0, 0.68, 0]),              // 조명 박스
    ...([0.7, -0.7] as const).map(
      (x) => part(new BoxGeometry(0.09, 0.2, 0.3), METAL, [x, 0.31, -0.18])),        // 벽 브래킷
    part(new CylinderGeometry(0.03, 0.03, 0.5, 6), DARK, [-0.9, 0.0, -0.2], [0, 0, 0.3]), // 전원 케이블
  ]),

  '주차 차단기': () => assemble([
    part(new BoxGeometry(0.42, 0.12, 0.42), [0.6, 0.6, 0.64], [-0.72, 0.06, 0]),     // 받침
    part(new BoxGeometry(0.3, 0.95, 0.3), WHITE, [-0.72, 0.6, 0]),                   // 제어함 기둥
    part(new BoxGeometry(0.34, 0.3, 0.34), [0.9, 0.9, 0.92], [-0.72, 1.22, 0]),      // 제어함 머리
    // 차단봉 — 줄무늬가 있어야 차단기로 읽힌다
    part(new BoxGeometry(1.6, 0.1, 0.1), WHITE, [0.1, 1.2, 0]),
    ...([-0.5, -0.1, 0.3, 0.7] as const).map(
      (x) => part(new BoxGeometry(0.2, 0.105, 0.105), [0.95, 0.35, 0.3], [x, 1.2, 0])),
    part(new CylinderGeometry(0.11, 0.11, 0.14, 8), [1, 0.6, 0.3], [-0.72, 1.44, 0]), // 경광등
    part(new CylinderGeometry(0.09, 0.09, 0.36, 8), METAL, [-0.5, 1.2, 0], [0, 0, Math.PI / 2]), // 봉 회전축
    part(new BoxGeometry(0.12, 0.16, 0.02), [0.95, 0.95, 0.6], [0.85, 1.2, 0.06]),   // 끝단 반사판
  ]),
};
