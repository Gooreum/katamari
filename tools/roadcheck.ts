/**
 * 도로 데이터 검사기.  `npm run roadcheck`
 *
 * **이 도구가 필요한 이유:**
 * 도로는 4,500개가 넘는다. 그중 하나가 폭 0이거나 좌표가 NaN이어도 화면에서는
 * 못 찾는다 — 안 그려지거나, 더 나쁘게는 병합 메시 전체의 bounding sphere를
 * NaN으로 만들어 **프러스텀 컬링을 조용히 죽인다.** 도구가 판정해야 한다.
 *
 * 삼각형·파일 크기도 여기서 본다. 도로는 렌더 전용이라 게임 로직에는
 * 아무 영향이 없지만 공짜는 아니다.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CityData, CityRoad, RoadKind } from '../src/world/cityData';

/**
 * 검사 대상. 두 갈래다.
 *
 *   --city <slug>   OSM 도시 (`src/world/city.<slug>.json`). 기본값 jamsil
 *   --stage town    **손배치 판.** 코드로 짓는 판이라 JSON 파일이 없다
 *
 * `--stage` 가 필요해진 이유: 동네 판이 도로를 갖게 됐는데 이 도구가
 * JSON 만 읽어서 검사 대상 밖이었다. 손으로 쓴 중심선도 폭 0 이나 NaN 이
 * 날 수 있고, **그게 하나만 있어도 병합 메시 전체의 bounding sphere 가 NaN 이 되어
 * 프러스텀 컬링이 조용히 죽는다.** 화면에서는 안 보이는 종류의 고장이다.
 */
const stageArg = process.argv.includes('--stage')
  ? process.argv[process.argv.indexOf('--stage') + 1]!
  : null;
const slug = stageArg ?? (process.argv.includes('--city')
  ? process.argv[process.argv.indexOf('--city') + 1]!
  : 'jamsil');

const city: CityData = await (async () => {
  if (stageArg === null) {
    const path = resolve(process.cwd(), `src/world/city.${slug}.json`);
    return JSON.parse(readFileSync(path, 'utf8')) as CityData;
  }
  // 손배치 판은 코드가 짓는다. three 를 안 끌어오는 모듈이라 그대로 부를 수 있다
  const mod = { town: './../src/world/stage.town', world: './../src/world/stage.world' }[stageArg];
  if (mod === undefined) {
    console.error(`\n❌ --stage 는 town 또는 world 여야 합니다 (받은 값: ${stageArg})\n`);
    process.exit(1);
  }
  const m = await import(mod) as Record<string, () => CityData>;
  return (stageArg === 'town' ? m['buildTownStage']! : m['buildWorldStage']!)();
})();
const roads = city.roads ?? [];

let violations = 0;

if (roads.length === 0) {
  console.error(`\n❌ ${slug} 에 도로가 없습니다.`);
  if (stageArg === null) {
    console.error('   npm run fetch-city -- --preset ' + slug + ' --only roads\n');
  } else {
    console.error(`   buildStage() 반환에 roads 키가 없습니다 — src/world/stage.${stageArg}.ts\n`);
  }
  process.exit(1);
}

// ─── 1. 종류별 집계 ────────────────────────────────────────────

const KINDS: RoadKind[] = ['arterial', 'street', 'alley', 'walk'];
const KIND_LABEL: Record<RoadKind, string> = {
  arterial: '대로', street: '생활도로', alley: '골목', walk: '보도·산책로',
};

/** 중복 점을 뺀 실제 정점 수. 렌더가 만드는 리본이 이 개수를 기준으로 한다. */
function uniquePoints(line: CityRoad['line']): number {
  let n = 1;
  for (let i = 1; i < line.length; i++) {
    const [x, z] = line[i]!;
    const [px, pz] = line[i - 1]!;
    if (x !== px || z !== pz) n++;
  }
  return n;
}

function lengthOf(line: CityRoad['line']): number {
  let m = 0;
  for (let i = 1; i < line.length; i++) {
    m += Math.hypot(line[i]![0] - line[i - 1]![0], line[i]![1] - line[i - 1]![1]);
  }
  return m;
}

interface Stat { count: number; meters: number; widthSum: number; verts: number; tris: number }
const stats = new Map<RoadKind, Stat>(
  KINDS.map((k) => [k, { count: 0, meters: 0, widthSum: 0, verts: 0, tris: 0 }]),
);

for (const r of roads) {
  const s = stats.get(r.kind);
  if (!s) continue;   // 알 수 없는 kind 는 아래 규약 검사에서 잡는다
  const n = uniquePoints(r.line);
  s.count++;
  s.meters += lengthOf(r.line);
  s.widthSum += r.width;
  s.verts += n * 2;              // 좌/우 한 쌍씩
  s.tris += (n - 1) * 2;         // 구간마다 사각형 하나 = 삼각형 둘
}

console.log(`\n${'═'.repeat(74)}`);
console.log(`도로 데이터 — ${city.name} 반경 ${city.radius}m`);
console.log('═'.repeat(74));
console.log('  종류            개수     총 연장    평균 폭      정점    삼각형');

