/**
 * 배치 규약 검사기.  `npm run placecheck`
 *
 * **이 도구가 필요한 이유:**
 * 물체가 호수 위에 떠 있어도 에러가 나지 않는다. 그냥 떠 있다.
 * 실제로 4,200개 중 805개(19.2%)가 석촌호수 위에 있었고,
 * 사용자가 화면을 보고 지적할 때까지 아무도 몰랐다.
 * 건물 안에 파묻힌 15개는 보이지도 않아서 더 찾기 어려웠다.
 *
 * 마지막 검사가 특히 중요하다 — 재배치가 **크기 분포를 건드리지 않았는지** 본다.
 * 건드렸다면 ladder 로 재둔 사다리가 통째로 거짓말이 된다.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Scene } from 'three';
import { generateWorld, GENERATION, LABEL_BUCKETS } from '../src/world/generation';
import type { CityData } from '../src/world/cityData';

// World 는 CanvasTexture 를 만들기 때문에 document 가 필요하다 (spawncheck 과 같은 수법).
const g = globalThis as unknown as Record<string, unknown>;
g['document'] = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect() {} }) }) };
g['window'] = {}; g['self'] = g;

const { World } = await import('../src/world/World');

const slug = process.argv.includes('--city')
  ? process.argv[process.argv.indexOf('--city') + 1]!
  : 'jamsil';
const city: CityData = JSON.parse(
  readFileSync(resolve(process.cwd(), `src/world/city.${slug}.json`), 'utf8'));

let violations = 0;

function pointInPolygon(x: number, z: number, poly: ReadonlyArray<readonly [number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// 게임과 **같은 경로**로 만든다. 별도 구현을 두면 도구가 게임을 검사하는 게 아니라
// 자기 자신을 검사하게 된다.
const world = new World(new Scene(), city);

const boxes = city.buildings
  .map((b) => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [px, pz] of b.outline) {
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (pz < minZ) minZ = pz;
      if (pz > maxZ) maxZ = pz;
    }
    return [minX, maxX, minZ, maxZ] as const;
  })
  .filter(([a, , d]) => Number.isFinite(a) && Number.isFinite(d));

// ─── 1. 물 안 ─────────────────────────────────────────────────

/** 좌표 목록에서 물 안 개수를 센다. 수역 이름별로 나눠 담는다. */
function countInWater(pts: ReadonlyArray<readonly [number, number]>): { total: number; byName: Map<string, number> } {
  const byName = new Map<string, number>();
  let total = 0;
  for (const [x, z] of pts) {
    for (const w of city.water) {
      if (pointInPolygon(x, z, w.outline)) {
        total++;
        const n = w.name ?? '(이름없음)';
        byName.set(n, (byName.get(n) ?? 0) + 1);
        break;
      }
    }
  }
  return { total, byName };
}

const now: Array<readonly [number, number]> = world.objects.map((o) => [o.pos.x, o.pos.z] as const);
const { total: inWater, byName: waterHits } = countInWater(now);

// ─── 2. 건물 안 ───────────────────────────────────────────────

function countInBuilding(pts: ReadonlyArray<readonly [number, number]>): number {
  let n = 0;
  for (const [x, z] of pts) {
    for (const [minX, maxX, minZ, maxZ] of boxes) {
      if (x > minX && x < maxX && z > minZ && z < maxZ) { n++; break; }
    }
  }
  return n;
}
const inBuilding = countInBuilding(now);

// ─── 3. 고치기 전 상태 ────────────────────────────────────────
//
// "이전에는 805개였다"를 주석으로 적어두면 도구가 자기 말을 증명하지 못한다.
// 술어를 **안 준** 결과를 같이 재서 before/after 를 매번 실측한다.

const REACH = city.radius;
const opts = {
  count: Math.round(GENERATION.count * Math.min(3, REACH / 190)),
  placeMax: REACH,
};
const plain = generateWorld(1337, opts);
const before: Array<readonly [number, number]> = plain.map(
  (s) => [s.x + world.spawn.x, s.z + world.spawn.z] as const);
const beforeWater = countInWater(before);
const beforeBuilding = countInBuilding(before);

/** 터미널 표시 폭. 한글은 두 칸을 차지하므로 String.padEnd 로는 표가 어긋난다. */
const cols = (s: string): number => [...s].reduce((n, c) => n + (c.charCodeAt(0) > 0x2e80 ? 2 : 1), 0);
const padR = (s: string, n: number): string => s + ' '.repeat(Math.max(0, n - cols(s)));

