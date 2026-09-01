import {
  BoxGeometry, BufferAttribute, BufferGeometry, CylinderGeometry, TorusGeometry,
} from 'three';
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

/**
 * **1을 넘는 계수.** 포장지·라벨·이빨처럼 「몸통보다 확실히 밝은 것」에 쓴다.
 *
 * 정점색은 절대색이 아니라 팔레트에 **곱하는 계수**고, three 는 그 곱을 클램프하지
 * 않는다. 그래서 어두운 팔레트 위에서 밝은 표식을 만들 길이 이것뿐이다 —
 * `PAPER`(0.92)는 **어떤 팔레트에서도** 몸통(`WHITE` = 1.0)과 대비를 0.08 밖에
 * 못 만들고, 실제로 캐러멜 포장지·팥 배꼽줄·골프공 딤플이 그래서 안 보였다.
 * 나는 여태 계수만 보고 「색을 줬다」고 판단해 왔다.
 *
 * 밝은 팔레트에서는 흰색으로 포화되는데, 포장지·라벨은 원래 흰색이라 그게 맞다.
 */
export const WRAP: RGB = [1.55, 1.52, 1.42];
/**
 * 같은 이유의 어두운 쪽 — 홈·그늘·눈동자·구멍.
 * `DARK`(0.18)는 «고무»라는 뜻이 붙어 있어 타이어·손잡이가 쓴다. 이건 «선»이다.
 */
export const INK: RGB = [0.22, 0.20, 0.18];

export interface Part { geo: BufferGeometry; rgb: RGB; tile: number }

/**
 * 부품 하나의 **정규화 뒤 실측.** `assemble()` 이 `geo.userData['parts']` 에 남긴다.
 *
 * ## 왜 생겼나
 *
 * 형태를 재는 자를 세 번 만들었고(면 수·인쇄·실루엣) **세 번 다 자와 코드가
 * 서로 다른 것을 봤다.** 자는 소스를 정규식으로 다시 파싱하고 코드는 실제
 * 지오메트리를 쓰니, `SphereGeometry(0.30, 20, 13)` 의 「20」을 치수로 세거나
 * `.scale()` 을 못 읽어서 44건이 헛failed 했다.
 *
 * 이제 형태가 **자기 부품 실측을 직접 들고 있다.** 병합 «전»에 부품별 정점 개수를
 * 적어두고, `normalize()` 까지 끝난 좌표에서 그 구간의 상자를 잰다 —
 * **자가 보는 좌표계가 곧 게임의 좌표계다.** 어긋날 데가 없다.
 *
 * 비용은 형태를 짓는 순간 한 번(146종 × 부품 수)이고 런타임에는 0이다.
 */
