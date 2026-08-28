import { BufferAttribute, BufferGeometry, CylinderGeometry, TorusGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TILE, tileUv } from './atlas';

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

export interface Part { geo: BufferGeometry; rgb: RGB; tile: number }

export type Vec3 = readonly [number, number, number];
const ZERO: Vec3 = [0, 0, 0];

/**
 * 부품 하나. 회전(라디안)을 먼저, 그 다음 이동을 지오메트리에 구워 넣는다.
 * 순서가 반대면 물체가 원점을 중심으로 휘둘린다.
 */
export function part(
  geo: BufferGeometry, rgb: RGB, pos: Vec3 = ZERO, rot: Vec3 = ZERO,
  /**
   * 인쇄 아틀라스의 칸 번호. **기본값이 순백 칸**이라 안 주면 지금까지와 똑같다 —
   * 그래서 기존 호출부 88종을 한 줄도 안 고쳤다.
   */
  tile: number = TILE.BLANK,
): Part {
  if (rot[0]) geo.rotateX(rot[0]);
  if (rot[1]) geo.rotateY(rot[1]);
  if (rot[2]) geo.rotateZ(rot[2]);
  if (pos[0] || pos[1] || pos[2]) geo.translate(pos[0], pos[1], pos[2]);
  return { geo, rgb, tile };
}

/**
 * 부품의 UV 를 **자기 칸 안으로 접는다.**
 *
 * 기본 도형의 uv 는 0~1 로 아틀라스 **전체**를 훑는다. 그대로 두면 주사위 한 면에
 * 16칸이 전부 찍힌다. 0~1 을 그 칸의 사각형으로 다시 매핑해야 한다.
 *
 * uv 가 아예 없는 지오메트리(회전·병합 과정에서 빠진 것)도 있으므로 없으면 만든다 —
 * `mergeGeometries` 는 부품들의 **속성 구성이 같기를 요구**해서, 하나라도 uv 가
 * 없으면 병합이 통째로 실패한다.
 */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function foldUv(geo: BufferGeometry, tile: number): void {
  const n = geo.attributes['position']!.count;
  const [u0, v0, u1, v1] = tileUv(tile);
  const src = geo.getAttribute('uv') as BufferAttribute | undefined;
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    // **0~1 로 물린 뒤에 접는다.** `SphereGeometry` 의 uv 는 0~1 이 아니다 —
    // three 가 극점 왜곡을 줄이려고 -0.0714 ~ 1.0714 까지 밀어낸다(7분할 기준).
    // 그대로 접으면 구를 쓰는 형태가 **옆 칸을 침범해서** 남의 인쇄를 끌어온다.
    // 실제로 88종 중 34종이 그랬다.
    const su = clamp01(src ? src.getX(i) : 0.5);
    const sv = clamp01(src ? src.getY(i) : 0.5);
    uv[i * 2] = u0 + su * (u1 - u0);
    uv[i * 2 + 1] = v0 + sv * (v1 - v0);
  }
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
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
 * uv는 **살린다.** 예전엔 지웠는데(머티리얼에 텍스처가 없었다) 이제 월드 인스턴스가
 * 인쇄 아틀라스를 쓴다. 부품마다 자기 칸으로 접어두면 모든 부품이 uv를 갖게 되어
 * 병합의 속성 구성도 맞는다. 공에 붙는 경로는 `Katamari.bake()`가 여전히 uv를 지운다.
 */
