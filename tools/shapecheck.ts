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
import { buildHouseStage } from '../src/world/stage.house';
import { buildTownStage } from '../src/world/stage.town';
import { buildWorldStage } from '../src/world/stage.world';

/** 규약 허용 오차. 부동소수 누적분만 봐주고 그 이상은 버그다. */
const EPS = 0.001;

/**
 * 형태 하나의 삼각형 상한 — **참고선이지 예산이 아니다.**
 *
 * 예전 값은 550/800 이었고, 「63종을 전부 이 밀도로 채우면 210만 삼각형」이라는
 * 계산에서 나왔다. **그 계산은 단위가 틀렸다.**
 *
 * 한 종의 삼각형 수만 보면 판단이 안 된다 — 곰인형은 아이 방에 **한 개**뿐이라
 * 1,550 삼각형이어도 씬에 1,550 을 더할 뿐이고, 300 짜리 형태가 300번 깔리면
 * 90,000 이다. **비용은 「형태당 삼각형 × 그 형태가 깔리는 개수」**,
 * 곧 아래 3장의 «전용 형태 적용 후» 값이다. 그게 진짜 예산이고 그걸 막는다.
 *
 * 여기 남기는 값은 **폭주 감지선**이다 — 실수로 세그먼트를 200으로 적었을 때
 * 잡으라고 둔다. 실제 합격/불합격은 `SCENE_TRI_MAX` 가 정한다.
 */
const TRI_WARN = 1800;
const TRI_FAIL = 3000;

/**
 * **진짜 예산.** 잠실 규모(길거리 4,200개)에서 씬에 올라가는 삼각형 총합.
 *
 * 실측 1,162,880 일 때 1,600,000 으로 뒀다(여유 38%). **2,000,000 으로 올린다** —
 * 곡면 면 수를 부품 크기에 맞추면서 실측이 1,740,392 가 됐다. 5~7면 원기둥을
 * 매끄럽게 칠하면 둥근 게 아니라 «물결치는 튜브»라 그게 「울퉁불퉁」의 절반이었고,
 * 그걸 고치는 값이다. 1.6M 은 하드웨어 한계가 아니라 실측 1.16M 때 «고른» 숫자다.
 * 참고선(TRI_WARN·TRI_FAIL)도 1200/2000 → 1800/3000 — 부품이 열 개 넘는 큰 형상
 * (석등·개·나무)이 그 선을 넘는 게 정상이 됐다.
 * 이 숫자가 커도 **드로우콜은 안 는다** — 인스턴싱이 형태 종류 수(118)로 묶는다.
 * 화면 HUD 실측 42 draws 는 세그먼트를 올려도 그대로다.
 */
const SCENE_TRI_MAX = 2_000_000;

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
//
// **스테이지가 «쓰는» 이름을 전부 모아야 한다.** 「모든 형상은 전역 라벨 표에서
// 뽑힌다」가 이 검사의 전제였는데 두 번 낡았다:
//
//   ① 손배치 가구(`placement.props`)는 난수 표를 안 거치고 이름으로 형상을 고른다
//   ② 방마다 표가 다르고(`rooms[].labels` = `ROOM_TABLES`),
//      자리는 `only` 로 이름을 직접 못 박는다
//
// 전역 표만 보면 거실 소품 여섯(책·비디오테이프·탁상시계·액자·귤·재떨이)이
// 「죽은 지오메트리」로 잡힌다 — 실제로는 거실 표와 자리 목록이 쓰고 있다.
// **도구가 게임과 다른 월드를 재면 그 숫자는 거짓말이다.**
const stages = [buildHouseStage(), buildTownStage(), buildWorldStage()];
const placedLabels = stages.flatMap((c) => {
  const pl = c.placement;
  if (!pl) return [];
  const tables = [
    pl.labels,
    ...(pl.rooms ?? []).map((r) => r.labels),
    ...(pl.spots ?? []).map((q) => q.labels),
  ];
  return [
    ...(pl.props ?? []).map((p) => p.label),
    ...(pl.spots ?? []).flatMap((q) => [...(q.only ?? [])]),
    ...tables.flatMap((t) => (t ? t.buckets.flat() : [])),
  ];
});
const allLabels = new Set([
  ...LABEL_BUCKETS.flat(), ...TOWN_BUCKETS.flat(), ...WORLD_BUCKETS.flat(),
  ...placedLabels,
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

// **이게 합격/불합격을 가르는 자다.** 형태 하나의 삼각형이 아니라 씬 총합이 비용이다
if (now > SCENE_TRI_MAX) {
  violations++;
  console.log(`\n❌ 씬 삼각형 ${now.toLocaleString()} > 상한 ${SCENE_TRI_MAX.toLocaleString()}`);
} else {
  console.log(`  씬 총합 ${now.toLocaleString()} / 상한 ${SCENE_TRI_MAX.toLocaleString()} ` +
    `(여유 ${((1 - now / SCENE_TRI_MAX) * 100).toFixed(0)}%)`);
}

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
