/**
 * 크기 사다리 검사.  `npm run ladder`
 *
 * 절차 생성 길거리 + 실제 건물 + 랜드마크를 합쳐서
 * 크기 옥타브별 개수를 센다.
 *
 * **이 도구가 필요한 이유:**
 * 절차 생성은 로그 균등이라 옥타브당 개수가 저절로 일정하다.
 * 실제 도시는 그렇지 않다. 5층 빌라는 수백 개인데 100~300m 사이는
 * 아예 비어 있을 수 있다. 그 구간에서 플레이어는 먹을 게 없어 멈춘다.
 *
 * 곡선 튜닝(tools/curve.ts)은 "얼마나 매끄러운가"를 보고,
 * 이건 "애초에 길이 끊기지 않았는가"를 본다. 이게 먼저다.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { coveredByLandmark, displayHeight, extentOf, type CityData } from '../src/world/cityData';
import { generateWorld, GENERATION } from '../src/world/generation';
import { TUNING } from '../src/game/tuning';

interface Item { size: number; source: 'street' | 'building' | 'landmark'; label: string }

const slug = process.argv.includes('--city')
  ? process.argv[process.argv.indexOf('--city') + 1]!
  : 'jamsil';

let city: CityData;
try {
  city = JSON.parse(readFileSync(resolve(process.cwd(), `src/world/city.${slug}.json`), 'utf8'));
} catch {
  console.error(`src/world/city.${slug}.json 이 없습니다.`);
  console.error('먼저 실행하세요:  npm run synth-city   또는   npm run fetch-city');
  process.exit(1);
}

const items: Item[] = [];
for (const s of generateWorld(1337)) items.push({ size: s.size, source: 'street', label: s.label });
for (const b of city.buildings) {
  // 게임이 보는 높이와 같아야 한다. 원본 높이로 재면 도구가 다른 도시를 잰다.
  const e = extentOf(b.outline, displayHeight(b));
  // City가 숨기는 건물은 사다리에서도 빼야 한다. 한쪽만 숨기면 도구가 거짓말을 한다 —
  // 게임엔 없는 건물을 세어놓고 "이 구간은 채워져 있다"고 말하게 된다.
  if (coveredByLandmark(e.cx, e.cz, e.size, city.landmarks)) continue;
  items.push({ size: e.size, source: 'building', label: b.name ?? b.kind });
}
for (const l of city.landmarks) {
  if (!l.edible) continue;
  items.push({
    size: Math.max(l.footprint[0], l.footprint[1], l.height),
    source: 'landmark', label: l.name,
  });
}

items.sort((a, b) => a.size - b.size);
const smallest = items[0]!.size;
const biggest = items[items.length - 1]!.size;
const octaves = Math.ceil(Math.log2(biggest / smallest));

const f = (m: number) => m < 1 ? `${(m * 100).toFixed(0)}cm` : `${m.toFixed(0)}m`;

console.log(`\n${city.name} — 물체 ${items.length}개, ${f(smallest)} ~ ${f(biggest)} (${octaves} 옥타브)\n`);
console.log('  구간                길거리  건물  랜드마크        분포');
console.log('  ' + '─'.repeat(62));

/**
 * 한 옥타브를 넘어가려면 몇 개가 필요한가.
 *
 * 부피 기준으로 두 배가 되려면 growth 배율을 감안해 대략 이만큼 먹어야 하고,
 * 흡수 가능 범위가 지름의 pickRatio 배이므로 한 옥타브 아래 것도 같이 먹힌다.
 * 정밀한 수치는 아니고 "명백히 부족한 구간"을 잡아내는 게 목적이다.
 */
const NEED = Math.ceil(7 / TUNING.growth) + 2;

const gaps: string[] = [];
let maxCount = 0;
const rows: Array<{ lo: number; hi: number; street: number; building: number; landmark: number }> = [];

for (let o = 0; o < octaves; o++) {
  const lo = smallest * 2 ** o;
  const hi = lo * 2;
  const inBand = items.filter((i) => i.size >= lo && i.size < hi);
  const row = {
    lo, hi,
    street: inBand.filter((i) => i.source === 'street').length,
    building: inBand.filter((i) => i.source === 'building').length,
    landmark: inBand.filter((i) => i.source === 'landmark').length,
  };
  rows.push(row);
  maxCount = Math.max(maxCount, inBand.length);
}

for (const r of rows) {
  const total = r.street + r.building + r.landmark;
  const bar = '█'.repeat(Math.max(total > 0 ? 1 : 0, Math.round((total / maxCount) * 22)));
  const flag = total === 0 ? '  ← 끊김' : total < NEED ? '  ← 얇음' : '';
  console.log(
    `  ${f(r.lo).padStart(5)} ~ ${f(r.hi).padEnd(6)}` +
    `${String(r.street || '').padStart(7)}${String(r.building || '').padStart(6)}` +
    `${String(r.landmark || '').padStart(9)}  ${bar}${flag}`,
  );
  if (total === 0) gaps.push(`${f(r.lo)}~${f(r.hi)} 완전히 비어 있음`);
  else if (total < NEED) gaps.push(`${f(r.lo)}~${f(r.hi)} ${total}개뿐 (권장 ${NEED}개 이상)`);
}

console.log('');
if (gaps.length === 0) {
  console.log(`  사다리 이상 없음. 옥타브당 최소 ${NEED}개 확보.`);
} else {
  console.log(`  구멍 ${gaps.length}곳:`);
  for (const g of gaps) console.log(`    · ${g}`);
  console.log('\n  메우는 방법:');
  console.log('    · 길거리 구간이면  generation.ts 의 sizeMax / count 조정');
  console.log('    · 중간 구간이면    실제 건물이 원래 없는 것 — 반경을 넓히거나 다른 동네');
  console.log('    · 상단이면         city.<slug>.json 의 landmarks 에 손으로 추가');
}

// 절차 생성 상한과 건물 하한이 만나는 지점 점검 — 두 층이 이어져야 한다
const streetMax = Math.max(...items.filter((i) => i.source === 'street').map((i) => i.size));
const buildingMin = Math.min(...items.filter((i) => i.source === 'building').map((i) => i.size));
console.log(`\n  이음매: 길거리 최대 ${f(streetMax)}  →  건물 최소 ${f(buildingMin)}`);
if (buildingMin > streetMax * 2) {
  console.log(`  ⚠ 두 층 사이가 벌어져 있습니다. generation.ts 의 sizeMax 를 ${f(buildingMin / 1.5)} 근처로 올리세요.`);
} else {
  console.log('  두 층이 이어집니다.');
}
console.log(`\n  최대 흡수 가능 크기 = 지름 × ${TUNING.pickRatio}`);
console.log(`  → ${f(biggest)} 짜리를 먹으려면 지름 ${f(biggest / TUNING.pickRatio)} 필요\n`);
