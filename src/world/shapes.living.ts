import {
  BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { ShapeIdLiving } from './generation';
import { assemble, DARK, GLASS, METAL, PAPER, part, WHITE, WOOD } from './shapes.kit';
import { TILE } from './atlas';

/** X축으로 돌린 원기둥·토러스 — 축이 Z가 된다 */
const LIE_Z: readonly [number, number, number] = [Math.PI / 2, 0, 0];
/** 눕힌 원기둥. 원기둥 축은 Y라 Z로 90° 돌리면 X축이 된다 */
const LIE_X: readonly [number, number, number] = [0, 0, Math.PI / 2];

/**
 * **거실 소품 — 여섯 종.**
 *
 * ## 왜 이 파일이 생겼나
 *
 * 사용자가 「오브젝트들이 정확히 뭔지 잘 모르겠어」라고 했다. 형상을 세어보니
 * 거실에 나오는 스무 종 중 **절반이 1~3cm** 였다 — 개미(1) · 클립(1) · 압정(3) ·
 * 단추(2) · 동전(2) · 각설탕(3). **5cm 공에게 1cm 물체는 점이다.** 그 크기에서는
 * 부품을 아무리 깎아도 안 읽힌다. 형상 문제가 아니라 **크기 문제**였다.
 *
 * 그리고 더 큰 게 있었다 — **거실 물건이랄 게 없었다.** 책도 잡지도 시계도 액자도
 * 비디오테이프도 없이 사탕·클립·압정이 굴러다니는 방을 거실이라고 부르고 있었다.
 *
 * 그래서 여기 있는 여섯은 전부 **10~25cm**, 거실에서 바로 알아보는 것들이다.
 *
 * ## 인쇄가 부품보다 세다
 *
 * 시계는 문자판이 있어야 시계다. 부품을 열둘로 늘려도 민짜면 원통이고,
 * 원통 하나라도 문자판이 찍혀 있으면 시계다. 그래서 넷은 새 인쇄 칸을 문다
 * (`TILE.BOOK` · `VIDEO` · `CLOCK` · `PICTURE` — 이 작업에서 그렸다).
 *
 * ## 규약
 *
 * 다른 빌더와 같다. `shapes.kit.ts` 만 import 한다(`shapes.ts` 를 물면 순환 참조).
 * 치수는 실제 cm 감각으로 쓰고, `assemble()` 의 `normalize()` 가 최장축을 1.0 으로
 * 맞추며 바닥을 y = −0.5 에 놓는다.
 * **`part()` 의 5번째 인자는 배율이 아니라 인쇄 칸 번호다.**
 */
export const LIVING_BUILDERS: Record<ShapeIdLiving, () => BufferGeometry> = {

  /**
   * 책 (22cm) — **세워둔** 책.
   *
   * 눕히면 그냥 판때기다. 세워야 책등이 보이고, 책등이 보여야 책장에 꽂힌 책이 된다.
   * 종이 쪽(앞면)과 표지(뒷면)의 색·두께가 달라야 「닫힌 책」으로 읽힌다.
   */
  책: () => assemble([
    part(new BoxGeometry(0.62, 1.00, 0.16), WHITE, [0, 0.50, 0], undefined, TILE.BOOK),
    // 책배 — 종이 단면. 표지보다 밝고 살짝 안쪽으로 들어간다
    part(new BoxGeometry(0.58, 0.94, 0.10), PAPER, [0.015, 0.50, 0.045]),
    // 책등. 표지가 접히는 쪽이라 조금 두껍다
    part(new BoxGeometry(0.05, 1.00, 0.17), WHITE, [-0.31, 0.50, 0]),
    // 책등 위아래 가름끈
    part(new BoxGeometry(0.06, 0.035, 0.18), [0.85, 0.72, 0.45], [-0.31, 0.94, 0]),
    part(new BoxGeometry(0.06, 0.035, 0.18), [0.85, 0.72, 0.45], [-0.31, 0.06, 0]),
    // 띠지 — 아래쪽 4분의 1을 두른다
    part(new BoxGeometry(0.63, 0.20, 0.175), [0.88, 0.40, 0.24], [0, 0.17, 0]),
    // 갈피 리본
    part(new BoxGeometry(0.02, 0.26, 0.012), [0.78, 0.24, 0.22], [0.24, 0.06, 0.088]),
  ]),

  /**
   * 비디오테이프 (19cm) — VHS 카세트.
   *
   * **릴 창 두 개가 정체다.** 창 없이 검은 상자를 놓으면 벽돌이다.
   * 앞 셔터(은색 띠)와 라벨 종이가 나머지를 맡는다.
   */
  비디오테이프: () => assemble([
    part(new BoxGeometry(1.00, 0.135, 0.57), DARK, [0, 0.09, 0]),
    // 위 라벨면. 손글씨가 찍힌다
    part(new BoxGeometry(0.92, 0.02, 0.50), WHITE, [0, 0.163, 0], undefined, TILE.VIDEO),
    // 릴 창 둘 — 안이 비쳐야 테이프다
    part(new CylinderGeometry(0.13, 0.13, 0.03, 14), GLASS, [-0.19, 0.168, 0.06]),
    part(new CylinderGeometry(0.13, 0.13, 0.03, 14), GLASS, [0.19, 0.168, 0.06]),
    // 릴 허브
    part(new CylinderGeometry(0.045, 0.045, 0.04, 8), METAL, [-0.19, 0.175, 0.06]),
    part(new CylinderGeometry(0.045, 0.045, 0.04, 8), METAL, [0.19, 0.175, 0.06]),
    // 앞 셔터. 은색 띠 하나가 앞뒤를 갈라준다
    part(new BoxGeometry(0.86, 0.10, 0.03), METAL, [0, 0.09, -0.30]),
    // 뒤쪽 굽 둘
    part(new BoxGeometry(0.10, 0.03, 0.07), DARK, [-0.36, 0.015, 0.22]),
    part(new BoxGeometry(0.10, 0.03, 0.07), DARK, [0.36, 0.015, 0.22]),
  ]),

  /**
   * 탁상시계 (12cm) — 종 둘 달린 자명종.
   *
   * **문자판이 전부다.** 눈금과 바늘이 없으면 발 달린 원통이다.
   * 위의 종 둘과 뒤의 태엽이 「자명종」이라는 실루엣을 만든다.
   */
  탁상시계: () => assemble([
    // 몸통 — 눕힌 원통. 앞면이 문자판이다
    part(new CylinderGeometry(0.40, 0.40, 0.24, 20), WHITE, [0, 0.42, 0], LIE_Z),
    // 문자판. 몸통보다 살짝 앞으로 나와야 테두리가 생긴다
    part(new CylinderGeometry(0.345, 0.345, 0.03, 20), WHITE, [0, 0.42, 0.13], LIE_Z, TILE.CLOCK),
    // 베젤 — 문자판을 두르는 테. 없으면 그림이 몸통에 스티커처럼 붙어 보인다
    part(new TorusGeometry(0.375, 0.035, 4, 20), METAL, [0, 0.42, 0.115], LIE_Z),
    // 종 둘. 자명종의 정체
    part(new SphereGeometry(0.155, 12, 8), METAL, [-0.26, 0.80, 0]),
    part(new SphereGeometry(0.155, 12, 8), METAL, [0.26, 0.80, 0]),
    // 종 자루
    part(new CylinderGeometry(0.028, 0.028, 0.12, 5), METAL, [-0.26, 0.71, 0]),
    part(new CylinderGeometry(0.028, 0.028, 0.12, 5), METAL, [0.26, 0.71, 0]),
    // 종 사이 망치
    part(new CylinderGeometry(0.022, 0.022, 0.30, 5), METAL, [0, 0.78, -0.05], LIE_X),
    // 발 둘. 앞으로 기울어져야 탁상시계로 보인다
    part(new CylinderGeometry(0.035, 0.045, 0.16, 6), METAL, [-0.24, 0.08, 0.10]),
    part(new CylinderGeometry(0.035, 0.045, 0.16, 6), METAL, [0.24, 0.08, 0.10]),
    // 뒤 태엽 손잡이
    part(new CylinderGeometry(0.06, 0.06, 0.05, 6), METAL, [0, 0.42, -0.16], LIE_Z),
  ]),

  /**
   * 액자 (20cm) — 세워둔 사진틀.
   *
   * **테 넷이 안쪽을 감싸야 액자다.** 판때기에 그림만 찍으면 사진이지 액자가 아니다.
   * 뒤 받침대가 「세워져 있다」를 만든다.
   */
  액자: () => assemble([
    // 그림면. 안쪽으로 들어가 있어야 테가 튀어나온 게 보인다
    part(new BoxGeometry(0.72, 0.86, 0.03), WHITE, [0, 0.52, 0], undefined, TILE.PICTURE),
    // 테 넷
    part(new BoxGeometry(0.86, 0.09, 0.07), WOOD, [0, 0.955, 0.015]),
    part(new BoxGeometry(0.86, 0.09, 0.07), WOOD, [0, 0.085, 0.015]),
    part(new BoxGeometry(0.09, 1.00, 0.07), WOOD, [-0.385, 0.52, 0.015]),
    part(new BoxGeometry(0.09, 1.00, 0.07), WOOD, [0.385, 0.52, 0.015]),
    // 뒤판
    part(new BoxGeometry(0.80, 0.92, 0.02), PAPER, [0, 0.52, -0.025]),
    // 받침대. 뒤로 비스듬히 뻗는다
    part(new BoxGeometry(0.16, 0.62, 0.02), PAPER, [0, 0.34, -0.14], [0.42, 0, 0]),
  ]),

  /**
   * 귤 (7cm) — 눌린 구.
   *
   * 사과와 헷갈리면 안 된다. **사과는 세로로 길고 귤은 납작하다.**
   * 꼭지가 위로 솟는 사과와 달리 귤은 꼭지 자리가 옴폭 들어간다.
   */
  귤: () => assemble([
    part(new SphereGeometry(0.5, 16, 10).scale(1, 0.76, 1), WHITE, [0, 0.38, 0]),
    // 꼭지 자리 — 옴폭한 자국. 귤과 사과를 가르는 한 끗
    part(new CylinderGeometry(0.09, 0.11, 0.05, 8), [0.72, 0.52, 0.22], [0, 0.755, 0]),
    // 배꼽 — 아래쪽 자국
    part(new CylinderGeometry(0.06, 0.045, 0.04, 6), [0.78, 0.56, 0.26], [0, 0.015, 0]),
    // 잎 둘
    part(new BoxGeometry(0.20, 0.02, 0.10), [0.34, 0.52, 0.24], [0.10, 0.78, 0.02], [0, 0.5, 0.22]),
    part(new BoxGeometry(0.16, 0.02, 0.08), [0.30, 0.46, 0.22], [-0.07, 0.77, -0.06], [0, -0.8, -0.18]),
  ]),

  /**
   * 재떨이 (12cm) — 유리 재떨이.
   *
   * **가장자리 홈이 재떨이의 정체다.** 홈 없는 오목한 접시는 그릇이다.
   * 담배꽁초 둘이 마지막을 맡는다.
   */
  재떨이: () => assemble([
    // 두꺼운 유리 몸통. 낮고 넓적하다
    part(new CylinderGeometry(0.50, 0.42, 0.22, 20), GLASS, [0, 0.11, 0]),
    // 파인 안쪽. 몸통보다 어두워야 깊이가 보인다
    part(new CylinderGeometry(0.38, 0.30, 0.10, 20), [0.42, 0.50, 0.55], [0, 0.19, 0]),
    // 담배 얹는 홈 둘 — 테두리를 가로지르는 막대
    part(new BoxGeometry(0.16, 0.05, 0.26), [0.42, 0.50, 0.55], [0.42, 0.215, 0]),
    part(new BoxGeometry(0.26, 0.05, 0.16), [0.42, 0.50, 0.55], [0, 0.215, -0.42]),
    // 꽁초 둘. 필터가 보여야 꽁초다
    part(new CylinderGeometry(0.038, 0.038, 0.26, 6), PAPER, [0.10, 0.235, 0.14], [0, 0.6, 1.5708]),
    part(new CylinderGeometry(0.040, 0.040, 0.09, 6), [0.78, 0.60, 0.30], [0.26, 0.235, 0.05], [0, 0.6, 1.5708]),
    // 재
    part(new SphereGeometry(0.07, 6, 4).scale(1, 0.4, 1), DARK, [-0.12, 0.16, -0.06]),
  ]),
};
