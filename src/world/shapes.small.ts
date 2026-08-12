import {
  BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { ShapeIdSmall } from './generation';
import { assemble, METAL, PAPER, part, WHITE } from './shapes.kit';

/** 눕힌 원기둥을 만들 때 쓰는 회전. 원기둥 축은 Y라 Z로 90° 돌리면 X축이 된다. */
const LIE_X: readonly [number, number, number] = [0, 0, Math.PI / 2];

/**
 * 버킷 0~2 (1~8cm) 형태.
 *
 * **작은 물체에 부품을 많이 쓰지 않는다.** 동전과 이쑤시개는 화면에서 몇 픽셀이고,
 * 63종을 다 채우면 이 파일의 21종이 전체 물체의 1/3을 차지한다.
 * 여기서 아낀 삼각형이 자판기·붕어빵 카트의 예산이 된다.
 *
 * 치수는 **실제 크기(cm 감각)** 로 쓴다 — normalize()가 어차피 규약에 맞추므로
 * 0~1로 환산할 필요가 없고, 그러면 비율이 눈에 안 보인다.
 */
export const SMALL_BUILDERS: Record<ShapeIdSmall, () => BufferGeometry> = {
  담배꽁초: () => assemble([
    // 원기둥 축은 Y다. Z로 90° 돌리면 축이 X가 된다 — 바닥에 눕힌 담배.
    // 종이를 두 토막으로 나눠 살짝 꺾는다. 곧은 원기둥은 담배가 아니라 분필로 보인다.
    part(new CylinderGeometry(0.14, 0.14, 0.34, 10), WHITE, [0.26, 0.015, 0], [0, 0.16, Math.PI / 2]),
    part(new CylinderGeometry(0.142, 0.14, 0.30, 10), WHITE, [-0.03, 0, 0], [0, 0, Math.PI / 2]),
    part(new CylinderGeometry(0.148, 0.148, 0.28, 10), [0.78, 0.6, 0.34], [-0.32, 0, 0], [0, 0, Math.PI / 2]), // 필터
    part(new CylinderGeometry(0.150, 0.150, 0.035, 8), [0.62, 0.46, 0.24], [-0.18, 0, 0], [0, 0, Math.PI / 2]), // 이음링
    part(new ConeGeometry(0.132, 0.10, 8), [0.12, 0.12, 0.12], [0.45, 0.03, 0], [0, 0, -Math.PI / 2]), // 탄 끝
  ]),

  // ─── 버킷 0 (1~2cm) ────────────────────────────────────────────

  병뚜껑: () => assemble([
    // 뒤집혀 떨어져 있다 — 그래서 톱니 치마가 위로 온다
    part(new CylinderGeometry(0.5, 0.5, 0.06, 12), WHITE, [0, 0.03, 0]),             // 상판
    part(new CylinderGeometry(0.5, 0.47, 0.16, 12), [0.85, 0.85, 0.87], [0, 0.14, 0]), // 톱니 치마
  ]),

  십원짜리: () => assemble([
    part(new CylinderGeometry(0.5, 0.5, 0.07, 14), WHITE, [0, 0.035, 0]),            // 동전
    part(new CylinderGeometry(0.33, 0.33, 0.085, 10), [0.82, 0.72, 0.5], [0, 0.035, 0]), // 다보탑 양각 자리
  ]),

  이쑤시개: () => assemble([
    part(new CylinderGeometry(0.035, 0.035, 0.84, 6), WHITE, [0, 0, 0], LIE_X),
    // 쓰고 버린 것이라 끝이 물들었다. 단색 막대면 이쑤시개인지 성냥인지 모른다
    part(new ConeGeometry(0.035, 0.09, 6), [0.7, 0.58, 0.42], [0.465, 0, 0], [0, 0, -Math.PI / 2]),
    part(new ConeGeometry(0.035, 0.09, 6), [0.7, 0.58, 0.42], [-0.465, 0, 0], LIE_X),
  ]),

  은행알: () => assemble([
    part(new SphereGeometry(0.5, 8, 6), WHITE, [0, 0.5, 0]),                         // 알
    part(new CylinderGeometry(0.05, 0.07, 0.16, 6), [0.55, 0.45, 0.3], [0, 0.98, 0]), // 꼭지
  ]),

  '껌 종이': () => assemble([
    // 구겨진 은박. 각도가 다른 판 넷이 겹치면 평평한 종이가 '버려진 것'이 된다
    part(new BoxGeometry(0.9, 0.03, 0.7), PAPER, [0, 0.03, 0], [0.12, 0, 0.09]),
    part(new BoxGeometry(0.7, 0.03, 0.6), METAL, [0.12, 0.08, 0.06], [-0.3, 0.4, 0.25]),
    part(new BoxGeometry(0.5, 0.03, 0.55), PAPER, [-0.2, 0.11, -0.1], [0.35, -0.5, -0.2]),
    part(new BoxGeometry(0.4, 0.03, 0.35), METAL, [0.05, 0.15, 0.14], [-0.15, 0.9, 0.5]),
  ]),

  옷핀: () => assemble([
    part(new CylinderGeometry(0.035, 0.035, 0.92, 6), METAL, [0, 0.06, 0], LIE_X),   // 곧은 핀
    part(new CylinderGeometry(0.045, 0.045, 0.86, 6), METAL, [-0.03, -0.09, 0], LIE_X), // 스프링 쪽 몸
    part(new TorusGeometry(0.1, 0.035, 4, 8), METAL, [-0.46, -0.02, 0], [0, Math.PI / 2, 0]), // 코일
    part(new BoxGeometry(0.14, 0.16, 0.1), [0.55, 0.56, 0.6], [0.44, 0.0, 0]),       // 걸이 머리(어둡게)
  ]),

  // ─── 버킷 1 (2~4cm) ────────────────────────────────────────────

  라이터: () => assemble([
    part(new BoxGeometry(0.56, 1.3, 0.34), WHITE, [0, 0.65, 0]),                     // 몸통
    part(new BoxGeometry(0.5, 0.26, 0.3), METAL, [0, 1.42, 0]),                      // 금속 상단
    part(new CylinderGeometry(0.11, 0.11, 0.14, 8), [0.6, 0.6, 0.62], [-0.13, 1.5, 0], [0, 0, Math.PI / 2]), // 부싯돌 휠
    part(new BoxGeometry(0.12, 0.16, 0.12), METAL, [0.16, 1.58, 0]),                 // 노즐
  ]),

  오백원짜리: () => assemble([
    part(new CylinderGeometry(0.5, 0.5, 0.08, 14), WHITE, [0, 0.04, 0]),             // 동전
    part(new CylinderGeometry(0.34, 0.34, 0.095, 10), [0.86, 0.86, 0.88], [0, 0.04, 0]), // 학 양각 자리
  ]),

  건전지: () => assemble([
    part(new CylinderGeometry(0.5, 0.5, 1.9, 12), WHITE, [0, 0.95, 0]),              // 몸통
    part(new CylinderGeometry(0.505, 0.505, 0.9, 12), [0.75, 0.72, 0.6], [0, 0.75, 0]), // 라벨
    part(new CylinderGeometry(0.18, 0.18, 0.12, 8), METAL, [0, 1.96, 0]),            // 양극 돌기
  ]),

  립밤: () => assemble([
    part(new CylinderGeometry(0.48, 0.5, 0.95, 10), WHITE, [0, 0.475, 0]),           // 몸통
    part(new CylinderGeometry(0.5, 0.5, 0.1, 10), [0.8, 0.8, 0.8], [0, 0.98, 0]),    // 이음링
    part(new CylinderGeometry(0.5, 0.49, 0.8, 10), [0.88, 0.88, 0.9], [0, 1.43, 0]), // 뚜껑
  ]),

  열쇠: () => assemble([
    part(new CylinderGeometry(0.3, 0.3, 0.07, 8), [0.85, 0.74, 0.45], [-0.62, 0.035, 0]), // 황동 머리
    part(new BoxGeometry(1.05, 0.07, 0.16), METAL, [0.1, 0.035, 0]),                 // 자루
    // 톱니 — 길이가 다른 세 개여야 열쇠로 읽힌다
    ...([[0.36, 0.1], [0.56, 0.16], [0.76, 0.08]] as const).map(
      ([x, h]) => part(new BoxGeometry(0.1, h, 0.16), METAL, [x, 0.035 + h / 2 + 0.03, 0])),
  ]),

  '페트병 뚜껑': () => assemble([
    part(new CylinderGeometry(0.5, 0.5, 0.5, 12), WHITE, [0, 0.25, 0]),              // 톱니 옆면
    part(new CylinderGeometry(0.46, 0.46, 0.08, 12), [0.9, 0.9, 0.9], [0, 0.53, 0]), // 상판
  ]),

  사탕: () => assemble([
    part(new SphereGeometry(0.42, 8, 6), WHITE, [0, 0.42, 0]),                       // 알맹이
    part(new ConeGeometry(0.2, 0.34, 6), PAPER, [0.5, 0.42, 0], [0, 0, Math.PI / 2]), // 포장 꼬리
    part(new ConeGeometry(0.2, 0.34, 6), PAPER, [-0.5, 0.42, 0], [0, 0, -Math.PI / 2]),
  ]),

  // ─── 버킷 2 (4~8cm) ────────────────────────────────────────────

  담뱃갑: () => assemble([
    part(new BoxGeometry(0.56, 0.72, 0.24), WHITE, [0, 0.36, 0]),                    // 갑 아래
    part(new BoxGeometry(0.57, 0.28, 0.25), [0.85, 0.85, 0.85], [0, 0.86, 0]),       // 젖힌 뚜껑
    part(new BoxGeometry(0.575, 0.22, 0.255), [0.6, 0.6, 0.6], [0, 0.4, 0]),         // 경고 문구 띠
    part(new BoxGeometry(0.44, 0.1, 0.2), METAL, [0, 1.02, 0]),                      // 은박
  ]),

  명함: () => assemble([
    part(new BoxGeometry(1.0, 0.02, 0.58), PAPER, [0, 0.01, 0]),                     // 카드
    part(new BoxGeometry(0.5, 0.025, 0.06), [0.45, 0.45, 0.5], [-0.16, 0.012, -0.1]), // 이름 줄
    part(new BoxGeometry(0.62, 0.025, 0.035), [0.6, 0.6, 0.65], [-0.1, 0.012, 0.06]), // 연락처 줄
    part(new BoxGeometry(0.34, 0.025, 0.04), [0.5, 0.55, 0.7], [0.28, 0.012, -0.18]),  // 회사 로고
  ]),

  찌라시: () => assemble([
    // 바람에 뒹구는 전단지. 낱장을 다른 각도로 겹친다
    part(new BoxGeometry(0.95, 0.02, 0.68), PAPER, [0, 0.02, 0], [0.1, 0, 0.14]),
    part(new BoxGeometry(0.9, 0.02, 0.64), WHITE, [0.06, 0.07, 0.05], [-0.22, 0.3, -0.18]),
    part(new BoxGeometry(0.8, 0.02, 0.6), PAPER, [-0.1, 0.12, -0.06], [0.28, -0.6, 0.3]),
    part(new BoxGeometry(0.6, 0.02, 0.5), [0.8, 0.78, 0.74], [0.14, 0.17, 0.12], [-0.2, 1.0, -0.4]),
  ]),

  물티슈: () => assemble([
    part(new BoxGeometry(1.0, 0.3, 0.66), WHITE, [0, 0.15, 0]),                      // 파우치
    part(new BoxGeometry(0.44, 0.09, 0.3), [0.8, 0.8, 0.82], [0.1, 0.33, 0]),        // 뚜껑
    part(new BoxGeometry(0.5, 0.03, 0.36), [0.65, 0.65, 0.68], [0.1, 0.3, 0]),       // 뚜껑 테두리
    part(new BoxGeometry(0.26, 0.16, 0.2), PAPER, [0.1, 0.44, 0], [0.2, 0, -0.25]),   // 뽑혀 나온 티슈
  ]),

  소주잔: () => assemble([
    part(new CylinderGeometry(0.5, 0.36, 0.72, 12), WHITE, [0, 0.42, 0]),            // 몸통
    part(new CylinderGeometry(0.42, 0.3, 0.66, 12), [0.72, 0.75, 0.78], [0, 0.5, 0]), // 안쪽 면
    part(new CylinderGeometry(0.34, 0.34, 0.1, 10), [0.9, 0.9, 0.92], [0, 0.05, 0]), // 굽
  ]),

  교통카드: () => assemble([
    part(new BoxGeometry(1.0, 0.03, 0.63), WHITE, [0, 0.015, 0]),                    // 카드
    part(new BoxGeometry(0.18, 0.035, 0.14), [0.85, 0.72, 0.35], [-0.3, 0.018, -0.14]), // 금색 칩
    part(new BoxGeometry(0.3, 0.035, 0.1), [0.5, 0.55, 0.65], [0.24, 0.018, 0.16]),  // 로고
    part(new BoxGeometry(1.0, 0.035, 0.12), [0.35, 0.35, 0.4], [0, 0.018, 0.24]),     // 자기띠
  ]),

  '이어폰 케이스': () => assemble([
    part(new CylinderGeometry(0.5, 0.46, 0.52, 12), WHITE, [0, 0.26, 0]),            // 아래 통
    part(new CylinderGeometry(0.5, 0.5, 0.3, 12), [0.9, 0.9, 0.92], [0, 0.67, 0]),   // 뚜껑
    part(new BoxGeometry(0.12, 0.1, 0.16), [0.6, 0.6, 0.62], [0, 0.52, -0.44]),      // 힌지
  ]),
};