console.log(`\n${'═'.repeat(70)}`);
console.log(`배치 규약 — ${city.name} (길거리 ${world.objects.length}개)`);
console.log('═'.repeat(70));
console.log(`  ${padR('', 16)}고치기 전      지금`);
const row = (label: string, was: number, is: number): void => {
  console.log(`  ${padR(label, 16)}${String(was).padStart(6)}개${String(is).padStart(8)}개`);
};
row('물 안', beforeWater.total, inWater);
for (const [n, c] of [...beforeWater.byName].sort((a, b) => b[1] - a[1])) {
  row(`  ${n}`, c, waterHits.get(n) ?? 0);
}
row('건물 안', beforeBuilding, inBuilding);
if (inWater > 0) violations++;
if (inBuilding > 0) violations++;

const spawn = world.spawn;
/**
 * 좌표 비교 허용 오차(m).
 *
 * 정확히 같은지 보면 안 된다. World 는 `s.x += spawn.x` 로 옮기므로
 * 되돌린 `pos.x - spawn.x` 가 원래 값과 **부동소수 수준에서 다르다.**
 * 이걸 놓쳐서 처음에 "99.3%가 재배치됨"이라는 거짓 수치가 나왔다.
 * 실제로 옮겨진 물체는 최소 수 미터를 움직이므로 1µm 오차면 충분히 구분된다.
 */
const EPS = 1e-6;
let moved = 0, distKept = 0, distChanged = 0;
for (let i = 0; i < plain.length; i++) {
  const a = plain[i]!;
  const o = world.objects[i]!;
  // world 쪽은 스폰만큼 옮겨져 있으므로 되돌려서 비교한다
  const bx = o.pos.x - spawn.x;
  const bz = o.pos.z - spawn.z;
  if (Math.abs(a.x - bx) < EPS && Math.abs(a.z - bz) < EPS) continue;
  moved++;
  const d0 = Math.hypot(a.x, a.z);
  const d1 = Math.hypot(bx, bz);
  if (Math.abs(d0 - d1) < EPS) distKept++; else distChanged++;
}

console.log(`\n${'─'.repeat(70)}`);
console.log(`  재배치된 물체: ${moved}개 (${(moved / plain.length * 100).toFixed(1)}%)`);
console.log(`    각도만 다시 뽑아 해결: ${distKept}개  ← 스폰까지의 거리가 보존된다`);
console.log(`    반지름까지 다시 뽑음:  ${distChanged}개`);

// ─── 4. 크기 분포 불변 (핵심) ──────────────────────────────────
//
// 재배치가 메인 난수 스트림을 건드렸다면 여기서 터진다.
// 터지면 ladder 로 재둔 사다리가 통째로 거짓말이 된다.

const keyOf = (s: { sx: number; sy: number; sz: number; size: number; volume: number; color: number; label: string; geo: number; rotY: number }) =>
  `${s.sx},${s.sy},${s.sz},${s.size},${s.volume},${s.color},${s.label},${s.geo},${s.rotY}`;
let distMismatch = 0;
for (let i = 0; i < plain.length; i++) {
  const a = plain[i]!;
  const o = world.objects[i]!;
  const b = {
    sx: o.scale.x, sy: o.scale.y, sz: o.scale.z,
    size: o.size, volume: o.volume, color: o.color, label: o.label, geo: o.combo, rotY: o.rotY,
  };
  if (keyOf(a) !== keyOf(b)) distMismatch++;
}

console.log(`\n${'─'.repeat(70)}`);
if (distMismatch === 0) {
  console.log('✅ 크기·색·라벨·회전 분포가 재배치 전과 완전히 동일합니다.');
  console.log('   → ladder 로 재둔 크기 사다리가 그대로 유효합니다.');
} else {
  violations++;
  console.log(`❌ 크기·색·라벨 분포가 ${distMismatch}개 어긋납니다.`);
  console.log('   → 재배치가 메인 난수 스트림을 건드렸습니다. ladder 가 거짓말이 됩니다.');
}

// ─── 5. 겹침 ──────────────────────────────────────────────────
//
// 물체가 서로 뚫고 있어도 에러가 나지 않는다. 그냥 겹쳐 있다.
// 배치 반경은 size^0.65 로 커지는데 바닥면적은 size² 로 커져서, 큰 물체 구간의
// 점유율이 34%까지 올라간다. 그 밀도에서 무작위로 놓으면 겹치는 게 정상이다.

interface Foot { x: number; z: number; sx: number; sz: number; size: number }

/** 심한 겹침 = 작은 쪽 바닥면적의 50% 이상 + 크기 비 4배 이내 */
const OVERLAP_AREA = 0.5;
const OVERLAP_RATIO = 4;
/** 브로드페이즈 격자 한 변(m) */
const OVERLAP_CELL = 8;

