import {
  BufferAttribute, BufferGeometry, CanvasTexture, ClampToEdgeWrapping,
  RepeatWrapping, SRGBColorSpace,
} from 'three';
import type { CityRoad, RoadKind } from './cityData';

/**
 * 종류별 텍스처 밴드 번호. `buildRoadTexture`의 세로 순서와 **반드시** 같아야 한다.
 */
const BAND: Record<RoadKind, number> = {
  arterial: 0,
  street: 1,
  alley: 2,
  walk: 3,
};

/** 파선 한 주기(m). u = 누적거리 / 이 값. */
const DASH_PERIOD = 8;

/** 텍스처 크기. 가로 = 길이 방향(반복), 세로 = 폭 방향(4밴드 × 32px). */
const TEX_W = 64;
const BAND_H = 32;
const TEX_H = BAND_H * 4;

/**
 * 도로 텍스처 한 장.
 *
 *   u = **길이 방향**, `DASH_PERIOD`마다 반복(RepeatWrapping). 파선이 여기서 나온다
 *   v = **폭 방향**, 32px씩 4밴드 — arterial / street / alley / walk
 *
 * u와 v를 이렇게 배치한 이유: 파선은 길이 방향으로 반복돼야 하는데 종류별 밴드는
 * 반복되면 안 된다. 반복 축(S)과 클램프 축(T)이 갈려야 해서 축을 이렇게 잡았다.
 *
 * 밴드를 한 장에 쌓은 건 **드로우콜 때문**이다. 종류마다 텍스처를 따로 두면
 * 도로 4,554개가 드로우콜 1개에서 4개가 된다.
 *
 * `fillStyle`·`fillRect`만 쓴다 — `tools/citycheck.ts`의 document 스텁이 그 둘만
 * 흉내내기 때문이다. facade.ts·World.ts가 같은 제약 아래 같은 수법을 쓴다.
 */
export function buildRoadTexture(): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = TEX_W;
  cv.height = TEX_H;
  const cx = cv.getContext('2d')!;

  const LINE = '#e8e6df';
  // 순서가 BAND와 같아야 한다.
  const bands: Array<{ base: string; edge?: number; dash?: boolean; joint?: string }> = [
    { base: '#6b7078', edge: 3, dash: true },   // 대로 — 양끝 실선 + 중앙 파선
    { base: '#767b83', edge: 2 },               // 생활도로 — 양끝 실선만
    { base: '#83878e' },                        // 골목 — 표시 없음. 실제로도 없다
    { base: '#c0b7a4', joint: '#a89e8b' },      // 보도 — 블록 줄눈
  ];

  bands.forEach((b, i) => {
    const y = i * BAND_H;
    cx.fillStyle = b.base;
    cx.fillRect(0, y, TEX_W, BAND_H);
    if (b.edge) {
      cx.fillStyle = LINE;
      cx.fillRect(0, y + 1, TEX_W, b.edge);
      cx.fillRect(0, y + BAND_H - 1 - b.edge, TEX_W, b.edge);
    }
    // 파선: u의 절반만 칠한다. 8m 주기니까 4m 칠 / 4m 빔이다.
    if (b.dash) {
      cx.fillStyle = LINE;
      cx.fillRect(0, y + BAND_H / 2 - 1, TEX_W / 2, 2);
    }
    if (b.joint) {
      cx.fillStyle = b.joint;
      for (let k = 0; k < TEX_W; k += 8) cx.fillRect(k, y, 1, BAND_H);
      cx.fillRect(0, y + BAND_H / 2, TEX_W, 1);
    }
  });

  const tex = new CanvasTexture(cv);
  // 없으면 three가 캔버스의 sRGB 값을 선형값으로 착각해 두 배 밝게 그린다.
  tex.colorSpace = SRGBColorSpace;
  // **S와 T가 달라야 한다.** 파선은 길이 방향으로 반복돼야 하고,
  // 밴드는 반복되면 arterial 위에 walk가 겹친다.
  tex.wrapS = RepeatWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.anisotropy = 4;
  return tex;
}

/**
 * 마이터 오프셋 상한. 예각에서 `1 / dot(m, n)` 이 발산하므로 막아야 한다.
 * 2를 넘기면 꺾인 안쪽에 폭의 몇 배짜리 삼각형이 튀어나온다.
 */
const MITER_MAX = 2;

/** 같은 좌표가 연속으로 들어온 점을 걷어낸다. */
function dedupe(line: CityRoad['line']): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const [x, z] of line) {
    const prev = out[out.length - 1];
    // 길이 0인 구간의 법선은 0/0 = NaN 이다. NaN 하나가 병합 메시 전체의
    // bounding sphere를 NaN으로 만들어 프러스텀 컬링을 죽인다.
    // 방어 코드로 나중에 0으로 덮는 대신 애초에 만들지 않는다.
    if (prev && prev[0] === x && prev[1] === z) continue;
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    out.push([x, z]);
  }
  return out;
}

