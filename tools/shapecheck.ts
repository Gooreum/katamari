/**
 * 형태 검사기.  `npm run shapecheck`
 *
 * **이 도구가 필요한 이유:**
 * 형태 규약(최장축 1.0, 바닥 y=-0.5)은 눈으로 못 잡는다. 어긴 물체는 에러를 내는 게 아니라
 * 땅에 뜨거나 파묻힌 채로 **그냥 그려진다.** 4200개 중 하나가 20cm 떠 있는 걸
 * 화면에서 발견할 방법은 없다. 그래서 도구가 판정한다.
 *
 * 삼각형 예산도 여기서 본다 — 실루엣은 예뻐지지만 공짜가 아니다.
 * 기본 도형만 쓰던 때와 비교해서 얼마나 늘었는지 숫자로 남긴다.
 *
 * THREE 지오메트리는 WebGL 없이 만들어지므로 브라우저 없이 돈다.
 */
import { BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, type BufferGeometry } from 'three';
import { buildShapeGeometries } from '../src/world/shapes';
import {
  generateWorld, GENERATION, GEOMETRY_COUNT, SHAPE_IDS, SHAPE_IDS_LARGE, SHAPE_IDS_MID,
  SHAPE_IDS_SMALL, TOTAL_GEOMETRY_COUNT,
  LABEL_BUCKETS, TOWN_BUCKETS, WORLD_BUCKETS, PALETTE, SHAPE_COLOR,
} from '../src/world/generation';

/** 규약 허용 오차. 부동소수 누적분만 봐주고 그 이상은 버그다. */
const EPS = 0.001;

/**
 * 형태 하나의 삼각형 상한.
 *
 * 63종을 전부 이 밀도로 채울 걸 전제로 잡은 선이다.
 * 길거리 물체는 잠실 규모에서 4200개가 깔리므로, 형태 평균이 500이면 210만 삼각형이 된다.
 * 한 형태가 예뻐 보이자고 부품을 무한정 붙이면 **나중에 63종을 전부 다시 깎아야 한다.**
 */
const TRI_WARN = 550;
const TRI_FAIL = 800;

let violations = 0;

function triangles(geo: BufferGeometry): number {
  const count = geo.index ? geo.index.count : geo.attributes['position']!.count;
  return count / 3;
}

// ─── 1. 형태 규약 ──────────────────────────────────────────────

const shapes = buildShapeGeometries();

console.log(`\n${'═'.repeat(72)}`);
console.log('형태 규약 — 최장축 1.0 · 바닥 y=-0.5 · X·Z ⊂ [-0.5, 0.5]');
console.log('═'.repeat(72));
console.log('  형태        최장축     바닥      가로(X)   세로(Y)   깊이(Z)   삼각형   판정');

const shapeTris = new Map<string, number>();

for (const geo of shapes) {
  const b = geo.boundingBox!;
  const sx = b.max.x - b.min.x;
  const sy = b.max.y - b.min.y;
  const sz = b.max.z - b.min.z;
  const longest = Math.max(sx, sy, sz);
  const tris = triangles(geo);
  shapeTris.set(geo.name, tris);

  const bad: string[] = [];
  if (Math.abs(longest - 1) > EPS) bad.push(`최장축 ${longest.toFixed(4)}`);
  if (Math.abs(b.min.y + 0.5) > EPS) bad.push(`바닥 ${b.min.y.toFixed(4)}`);
  if (b.min.x < -0.5 - EPS || b.max.x > 0.5 + EPS) bad.push('X 범위');
  if (b.min.z < -0.5 - EPS || b.max.z > 0.5 + EPS) bad.push('Z 범위');
  if (tris > TRI_FAIL) bad.push(`삼각형 ${tris} > ${TRI_FAIL}`);
  if (bad.length) violations++;

  // 상한을 넘지 않아도 여유가 얼마 없으면 알려준다 — 다음에 부품을 붙이려다 걸린다.
  const budget = tris > TRI_FAIL ? '❌' : tris > TRI_WARN ? '⚠' : ' ';

  console.log(
    `  ${geo.name.padEnd(9)}${longest.toFixed(4).padStart(8)}` +
    `${b.min.y.toFixed(4).padStart(10)}` +
    `${sx.toFixed(3).padStart(10)}${sy.toFixed(3).padStart(10)}${sz.toFixed(3).padStart(10)}` +
    `${String(tris).padStart(8)}${budget}  ${bad.length ? `❌ ${bad.join(', ')}` : '✅'}`,
  );
}

