/** 스폰 지점 주변에 실제로 먹을 게 있는지 검사 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Scene } from 'three';
const g: any = globalThis;
g.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect() {} }) }) };
g.window = {}; g.self = g;

const { World } = await import('../src/world/World');
const { TUNING } = await import('../src/game/tuning');

const slug = process.argv.includes('--city') ? process.argv[process.argv.indexOf('--city') + 1]! : 'jamsil';
const city = JSON.parse(readFileSync(resolve(process.cwd(), `src/world/city.${slug}.json`), 'utf8'));
const world = new World(new Scene(), city);
const s = world.spawn;

console.log(`${city.name}`);
console.log(`  데이터 스폰: (${city.spawn.x}, ${city.spawn.z})`);
console.log(`  실제 스폰:   (${s.x.toFixed(0)}, ${s.z.toFixed(0)})`);

const startMax = TUNING.startRadius * 2 * TUNING.pickRatio;
console.log(`\n  시작 시 흡수 가능 크기: ${(startMax * 100).toFixed(1)}cm 이하`);
console.log('\n  반경    먹을 수 있는 것   전체');
for (const r of [3, 10, 30, 100]) {
  let edible = 0, all = 0;
  for (const o of world.objects) {
    const d = Math.hypot(o.pos.x - s.x, o.pos.z - s.z);
    if (d > r) continue;
    all++;
    if (o.size <= startMax) edible++;
  }
  const flag = r === 10 && edible < 3 ? '   ← 시작하자마자 먹을 게 없음' : '';
  console.log(`  ${String(r).padStart(4)}m ${String(edible).padStart(12)} ${String(all).padStart(8)}${flag}`);
}