export interface PartMeta {
  readonly rgb: RGB;
  readonly tile: number;
  readonly min: Vec3;
  readonly max: Vec3;
  /** 이 부품이 차지하는 정점 개수. 병합된 삼각형을 부품으로 되돌릴 때 쓴다 */
  readonly n: number;
  /**
   * 상자 부피. 삼각형 부호부피가 아니라 상자인 이유는 재는 대상이
   * 「이 부품이 **실루엣**에 얼마나 기여하나」라서다. 실루엣은 부피가 아니라
   * 차지하는 자리가 정한다.
   */
  readonly vol: number;
}

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
 * **모서리를 깎은 상자.** `new BoxGeometry(w, h, d)` 자리에 그대로 들어간다.
 *
 * ## 왜 생겼나
 *
 * 앞선 작업에서 `flatShading: true` 를 껐더니 **곡면은 실제로 부드러워졌다** —
 * 사과·전구·비누·찻잔을 화면으로 확인했다. 그런데도 사용자가 말했다:
 *
 * > 「사물들이 여전히 너무 각져있다」
 *
 * 당연하다. **상자의 모서리는 음영이 아니라 «형상»이 만든다.** `BoxGeometry` 의
 * 모서리는 수학적으로 날카롭고, 음영을 어떻게 하든 거기엔 아무 일도 안 일어난다.
 * 그리고 실물에는 그런 모서리가 없다 — 종이 상자에도 1mm 라운드가 있고 거기서
 * 빛이 한 번 꺾인다. 거실 형태 36종 중 **24종이 상자**였다.
 *
 * ## 44삼각형 — 면 6 + 모서리 띠 12 + 꼭짓점 8
 *
 * three 의 `RoundedBoxGeometry`(examples)는 같은 그림에 **108삼각형**을 쓴다.
 * `BoxGeometry(1,1,1,3,3,3)` 를 깎는 방식이라 면 한가운데를 3×3 으로 쪼개는데
 * 그 조각들은 평평해서 그림에 아무 기여도 안 한다. 형태는 판끼리 공유되므로
 * (텔레비전 하나를 깎으면 그 형태가 나오는 모든 판이 같이 무거워진다)
 * 같은 그림에 삼각형을 2.5배 쓸 이유가 없다.
 *
 * ## 모서리 띠의 법선을 «양쪽 면»으로 나눠 준다
 *
 * 띠에 자기 법선 하나(45°)를 주면 밝은 띠가 생겨서 「깎았다」로 보인다.
 * 대신 띠의 X쪽 정점에 (±1,0,0), Y쪽 정점에 (0,±1,0) 을 주면 그 사이가 보간돼서
 * **「둥글렸다」로 보인다.** 삼각형을 하나도 더 안 쓰고 그렇게 된다.
 *
 * ## 바깥 치수는 «안 변한다»
 *
 * 모따기는 **안쪽으로만** 깎는다. bbox 가 그대로라 `normalize()` 결과가 같고,
 * 그래서 충돌 상자·`spots` 의 상판 높이·`size` 가 전부 그대로다.
 * (앞선 작업에서 세그먼트를 올렸다가 방석더미 상단이 0.196 → 0.185 로 내려가
 * 얹힌 물건이 1.1cm 뜬 적이 있다. 그 사고는 여기서는 원리상 안 난다.)
 *
 * ## uv 는 `BoxGeometry` 와 «똑같이» 맞춘다
 *
 * 성냥갑·지우개·캐러멜 상자·책은 면에 인쇄를 문다. u·v 축이 뒤집히면 글자가
 * 거울로 나온다. three 의 `buildPlane` 여섯 호출을 그대로 옮겨 적었다.
 *
 * ## 색인(indexed) 지오메트리를 낸다
 *
 * `mergeGeometries` 는 부품들의 색인 유무가 **전부 같기**를 요구한다. 기본 도형
 * (Box·Cylinder·Sphere·Torus)이 전부 색인이라 여기도 색인이어야 한다 —
 * 아니면 이 부품을 쓴 형태만 병합이 통째로 실패한다.
 *
 * ## 「회전해서 붙이는 부품」에는 쓰지 않는다
 *
 * 바깥 치수를 지키는 건 **자기 축에서**다. `part()` 가 돌려서 붙이면 얘기가 달라진다 —
 * 깎여 나간 모서리가 바로 «돌린 뒤 bbox 의 극점»이라 형태가 조금 얇아진다.
 * 실제로 우유팩 지붕(±0.7 rad)을 깎았더니 형태 깊이가 0.297 → 0.281 로 5% 줄었고,
 * `normalize()` 를 타면서 그 물체의 비율이 통째로 밀렸다.
 * **회전 부품이 형태의 bbox 를 정한다면 그 부품은 `BoxGeometry` 로 둔다.**
 *
 * ## 깎을지 말지는 «부르는 쪽»이 정한다
 *
 * 「짧은 변이 얼마 이상이면 깎는다」는 자동 규칙을 넣으려다 **단위가 틀린 걸
 * 발견해서 버렸다.** 치수는 자기 몸 대비 비율이라, 같은 `0.04` 가 1m 짜리
 * TV장에서는 4cm 측판(모따기 9mm — 잘 보인다)이고 5.5cm 짜리 화투에서는
 * 2mm 낱장(모따기 0.1mm — 안 보인다)이다. **문턱값 하나로 둘을 못 가른다.**
 * 아래 `1e-3` 검사는 설계 기준이 아니라 퇴화 방지용 수치 안전장치다.
 *
 * @param w·h·d  바깥 치수. **모따기해도 이 값은 안 변한다**
 * @param bevel  짧은 변 대비 모따기 비율. 기본 0.22, 0.45 를 넘길 수 없다
 */