/**
 * **속이 파인 그릇.** 바깥벽 · 안쪽벽 · 안쪽 바닥 · 바깥 바닥 · 테두리를 한 번에 만든다.
 *
 * ## 왜 생겼나
 *
 * 여태 이 게임의 그릇은 **전부 통짜**였다. `밥공기` 주석이 그걸 자백하고 있었다 —
 * 「사발의 윤곽은 **안쪽이 아니라** 이 얇은 띠가 만든다」. 속을 파는 대신 테두리 링으로
 * 흉내 냈다는 뜻이다. 그래서 사용자가 이렇게 말했다:
 *
 * > 「컵이라 하면 **중간에 움푹 파인게 없으니까 걍 덩어리** 같음」
 *
 * 그릇을 그릇으로 만드는 건 **파인 것**이다. 하나씩 손으로 파면 다음 그릇에서 또 틀리니
 * 여기 둔다.
 *
 * ## 안쪽벽을 뒤집는 이유
 *
 * 인스턴스 머티리얼이 `FrontSide` 다. 안쪽벽을 그냥 넣으면 «바깥»을 보는 면이라
 * 통째로 컬링돼서 그릇 안을 들여다보면 **바닥이 뚫려 보인다.**
 * `scale(-1, 1, 1)` 이 감기 순서를 뒤집어 안을 보게 만든다.
 * (`DoubleSide` 로 바꾸면 4,200개 전부가 뒷면까지 그려진다 — 그 값을 치를 이유가 없다.)
 *
 * @param rTop  윗지름 반쪽   @param rBot 아랫지름 반쪽   @param h 전체 높이
 * @param wall  벽 두께        @param floorT 바닥 두께
 * @param seg   둘레 분할 — 20 권장. 12는 각져 보인다
 * @param rgb   바깥 색        @param inner 안쪽 색 (조금 어두우면 깊이가 산다)
 * @param tile  바깥벽 인쇄 칸
 */
export function hollow(
  rTop: number, rBot: number, h: number, wall: number, floorT: number,
  seg = 20, rgb: RGB = WHITE, inner: RGB = WHITE, tile: number = TILE.BLANK,
): Part[] {
  const iTop = Math.max(rTop - wall, wall);
  const iBot = Math.max(rBot - wall, wall * 0.6);
  const cavity = Math.max(h - floorT, wall);
  return [
    // 바깥벽 — 위아래가 뚫린 띠. 뚜껑을 안 덮어야 테두리가 두께를 갖는다
    part(new CylinderGeometry(rTop, rBot, h, seg, 1, true), rgb, [0, h / 2, 0], undefined, tile),
    // **안쪽벽.** 이게 「움푹하다」의 전부다
    part(new CylinderGeometry(iTop, iBot, cavity, seg, 1, true).scale(-1, 1, 1),
      inner, [0, floorT + cavity / 2, 0]),
    // 안쪽 바닥 — 없으면 그릇을 통해 방바닥이 보인다
    part(new CylinderGeometry(iBot, iBot, 0.008, seg), inner, [0, floorT, 0]),
    // 바깥 바닥
    part(new CylinderGeometry(rBot, rBot, 0.008, seg), rgb, [0, 0.004, 0]),
    // 테두리 — 바깥벽과 안쪽벽을 잇는 링. 없으면 벽이 종이처럼 얇아 보인다
    part(new TorusGeometry((rTop + iTop) / 2, wall / 2, 5, seg), rgb, [0, h, 0],
      [Math.PI / 2, 0, 0]),
  ];
}

export function assemble(parts: Part[]): BufferGeometry {
  if (parts.length === 0) throw new Error('형태에 부품이 하나도 없습니다');

  for (const { geo, rgb, tile } of parts) {
    // **uv 를 지우지 않는다.** 예전엔 지웠다 — 머티리얼에 텍스처가 없었으니까.
    // 이제 월드 인스턴스가 인쇄 아틀라스를 쓰므로 각 부품을 자기 칸으로 접는다.
    // 공에 붙을 때는 `Katamari.bake()` 가 어차피 uv 를 지우므로 그 경로는 그대로다.
    foldUv(geo, tile);
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
  // 기본 도형 4개도 uv를 순백 칸으로 접는다. 안 접으면 0~1 uv가 아틀라스
  // **전체**를 훑어서 상자 한 면에 인쇄 16칸이 다 찍힌다.
  foldUv(geo, TILE.BLANK);
  return geo;
}
