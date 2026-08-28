import {
  BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { ShapeIdHouse } from './generation';
import { assemble, DARK, GLASS, METAL, PAPER, part, WHITE, WOOD } from './shapes.kit';
import { TILE } from './atlas';

/** 눕힌 원기둥. 원기둥 축은 Y라 Z로 90° 돌리면 X축이 된다 */
const LIE_X: readonly [number, number, number] = [0, 0, Math.PI / 2];
/** X축으로 돌린 원기둥 — 축이 Z가 된다 */
const LIE_Z: readonly [number, number, number] = [Math.PI / 2, 0, 0];
/** 원뿔 꼭짓점을 +X 쪽으로 눕히는 회전 */
const TIP_X: readonly [number, number, number] = [0, 0, -Math.PI / 2];

/**
 * **방 정체성 전용 형태** — 부엌 7 · 화장실 4 · 아이 방 5.
 *
 * ## 왜 크기가 아니라 방으로 묶었나
 *
 * 기존 `shapes.small/mid/large.ts` 는 **크기 축**으로 갈라져 있다. 그건 빌더 파일이
 * 1,000줄을 넘어서 나눈 것이라 자연스러운 축이었다. 이 16종이 존재하는 이유는
 * 다르다 — 크기가 아니라 **「부엌에 부엌 물건이 있어야 한다」** 다.
 * 라벨 표가 방마다 갈리는 순간(`ROOM_TABLES`) 이 묶음이 그 표의 재료가 된다.
 *
 * ## 이 16종을 고른 기준
 *
 * 집 맵에는 이미 49종이 있었는데 **전부 거실 물건**이었다. 크레용·주사위·신문·
 * 리모컨·방석·찻잔. 그래서 부엌에 들어가도 크레용이 깔리고 화장실에 밥솥이 굴렀다.
 * 없는 건 「부엌·화장실·아이 방에만 있는 것」이었다.
 *
 * 이름 옆 숫자가 **실물 최대 변(cm)** 이다. 라벨 버킷 경계(1·2·4·8·15·30·60·120cm)
 * 안에 들어가는지 확인하고 넣었다 — 안 그러면 15cm 자리에 35cm짜리 이름이 붙는다.
 *
 * ## 규약
 *
 * `shapes.kit.ts` 만 import 한다 (`shapes.ts` 를 import 하면 순환 참조).
 * 치수는 **실제 cm 감각**으로 쓴다 — `assemble()` 의 `normalize()` 가 최장축을 1.0으로
 * 맞추므로 0~1 로 환산할 필요가 없고, 그러면 비율이 눈에 안 보인다.
 *
 * **`part()` 의 5번째 인자는 배율이 아니라 인쇄 칸 번호다.** 축별로 눌러야 하는
 * 형태(계란·비누·곰인형)는 지오메트리에 `.scale()` 로 직접 굽는다.
 */
export const HOUSE_BUILDERS: Record<ShapeIdHouse, () => BufferGeometry> = {

  // ─── 부엌 ────────────────────────────────────────────────────

  계란: () => assemble([
    // 눕힌 타원. **완전한 구면이면 골프공과 구별이 안 된다** — 마당 표에 골프공이 있다
    part(new SphereGeometry(0.5, 11, 8).scale(1, 0.76, 0.76), WHITE, [0, 0.38, 0]),
    // 한쪽만 좁다. 달걀을 달걀로 만드는 건 이 비대칭이다
    part(new SphereGeometry(0.5, 9, 7).scale(0.44, 0.60, 0.60), WHITE, [0.32, 0.38, 0]),
  ]),

  밥공기: () => assemble([
    // 위가 넓고 아래가 좁은 사발 + 굽. 굽이 없으면 컵이다
    part(new CylinderGeometry(0.50, 0.30, 0.42, 14), WHITE, [0, 0.27, 0]),
    part(new CylinderGeometry(0.30, 0.30, 0.12, 10), WHITE, [0, 0.06, 0]),
    // 테두리 링 — 사발의 윤곽은 안쪽이 아니라 이 얇은 띠가 만든다
    part(new TorusGeometry(0.47, 0.03, 4, 14), [0.62, 0.68, 0.78], [0, 0.47, 0], LIE_Z),
  ]),

  젓가락: () => assemble([
    // **두 짝이어야 한다.** 한 짝만 두면 성냥·연필과 구별이 안 된다
    part(new CylinderGeometry(0.030, 0.017, 1.0, 5), WHITE, [0, 0.03, 0.055], LIE_X),
    part(new CylinderGeometry(0.030, 0.017, 1.0, 5), WHITE, [0, 0.03, -0.055], LIE_X),
    // 굵은 쪽 끝동. 나무젓가락은 여기서 색이 갈린다
    part(new CylinderGeometry(0.033, 0.033, 0.18, 5), WOOD, [-0.40, 0.03, 0.055], LIE_X),
    part(new CylinderGeometry(0.033, 0.033, 0.18, 5), WOOD, [-0.40, 0.03, -0.055], LIE_X),
  ]),

  숟가락: () => assemble([
    part(new BoxGeometry(0.62, 0.035, 0.09), METAL, [-0.16, 0.05, 0]),
    // 눌린 구 하나가 숟가락 머리를 만든다. 상자로 하면 주걱이 된다
    part(new SphereGeometry(0.5, 10, 7).scale(0.46, 0.24, 0.36), METAL, [0.30, 0.06, 0]),
    // 자루 끝 — 얇은 판이 허공에서 끊기면 부러진 것으로 보인다
    part(new CylinderGeometry(0.05, 0.05, 0.035, 8), METAL, [-0.46, 0.05, 0]),
  ]),

  당근: () => assemble([
    // 눕힌 원뿔. 꼭짓점이 +X를 보게 돌린다
    part(new ConeGeometry(0.19, 0.86, 9), WHITE, [0.08, 0.19, 0], TIP_X),
    // 잎 세 갈래. **당근을 당근으로 만드는 건 이 초록이다** — 없으면 그냥 원뿔이다
    part(new ConeGeometry(0.05, 0.30, 4), [0.36, 0.62, 0.28], [-0.44, 0.30, 0], [0, 0, 0.35]),
    part(new ConeGeometry(0.05, 0.26, 4), [0.36, 0.62, 0.28], [-0.40, 0.28, 0.10], [0.4, 0, 0.2]),
    part(new ConeGeometry(0.05, 0.26, 4), [0.36, 0.62, 0.28], [-0.40, 0.28, -0.10], [-0.4, 0, 0.2]),
  ]),

  냄비: () => assemble([
    part(new CylinderGeometry(0.42, 0.38, 0.44, 14), WHITE, [0, 0.22, 0]),
    // 뚜껑 + 꼭지
    part(new CylinderGeometry(0.44, 0.44, 0.06, 14), METAL, [0, 0.47, 0]),
    part(new SphereGeometry(0.08, 7, 5), DARK, [0, 0.53, 0]),
    // 양쪽 귀. **이게 있어야 컵이 아니라 냄비다**
    part(new BoxGeometry(0.16, 0.05, 0.11), DARK, [0.49, 0.34, 0]),
    part(new BoxGeometry(0.16, 0.05, 0.11), DARK, [-0.49, 0.34, 0]),
  ]),

  도마: () => assemble([
    part(new BoxGeometry(0.98, 0.07, 0.62), WHITE, [-0.01, 0.035, 0]),
    // 자루. 자루가 없으면 그냥 판자다
    part(new BoxGeometry(0.24, 0.06, 0.26), WHITE, [0.60, 0.03, 0]),
    part(new CylinderGeometry(0.05, 0.05, 0.10, 8), DARK, [0.62, 0.03, 0]),
    // 나뭇결 두 줄 — 흰 판에 결이 없으면 플라스틱으로 보인다
    part(new BoxGeometry(0.90, 0.012, 0.03), WOOD, [-0.02, 0.072, 0.15]),
    part(new BoxGeometry(0.90, 0.012, 0.03), WOOD, [-0.02, 0.072, -0.11]),
  ]),

  // ─── 화장실 ──────────────────────────────────────────────────

  비누: () => assemble([
    // 모서리가 닳은 덩어리. 상자로 만들면 지우개와 구별이 안 된다
    part(new SphereGeometry(0.5, 11, 7).scale(1, 0.42, 0.66), WHITE, [0, 0.21, 0]),
    // 눌러 찍은 글자 자리 — 비누에는 늘 뭔가 찍혀 있다
    part(new BoxGeometry(0.34, 0.02, 0.15), PAPER, [0, 0.40, 0]),
  ]),

  고무오리: () => assemble([
    part(new SphereGeometry(0.5, 10, 7).scale(1, 0.74, 0.80), WHITE, [-0.06, 0.34, 0]),
    part(new SphereGeometry(0.23, 9, 7), WHITE, [0.29, 0.64, 0]),
    // 부리 — 몸과 다른 색이어야 오리가 된다
    part(new ConeGeometry(0.09, 0.20, 6), [0.95, 0.58, 0.16], [0.48, 0.60, 0], TIP_X),
    part(new SphereGeometry(0.042, 5, 4), DARK, [0.36, 0.72, 0.12]),
    part(new SphereGeometry(0.042, 5, 4), DARK, [0.36, 0.72, -0.12]),
    // 치켜든 꼬리
    part(new ConeGeometry(0.13, 0.24, 5), WHITE, [-0.44, 0.46, 0], [0, 0, 0.9]),
  ]),

  칫솔: () => assemble([
    part(new BoxGeometry(0.70, 0.05, 0.07), WHITE, [-0.13, 0.04, 0]),
    part(new BoxGeometry(0.26, 0.05, 0.11), WHITE, [0.35, 0.04, 0]),
    // 솔. **흰 솔이 있어야 칫솔이지, 없으면 막대다**
    part(new BoxGeometry(0.23, 0.07, 0.10), PAPER, [0.35, 0.09, 0]),
    part(new SphereGeometry(0.05, 6, 5), WHITE, [-0.46, 0.04, 0]),
  ]),

  수건: () => assemble([
    // 개어놓은 수건. **층이 보여야 한 장이 아니라 수건이다** (신문과 같은 수법)
    part(new BoxGeometry(0.98, 0.13, 0.62), WHITE, [0, 0.065, 0]),
    part(new BoxGeometry(0.94, 0.11, 0.58), PAPER, [0.01, 0.185, 0]),
    part(new BoxGeometry(0.90, 0.09, 0.54), WHITE, [-0.01, 0.285, 0]),
    // 접힌 쪽의 둥근 등
    part(new CylinderGeometry(0.065, 0.065, 0.62, 6), PAPER, [-0.49, 0.13, 0], LIE_Z),
    // 가장자리 짜임 띠
    part(new BoxGeometry(0.86, 0.03, 0.06), [0.78, 0.82, 0.88], [0, 0.33, 0.18]),
  ]),

  // ─── 아이 방 ─────────────────────────────────────────────────

  구슬: () => assemble([
    part(new SphereGeometry(0.5, 11, 8), GLASS, [0, 0.5, 0]),
    // 안에 든 꽈배기 심지. **구슬을 구슬로 만드는 건 이것이다** — 없으면 그냥 공이다
    part(new SphereGeometry(0.30, 8, 6).scale(1, 0.34, 0.34), WHITE, [0, 0.50, 0], [0, 0, 0.6]),
  ]),

  '장난감 블록': () => assemble([
    part(new BoxGeometry(0.98, 0.60, 0.98), WHITE, [0, 0.30, 0]),
    // 돌기 넷. 이게 없으면 그냥 정육면체다
    part(new CylinderGeometry(0.16, 0.16, 0.16, 8), WHITE, [0.24, 0.68, 0.24]),
    part(new CylinderGeometry(0.16, 0.16, 0.16, 8), WHITE, [-0.24, 0.68, 0.24]),
    part(new CylinderGeometry(0.16, 0.16, 0.16, 8), WHITE, [0.24, 0.68, -0.24]),
    part(new CylinderGeometry(0.16, 0.16, 0.16, 8), WHITE, [-0.24, 0.68, -0.24]),
  ]),

  딱지: () => assemble([
    // 종이를 접어 겹친 것. 사각형 한 장으로는 화투와 구별이 안 되므로
    // **접힌 결**을 위에 얹는다 — 딱지는 두께가 아니라 결로 읽힌다
    part(new BoxGeometry(0.94, 0.09, 0.94), WHITE, [0, 0.045, 0], undefined, TILE.CARD),
    part(new BoxGeometry(0.86, 0.04, 0.30), PAPER, [0, 0.11, 0], [0, 0.79, 0]),
    part(new BoxGeometry(0.86, 0.04, 0.30), PAPER, [0, 0.11, 0], [0, -0.79, 0]),
  ]),

  공책: () => assemble([
    part(new BoxGeometry(0.76, 0.09, 0.98), WHITE, [0, 0.045, 0]),
    part(new BoxGeometry(0.70, 0.08, 0.92), PAPER, [0.02, 0.11, 0]),
    part(new BoxGeometry(0.76, 0.04, 0.98), WHITE, [0, 0.17, 0]),
    // 등에 감은 철끈 — 공책과 그냥 종이 뭉치를 가르는 것
    part(new CylinderGeometry(0.045, 0.045, 0.98, 6), METAL, [-0.36, 0.10, 0], LIE_Z),
  ]),

  곰인형: () => assemble([
    // 배가 둥글고 팔다리가 짧다. 곰인형은 곰이 아니라 **인형** 비율이다
    part(new SphereGeometry(0.5, 8, 6).scale(0.66, 0.86, 0.60), WHITE, [0, 0.40, 0]),
    part(new SphereGeometry(0.28, 8, 6), WHITE, [0.02, 0.90, 0]),
    part(new SphereGeometry(0.11, 6, 4), WHITE, [-0.06, 1.10, 0.19]),
    part(new SphereGeometry(0.11, 6, 4), WHITE, [-0.06, 1.10, -0.19]),
    // 주둥이 + 코 + 눈. 얼굴이 없으면 눈사람이다
    part(new SphereGeometry(0.14, 7, 5).scale(1, 0.72, 0.90), PAPER, [0.22, 0.85, 0]),
    part(new SphereGeometry(0.05, 5, 4), DARK, [0.33, 0.88, 0]),
    part(new SphereGeometry(0.038, 4, 3), DARK, [0.19, 0.99, 0.11]),
    part(new SphereGeometry(0.038, 4, 3), DARK, [0.19, 0.99, -0.11]),
    // 팔 둘 · 다리 둘
    part(new SphereGeometry(0.13, 6, 4), WHITE, [0.02, 0.52, 0.32]),
    part(new SphereGeometry(0.13, 6, 4), WHITE, [0.02, 0.52, -0.32]),
    part(new SphereGeometry(0.15, 6, 4), WHITE, [0.15, 0.14, 0.19]),
    part(new SphereGeometry(0.15, 6, 4), WHITE, [0.15, 0.14, -0.19]),
  ]),
};
