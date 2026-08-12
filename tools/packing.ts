/** 표면 패킹 검증: 겹침이 실제로 해소되는지 + 비용이 감당 가능한지 */
import { Vector3 } from 'three';
import { SurfacePacking, type Bump } from '../src/game/SurfacePacking';
import { TUNING, radiusFromVolume, volumeFromRadius } from '../src/game/tuning';
import { generateWorld } from '../src/world/generation';

function trial(sink: number, packScale: number, quiet = false) {
  const specs = generateWorld(1337).sort((a, b) => a.size - b.size);
  const packing = new SurfacePacking();
  const live: Bump[] = [];
  const riding: Bump[] = [];
  let radius = TUNING.startRadius;
  let volume = volumeFromRadius(radius);
  let worst = 0, overlaps = 0, placed = 0, peak = 0, sumLive = 0, samples = 0;
  const t0 = performance.now();

  for (const spec of specs) {
    if (spec.size > radius * 2 * TUNING.pickRatio) continue;
    volume += spec.volume * TUNING.growth;
    radius = radiusFromVolume(volume);

    const packRadius = 0.5 * spec.size * packScale;
    const surf = (pr: number) => Math.max(radius - pr * (1 - 2 * sink), pr * 0.3);
    // 표면을 타는 것들을 새 반지름에 맞춰 갱신
    for (const b of riding) {
      b.dist = surf(b.radius);
      b.ang = Math.asin(Math.min(b.radius / b.dist, 0.999));
    }
    const dist = surf(packRadius);
    const ang = Math.asin(Math.min(packRadius / dist, 0.999));

    const z = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    const dir = new Vector3(r * Math.cos(th), r * Math.sin(th), z);

    packing.resolve(dir, ang);
    const bump: Bump = { dir: dir.clone(), dist, radius: packRadius, ang, dead: false };
    packing.add(bump);
    live.push(bump);
    riding.push(bump);
    let cov = 0;
    for (const b of riding) cov += (1 - Math.cos(b.ang)) / 2;
    while (riding.length > 1 && (cov > TUNING.surfaceCoverage || riding.length > TUNING.ridePoolSize)) {
      const old = riding.shift()!;
      cov -= (1 - Math.cos(old.ang)) / 2;
    }
    placed++;

    for (const b of live) {
      if (b === bump || b.dead || b.dist + b.radius < radius) continue;
      const need = ang + b.ang;
      const act = Math.acos(Math.min(1, Math.max(-1, dir.dot(b.dir))));
      if (act < need - 1e-6) { overlaps++; worst = Math.max(worst, ((need - act) / need) * 100); }
    }
    if (placed % 20 === 0) packing.prune(radius);
    peak = Math.max(peak, packing.count);
    let vis = 0;
    for (const b of live) if (!b.dead && b.dist + b.radius >= radius) vis++;
    sumLive += vis; samples++;
  }
  const ms = performance.now() - t0;
  const avg = sumLive / samples;
  if (!quiet) console.log(
    `sink ${sink.toFixed(2)}  pack ${packScale.toFixed(2)}  ` +
    `평균 ${avg.toFixed(0).padStart(4)}개  최대 ${String(peak).padStart(4)}  ` +
    `겹침 ${String(overlaps).padStart(5)}건(최악 ${worst.toFixed(0)}%)  ` +
    `${(ms / placed * 1000).toFixed(0)}µs/개`);
  return { avg, peak, ms: ms / placed };
}

console.log(`── 점유율 상한 ${TUNING.surfaceCoverage}, 개수 상한 ${TUNING.ridePoolSize} ──`);
for (const sink of [0.25, 0.35, 0.45]) trial(sink, 0.78);
console.log('');
for (const ps of [0.6, 0.78, 0.95]) trial(0.35, ps);
