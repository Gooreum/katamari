/**
 * 집 손배치 검사기.  `npm run housecheck`
 *
 * **이 도구가 필요한 이유:**
 * 가구 형상의 비율을 바꾸면 두 가지가 조용히 틀어진다. 둘 다 에러가 안 난다.
 *   ① **벽 관통** — 손배치 가구(`placement.props`)의 발자국이 넓어져 벽을 파고든다.
 *      2026-09-14 에 재 보니 거실 책장이 이미 동벽을 6cm 뚫고 있었다(누구도 몰랐다)
 *   ② **떠 있는 물건** — 가구 위 자리(`placement.spots` 의 `y`)는 월드 미터 값이라 가구 윗면이
 *      움직여도 안 따라간다. 서랍장 윗면이 1.00 → 0.96 이 되자 전화기가 4cm 떴다
 *
 * 벽은 방 사각형 안쪽 0.07m(`WALL`) 로 본다. 자리 높이는 자리 사각형 안 9 점에서
 * 위→아래로 광선을 쏴 **실제 형상 표면**과 비교한다 — 정점만 보면 넓은 판 윗면을 놓친다.
 *
 * THREE 지오메트리와 광선은 WebGL 없이 돈다. 아틀라스는 캔버스 흉내로 넘긴다(placecheck 와 같은 수법).
 */
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';

const g = globalThis as unknown as Record<string, unknown>;
const stub: unknown = new Proxy({}, { get: () => (): unknown => stub, set: () => true });
g['document'] = { createElement: () => ({ width: 0, height: 0, getContext: () => stub }) };
g['window'] = {}; g['self'] = g;

const { buildShapeGeometries } = await import('../src/world/shapes');
const { SHAPE_IDS } = await import('../src/world/generation');
const { buildHouseStage } = await import('../src/world/stage.house');

/** 벽 두께의 반. 방 사각형은 벽 가운데선이라 안쪽 면은 이만큼 들어온다(거실 동벽 x 2.7 → 2.63) */
const WALL = 0.07;
/** 자리 높이 허용 오차 — 이보다 크면 물건이 뜨거나 파묻힌 게 눈에 보인다 */
const SURF_EPS = 0.008;

const geos = buildShapeGeometries();
const stage = buildHouseStage('house');
const props = stage.placement?.props ?? [];
const rooms = stage.placement?.rooms ?? [];
const spots = stage.placement?.spots ?? [];
let violations = 0;

// ── ① 벽 관통 ───────────────────────────────────────────────
console.log('\n손배치 가구 — 방 벽 안쪽 면을 넘는가');
for (const p of props) {
  const geo = geos[SHAPE_IDS.indexOf(p.label as never)]!;
  geo.computeBoundingBox();
  const b = geo.boundingBox!;
  const hx = (b.max.x - b.min.x) / 2 * p.size, hz = (b.max.z - b.min.z) / 2 * p.size;
  const c = Math.abs(Math.cos(p.rotY ?? 0)), s = Math.abs(Math.sin(p.rotY ?? 0));
  const HX = hx * c + hz * s, HZ = hx * s + hz * c;
  const room = rooms.find((q) => p.x >= q.rect[0] && p.x <= q.rect[2] && p.z >= q.rect[1] && p.z <= q.rect[3]);
  if (!room) continue;   // 방 밖(마당 경계 등)은 이 검사의 대상이 아니다
  const [x0, z0, x1, z1] = room.rect;
  const over = Math.max(x0 + WALL - (p.x - HX), p.x + HX - (x1 - WALL), z0 + WALL - (p.z - HZ), p.z + HZ - (z1 - WALL));
  if (over > 0.005) {
    violations++;
    console.log(`  ❌ ${room.id} ${p.label} — 벽을 ${(over * 100).toFixed(1)}cm 넘는다 (x ${(p.x - HX).toFixed(2)}~${(p.x + HX).toFixed(2)} · z ${(p.z - HZ).toFixed(2)}~${(p.z + HZ).toFixed(2)})`);
  }
}

// ── ② 가구 위 자리 높이 ──────────────────────────────────────
console.log('\n가구 위 자리 — 자리 높이가 실제 표면과 맞는가');
const meshes = props.map((p) => {
  const m = new Mesh(geos[SHAPE_IDS.indexOf(p.label as never)]!, new MeshBasicMaterial({ side: DoubleSide }));
  m.position.set(p.x, (p.y ?? 0) + 0.5 * p.size, p.z);
  m.rotation.y = p.rotY ?? 0;
  m.scale.setScalar(p.size);
  m.updateMatrixWorld();
  m.name = p.label;
  return m;
});
const ray = new Raycaster();
for (const q of spots) {
  if (q.y === undefined) continue;
  const [x0, z0, x1, z1] = q.rect;
  const hits: number[] = [];
  let who = '';
  for (const fx of [0.2, 0.5, 0.8]) {
    for (const fz of [0.2, 0.5, 0.8]) {
      ray.set(new Vector3(x0 + (x1 - x0) * fx, q.y + 0.03, z0 + (z1 - z0) * fz), new Vector3(0, -1, 0));
      const h = ray.intersectObjects(meshes, false)[0];
      if (h) { hits.push(h.point.y); who = h.object.name; }
    }
  }
  /**
   * **9 점 중 과반이 맞으면 통과.** 자리 사각형이 다른 가구(TV장 위 TV)와 겹치면 그 몸체 «안»에서
   * 출발한 광선이 안쪽 면을 먼저 맞힌다. 그 점은 어차피 물건이 못 놓이는 자리다.
   */
  const good = hits.filter((y) => Math.abs(q.y - y) <= SURF_EPS).length;
  const near = hits.length ? hits.reduce((a, y) => (Math.abs(y - q.y) < Math.abs(a - q.y) ? y : a)) : NaN;
  const ok = good >= 5;
  if (!ok) violations++;
  console.log(`  ${ok ? '✅' : '❌'} ${q.id.padEnd(16)} 자리 ${q.y.toFixed(3)} · 표면 ${Number.isNaN(near) ? '없음' : near.toFixed(3)} (${who || '—'}) · 맞은 점 ${good}/9`);
}

console.log(violations ? `\n❌ 위반 ${violations}건` : '\n✅ 위반 없음.');
process.exit(violations ? 1 : 0);
