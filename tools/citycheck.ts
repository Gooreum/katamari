/** 도시 렌더러 검증: 청크 구성 / 지오메트리 / 드로우콜 (헤드리스) */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extentOf, type CityData } from '../src/world/cityData';

const city: CityData = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/world/city.jamsil.json'), 'utf8'));

function analyze(CHUNK: number) {
  const chunks = new Map<number, number>();
  for (const b of city.buildings) {
    const e = extentOf(b.outline, b.height);
    const key = ((Math.floor(e.cx / CHUNK) + 512) << 10) | (Math.floor(e.cz / CHUNK) + 512);
    chunks.set(key, (chunks.get(key) ?? 0) + 1);
  }
  const counts = [...chunks.values()].sort((a, b) => b - a);
  return {
    draws: chunks.size,
    worst: counts[0]!,
    median: counts[(counts.length / 2) | 0]!,
  };
}

console.log(`건물 ${city.buildings.length}채\n`);
console.log('청크(m)  드로우콜  청크당 최대  중앙값');
for (const c of [120, 180, 260, 360, 500, 700]) {
  const r = analyze(c);
  console.log(`${String(c).padStart(6)}  ${String(r.draws).padStart(8)}  ${String(r.worst).padStart(10)}  ${String(r.median).padStart(6)}`);
}
let maxSize = 0, biggest = '';
for (const b of city.buildings) {
  const e = extentOf(b.outline, b.height);
  if (e.size > maxSize) { maxSize = e.size; biggest = b.name ?? b.kind; }
}
console.log(`\n최대 물체: ${biggest} ${maxSize.toFixed(0)}m`);

/**
 * 흡수 1회 = 그 청크 재빌드 1회 = 그 프레임의 멈춤.
 *
 * 예전에는 "재빌드 비용 = 청크당 건물 수"였다 — 매번 전부 다시 압출했기 때문이다.
 * 지금은 압출 결과를 캐시하므로 병합 비용만 남는다. 그래도 청크가 커지면
 * 병합량도 늘어나므로 실측으로 확인한다.
 */
const g = globalThis as unknown as Record<string, unknown>;
g['document'] = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect() {} }) }) };
g['window'] = {}; g['self'] = g;

const { City } = await import('../src/world/City');

/** City의 내부를 들여다본다 — 측정 도구라 private에 접근한다. */
interface CityInternals {
  chunkMembers: Map<number, number[]>;
  rebuild(key: number): void;
}

const built = new City(city) as unknown as CityInternals;
const keys = [...built.chunkMembers.keys()]
  .sort((a, b) => built.chunkMembers.get(b)!.length - built.chunkMembers.get(a)!.length);

const FRAME_MS = 16.7;
console.log('\n흡수 1회당 청크 재빌드 (= 그 프레임의 멈춤)');
console.log('  청크건물수    재빌드ms');
for (const key of keys.slice(0, 5)) {
  const n = built.chunkMembers.get(key)!.length;
  built.rebuild(key);                       // 워밍업 — 캐시를 채운다
  const REPS = 20;
  const t = performance.now();
  for (let i = 0; i < REPS; i++) built.rebuild(key);
  const ms = (performance.now() - t) / REPS;
  const flag = ms > FRAME_MS ? `  ← 60fps 한 프레임(${FRAME_MS}ms) 초과` : '';
  console.log(`  ${String(n).padStart(8)}  ${ms.toFixed(2).padStart(10)}${flag}`);
}