export function soft(w: number, h: number, d: number, bevel = 0.22): BufferGeometry {
  const half = [w / 2, h / 2, d / 2] as const;
  const mn = Math.min(w, h, d);
  if (mn < 1e-3) return new BoxGeometry(w, h, d);
  const c = mn * Math.min(bevel, 0.45);

  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];

  /**
   * 꼭짓점마다 점이 **셋**이다 — X면 쪽 · Y면 쪽 · Z면 쪽.
   * `face` 축만 끝까지 나가고 나머지 둘은 c 만큼 안으로 들어온다.
   * 이 셋을 이으면 그게 꼭짓점 삼각형이 된다.
   */
  const at = (s: readonly number[], face: number): Vec3 => [
    s[0]! * (face === 0 ? half[0] : half[0] - c),
    s[1]! * (face === 1 ? half[1] : half[1] - c),
    s[2]! * (face === 2 ? half[2] : half[2] - c),
  ];

  /**
   * `BoxGeometry` 의 uv 규약. three r169 `BoxGeometry` 의 `buildPlane` 여섯 호출
   * (px·nx·py·ny·pz·nz)에서 그대로 옮겼다. 이게 틀리면 인쇄가 뒤집힌다.
   *
   * **나누는 값이 바깥 치수가 아니라 «깎이고 남은 면»의 치수다.** 처음엔 바깥
   * 치수로 나눴는데, 그러면 면이 c 만큼 안으로 들어간 만큼 uv 도 안으로 들어가서
   * (1×1×1 에 c=0.22 면 0.22~0.78) 인쇄의 **바깥 22% 가 잘려 나갔다.**
   * 성냥갑 라벨이 테두리를 잃는다는 뜻이다. 남은 면을 0~1 로 꽉 채우면 인쇄가
   * 온전히 들어가고, 모서리 띠는 자기가 붙은 면의 가장자리 색을 이어받는다.
   * (`bevel` 이 0.45 로 잘려 있어 분모가 0이 될 일은 없다 — 최소 0.1×짧은 변)
   */
  const inset = [w - 2 * c, h - 2 * c, d - 2 * c] as const;
  const uvOf = (p: Vec3, face: number, sign: number): readonly [number, number] => {
    if (face === 0) return [0.5 - (sign * p[2]) / inset[2], 0.5 + p[1] / inset[1]];
    if (face === 1) return [0.5 + p[0] / inset[0], 0.5 - (sign * p[2]) / inset[2]];
    return [0.5 + (sign * p[0]) / inset[0], 0.5 + p[1] / inset[1]];
  };

  const push = (p: Vec3, n: Vec3, face: number, sign: number): number => {
    const [u, v] = uvOf(p, face, sign);
    pos.push(p[0], p[1], p[2]);
    nrm.push(n[0], n[1], n[2]);
    uv.push(u, v);
    return pos.length / 3 - 1;
  };

  const axis = (a: number, s: number): Vec3 =>
    (a === 0 ? [s, 0, 0] : a === 1 ? [0, s, 0] : [0, 0, s]) as Vec3;

  /**
   * 감기 방향을 **계산해서** 맞춘다. 축·부호를 손으로 따지면 24장 중 몇 장이
   * 반드시 뒤집히고, 그건 화면에서 「구멍」으로 보인다. 첫 삼각형의 기하 법선이
   * 바깥쪽을 향하는지 보고 아니면 뒤집는다.
   */
  const emit = (ids: number[], pts: Vec3[], out: Vec3): void => {
    const [p0, p1, p2] = pts as [Vec3, Vec3, Vec3];
    const e1: Vec3 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const e2: Vec3 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const g: Vec3 = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ];
    const order = g[0] * out[0] + g[1] * out[1] + g[2] * out[2] >= 0
      ? ids : [...ids].reverse();
    for (let i = 2; i < order.length; i++) idx.push(order[0]!, order[i - 1]!, order[i]!);
  };

  const SIGNS = [-1, 1] as const;

  // ── ① 면 6장 — c 만큼 안으로 들어간 사각형. 법선은 축 그대로 ──
  for (let a = 0; a < 3; a++) {
    const b = (a + 1) % 3, e = (a + 2) % 3;
    for (const s of SIGNS) {
      const n = axis(a, s);
      const ids: number[] = [], pts: Vec3[] = [];
      for (const [sb, se] of [[1, -1], [1, 1], [-1, 1], [-1, -1]] as const) {
        const sg = [0, 0, 0]; sg[a] = s; sg[b] = sb; sg[e] = se;
        const p = at(sg, a);
        pts.push(p); ids.push(push(p, n, a, s));
      }
      emit(ids, pts, n);
    }
  }

  // ── ② 모서리 띠 12장 — 두 면을 잇는다. 법선을 양쪽 면 것으로 나눠 준다 ──
  //
  // 축 `e` 를 따라 뻗은 모서리는 나머지 두 축(a, b)의 부호로 정해진다.
  for (let e = 0; e < 3; e++) {
    const a = (e + 1) % 3, b = (e + 2) % 3;
    for (const sa of SIGNS) for (const sb of SIGNS) {
      const na = axis(a, sa), nb = axis(b, sb);
      const out: Vec3 = [na[0] + nb[0], na[1] + nb[1], na[2] + nb[2]];
      const ids: number[] = [], pts: Vec3[] = [];
      // A쪽 두 점 → B쪽 두 점. 순서는 emit 이 바로잡는다
      for (const [face, n, se] of [
        [a, na, -1], [a, na, 1], [b, nb, 1], [b, nb, -1],
      ] as const) {
        const sg = [0, 0, 0]; sg[a] = sa; sg[b] = sb; sg[e] = se;
        const p = at(sg, face);
        pts.push(p); ids.push(push(p, n, face, face === a ? sa : sb));
      }
      emit(ids, pts, out);
    }
  }

  // ── ③ 꼭짓점 8개 — 세 면을 잇는 삼각형 ──
  for (const sx of SIGNS) for (const sy of SIGNS) for (const sz of SIGNS) {
    const sg = [sx, sy, sz] as const;
    const ids: number[] = [], pts: Vec3[] = [];
    for (let f = 0; f < 3; f++) {
      const p = at(sg, f);
      pts.push(p); ids.push(push(p, axis(f, sg[f]!), f, sg[f]!));
    }
    emit(ids, pts, [sx, sy, sz]);
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(nrm), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  geo.setIndex(idx);
  // 바깥 치수를 «잰 값»으로 남긴다 — normalize() 와 검사가 이걸 본다
  geo.computeBoundingBox();
  return geo;
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

/**
 * **곡면 최소 면 수 — 놓이는 크기가 정한다.**
 *
 * ## 왜 어중간한 면 수가 제일 나쁜가
 *
 * 이 씬은 `flatShading` 이 꺼져 있어 곡면이 «매끄럽게» 칠해진다. 그런데 5~7면짜리
 * 원기둥을 매끄럽게 칠하면 둥근 원기둥이 아니라 **물결치는 튜브**로 보인다 —
 * 법선은 둥근 척하는데 실루엣은 오각형이라 둘이 안 맞는다.
 *
 * 면이 아주 적으면(각지게 보이거나) 충분히 많으면(둥글게 보이거나) 둘 중 하나로
 * 읽히는데, 그 사이에 걸치면 「울퉁불퉁」이 된다. 실측 262개 중 156개(60%)가
 * 거기 있었다 — 5면 57 · 6면 49 · 7면 35.
 *
 * ## 왜 전부 20면으로 안 올리는가
 *
 * 1cm 짜리 팥은 화면에서 세 픽셀이다. 거기 쓰는 삼각형은 눈에 안 보이고
 * 예산만 먹는다. **놓이는 크기가 면 수를 정한다.**
 */
export const SEG = {
  /** 63cm~5m — 화면을 가득 채운다 */
  BIG: 20,
  /** 20~63cm — 손에 잡히는 크기 */
  MID: 14,
  /** 8~20cm */
  SMALL: 10,
  /** 1~8cm — 몇 픽셀이다. 올려봐야 안 보인다 */
  TINY: 6,
} as const;

/**
 * 이웃 부품보다 «내미는» 비율. 0.10 이면 10% 넓다.
 *
 * 그림자가 한 줄 생길 만큼이면 충분하다. 더 크면 턱이 아니라 «접시»가 된다.
 */
export const STEP = 0.10;

/**
 * **회전체가 이웃과 만나는 자리에 «턱»을 준다.**
 *
 * ## 왜 필요한가 — 매끄러운 칠이 부품 경계를 «지운다»
 *
 * 이 씬은 `flatShading` 이 꺼져 있다(예전에 「너무 각져 보인다」로 껐다).
 * 그래서 세로로 쌓인 회전체 둘이 **같은 반지름으로 만나면** 기하학적으로 한
 * 연속면이 되어 그 자리에 **아무 선도 안 생긴다.**
 *
 * ```
 * 주전자 몸통 CylinderGeometry(0.36, 0.40, 0.44, 20)   ← 위 반지름 0.36
 *        뚜껑 CylinderGeometry(0.30, 0.36, 0.12, 20)   ← 아래 반지름 0.36  ← 똑같다
 * ```
 *
 * **20면짜리라 이미 충분히 둥근데도** 화면에서 몸통과 뚜껑이 «하나의 녹은 돔»으로
 * 보였다. 면 수를 올려도 안 고쳐진다 — 문제는 매끄러움이 아니라 **경계가 없다**는 것이다.
 *
 * 실제 물건은 뚜껑이 몸통보다 넓게 얹히고, 화분은 위에 테가 두르고, 양동이는
 * 테두리가 말려 있다. **그 턱 하나가 「부품이 둘이다」를 말한다.**
 *
 * ## 규약
 *
 * **이웃한 회전체는 같은 반지름으로 만나지 않는다.** 위가 넓든 좁든 상관없지만
 * 같으면 안 된다. `silhouette.mts` 가 소스를 읽어 어긴 곳을 센다.
 *
 * @param r    이웃 부품의 반지름
 * @param h    턱의 두께(m). 얇을수록 «테», 두꺼우면 «단»
 * @param seg  면 수 — 이웃과 같아야 옆에서 봤을 때 모서리가 안 어긋난다
 */
export function lip(r: number, h: number, seg: number, over = STEP): BufferGeometry {
  const R = r * (1 + over);
  return new CylinderGeometry(R, R, h, seg);
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
  /**
   * **부품별 정점 개수를 병합 «전»에 적는다.** `mergeGeometries(_, false)` 는
   * 속성을 순서대로 이어 붙이므로, 이 개수만 있으면 병합 뒤에도 어느 정점이
   * 어느 부품인지 안다. 부품 지오메트리는 곧 `dispose()` 되므로 지금 세야 한다.
   */
  const runs = parts.map((p) => p.geo.attributes['position']!.count);
  const merged = mergeGeometries(parts.map((p) => p.geo), false);
  for (const p of parts) p.geo.dispose();
  // 조용히 넘어가면 그 형태만 화면에서 사라진 채로 게임이 돈다. 시끄럽게 죽는 편이 낫다.
  if (!merged) throw new Error('형태 병합 실패 — 부품들의 속성 구성이 다릅니다');
  /**
   * 상자는 비워두고 **`normalize()` 가 채운다.** 여기서 직접 재면
   * `normalize(assemble([...]).scale(...))` 처럼 **뒤에 한 번 더 변환하는**
   * 형태(꽃잎·자갈)에서 상자가 낡는다 — 실제로 자가 그걸 잡았다.
   * 정점 개수만 들려 보내면 `normalize()` 가 언제 불리든 다시 잰다.
   */
  merged.userData['parts'] = parts.map((p, k) => ({
    rgb: p.rgb, tile: p.tile, n: runs[k]!,
    min: [0, 0, 0] as Vec3, max: [0, 0, 0] as Vec3, vol: 0,
  } satisfies PartMeta));
  return normalize(merged);
}

/**
 * `userData['parts']` 의 상자를 **지금 정점에서** 다시 잰다.
 * `normalize()` 끝에서 부른다 — 그래서 정규화를 몇 번 태우든 늘 최신이다.
 */
function remeasureParts(geo: BufferGeometry): void {
  const parts = geo.userData['parts'] as PartMeta[] | undefined;
  if (!parts) return;
  const p = geo.getAttribute('position');
  let at = 0;
  geo.userData['parts'] = parts.map((meta) => {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity;
    let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = at; i < at + meta.n; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    at += meta.n;
    return {
      rgb: meta.rgb, tile: meta.tile, n: meta.n,
      min: [x0, y0, z0] as Vec3, max: [x1, y1, z1] as Vec3,
      vol: (x1 - x0) * (y1 - y0) * (z1 - z0),
    } satisfies PartMeta;
  });
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
  // 부품 상자를 «지금» 좌표에서 다시 잰다 — 정규화를 두 번 태워도 안 낡는다
  remeasureParts(geo);
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