const bucketOf = (size: number): number =>
  Math.min(LABEL_BUCKETS.length - 1,
    Math.max(0, Math.floor(Math.log2(size / GENERATION.sizeMin))));

function countOverlaps(list: readonly Foot[]): {
  pairs: number; objects: number; perBucket: number[]; totalPerBucket: number[];
} {
  const grid = new Map<number, number[]>();
  for (let i = 0; i < list.length; i++) {
    const s = list[i]!;
    for (let gz = Math.floor((s.z - s.sz / 2) / OVERLAP_CELL); gz <= Math.floor((s.z + s.sz / 2) / OVERLAP_CELL); gz++) {
      for (let gx = Math.floor((s.x - s.sx / 2) / OVERLAP_CELL); gx <= Math.floor((s.x + s.sx / 2) / OVERLAP_CELL); gx++) {
        const key = gx * 100003 + gz;
        let cell = grid.get(key);
        if (!cell) grid.set(key, (cell = []));
        cell.push(i);
      }
    }
  }

  const hit = new Set<number>();
  const seen = new Set<number>();
  let pairs = 0;
  for (const cell of grid.values()) {
    for (let a = 0; a < cell.length; a++) {
      for (let b = a + 1; b < cell.length; b++) {
        const i = cell[a]!, j = cell[b]!;
        // 한 쌍이 여러 셀에 함께 들어갈 수 있다. 한 번만 센다.
        const pair = i * list.length + j;
        if (seen.has(pair)) continue;
        seen.add(pair);

        const s = list[i]!, t = list[j]!;
        if (Math.max(s.size, t.size) > Math.min(s.size, t.size) * OVERLAP_RATIO) continue;
        const ox = (s.sx + t.sx) / 2 - Math.abs(s.x - t.x);
        const oz = (s.sz + t.sz) / 2 - Math.abs(s.z - t.z);
        if (ox <= 0 || oz <= 0) continue;
        if (ox * oz < Math.min(s.sx * s.sz, t.sx * t.sz) * OVERLAP_AREA) continue;
        pairs++;
        hit.add(i);
        hit.add(j);
      }
    }
  }

  const perBucket = new Array<number>(LABEL_BUCKETS.length).fill(0);
  const totalPerBucket = new Array<number>(LABEL_BUCKETS.length).fill(0);
  for (let i = 0; i < list.length; i++) totalPerBucket[bucketOf(list[i]!.size)]!++;
  for (const i of hit) perBucket[bucketOf(list[i]!.size)]!++;
  return { pairs, objects: hit.size, perBucket, totalPerBucket };
}

const beforeSpecs = generateWorld(1337, { ...opts, relaxIterations: 0 });
const overlapBefore = countOverlaps(beforeSpecs);
const overlapAfter = countOverlaps(world.objects.map((o) => ({
  x: o.pos.x, z: o.pos.z, sx: o.scale.x, sz: o.scale.z, size: o.size,
})));

console.log(`\n${'─'.repeat(70)}`);
console.log('심한 겹침 — 작은 쪽 바닥면적 50% 이상 + 크기 비 4배 이내');
row('겹친 물체', overlapBefore.objects, overlapAfter.objects);
row('겹친 쌍', overlapBefore.pairs, overlapAfter.pairs);

const RANGES = ['1~2cm', '2~4cm', '4~8cm', '8~16cm', '16~32cm',
  '32~63cm', '63cm~1.26m', '1.26~2.51m', '2.51~5m'];
console.log(`\n  ${padR('크기 구간', 14)}개수   고치기 전      지금`);
for (let b = 0; b < LABEL_BUCKETS.length; b++) {
  const n = overlapAfter.totalPerBucket[b]!;
  if (n === 0) continue;
  const was = overlapBefore.perBucket[b]!, is = overlapAfter.perBucket[b]!;
  console.log(`  ${padR(RANGES[b]!, 14)}${String(n).padStart(4)}` +
    `${String(was).padStart(8)}개 (${(was / n * 100).toFixed(0).padStart(2)}%)` +
    `${String(is).padStart(6)}개 (${(is / n * 100).toFixed(0).padStart(2)}%)`);
}

const overlapRate = overlapAfter.objects / world.objects.length;
console.log('');
if (overlapRate > 0.02) {
  violations++;
  console.log(`❌ 심한 겹침 ${(overlapRate * 100).toFixed(1)}% — 상한 2% 를 넘습니다.`);
} else {
  console.log(`✅ 심한 겹침 ${(overlapRate * 100).toFixed(1)}% (상한 2%).`);
}

console.log('');
if (violations > 0) {
  console.log(`❌ 위반 ${violations}건.\n`);
  process.exit(1);
}
console.log('✅ 위반 없음.\n');