// ─── 2. 라벨 오타 ──────────────────────────────────────────────
//
// SHAPE_IDS 에 오타가 나면 그 형태는 아무 물체도 안 쓰는 죽은 지오메트리가 된다.
// 에러가 안 나므로 이 검사가 없으면 영원히 모른다.

// **스테이지마다 라벨 표가 다르다.** 집 표만 보면 동네 형태 20종이 전부
// "죽은 지오메트리"로 잡힌다 — 실제로는 동네 맵이 쓰는 것들이다.
const allLabels = new Set([
  ...LABEL_BUCKETS.flat(), ...TOWN_BUCKETS.flat(), ...WORLD_BUCKETS.flat(),
]);
const missing = SHAPE_IDS.filter((id) => !allLabels.has(id));

console.log(`\n${'─'.repeat(72)}`);
if (missing.length) {
  violations++;
  console.log(`❌ 어느 라벨 표에도 없는 형태 ${missing.length}개: ${missing.join(', ')}`);
  console.log('   → 이 형태는 아무 물체도 쓰지 않는 죽은 지오메트리입니다.');
} else {
  console.log(`✅ SHAPE_IDS ${SHAPE_IDS.length}개 전부 라벨 표(집·동네)에 실재합니다.`);
}

// ─── 3. 색 배정 ────────────────────────────────────────────────
//
// 형태를 추가하고 SHAPE_COLOR 에 색 넣는 걸 잊으면 그 물체만 팔레트 전체에서
// 무작위 색을 받는다. 63종 중 하나라 화면에서는 절대 못 찾는다.

const noColor = SHAPE_IDS.filter((id) => !SHAPE_COLOR[id]);
const badIndex = Object.entries(SHAPE_COLOR)
  .filter(([, v]) => v.length === 0 || v.some((i) => !Number.isInteger(i) || i < 0 || i >= PALETTE.length))
  .map(([k]) => k);
// SHAPE_IDS 에 없는 이름에 색을 주면 아무도 안 쓰는 죽은 항목이 된다 (오타)
const shapeIdSet = new Set<string>(SHAPE_IDS);
const deadColor = Object.keys(SHAPE_COLOR).filter((k) => !shapeIdSet.has(k));

console.log(`\n${'─'.repeat(72)}`);
if (noColor.length) {
  violations++;
  console.log(`❌ 색이 배정되지 않은 형태 ${noColor.length}개: ${noColor.join(', ')}`);
  console.log('   → 이 형태만 팔레트에서 무작위 색을 받습니다.');
}
if (badIndex.length) {
  violations++;
  console.log(`❌ 팔레트 범위(0~${PALETTE.length - 1})를 벗어난 색 ${badIndex.length}개: ${badIndex.join(', ')}`);
}
if (deadColor.length) {
  violations++;
  console.log(`❌ SHAPE_IDS 에 없는 이름에 색이 배정됨 ${deadColor.length}개: ${deadColor.join(', ')}`);
  console.log('   → 오타입니다. 이 색은 아무도 쓰지 않습니다.');
}
if (!noColor.length && !badIndex.length && !deadColor.length) {
  const multi = SHAPE_IDS.filter((id) => (SHAPE_COLOR[id]?.length ?? 0) > 1).length;
  console.log(`✅ SHAPE_IDS ${SHAPE_IDS.length}개 전부 색이 배정돼 있습니다 (여러 색인 형태 ${multi}개).`);
}

// ─── 4. 삼각형 예산 ────────────────────────────────────────────
//
// 실제 게임 규모로 잰다. 잠실(반경 2800m)은 World가 count 를 3배로 키운다.

const REACH = 2800;
const scaled = Math.round(GENERATION.count * Math.min(3, REACH / 190));
const specs = generateWorld(1337, { count: scaled, placeMax: REACH });

const primitiveTris = [
  triangles(new BoxGeometry(1, 1, 1)),
  triangles(new CylinderGeometry(0.5, 0.5, 1, 10)),
  triangles(new SphereGeometry(0.5, 10, 8)),
  triangles(new ConeGeometry(0.5, 1, 8)),
];