let totalCount = 0, totalM = 0, totalV = 0, totalT = 0;
for (const k of KINDS) {
  const s = stats.get(k)!;
  totalCount += s.count; totalM += s.meters; totalV += s.verts; totalT += s.tris;
  const avgW = s.count ? s.widthSum / s.count : 0;
  console.log(
    `  ${KIND_LABEL[k].padEnd(12)}${String(s.count).padStart(6)}` +
    `${(s.meters / 1000).toFixed(1).padStart(10)}km` +
    `${avgW.toFixed(1).padStart(9)}m` +
    `${s.verts.toLocaleString().padStart(10)}${s.tris.toLocaleString().padStart(10)}`,
  );
}
console.log(`  ${'합계'.padEnd(11)}${String(totalCount).padStart(6)}` +
  `${(totalM / 1000).toFixed(1).padStart(10)}km` +
  `${''.padStart(10)}${totalV.toLocaleString().padStart(10)}${totalT.toLocaleString().padStart(10)}`);

// ─── 2. 규약 검사 ──────────────────────────────────────────────
//
// 전부 "화면에서는 절대 못 찾는" 것들이다.

const badWidth: number[] = [];
const badCoord: number[] = [];
const tooShort: number[] = [];
const outOfRange: number[] = [];
const badKind: number[] = [];
// fetch-osm 이 반경으로 잘라서 저장하므로 밖으로 나간 점이 있으면 안 된다.
// 부동소수 오차만 봐준다. 이걸 느슨하게 두면 지면(±radius*1.3) 밖 허공에
// 회색 띠가 떠 있는 걸 도구가 통과시킨다 — 실제로 7.3km짜리가 하나 있었다.
const LIMIT = city.radius * 1.001;

roads.forEach((r, i) => {
  if (!KINDS.includes(r.kind)) badKind.push(i);
  if (!Number.isFinite(r.width) || r.width <= 0) badWidth.push(i);
  if (r.line.some(([x, z]) => !Number.isFinite(x) || !Number.isFinite(z))) badCoord.push(i);
  else if (r.line.some(([x, z]) => Math.hypot(x, z) > LIMIT)) outOfRange.push(i);
  if (uniquePoints(r.line) < 2) tooShort.push(i);
});

console.log(`\n${'─'.repeat(74)}`);
const checks: Array<[string, number[]]> = [
  ['폭이 0 이하이거나 NaN', badWidth],
  ['좌표에 NaN/Infinity', badCoord],
  [`원점에서 반경 ${city.radius}m 밖으로 벗어난 점`, outOfRange],
  ['중복 점 제거 후 2점 미만 (리본을 못 만든다)', tooShort],
  ['알 수 없는 kind', badKind],
];
for (const [label, list] of checks) {
  if (list.length) {
    violations++;
    console.log(`❌ ${label}: ${list.length}개 (인덱스 ${list.slice(0, 5).join(', ')}${list.length > 5 ? ' …' : ''})`);
  } else {
    console.log(`✅ ${label}: 0개`);
  }
}

/**
 * **이 검사는 OSM 전용이다.** 네 종류가 다 나와야 태그 매핑이 온전하다는 뜻인데,
 * 손배치 판은 사람이 필요한 길만 긋는다 — 골목도 보도도 없는 게 정상이고,
 * 그걸 위반이라고 부르면 도구가 거짓말을 한다.
 */
if (stageArg === null) {
  for (const k of KINDS) {
    if (stats.get(k)!.count === 0) {
      violations++;
      console.log(`❌ ${KIND_LABEL[k]}(${k}) 가 하나도 없습니다 — 태그 매핑이 빠졌을 수 있습니다.`);
    }
  }
}

// ─── 3. 비용 ───────────────────────────────────────────────────

const roadBytes = JSON.stringify(roads).length;
console.log(`\n${'─'.repeat(74)}`);
if (stageArg === null) {
  // OSM 도시만 파일이 있다. 손배치 판은 코드가 짓는다
  const bytes = readFileSync(resolve(process.cwd(), `src/world/city.${slug}.json`)).length;
  console.log(`파일 ${(bytes / 1048576).toFixed(2)}MB — 그중 도로 ${(roadBytes / 1048576).toFixed(2)}MB ` +
    `(${(roadBytes / bytes * 100).toFixed(0)}%)`);
} else {
  console.log(`손배치 판 — 도로 데이터 ${roadBytes.toLocaleString()}바이트 (코드로 짓는다)`);
}
// 종류별 색은 예전에 정점색이었지만 지금은 텍스처 밴드다 (Roads.buildRoadTexture).
// 드로우콜이 1인 이유가 바뀌었으므로 문구도 같이 바꾼다 — 틀린 설명이 남으면 다음 사람이 속는다.
console.log(`도로 삼각형 ${totalT.toLocaleString()} · 드로우콜 1 (종류별 색·차선은 텍스처 4밴드)`);
console.log(`건물 ${city.buildings.length}채 · 수역 ${city.water.length}개 · 랜드마크 ${city.landmarks.length}개`);

console.log('');
if (violations > 0) {
  console.log(`❌ 위반 ${violations}건.\n`);
  process.exit(1);
}
console.log('✅ 위반 없음.\n');
