import { BufferAttribute, BufferGeometry, Color } from 'three';
import type { CityRoad, RoadKind } from './cityData';

/**
 * 도로 색. 차도는 차가운 아스팔트 계열, 보도는 따뜻한 회색으로 갈라 놓는다 —
 * 같은 계열로 두면 폭 차이만으로는 '보도'가 안 읽힌다.
 */
const ROAD_COLOR: Record<RoadKind, number> = {
  arterial: 0x5f6268,
  street: 0x6e7178,
  alley: 0x7c7f85,
  walk: 0xa8a091,
};

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
 * 종류별 색은 정점색으로 넣는다. 그래야 머티리얼 하나로 4,554개를 한 번에 그린다 —
 * 도로 전체가 드로우콜 1개다.
 *
 * y는 0으로 만든다. 지면 위로 띄우는 건 호출자(City)가 한다.
 */
export function buildRoadGeometry(roads: readonly CityRoad[]): BufferGeometry | null {
  if (roads.length === 0) return null;

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const c = new Color();

  for (const road of roads) {
    const pts = dedupe(road.line);
    // 중복을 걷어내면 1점만 남는 도로가 있을 수 있다. 그것만 건너뛰고 나머지는 만든다.
    if (pts.length < 2) continue;

    c.setHex(ROAD_COLOR[road.kind]);
    const half = road.width / 2;
    const base = positions.length / 3;

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
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
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
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
  geo.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function unit(x: number, z: number): [number, number] {
  const len = Math.hypot(x, z);
  return len < 1e-9 ? [1, 0] : [x / len, z / len];
}