const perGeo = new Int32Array(TOTAL_GEOMETRY_COUNT);
for (const s of specs) perGeo[s.geo]!++;

let now = 0;
for (let i = 0; i < GEOMETRY_COUNT; i++) now += perGeo[i]! * primitiveTris[i]!;
for (let i = 0; i < SHAPE_IDS.length; i++) {
  now += perGeo[GEOMETRY_COUNT + i]! * shapeTris.get(SHAPE_IDS[i]!)!;
}

// 변경 전: 형태를 받은 물체들도 기본 도형 평균만큼 그렸다.
// spec.geo 를 안 바꿨다면 무슨 도형이 나왔을지는 알 수 없으므로 평균으로 근사한다.
const primAvg = primitiveTris.reduce((a, b) => a + b, 0) / GEOMETRY_COUNT;
let shapedCount = 0;
for (let i = 0; i < SHAPE_IDS.length; i++) shapedCount += perGeo[GEOMETRY_COUNT + i]!;
let before = 0;
for (let i = 0; i < GEOMETRY_COUNT; i++) before += perGeo[i]! * primitiveTris[i]!;
before += shapedCount * primAvg;

const delta = now - before;

console.log(`\n${'═'.repeat(72)}`);
console.log(`삼각형 예산 — 잠실 규모 (길거리 ${specs.length}개)`);
console.log('═'.repeat(72));
console.log(`  기본 도형만 썼을 때   ${Math.round(before).toLocaleString().padStart(10)} 삼각형`);
console.log(`  전용 형태 적용 후     ${now.toLocaleString().padStart(10)} 삼각형`);
console.log(`  증가                  ${(delta >= 0 ? '+' : '') + Math.round(delta).toLocaleString().padStart(9)} ` +
  `(${(delta / before * 100).toFixed(1)}%)`);
const shapeAvg = [...shapeTris.values()].reduce((a, b) => a + b, 0) / shapeTris.size;
console.log(`\n  형태를 받은 물체 ${shapedCount}개 / ${specs.length}개 ` +
  `(${(shapedCount / specs.length * 100).toFixed(1)}%)`);
console.log(`  기본 도형 평균 ${primAvg.toFixed(1)} 삼각형 → 형태 평균 ${shapeAvg.toFixed(1)} 삼각형`);

// ─── 3-b. 크기 구간별 평균 ──────────────────────────────────────
//
// 전체 평균만 보면 "어디가 무거운지"를 못 본다. 동전에 200 삼각형을 쓰는 것과
// 자판기에 200을 쓰는 건 전혀 다른 문제다. 구간을 나눠야 판단이 된다.

const BANDS = [
  { name: '1~8cm    (작은 것)', ids: SHAPE_IDS_SMALL },
  { name: '8cm~63cm (중간)', ids: SHAPE_IDS_MID },
  { name: '63cm~5m  (큰 것)', ids: SHAPE_IDS_LARGE },
] as const;

console.log(`\n${'─'.repeat(72)}`);
console.log('크기 구간별 평균 삼각형');
for (const band of BANDS) {
  const list = band.ids.map((id) => shapeTris.get(id) ?? 0);
  const avg = list.reduce((a, b) => a + b, 0) / list.length;
  const max = Math.max(...list);
  console.log(`  ${band.name.padEnd(20)}${String(band.ids.length).padStart(3)}종   ` +
    `평균 ${avg.toFixed(1).padStart(6)}   최대 ${String(max).padStart(4)}`);
}
console.log(`  ${'전체'.padEnd(19)}${String(SHAPE_IDS.length).padStart(3)}종   ` +
  `평균 ${shapeAvg.toFixed(1).padStart(6)}   ← 이게 월드 비용을 결정한다`);

// ─── 4. 커버리지 ───────────────────────────────────────────────

const total = allLabels.size;
console.log(`\n${'─'.repeat(72)}`);
console.log(`실루엣 커버리지: ${SHAPE_IDS.length} / ${total}종 ` +
  `(${(SHAPE_IDS.length / total * 100).toFixed(0)}%) — 남은 ${total - SHAPE_IDS.length}종은 아직 기본 도형입니다.`);

console.log('');
if (violations > 0) {
  console.log(`❌ 위반 ${violations}건. 고치기 전에는 화면에서 절대 못 찾습니다.\n`);
  process.exit(1);
}
console.log('✅ 규약 위반 없음.\n');