/**
 * 도로 전체 → 병합된 리본 지오메트리 하나.
 *
 * 중심선을 폭만큼 좌우로 벌려 사각형을 잇는다. 구간마다 따로 사각형을 찍으면
 * 꺾이는 곳에 쐐기 구멍이 생기므로, 꼭짓점에서는 앞뒤 두 구간의 법선을 평균낸
 * **마이터 오프셋**을 쓴다.
 *
 * 종류별 색·차선은 **uv**로 넣는다(예전에는 정점색이었다). 텍스처 한 장에 종류 4개를
 * 세로 밴드로 쌓아서, 머티리얼 하나로 4,554개를 한 번에 그린다 — 도로 전체가 드로우콜 1개다.
 *
 * y는 0으로 만든다. 지면 위로 띄우는 건 호출자(City)가 한다.
 */
export function buildRoadGeometry(roads: readonly CityRoad[]): BufferGeometry | null {
  if (roads.length === 0) return null;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (const road of roads) {
    const pts = dedupe(road.line);
    // 중복을 걷어내면 1점만 남는 도로가 있을 수 있다. 그것만 건너뛰고 나머지는 만든다.
    if (pts.length < 2) continue;

    // 밴드 안쪽으로 1.5px 밀어 넣는다. 정확히 경계에 두면 밉맵/선형 보간이
    // 옆 밴드 색을 끌어와 도로 가장자리에 다른 종류 색이 번진다.
    const band = BAND[road.kind];
    const vLo = (band * BAND_H + 1.5) / TEX_H;
    const vHi = (band * BAND_H + BAND_H - 1.5) / TEX_H;

    const half = road.width / 2;
    const base = positions.length / 3;
    /** 누적 거리(m). 구간 길이가 제각각이라 인덱스로 세면 짧은 구간에서 파선이 뭉친다. */
    let run = 0;

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      const back = pts[i - 1];
      if (back) run += Math.hypot(p[0] - back[0], p[1] - back[1]);
      // 구간 방향 — 끝점에서는 붙어 있는 구간 하나만 쓴다
      const prev = pts[i - 1];
      const next = pts[i + 1];
      let nx: number, nz: number;

      if (prev && next) {
        const [ax, az] = unit(p[0] - prev[0], p[1] - prev[1]);
        const [bx, bz] = unit(next[0] - p[0], next[1] - p[1]);
        // 각 구간의 법선(왼쪽)을 평균내면 마이터 방향이 된다
        let mx = -az + -bz;
        let mz = ax + bx;
        const len = Math.hypot(mx, mz);
        if (len < 1e-6) {
          // 180도로 되꺾이는 경우 — 평균이 0이라 방향을 못 정한다. 앞 구간 법선을 쓴다.
          mx = -az; mz = ax;
        } else {
          mx /= len; mz /= len;
          // 마이터 길이 보정: 법선과 이룬 각의 코사인으로 나눈다
          const cos = mx * -az + mz * ax;
          const scale = Math.min(1 / Math.max(Math.abs(cos), 1e-3), MITER_MAX);
          mx *= scale; mz *= scale;
        }
        nx = mx; nz = mz;
      } else {
        const a = prev ?? p;
        const b = next ?? p;
        const [dx, dz] = prev
          ? unit(p[0] - a[0], p[1] - a[1])
          : unit(b[0] - p[0], b[1] - p[1]);
        nx = -dz; nz = dx;
      }

      positions.push(p[0] + nx * half, 0, p[1] + nz * half);
      positions.push(p[0] - nx * half, 0, p[1] - nz * half);
      uvs.push(run / DASH_PERIOD, vLo, run / DASH_PERIOD, vHi);
    }

    // 감기 방향이 법선을 정한다. (l0, r0, l1) 순서면 법선이 -Y가 되어
    // 위에서 볼 때 뒷면이 되고, FrontSide 머티리얼이 **통째로 컬링한다** —
    // 삼각형 38,548개가 화면에서 그냥 사라진다. 개수나 NaN 검사로는 안 잡힌다.
    for (let i = 0; i < pts.length - 1; i++) {
      const l0 = base + i * 2, r0 = l0 + 1, l1 = l0 + 2, r1 = l0 + 3;
      indices.push(l0, l1, r0, r0, l1, r1);
    }
  }

  if (indices.length === 0) return null;

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function unit(x: number, z: number): [number, number] {
  const len = Math.hypot(x, z);
  return len < 1e-9 ? [1, 0] : [x / len, z / len];
}
