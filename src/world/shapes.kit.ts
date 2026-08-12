import { BufferAttribute, BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * 형태 조립 도구. 빌더 파일(shapes.small/mid/large.ts)이 쓰는 공통 부품.
 *
 * **형태 규약 — 어기면 물체가 땅에 뜨거나 파묻힌다.**
 * 기본 도형 4개는 전부 단위 정육면체 안에 들어가고 바닥이 y = -0.5 다.
 * World가 물체를 y = sy/2 에 놓기 때문에 이 규약이라야 지면에 정확히 닿는다.
 *
 *   1. X·Z ∈ [-0.5, 0.5], Y ∈ [-0.5, 0.5]
 *   2. **바닥이 정확히 y = -0.5** — 승용차처럼 낮은 물체는 위쪽을 비운다. 그게 맞다
 *   3. **최장축이 1.0**
 *
 * 손으로 맞추면 반드시 틀리므로 normalize()가 병합 후 bbox로 계산해서 강제한다.
 * tools/shapecheck.ts 가 이 세 가지를 다시 검사한다.
 *
 * **비율을 스케일이 아니라 지오메트리에 굽는 이유.**
 * ObjectSpec의 sx/sy/sz를 물체별 비율로 바꾸면 volume = sx*sy*sz 가 달라져서
 * 실측으로 맞춰둔 성장 곡선이 통째로 무너진다. 대신 전봇대 지오메트리 자체를
 * 로컬에서 가늘고 길게 만들면, 기존 무작위 스케일이 그대로 곱해져
 * 가늘고 긴 전봇대가 되면서 size·volume 은 한 글자도 안 바뀐다.
 *
 * **색은 절대색이 아니라 곱셈 계수다.**
 * three 셰이더는 vColor에 정점색을 곱하고 그 다음 instanceColor를 곱한다
 * (r169 color_vertex.glsl.js). 그래서 정점색을 계수로 쓰면:
 *   흰색(1,1,1) → 팔레트 색 그대로 / 0.18 → 그 팔레트 색의 어두운 버전
 * 물체 고유색은 팔레트에 맡기고, 정점색은 바퀴·창문·필터 같은 **내부 대비**만 담당한다.
 */

export type RGB = readonly [number, number, number];

/** 팔레트 색이 그대로 나온다 — 물체의 "본체" 부분에 쓴다 */
export const WHITE: RGB = [1, 1, 1];
/** 타이어·고무 */
export const DARK: RGB = [0.18, 0.18, 0.2];
/** 유리 — 살짝 푸르게 */
export const GLASS: RGB = [0.55, 0.68, 0.78];
/** 금속 */
export const METAL: RGB = [0.72, 0.74, 0.78];
/** 종이·천 — 팔레트 색을 바래게 */
export const PAPER: RGB = [0.92, 0.9, 0.86];
/** 나무·흙 */
export const WOOD: RGB = [0.5, 0.38, 0.26];

export interface Part { geo: BufferGeometry; rgb: RGB }

export type Vec3 = readonly [number, number, number];
const ZERO: Vec3 = [0, 0, 0];

/**
 * 부품 하나. 회전(라디안)을 먼저, 그 다음 이동을 지오메트리에 구워 넣는다.
 * 순서가 반대면 물체가 원점을 중심으로 휘둘린다.
 */
export function part(geo: BufferGeometry, rgb: RGB, pos: Vec3 = ZERO, rot: Vec3 = ZERO): Part {
  if (rot[0]) geo.rotateX(rot[0]);
  if (rot[1]) geo.rotateY(rot[1]);
  if (rot[2]) geo.rotateZ(rot[2]);
  if (pos[0] || pos[1] || pos[2]) geo.translate(pos[0], pos[1], pos[2]);
  return { geo, rgb };
}

/** 정점 전체에 같은 색을 칠한다. */
export function paint(geo: BufferGeometry, rgb: RGB): void {
  const n = geo.attributes['position']!.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = rgb[0];
    colors[i * 3 + 1] = rgb[1];
    colors[i * 3 + 2] = rgb[2];
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
}

/**
 * 부품들을 하나로 합치고 규약에 맞춘다.
 * uv는 지운다 — 머티리얼에 텍스처가 없고, Katamari.bake()가 어차피 지워서
 * 남겨두면 병합할 때 속성 구성만 안 맞는다.
 */
export function assemble(parts: Part[]): BufferGeometry {
  if (parts.length === 0) throw new Error('형태에 부품이 하나도 없습니다');

  for (const { geo, rgb } of parts) {
    geo.deleteAttribute('uv');
    paint(geo, rgb);
  }
  const merged = mergeGeometries(parts.map((p) => p.geo), false);
  for (const p of parts) p.geo.dispose();
  // 조용히 넘어가면 그 형태만 화면에서 사라진 채로 게임이 돈다. 시끄럽게 죽는 편이 낫다.
  if (!merged) throw new Error('형태 병합 실패 — 부품들의 속성 구성이 다릅니다');
  return normalize(merged);
}

/** 최장축을 1.0으로 맞추고, 바닥을 y=-0.5, 수평 중심을 원점에 놓는다. */
export function normalize(geo: BufferGeometry): BufferGeometry {
  geo.computeBoundingBox();
  const b = geo.boundingBox!;
  const longest = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
  geo.scale(1 / longest, 1 / longest, 1 / longest);

  geo.computeBoundingBox();
  const c = geo.boundingBox!;
  geo.translate(
    -(c.min.x + c.max.x) / 2,
    -0.5 - c.min.y,
    -(c.min.z + c.max.z) / 2,
  );

  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * 기본 도형용 흰색 정점색.
 * 머티리얼 하나가 vertexColors를 켜면 **모든** 지오메트리에 color 속성이 있어야 한다 —
 * 없으면 기본값 (0,0,0)이 들어가서 그 물체만 새까맣게 나온다.
 * 흰색은 곱셈 항등원이라 지금까지와 똑같이 보인다.
 */
export function withWhiteColors(geo: BufferGeometry): BufferGeometry {
  paint(geo, WHITE);
  return geo;
}
