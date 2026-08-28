import type { BufferGeometry } from 'three';
import { SHAPE_IDS, type ShapeId } from './generation';
import { HOUSE_BUILDERS } from './shapes.house';
import { LARGE_BUILDERS } from './shapes.large';
import { MID_BUILDERS } from './shapes.mid';
import { SMALL_BUILDERS } from './shapes.small';
import { TOWN_BUILDERS } from './shapes.town';
import { WORLD_BUILDERS } from './shapes.world';

export { withWhiteColors } from './shapes.kit';

/**
 * 길거리 오브젝트의 전용 실루엣 — **조합 전용 파일.**
 *
 * 실제 형태는 크기 그룹별 파일에 있다:
 *   shapes.small.ts  버킷 0~2 (1~8cm)
 *   shapes.mid.ts    버킷 3~5 (8cm~63cm)
 *   shapes.large.ts  버킷 6~8 (63cm~5m)
 *   shapes.house.ts  방 정체성 전용 (부엌·화장실·아이 방 — 크기가 아니라 방으로 묶었다)
 *   shapes.town.ts   동네 맵 전용 (집에 없는 것들)
 *   shapes.world.ts  World 맵 전용 (1.15~4m — 동네에서는 배경이던 것들)
 * 조립 도구(part/assemble/normalize)와 형태 규약은 shapes.kit.ts 에 있다.
 *
 * 빌더를 한 파일에 두면 1,000줄이 넘어서 나눴다.
 * 빌더 파일은 shapes.kit.ts 만 import한다 — 이 파일을 import하면 순환 참조가 된다.
 */
const BUILDERS: Record<ShapeId, () => BufferGeometry> = {
  ...SMALL_BUILDERS,
  ...MID_BUILDERS,
  ...LARGE_BUILDERS,
  ...HOUSE_BUILDERS,
  ...TOWN_BUILDERS,
  ...WORLD_BUILDERS,
};

/** SHAPE_IDS 순서 그대로. World가 기본 도형 4개 뒤에 이어붙인다. */
export function buildShapeGeometries(): BufferGeometry[] {
  return SHAPE_IDS.map((id) => {
    const geo = BUILDERS[id]();
    geo.name = id;
    return geo;
  });
}
