import {
  BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { ShapeIdLarge } from './generation';
import { assemble, DARK, GLASS, METAL, part, WHITE, WOOD } from './shapes.kit';

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
    // 웅크린 자세. 원작 집 고양이는 대부분 앉아 있다
    part(new SphereGeometry(0.30, 10, 7), WHITE, [-0.10, 0.32, 0]),
    part(new BoxGeometry(0.44, 0.34, 0.34), WHITE, [0.12, 0.30, 0]),
    // 머리 + 귀 둘 + 코
    part(new SphereGeometry(0.22, 9, 7), WHITE, [0.40, 0.52, 0]),
    part(new ConeGeometry(0.09, 0.16, 4), WHITE, [0.34, 0.72, 0.11]),
    part(new ConeGeometry(0.09, 0.16, 4), WHITE, [0.34, 0.72, -0.11]),
    part(new SphereGeometry(0.045, 5, 4), [0.9, 0.55, 0.6], [0.60, 0.50, 0]),
    // 앞다리 둘
    part(new CylinderGeometry(0.07, 0.07, 0.26, 7), WHITE, [0.34, 0.13, 0.12]),
    part(new CylinderGeometry(0.07, 0.07, 0.26, 7), WHITE, [0.34, 0.13, -0.12]),
    // 몸을 감은 꼬리
    part(new TorusGeometry(0.22, 0.05, 4, 10, Math.PI * 1.2), WHITE, [-0.10, 0.10, 0], LIE_Z),
  ]),

  의자: () => assemble([
    // 등받이 있는 나무 의자. 다리 넷이 보여야 의자다
    part(new BoxGeometry(0.62, 0.08, 0.58), WHITE, [0, 0.52, 0]),
    part(new BoxGeometry(0.62, 0.60, 0.08), WHITE, [0, 0.82, -0.25]),
    part(new BoxGeometry(0.52, 0.08, 0.06), WHITE, [0, 0.66, -0.25]),
    part(new BoxGeometry(0.07, 0.52, 0.07), WOOD, [0.26, 0.26, 0.24]),
    part(new BoxGeometry(0.07, 0.52, 0.07), WOOD, [-0.26, 0.26, 0.24]),
    part(new BoxGeometry(0.07, 0.52, 0.07), WOOD, [0.26, 0.26, -0.24]),
    part(new BoxGeometry(0.07, 0.52, 0.07), WOOD, [-0.26, 0.26, -0.24]),
  ]),

  스툴: () => assemble([
    // 등받이 없는 둥근 걸상. 의자와 실루엣이 달라야 둘 다 두는 의미가 있다
    part(new CylinderGeometry(0.34, 0.34, 0.10, 14), WHITE, [0, 0.55, 0]),
    part(new CylinderGeometry(0.30, 0.30, 0.06, 14), WHITE, [0, 0.62, 0]),
    part(new CylinderGeometry(0.05, 0.06, 0.52, 7), WOOD, [0.20, 0.26, 0.20], [0.06, 0, -0.06]),
    part(new CylinderGeometry(0.05, 0.06, 0.52, 7), WOOD, [-0.20, 0.26, 0.20], [0.06, 0, 0.06]),
    part(new CylinderGeometry(0.05, 0.06, 0.52, 7), WOOD, [0.20, 0.26, -0.20], [-0.06, 0, -0.06]),
    part(new CylinderGeometry(0.05, 0.06, 0.52, 7), WOOD, [-0.20, 0.26, -0.20], [-0.06, 0, 0.06]),
    // 가로대 — 다리만 넷이면 허공에 뜬 판으로 보인다
    part(new CylinderGeometry(0.025, 0.025, 0.40, 5), WOOD, [0, 0.16, 0.20], LIE_X),
    part(new CylinderGeometry(0.025, 0.025, 0.40, 5), WOOD, [0, 0.16, -0.20], LIE_X),
  ]),

  텔레비전: () => assemble([
    // 브라운관 TV. 원작 거실의 그것 — 다리가 짧고 몸통이 두껍다
    part(new BoxGeometry(0.86, 0.66, 0.62), WHITE, [0, 0.42, 0]),
    // 화면 — 살짝 볼록한 유리
    part(new BoxGeometry(0.62, 0.48, 0.04), GLASS, [-0.04, 0.44, 0.32]),
    part(new BoxGeometry(0.54, 0.40, 0.03), [0.35, 0.42, 0.48], [-0.04, 0.44, 0.34]),
    // 오른쪽 조작부 — 다이얼 둘
    part(new CylinderGeometry(0.07, 0.07, 0.05, 8), DARK, [0.34, 0.56, 0.32], LIE_Z),
    part(new CylinderGeometry(0.07, 0.07, 0.05, 8), DARK, [0.34, 0.36, 0.32], LIE_Z),
    // 안테나
    part(new CylinderGeometry(0.02, 0.015, 0.52, 5), METAL, [0.16, 0.98, -0.16], [0.3, 0, 0.3]),
    part(new CylinderGeometry(0.02, 0.015, 0.52, 5), METAL, [-0.16, 0.98, -0.16], [0.3, 0, -0.3]),
    part(new BoxGeometry(0.10, 0.14, 0.10), WHITE, [0.30, 0.05, 0.20]),
    part(new BoxGeometry(0.10, 0.14, 0.10), WHITE, [-0.30, 0.05, 0.20]),
  ]),

  서랍장: () => assemble([
    // 3단 나무 서랍장. 손잡이가 서랍을 서랍으로 만든다
    part(new BoxGeometry(0.82, 0.94, 0.46), WHITE, [0, 0.50, 0]),
    part(new BoxGeometry(0.86, 0.06, 0.50), WHITE, [0, 1.00, 0]),
    for3Drawers(0.78),
    for3Drawers(0.50),
    for3Drawers(0.22),
    part(new BoxGeometry(0.12, 0.10, 0.06), WOOD, [0, 0.06, 0.22]),
  ].flat()),

  스탠드: () => assemble([
    // 갓 달린 탁상등. 갓이 크고 기둥이 가늘어야 스탠드로 읽힌다
    part(new CylinderGeometry(0.30, 0.30, 0.06, 14), WHITE, [0, 0.03, 0]),
    part(new CylinderGeometry(0.035, 0.035, 0.62, 7), METAL, [0, 0.35, 0]),
    part(new CylinderGeometry(0.34, 0.20, 0.36, 14), WHITE, [0, 0.82, 0]),
    // 갓 안쪽 — 밝게 둬야 불이 켜진 것처럼 보인다
    part(new CylinderGeometry(0.30, 0.17, 0.04, 14), [1, 0.95, 0.75], [0, 0.66, 0]),
    part(new SphereGeometry(0.10, 8, 6), GLASS, [0, 0.72, 0]),
  ]),

  물뿌리개: () => assemble([
    // 뒷마당 것. 긴 주둥이와 장미꼭지가 실루엣의 전부다
    part(new CylinderGeometry(0.30, 0.34, 0.56, 13), WHITE, [0, 0.30, 0]),
    part(new CylinderGeometry(0.26, 0.30, 0.10, 13), WHITE, [0, 0.62, 0]),
    part(new CylinderGeometry(0.11, 0.11, 0.10, 9), DARK, [0, 0.68, 0]),
    // 주둥이 — 아래에서 위로 뻗는다
    part(new CylinderGeometry(0.06, 0.08, 0.74, 9), WHITE, [0.40, 0.48, 0], [0, 0, -0.7]),
    part(new CylinderGeometry(0.14, 0.06, 0.10, 9), WHITE, [0.66, 0.70, 0], [0, 0, -0.7]),
    // 손잡이 둘
    part(new TorusGeometry(0.20, 0.04, 4, 10, Math.PI), WHITE, [-0.28, 0.62, 0], [0, Math.PI / 2, 0.4]),
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
    part(new CylinderGeometry(0.045, 0.045, 0.06, 7), METAL, [0.18, y, 0.27], LIE_Z),
    part(new CylinderGeometry(0.045, 0.045, 0.06, 7), METAL, [-0.18, y, 0.27], LIE_Z),
  ];
}
