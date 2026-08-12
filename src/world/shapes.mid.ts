import {
  BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { ShapeIdMid } from './generation';
import { assemble, DARK, METAL, part, WHITE, WOOD } from './shapes.kit';

/**
 * 버킷 3~5 (8cm~63cm) 형태.
 *
 * 손에 잡히는 크기다. 공이 20~60cm일 때 화면을 채우므로 실루엣이 읽혀야 한다.
 * 원기둥 분할은 12~14를 쓴다 — 이 크기부터 8각이 눈에 띈다.
 */
export const MID_BUILDERS: Record<ShapeIdMid, () => BufferGeometry> = {
  // ─── 버킷 3 (8~16cm) ───────────────────────────────────────────

  종이컵: () => assemble([
    part(new CylinderGeometry(0.5, 0.36, 1.05, 14), WHITE, [0, 0.55, 0]),            // 테이퍼 몸통
    part(new CylinderGeometry(0.42, 0.3, 0.98, 12), [0.78, 0.78, 0.8], [0, 0.6, 0]), // 안쪽 면
    part(new CylinderGeometry(0.52, 0.5, 0.09, 14), [0.92, 0.92, 0.94], [0, 1.05, 0]), // 말린 림
    part(new CylinderGeometry(0.36, 0.36, 0.06, 12), [0.85, 0.85, 0.86], [0, 0.06, 0]), // 바닥
  ]),

  '탕후루 꼬치': () => assemble([
    part(new CylinderGeometry(0.035, 0.035, 2.0, 6), WOOD, [0, 1.0, 0]),             // 꼬치
    // 딸기 셋. 위로 갈수록 작아야 꽂힌 것으로 보인다
    ...([[0.55, 0.34], [1.05, 0.30], [1.5, 0.25]] as const).map(
      ([y, r]) => part(new SphereGeometry(r, 8, 6), WHITE, [0, y, 0])),
    part(new CylinderGeometry(0.06, 0.03, 0.12, 6), WOOD, [0, 2.02, 0]),             // 뾰족한 끝
  ]),

  컵라면: () => assemble([
    part(new CylinderGeometry(0.5, 0.36, 1.02, 14), WHITE, [0, 0.51, 0]),            // 테이퍼 컵
    part(new CylinderGeometry(0.505, 0.42, 0.5, 14), [0.85, 0.6, 0.4], [0, 0.4, 0]), // 라벨 띠
    part(new CylinderGeometry(0.52, 0.52, 0.05, 14), METAL, [0, 1.04, 0]),           // 종이 뚜껑
    part(new BoxGeometry(0.18, 0.03, 0.16), [0.7, 0.7, 0.72], [0.36, 1.07, 0]),      // 젖힌 뚜껑 귀
  ]),

  '즉석밥 용기': () => assemble([
    part(new CylinderGeometry(0.5, 0.42, 0.62, 12), WHITE, [0, 0.31, 0]),            // 용기
    part(new CylinderGeometry(0.53, 0.53, 0.05, 12), [0.86, 0.86, 0.88], [0, 0.6, 0]), // 림
    part(new CylinderGeometry(0.5, 0.5, 0.03, 12), METAL, [0, 0.64, 0]),             // 필름 뚜껑
    part(new BoxGeometry(0.16, 0.02, 0.1), METAL, [0.55, 0.64, 0], [0, 0, 0.35]),    // 뜯는 귀
  ]),

  '요구르트 줄': () => assemble([
    // 네 개 묶음. 하나짜리면 그냥 작은 병이라 '줄'로 안 읽힌다.
    // 다섯 개면 332 삼각형으로 상한(300)을 넘는다 — shapecheck 가 잡아줬다.
    ...([-0.63, -0.21, 0.21, 0.63] as const).flatMap((x) => [
      part(new CylinderGeometry(0.19, 0.16, 0.46, 8), WHITE, [x, 0.23, 0]),
      part(new CylinderGeometry(0.2, 0.2, 0.05, 8), METAL, [x, 0.48, 0]),            // 은박 뚜껑
    ]),
    part(new BoxGeometry(1.5, 0.05, 0.12), [0.8, 0.8, 0.82], [0, 0.4, 0]),           // 묶음 띠
  ]),

  마스크: () => assemble([
    // 주름 세 겹을 각도 다르게 — 평평한 판이면 종이로 보인다
    ...([[0.0, 0.06], [0.16, 0.0], [-0.16, 0.0]] as const).map(
      ([z, dy], i) => part(new BoxGeometry(1.0, 0.03, 0.2), WHITE,
        [0, 0.14 + dy, z], [i === 0 ? 0 : (z > 0 ? 0.25 : -0.25), 0, 0])),
    part(new BoxGeometry(0.04, 0.02, 0.5), [0.6, 0.6, 0.62], [0, 0.2, 0]),           // 코 와이어
    ...([0.52, -0.52] as const).map(
      (x) => part(new TorusGeometry(0.22, 0.018, 4, 8), WHITE, [x, 0.13, 0], [Math.PI / 2, 0, 0])), // 귀끈
  ]),

  리모컨: () => assemble([
    part(new BoxGeometry(0.42, 0.16, 1.6), WHITE, [0, 0.08, 0]),                     // 몸통
    part(new CylinderGeometry(0.21, 0.21, 0.42, 8), [0.92, 0.92, 0.94], [0, 0.16, 0.6], [Math.PI / 2, 0, 0]), // 곡면 상단
    part(new CylinderGeometry(0.13, 0.13, 0.04, 8), [1, 0.4, 0.35], [0, 0.18, 0.66]), // 전원 버튼
    ...([0, 1, 2] as const).flatMap((r) => ([-0.11, 0.11] as const).map(
      (x) => part(new BoxGeometry(0.14, 0.04, 0.12), DARK, [x, 0.17, 0.2 - r * 0.3]))), // 버튼 6
  ]),

  // ─── 버킷 4 (16~32cm) ──────────────────────────────────────────

  소주병: () => assemble([
    part(new CylinderGeometry(0.36, 0.35, 1.42, 12), WHITE, [0, 0.79, 0]),            // 몸통
    part(new CylinderGeometry(0.365, 0.365, 0.10, 10), [0.9, 0.92, 0.9], [0, 0.13, 0]), // 바닥 굽
    part(new CylinderGeometry(0.15, 0.36, 0.38, 12), WHITE, [0, 1.69, 0]),            // 어깨
    part(new CylinderGeometry(0.14, 0.14, 0.52, 10), WHITE, [0, 2.14, 0]),            // 목
    part(new CylinderGeometry(0.165, 0.165, 0.07, 10), WHITE, [0, 2.36, 0]),          // 목 링
    part(new CylinderGeometry(0.155, 0.16, 0.18, 12), METAL, [0, 2.49, 0]),           // 뚜껑
    part(new CylinderGeometry(0.375, 0.375, 0.58, 12), [0.86, 0.9, 0.86], [0, 0.74, 0]), // 라벨
  ]),

  '떡볶이 접시': () => assemble([
    part(new CylinderGeometry(0.5, 0.4, 0.22, 16), WHITE, [0, 0.11, 0]),             // 접시
    part(new CylinderGeometry(0.52, 0.5, 0.06, 16), [0.9, 0.9, 0.92], [0, 0.23, 0]), // 림
    // 떡 넷. 원기둥을 눕혀야 가래떡으로 읽힌다
    ...([[-0.14, -0.1, 0.3], [0.12, -0.06, -0.2], [-0.02, 0.14, 0.9], [0.16, 0.16, 2.1]] as const).map(
      ([x, z, a]) => part(new CylinderGeometry(0.09, 0.09, 0.34, 8), [0.95, 0.55, 0.4],
        [x, 0.24, z], [0, a, Math.PI / 2])),
  ]),

  '배달 용기': () => assemble([
    part(new BoxGeometry(1.0, 0.42, 0.72), WHITE, [0, 0.21, 0]),                     // 용기
    part(new BoxGeometry(1.04, 0.05, 0.76), [0.88, 0.88, 0.9], [0, 0.44, 0]),        // 뚜껑
    part(new BoxGeometry(0.03, 0.3, 0.68), [0.8, 0.8, 0.82], [0.06, 0.24, 0]),       // 칸막이
    part(new BoxGeometry(0.94, 0.3, 0.03), [0.8, 0.8, 0.82], [0, 0.24, 0.1]),        // 칸막이 2
    ...([[0.52, 0], [-0.52, 0]] as const).map(
      ([x, z]) => part(new BoxGeometry(0.06, 0.1, 0.2), [0.7, 0.7, 0.72], [x, 0.44, z])), // 잠금 귀
    // 비어 있으면 그냥 플라스틱 상자다. 내용물이 보여야 '배달 용기'가 된다
    part(new CylinderGeometry(0.26, 0.26, 0.3, 10), [0.96, 0.94, 0.88], [-0.3, 0.3, 0]), // 밥
    part(new CylinderGeometry(0.2, 0.2, 0.24, 10), [0.9, 0.45, 0.35], [0.34, 0.28, 0.16]), // 반찬
  ]),

  슬리퍼: () => assemble([
    part(new BoxGeometry(1.0, 0.12, 0.42), WHITE, [0, 0.06, 0]),                     // 밑창
    part(new BoxGeometry(0.34, 0.08, 0.42), [0.85, 0.85, 0.87], [-0.3, 0.16, 0]),    // 뒤꿈치 굽
    part(new CylinderGeometry(0.21, 0.21, 0.4, 8), WHITE, [0.4, 0.06, 0], [Math.PI / 2, 0, 0]), // 둥근 앞코
    // 발등 X자 끈
    part(new BoxGeometry(0.44, 0.06, 0.07), DARK, [0.18, 0.2, 0.1], [0, 0.5, 0.35]),
    part(new BoxGeometry(0.44, 0.06, 0.07), DARK, [0.18, 0.2, -0.1], [0, -0.5, 0.35]),
    part(new BoxGeometry(0.9, 0.03, 0.34), [0.82, 0.8, 0.76], [0.02, 0.13, 0]),      // 깔창
    part(new BoxGeometry(0.98, 0.05, 0.4), [0.6, 0.6, 0.62], [0, 0.02, 0]),          // 바닥 트레드
  ]),

  벽돌: () => assemble([
    part(new BoxGeometry(1.0, 0.42, 0.48), WHITE, [0, 0.21, 0]),                     // 몸통
    // 구멍 셋 — 이게 있어야 콘크리트 블록으로 읽힌다
    ...([-0.3, 0, 0.3] as const).map(
      (x) => part(new CylinderGeometry(0.11, 0.11, 0.44, 8), [0.45, 0.45, 0.47], [x, 0.21, 0])),
    part(new BoxGeometry(1.005, 0.06, 0.485), [0.8, 0.8, 0.8], [0, 0.4, 0]),         // 윗면 밝게
  ]),

  '종량제 봉투': () => assemble([
    part(new SphereGeometry(0.5, 8, 6), WHITE, [0, 0.52, 0]),                        // 불룩한 몸통
    part(new CylinderGeometry(0.5, 0.44, 0.4, 8), WHITE, [0, 0.24, 0]),              // 바닥 쪽
    part(new CylinderGeometry(0.14, 0.24, 0.26, 8), WHITE, [0, 0.95, 0]),            // 묶은 목
    ...([0.4, -0.4] as const).map(
      (a) => part(new BoxGeometry(0.34, 0.06, 0.2), [0.9, 0.9, 0.92], [Math.sin(a) * 0.22, 1.1, 0], [0, 0, a])), // 매듭 귀
  ]),

  화분: () => assemble([
    part(new CylinderGeometry(0.5, 0.34, 0.7, 14), WHITE, [0, 0.35, 0]),             // 테이퍼 화분
    part(new CylinderGeometry(0.53, 0.5, 0.1, 14), [0.88, 0.88, 0.86], [0, 0.68, 0]), // 림
    part(new CylinderGeometry(0.45, 0.45, 0.06, 12), [0.4, 0.32, 0.26], [0, 0.68, 0]), // 흙
    // 잎 셋 — 서로 다른 각도로 뻗어야 식물로 보인다
    ...([[0.3, 0.25, 0], [-0.2, 0.15, -0.35], [0.05, 0.05, 0.3]] as const).map(
      ([x, a, z]) => part(new ConeGeometry(0.16, 0.62, 6), [0.55, 0.75, 0.45],
        [x, 1.0, z], [0, 0, a])),
  ]),

  // ─── 버킷 5 (32~63cm) ──────────────────────────────────────────

  라바콘: () => assemble([
    // 반사띠가 가장 밝아야 라바콘으로 읽힌다. 그래서 본체를 0.8로 눌렀다.
    // 실제 라바콘은 띠가 **2줄**이다 — 이게 한 줄일 때와 실루엣이 확 다르다.
    part(new BoxGeometry(0.64, 0.05, 0.64), [0.78, 0.78, 0.78], [0, 0.025, 0]),       // 받침
    part(new CylinderGeometry(0.20, 0.30, 0.08, 4), [0.78, 0.78, 0.78], [0, 0.09, 0], [0, Math.PI / 4, 0]), // 받침 테이퍼
    part(new ConeGeometry(0.26, 0.72, 12), [0.8, 0.8, 0.8], [0, 0.42, 0]),            // 몸통
    // 띠는 원뿔 표면에 **거의 붙어야** 한다. 처음엔 반지름 0.155~0.185로 만들었는데
    // 그 높이의 원뿔 반지름이 0.101이라 3cm나 튀어나와 탑처럼 보였다.
    // 원뿔은 y=0.06에서 반지름 0.26, y=0.78이 꼭짓점이므로 r(y) = 0.26*(0.78-y)/0.72 다.
    // 띠 반지름은 그 값 + 0.006 으로 잡는다. 딱 맞추면 같은 평면이 겹쳐 z-fighting이 나고,
    // 더 키우면 계단이 생긴다. 0.006이면 12각형 면 중앙에서만 살짝 도드라진다.
    part(new CylinderGeometry(0.147, 0.194, 0.13, 12), WHITE, [0, 0.325, 0]),         // 반사띠 아래 (y 0.26~0.39)
    part(new CylinderGeometry(0.085, 0.125, 0.11, 12), WHITE, [0, 0.505, 0]),         // 반사띠 위 (y 0.45~0.56)
    part(new CylinderGeometry(0.055, 0.062, 0.05, 10), [0.7, 0.7, 0.7], [0, 0.735, 0]), // 상단 링
  ]),

  '택배 상자': () => assemble([
    part(new BoxGeometry(1.0, 0.72, 0.8), WHITE, [0, 0.36, 0]),                      // 상자
    // 젖혀진 플랩 넷 — 닫힌 상자는 그냥 정육면체다
    ...([[0.66, 0.9], [-0.66, -0.9]] as const).map(
      ([x, a]) => part(new BoxGeometry(0.42, 0.04, 0.78), [0.88, 0.86, 0.82],
        [x, 0.86, 0], [0, 0, a])),
    ...([[0.55, -0.8], [-0.55, 0.8]] as const).map(
      ([z, a]) => part(new BoxGeometry(0.96, 0.04, 0.36), [0.88, 0.86, 0.82],
        [0, 0.82, z], [a, 0, 0])),
    part(new BoxGeometry(0.14, 0.05, 0.82), [0.75, 0.72, 0.66], [0, 0.73, 0]),       // 테이프
    part(new BoxGeometry(0.4, 0.02, 0.28), [0.98, 0.98, 0.96], [0.2, 0.73, 0.2]),    // 송장
    part(new BoxGeometry(1.02, 0.3, 0.06), [0.78, 0.75, 0.7], [0, 0.36, 0.41]),      // 앞면 테이프
    part(new BoxGeometry(0.06, 0.3, 0.82), [0.78, 0.75, 0.7], [0.51, 0.36, 0]),      // 옆면 테이프
  ]),

  소화기: () => assemble([
    part(new CylinderGeometry(0.5, 0.48, 1.5, 14), WHITE, [0, 0.75, 0]),             // 몸통
    part(new CylinderGeometry(0.24, 0.5, 0.30, 14), WHITE, [0, 1.65, 0]),            // 어깨
    part(new CylinderGeometry(0.13, 0.13, 0.22, 10), METAL, [0, 1.91, 0]),           // 목
    part(new BoxGeometry(0.30, 0.16, 0.22), METAL, [0, 2.08, 0]),                    // 밸브 몸체
    part(new BoxGeometry(0.42, 0.05, 0.07), METAL, [0.10, 2.20, 0], [0, 0, 0.12]),   // 손잡이 위
    part(new BoxGeometry(0.36, 0.05, 0.07), METAL, [0.08, 2.02, 0], [0, 0, -0.15]),  // 손잡이 아래
    part(new CylinderGeometry(0.05, 0.05, 0.75, 6), DARK, [0.28, 1.40, 0], [0, 0, 0.5]), // 호스
    part(new ConeGeometry(0.09, 0.20, 6), DARK, [0.44, 1.02, 0], [0, 0, -0.6]),      // 노즐
    part(new CylinderGeometry(0.505, 0.49, 0.55, 14), [0.9, 0.9, 0.88], [0, 0.85, 0]), // 라벨
  ]),

  '라이더 헬멧': () => assemble([
    part(new SphereGeometry(0.5, 10, 8), WHITE, [0, 0.5, 0]),                        // 쉘
    part(new BoxGeometry(0.7, 0.28, 0.06), [0.35, 0.4, 0.5], [0, 0.5, 0.44]),        // 바이저
    part(new CylinderGeometry(0.5, 0.5, 0.1, 10), [0.85, 0.85, 0.87], [0, 0.06, 0]), // 아래 테두리
    part(new BoxGeometry(0.32, 0.3, 0.2), [0.75, 0.75, 0.78], [0, 0.3, 0.44]),       // 턱 보호대
    ...([0.2, -0.2] as const).map(
      (x) => part(new BoxGeometry(0.1, 0.05, 0.16), DARK, [x, 0.86, 0.22])),         // 통풍구
  ]),

  '스티로폼 박스': () => assemble([
    part(new BoxGeometry(1.0, 0.6, 0.72), WHITE, [0, 0.3, 0]),                       // 본체
    part(new BoxGeometry(1.04, 0.12, 0.76), [0.94, 0.94, 0.95], [0, 0.66, 0]),       // 뚜껑
    // 두꺼운 벽이 스티로폼의 정체성이다 — 테두리를 밝게 둘러 두께를 보여준다
    ...([[0.47, 0], [-0.47, 0]] as const).map(
      ([x, z]) => part(new BoxGeometry(0.1, 0.56, 0.7), [0.88, 0.88, 0.9], [x, 0.3, z])),
    ...([[0, 0.33], [0, -0.33]] as const).map(
      ([x, z]) => part(new BoxGeometry(0.96, 0.56, 0.1), [0.88, 0.88, 0.9], [x, 0.3, z])),
    ...([0.52, -0.52] as const).map(
      (x) => part(new BoxGeometry(0.06, 0.12, 0.3), [0.7, 0.7, 0.72], [x, 0.4, 0])), // 손잡이 홈
    part(new BoxGeometry(0.42, 0.02, 0.24), [0.7, 0.72, 0.78], [0, 0.73, 0]),        // 상표
  ]),

  우산꽂이: () => assemble([
    part(new CylinderGeometry(0.5, 0.46, 1.3, 14), WHITE, [0, 0.65, 0]),             // 통
    part(new CylinderGeometry(0.42, 0.4, 1.2, 12), [0.6, 0.6, 0.64], [0, 0.72, 0]),  // 안쪽
    part(new CylinderGeometry(0.52, 0.5, 0.08, 14), [0.9, 0.9, 0.92], [0, 1.3, 0]),  // 림
    // 꽂힌 우산 둘 — 빈 통이면 그냥 쓰레기통이다
    ...([[0.16, 0.1, 0.12], [-0.14, -0.12, -0.1]] as const).map(
      ([x, z, a]) => part(new CylinderGeometry(0.07, 0.07, 1.7, 6), DARK,
        [x, 1.1, z], [0, 0, a])),
    ...([[0.24, 0.16], [-0.22, -0.2]] as const).map(
      ([x, z]) => part(new BoxGeometry(0.1, 0.16, 0.1), [0.5, 0.5, 0.55], [x, 1.95, z])), // 손잡이
  ]),

  '음식물 쓰레기통': () => assemble([
    part(new CylinderGeometry(0.5, 0.4, 1.0, 12), WHITE, [0, 0.5, 0]),               // 테이퍼 몸통
    part(new CylinderGeometry(0.53, 0.52, 0.12, 12), [0.85, 0.85, 0.87], [0, 1.05, 0]), // 뚜껑
    part(new CylinderGeometry(0.3, 0.3, 0.06, 10), [0.7, 0.7, 0.72], [0, 1.13, 0]),  // 뚜껑 손잡이 판
    ...([0.5, -0.5] as const).map(
      (x) => part(new BoxGeometry(0.1, 0.24, 0.14), [0.6, 0.6, 0.64], [x * 1.06, 0.86, 0])), // 잠금 걸쇠
    part(new CylinderGeometry(0.42, 0.42, 0.05, 12), [0.75, 0.75, 0.77], [0, 0.03, 0]), // 바닥
  ]),
};
