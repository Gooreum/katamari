import {
  BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { ShapeIdMid } from './generation';
import { assemble, DARK, GLASS, METAL, PAPER, part, WHITE, WOOD } from './shapes.kit';
import { TILE } from './atlas';

const LIE_X: readonly [number, number, number] = [0, 0, Math.PI / 2];
const LIE_Z: readonly [number, number, number] = [Math.PI / 2, 0, 0];

/**
 * 버킷 3~5 (8~60cm) 형태 — 원작 타케다 저택 물건.
 *
 * 이 구간이 **화면에서 제일 오래 보인다.** 공이 8cm를 넘긴 뒤부터 30cm까지가
 * 집 맵 플레이의 대부분이고, 그때 눈높이에 있는 게 이 21종이다.
 * 그래서 작은 것들보다 부품을 한두 개 더 쓴다 — 손잡이, 뚜껑, 다리 같은 것.
 */
export const MID_BUILDERS: Record<ShapeIdMid, () => BufferGeometry> = {
  // ─── 버킷 3 (8~15cm) ─────────────────────────────────────────

  소시지: () => assemble([
    // 양끝이 묶인 원기둥. 끝을 원뿔로 막아야 소시지가 된다 (8.3cm)
    part(new CylinderGeometry(0.22, 0.22, 0.66, 10), WHITE, [0, 0.22, 0], LIE_X),
    part(new SphereGeometry(0.22, 9, 6), WHITE, [0.33, 0.22, 0]),
    part(new SphereGeometry(0.22, 9, 6), WHITE, [-0.33, 0.22, 0]),
    part(new CylinderGeometry(0.06, 0.06, 0.10, 5), PAPER, [0.47, 0.22, 0], LIE_X),
  ]),

  껌: () => assemble([
    // 은박에 싸인 판형 껌 (8.5cm)
    part(new BoxGeometry(0.90, 0.10, 0.32), WHITE, [0, 0.05, 0]),
    part(new BoxGeometry(0.62, 0.11, 0.33), WHITE, [0.10, 0.05, 0], undefined, TILE.GUM),
    part(new BoxGeometry(0.10, 0.09, 0.30), PAPER, [-0.44, 0.05, 0]),
  ]),

  달팽이: () => assemble([
    // 껍데기(토러스 두 겹) + 몸통 + 더듬이. 원작 마당의 9.8cm
    part(new TorusGeometry(0.24, 0.13, 5, 11), WHITE, [0.06, 0.32, 0], LIE_Z),
    part(new TorusGeometry(0.11, 0.09, 4, 9), WHITE, [0.06, 0.32, 0], LIE_Z),
    part(new SphereGeometry(0.14, 8, 6), [0.72, 0.66, 0.5], [-0.28, 0.14, 0]),
    part(new BoxGeometry(0.44, 0.14, 0.20), [0.72, 0.66, 0.5], [-0.12, 0.07, 0]),
    part(new CylinderGeometry(0.02, 0.02, 0.18, 4), [0.72, 0.66, 0.5], [-0.34, 0.26, 0.06], [0, 0, 0.35]),
    part(new CylinderGeometry(0.02, 0.02, 0.18, 4), [0.72, 0.66, 0.5], [-0.34, 0.26, -0.06], [0, 0, 0.35]),
  ]),

  '캐러멜 상자': () => assemble([
    // 세워둔 갑 (11.3cm). 뚜껑 단이 있어야 상자가 아니라 캐러멜 갑이다
    part(new BoxGeometry(0.44, 0.90, 0.24), WHITE, [0, 0.45, 0], undefined, TILE.CARAMEL),
    part(new BoxGeometry(0.46, 0.16, 0.26), PAPER, [0, 0.82, 0]),
    part(new BoxGeometry(0.40, 0.34, 0.02), [0.85, 0.45, 0.15], [0, 0.42, 0.13]),
  ]),

  사과: () => assemble([
    part(new SphereGeometry(0.46, 10, 7), WHITE, [0, 0.44, 0]),
    // 꼭지가 파인 자리. 구만 두면 공이지 사과가 아니다
    part(new CylinderGeometry(0.035, 0.03, 0.22, 5), WOOD, [0, 0.90, 0], [0, 0, 0.16]),
    part(new BoxGeometry(0.22, 0.02, 0.12), [0.35, 0.55, 0.25], [0.14, 0.92, 0], [0, 0.3, 0.2]),
  ]),

  찻잔: () => assemble([
    // 몸통 + 손잡이 + 받침. 일본 찻잔이라 손잡이는 작게
    part(new CylinderGeometry(0.32, 0.24, 0.44, 12), WHITE, [0, 0.28, 0], undefined, TILE.TEACUP),
    part(new CylinderGeometry(0.27, 0.27, 0.06, 12), [0.55, 0.45, 0.35], [0, 0.47, 0]),
    part(new CylinderGeometry(0.40, 0.40, 0.05, 12), WHITE, [0, 0.03, 0]),
    part(new TorusGeometry(0.13, 0.035, 4, 9), WHITE, [0.36, 0.30, 0], LIE_Z),
  ]),

  전구: () => assemble([
    part(new SphereGeometry(0.36, 10, 7), GLASS, [0, 0.52, 0]),
    // 목 + 나사 소켓. 소켓이 없으면 그냥 유리공이다
    part(new CylinderGeometry(0.16, 0.24, 0.16, 9), GLASS, [0, 0.20, 0]),
    part(new CylinderGeometry(0.15, 0.15, 0.22, 9), METAL, [0, 0.11, 0]),
    part(new SphereGeometry(0.06, 6, 4), DARK, [0, 0.02, 0]),
  ]),

  // ─── 버킷 4 (15~30cm) ────────────────────────────────────────

  찌라시: () => assemble([
    // 바닥에 떨어져 살짝 휜 낱장 (16.8cm). 각도가 다른 판 셋이면 '버려진' 게 된다
    part(new BoxGeometry(0.94, 0.012, 0.68), WHITE, [0, 0.01, 0], undefined, TILE.FLYER),
    part(new BoxGeometry(0.60, 0.012, 0.52), WHITE, [0.16, 0.03, 0.06], [0.06, 0.2, 0.03], TILE.FLYER),
    part(new BoxGeometry(0.34, 0.012, 0.30), [0.85, 0.3, 0.25], [-0.24, 0.02, -0.14], [0, -0.4, 0]),
  ]),

  신문: () => assemble([
    // 접어서 쌓아둔 신문 (21.5cm). 층이 보여야 한 장이 아니라 신문이다
    part(new BoxGeometry(0.92, 0.10, 0.62), WHITE, [0, 0.05, 0]),
    part(new BoxGeometry(0.88, 0.08, 0.58), PAPER, [0.02, 0.13, 0.01], [0, 0.05, 0]),
    part(new BoxGeometry(0.84, 0.06, 0.54), WHITE, [-0.02, 0.19, -0.01], [0, -0.04, 0], TILE.NEWSPAPER),
    // 접힌 등
    part(new CylinderGeometry(0.05, 0.05, 0.62, 6), PAPER, [-0.44, 0.10, 0], LIE_Z),
    part(new BoxGeometry(0.50, 0.02, 0.10), DARK, [0.10, 0.23, 0.10]),
  ]),

  연필깎이: () => assemble([
    // 손잡이 달린 탁상형 (26.2cm). 원작 아이 방에 있다
    part(new BoxGeometry(0.60, 0.46, 0.44), WHITE, [0, 0.23, 0], undefined, TILE.SHARPENER),
    part(new BoxGeometry(0.66, 0.12, 0.50), DARK, [0, 0.06, 0]),
    // 연필 꽂는 구멍
    part(new CylinderGeometry(0.09, 0.09, 0.10, 8), DARK, [-0.32, 0.30, 0], LIE_X),
    // 크랭크 손잡이
    part(new CylinderGeometry(0.05, 0.05, 0.20, 7), METAL, [0.34, 0.30, 0], LIE_X),
    part(new BoxGeometry(0.05, 0.30, 0.05), METAL, [0.44, 0.38, 0]),
    part(new CylinderGeometry(0.07, 0.07, 0.12, 7), WOOD, [0.44, 0.52, 0], LIE_X),
  ]),

  'RC 컨트롤러': () => assemble([
    // 안테나 세운 조종기 (30.1cm). 안테나가 실루엣의 전부다
    part(new BoxGeometry(0.56, 0.30, 0.40), WHITE, [0, 0.15, 0]),
    part(new BoxGeometry(0.60, 0.08, 0.44), WHITE, [0, 0.29, 0], undefined, TILE.RC),
    part(new CylinderGeometry(0.10, 0.10, 0.06, 8), DARK, [-0.16, 0.35, 0]),
    part(new CylinderGeometry(0.10, 0.10, 0.06, 8), DARK, [0.16, 0.35, 0]),
    part(new CylinderGeometry(0.03, 0.02, 0.58, 5), METAL, [0.24, 0.62, -0.12]),
    part(new SphereGeometry(0.035, 5, 4), [0.9, 0.3, 0.2], [0.24, 0.92, -0.12]),
  ]),

  접시: () => assemble([
    // 얕은 원반 + 굽. 원작 부엌의 그것
    part(new CylinderGeometry(0.50, 0.36, 0.14, 14), WHITE, [0, 0.09, 0], undefined, TILE.PLATE),
    part(new CylinderGeometry(0.22, 0.22, 0.05, 12), WHITE, [0, 0.025, 0]),
    part(new TorusGeometry(0.44, 0.03, 4, 14), [0.55, 0.62, 0.75], [0, 0.15, 0], LIE_Z),
  ]),

  슬리퍼: () => assemble([
    // 밑창 + 발등 띠. 실내 슬리퍼라 뒤가 트여 있다.
    //
    // 앞뒤를 원기둥으로 둥글렸더니 그 원기둥이 옆에서 큰 원반으로 보여서
    // **아령처럼** 나왔다. 둥글리는 건 발가락 쪽만, 그것도 납작한 원기둥으로 한다.
    part(new BoxGeometry(0.74, 0.09, 0.34), WHITE, [-0.05, 0.045, 0]),
    part(new CylinderGeometry(0.17, 0.17, 0.09, 11), WHITE, [0.32, 0.045, 0]),
    // 발등 띠 — 폭 방향으로 걸친 아치. 축이 X여야 발등을 덮는다
    part(new TorusGeometry(0.17, 0.045, 4, 10, Math.PI), WHITE, [0.16, 0.08, 0], [0, 0, 0]),
    part(new BoxGeometry(0.20, 0.04, 0.34), WHITE, [0.16, 0.24, 0]),
  ]),

  우유팩: () => assemble([
    // 1L 게이블탑 (19.5cm). **지붕 경사가 없으면 그냥 상자다** — 원작 거실에서
    // 이 실루엣과 소 그림 인쇄가 우유팩을 우유팩으로 만든다.
    part(new BoxGeometry(0.46, 0.66, 0.46), WHITE, [0, 0.33, 0], undefined, TILE.MILK),
    // **지붕에는 인쇄를 안 넣는다.** 넣었더니 색 띠가 몸통 위에 한 번 더 나와서
    // 팩이 두 칸으로 잘려 보였다. 인쇄는 몸통 한 벌이면 충분하다.
    part(new BoxGeometry(0.46, 0.26, 0.24), WHITE, [0, 0.76, 0.11], [0.7, 0, 0]),
    part(new BoxGeometry(0.46, 0.26, 0.24), WHITE, [0, 0.76, -0.11], [-0.7, 0, 0]),
    // 접힌 마루. 지붕 둘이 만나는 자리를 덮어야 틈이 안 보인다
    part(new BoxGeometry(0.46, 0.10, 0.04), PAPER, [0, 0.91, 0]),
  ]),

  '두루마리 휴지': () => assemble([
    part(new CylinderGeometry(0.42, 0.42, 0.52, 14), WHITE, [0, 0.26, 0]),
    // 심지 구멍. 어두운 안쪽이 보여야 두루마리다
    part(new CylinderGeometry(0.13, 0.13, 0.56, 10), [0.55, 0.48, 0.38], [0, 0.26, 0]),
    // 풀린 자락
    part(new BoxGeometry(0.02, 0.34, 0.44), PAPER, [0.42, 0.17, 0], [0, 0, -0.12]),
  ]),

  // ─── 버킷 5 (30~60cm) ────────────────────────────────────────

  방석: () => assemble([
    // 네모 방석 (자부톤). 모서리에 술이 달려 있다
    part(new BoxGeometry(0.92, 0.16, 0.92), WHITE, [0, 0.08, 0]),
    part(new BoxGeometry(0.80, 0.20, 0.80), WHITE, [0, 0.09, 0]),
    part(new SphereGeometry(0.05, 5, 4), PAPER, [0.44, 0.08, 0.44]),
    part(new SphereGeometry(0.05, 5, 4), PAPER, [-0.44, 0.08, 0.44]),
    part(new SphereGeometry(0.05, 5, 4), PAPER, [0.44, 0.08, -0.44]),
    part(new SphereGeometry(0.05, 5, 4), PAPER, [-0.44, 0.08, -0.44]),
  ]),

  백팩: () => assemble([
    // 원작 아이 방의 란도셀. 뚜껑과 어깨끈이 실루엣이다
    part(new BoxGeometry(0.62, 0.72, 0.40), WHITE, [0, 0.36, 0]),
    part(new BoxGeometry(0.64, 0.30, 0.42), WHITE, [0, 0.62, 0.02]),
    part(new BoxGeometry(0.16, 0.08, 0.06), METAL, [0, 0.48, 0.22]),
    // 어깨끈
    part(new TorusGeometry(0.20, 0.045, 4, 9, Math.PI), WHITE, [0.18, 0.44, -0.20], [0, 0, 0]),
    part(new TorusGeometry(0.20, 0.045, 4, 9, Math.PI), WHITE, [-0.18, 0.44, -0.20], [0, 0, 0]),
  ]),

  휴지통: () => assemble([
    part(new CylinderGeometry(0.42, 0.32, 0.80, 12), WHITE, [0, 0.40, 0]),
    // 테두리 링. 원기둥만 두면 컵이다
    part(new TorusGeometry(0.42, 0.035, 4, 12), WHITE, [0, 0.79, 0], LIE_Z),
    // 안쪽 그림자 — 비어 있는 게 보여야 통이다
    part(new CylinderGeometry(0.36, 0.28, 0.04, 12), DARK, [0, 0.74, 0]),
  ]),

  전화기: () => assemble([
    // 다이얼식 탁상 전화. 원작 복도에 있는 그 검은 것
    part(new BoxGeometry(0.80, 0.24, 0.56), WHITE, [0, 0.12, 0]),
    part(new CylinderGeometry(0.24, 0.24, 0.06, 14), DARK, [0, 0.26, -0.06]),
    part(new CylinderGeometry(0.09, 0.09, 0.08, 8), WHITE, [0, 0.30, -0.06]),
    // 수화기 — 가운데 잘록한 막대
    part(new BoxGeometry(0.66, 0.14, 0.14), WHITE, [0, 0.31, 0.20]),
    part(new BoxGeometry(0.20, 0.20, 0.20), WHITE, [0.30, 0.34, 0.20]),
    part(new BoxGeometry(0.20, 0.20, 0.20), WHITE, [-0.30, 0.34, 0.20]),
  ]),

  밥솥: () => assemble([
    part(new CylinderGeometry(0.44, 0.44, 0.52, 14), WHITE, [0, 0.28, 0]),
    // 뚜껑 + 손잡이 + 김 구멍
    part(new CylinderGeometry(0.46, 0.44, 0.14, 14), WHITE, [0, 0.60, 0]),
    part(new CylinderGeometry(0.10, 0.10, 0.10, 8), DARK, [0, 0.71, 0]),
    part(new BoxGeometry(0.16, 0.10, 0.10), DARK, [0.46, 0.34, 0]),
    part(new BoxGeometry(0.16, 0.10, 0.10), DARK, [-0.46, 0.34, 0]),
    part(new BoxGeometry(0.30, 0.10, 0.02), DARK, [0, 0.30, 0.44]),
  ]),

  화분: () => assemble([
    // 뒷마당의 토마토 화분. 흙과 줄기가 있어야 화분이다
    part(new CylinderGeometry(0.38, 0.28, 0.52, 12), WHITE, [0, 0.26, 0]),
    part(new CylinderGeometry(0.40, 0.40, 0.08, 12), WHITE, [0, 0.48, 0]),
    part(new CylinderGeometry(0.33, 0.33, 0.04, 12), [0.28, 0.22, 0.16], [0, 0.50, 0]),
    part(new CylinderGeometry(0.03, 0.025, 0.44, 5), [0.35, 0.55, 0.25], [0, 0.72, 0]),
    part(new SphereGeometry(0.13, 7, 5), [0.35, 0.55, 0.25], [0.06, 0.92, 0]),
  ]),

  주전자: () => assemble([
    part(new CylinderGeometry(0.36, 0.40, 0.44, 13), WHITE, [0, 0.24, 0]),
    part(new CylinderGeometry(0.30, 0.36, 0.12, 13), WHITE, [0, 0.51, 0]),
    part(new CylinderGeometry(0.07, 0.07, 0.08, 7), DARK, [0, 0.60, 0]),
    // 주둥이 — 이게 없으면 냄비다
    part(new CylinderGeometry(0.05, 0.09, 0.34, 8), WHITE, [0.36, 0.40, 0], [0, 0, -0.9]),
    // 손잡이
    part(new TorusGeometry(0.30, 0.035, 4, 10, Math.PI), METAL, [0, 0.54, 0], [0, Math.PI / 2, 0]),
  ]),
};
