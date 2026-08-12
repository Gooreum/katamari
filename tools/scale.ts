/** 실제 지형 스케일에서 성장 곡선이 성립하는지 검증 */
import { generateWorld, GENERATION, type GenerationParams } from '../src/world/generation';
import { TUNING, canAbsorb, radiusFromVolume, speedAt, volumeFromRadius } from '../src/game/tuning';

function sim(ov: Partial<GenerationParams>) {
  const specs = generateWorld(1337, ov);
  const alive = specs.map(s => ({ s, dead: false }));
  let px = 0, pz = 0, radius = TUNING.startRadius;
  let volume = volumeFromRadius(radius), t = 0, eaten = 0;
  const samples = [{ t: 0, d: radius * 2 }];
  for (let g = 0; g < specs.length + 10; g++) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < alive.length; i++) { const a = alive[i]!; if (a.dead || !canAbsorb(radius, a.s.size)) continue;
      const d = Math.hypot(a.s.x - px, a.s.z - pz); if (d < bd) { bd = d; best = i; } }
    if (best < 0) break;
    const tg = alive[best]!.s, dx = tg.x - px, dz = tg.z - pz, len = Math.hypot(dx, dz) || 1;
    const ux = dx / len, uz = dz / len; t += len / speedAt(radius);
    const cor: { i: number; a: number }[] = [];
    for (let i = 0; i < alive.length; i++) { const a = alive[i]!; if (a.dead) continue;
      const al = (a.s.x - px) * ux + (a.s.z - pz) * uz; if (al < 0 || al > len) continue;
      if (Math.abs(-(a.s.x - px) * uz + (a.s.z - pz) * ux) <= radius) cor.push({ i, a: al }); }
    cor.sort((x, y) => x.a - y.a);
    for (const { i } of cor) { const a = alive[i]!; if (a.dead || !canAbsorb(radius, a.s.size)) continue;
      a.dead = true; volume += a.s.volume * TUNING.growth; radius = radiusFromVolume(volume); eaten++;
      samples.push({ t, d: radius * 2 }); }
    if (!alive[best]!.dead) { alive[best]!.dead = true; volume += tg.volume * TUNING.growth;
      radius = radiusFromVolume(volume); eaten++; samples.push({ t, d: radius * 2 }); }
    px = tg.x; pz = tg.z;
  }
  const dts: number[] = []; let anchor = samples[0]!;
  for (const s of samples) if (s.d >= anchor.d * 2) { dts.push(s.t - anchor.t); anchor = s; }
  const mean = dts.reduce((a, b) => a + b, 0) / (dts.length || 1);
  const cv = Math.sqrt(dts.reduce((a, b) => a + (b - mean) ** 2, 0) / (dts.length || 1)) / mean;
  const maxPlace = Math.max(...specs.map(s => Math.hypot(s.x, s.z)));
  return { d: radius * 2, t: samples.at(-1)!.t, cv, n: eaten, doublings: dts.length, world: maxPlace };
}

const f = (m: number) => m < 1 ? `${(m * 100).toFixed(0)}cm` : m < 1000 ? `${m.toFixed(0)}m` : `${(m / 1000).toFixed(2)}km`;

// 옥타브당 개수를 일정하게 유지해야 로그 균등의 전제가 지켜진다
const PER_OCTAVE = 150;
console.log('상한   개수   최종지름   시간    CV   2배  월드반경  placeMax');
for (const sizeMax of [5, 30, 100, 250, 560]) {
  const octaves = Math.log2(sizeMax / GENERATION.sizeMin);
  const count = Math.round(octaves * PER_OCTAVE);
  // 배치 반경은 크기에 맞춰 자동으로 — 안 그러면 큰 게 좁은 데 뭉쳐서 곡선이 터진다
  const placeMax = Math.ceil(GENERATION.placeCoef * sizeMax ** GENERATION.placePower);
  const r = sim({ sizeMax, count, placeMax });
  console.log(
    `${String(sizeMax).padStart(4)}m ${String(count).padStart(5)}  ${f(r.d).padStart(7)}  ` +
    `${r.t.toFixed(0).padStart(4)}s  ${r.cv.toFixed(3)}  ${String(r.doublings).padStart(2)}  ` +
    `${f(r.world).padStart(7)}  ${f(placeMax)}`);
}
