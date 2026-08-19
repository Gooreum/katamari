/**
 * 성장 곡선 분석기.  `npm run curve`
 *
 * 렌더 없이 "탐욕적 플레이어"를 시뮬레이션한다:
 *   가장 가까운 흡수 가능 물체로 직진하고, 경로 폭 2R 안에 있는 건 지나가며 다 먹는다.
 *
 * 완벽한 플레이 모델은 아니지만 **곡선의 모양**은 정확히 드러난다.
 * 목표는 로그 스케일에서 직선 — 즉 두 배 되는 데 걸리는 시간이 일정한 것.
 * 계단이 나오면 크기 분포에 벽이 있다는 뜻이다.
 */
import { generateWorld, GENERATION, type GenerationParams, type ObjectSpec } from '../src/world/generation';
import { TUNING, canAbsorb, radiusFromVolume, speedAt, volumeFromRadius } from '../src/game/tuning';
import { buildHouseStage } from '../src/world/stage.house';
import { buildTownStage } from '../src/world/stage.town';
import { extentOf } from '../src/world/cityData';
import { STAGES } from '../src/game/Stage';

/**
 * 기본 스테이지의 방 배치. **게임과 같은 월드를 재야 한다** —
 * 도넛 공식으로 재면 지금은 존재하지도 않는 월드의 곡선을 보고 튜닝하게 된다.
 *
 * `--donut` 을 주면 예전처럼 경계 없는 평지를 잰다 (OSM 도시 경로 비교용).
 */
// `--donut`: 경계 없는 평지 (OSM 도시 경로 비교용)
// `--living`: 「별을 만들어라 1」의 세계 = 거실 한 칸. **star1이 클리어 가능한지는
//             여기서만 드러난다** — 거실 물건만으로 5cm → 10cm가 되어야 한다.
const STAGE = process.argv.includes('--town')
  ? buildTownStage()
  : buildHouseStage(process.argv.includes('--living') ? 'living' : 'house');
const ROOMS = process.argv.includes('--donut') ? undefined : STAGE.placement?.rooms;

/**
 * **건물도 먹을 수 있는 물체다.**
 *
 * 예전에는 소품만 굴렸다. 집 맵은 건물이 벽·문뿐(먹는 게 0채)이라 티가 안 났는데,
 * 동네가 생기고 나서 거리 집기 12채를 넣어도 곡선이 1초도 안 움직여서 드러났다 —
 * `Game.resolveCity()`는 건물을 먹는데 이 도구는 안 세고 있었다.
 * 도구가 게임과 다른 월드를 재면 그 숫자는 거짓말이다.
 *
 * 벽·문은 뺀다. 먹으라고 있는 게 아니다 (`ladder`도 같은 규칙).
 */
function buildingSpecs(): ObjectSpec[] {
  if (process.argv.includes('--donut')) return [];
  return STAGE.buildings
    .filter((b) => b.kind !== 'wall' && b.kind !== 'door')
    .map((b) => {
      const e = extentOf(b.outline, b.height);
      return {
        x: e.cx, z: e.cz, size: e.size, volume: e.volume,
        // 아래는 시뮬이 안 쓰는 값이다. 스키마를 맞추려고 채운다.
        sx: e.width, sy: b.height, sz: e.depth,
        rotY: 0, geo: 0, color: 0, label: b.name ?? '건물',
      } as ObjectSpec;
    });
}
/** 라벨 표도 스테이지가 갖는다 — 동네에 밥솥이 나오면 사다리 이름이 거짓말이 된다 */
const LABELS = process.argv.includes('--donut') ? undefined : STAGE.placement?.labels;

interface Sample { t: number; diameter: number; eaten: number }

interface Result {
  samples: Sample[];
  finalDiameter: number;
  eaten: number;
  total: number;
  stalledAt: number | null;
}

function simulate(specs: ObjectSpec[]): Result {
  const alive = specs.map((s) => ({ s, dead: false }));
  let px = 0, pz = 0;
  let radius = TUNING.startRadius;
  let volume = volumeFromRadius(radius);
  let t = 0;
  let eaten = 0;
  const samples: Sample[] = [{ t: 0, diameter: radius * 2, eaten: 0 }];

  const eat = (o: ObjectSpec) => {
    volume += o.volume * TUNING.growth;
    radius = radiusFromVolume(volume);
    eaten++;
  };

  for (let guard = 0; guard < specs.length + 10; guard++) {
    // 1) 가장 가까운 흡수 가능 물체
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < alive.length; i++) {
      const a = alive[i]!;
      if (a.dead || !canAbsorb(radius, a.s.size)) continue;
      const d = Math.hypot(a.s.x - px, a.s.z - pz);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    if (best < 0) break;   // 먹을 게 없다 = 막힘

    const target = alive[best]!.s;
    const dx = target.x - px, dz = target.z - pz;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len, uz = dz / len;

    // 2) 이동 시간 (평균 속도로 근사 — 이동 중에도 커지므로)
    t += len / speedAt(radius);

    // 3) 경로 회랑(폭 2R) 안의 것들을 진행 순서대로 흡수
    const corridor: Array<{ i: number; along: number }> = [];
    for (let i = 0; i < alive.length; i++) {
      const a = alive[i]!;
      if (a.dead) continue;
      const along = (a.s.x - px) * ux + (a.s.z - pz) * uz;
      if (along < 0 || along > len) continue;
      const perp = Math.abs(-(a.s.x - px) * uz + (a.s.z - pz) * ux);
      if (perp <= radius) corridor.push({ i, along });
    }
    corridor.sort((a, b) => a.along - b.along);

    for (const { i } of corridor) {
      const a = alive[i]!;
      if (a.dead) continue;
      if (!canAbsorb(radius, a.s.size)) continue;   // 커지는 중에 조건이 바뀔 수 있다
      a.dead = true;
      eat(a.s);
      samples.push({ t, diameter: radius * 2, eaten });
    }

    if (!alive[best]!.dead) {
      alive[best]!.dead = true;
      eat(target);
      samples.push({ t, diameter: radius * 2, eaten });
    }
    px = target.x; pz = target.z;
  }

  const remaining = alive.filter((a) => !a.dead);
  const smallestLeft = remaining.length
    ? Math.min(...remaining.map((a) => a.s.size))
    : null;

  return {
    samples,
    finalDiameter: radius * 2,
    eaten,
    total: specs.length,
    stalledAt: remaining.length > 0 ? smallestLeft : null,
  };
}

/** 지름이 두 배 될 때마다 걸린 시간/개수 — 이게 진짜 봐야 할 표다. */
function doublings(samples: Sample[]): Array<{ from: number; to: number; dt: number; count: number }> {
  const rows: Array<{ from: number; to: number; dt: number; count: number }> = [];
  let anchor = samples[0]!;
  for (const s of samples) {
    if (s.diameter >= anchor.diameter * 2) {
      rows.push({
        from: anchor.diameter,
        to: s.diameter,
        dt: s.t - anchor.t,
        count: s.eaten - anchor.eaten,
      });
      anchor = s;
    }
  }
  return rows;
}

function fmt(m: number): string {
  return m < 1 ? `${(m * 100).toFixed(1)}cm` : `${m.toFixed(2)}m`;
}

function bar(value: number, max: number, width = 26): string {
  return '█'.repeat(Math.max(1, Math.round((value / max) * width)));
}

function report(label: string, overrides: Partial<GenerationParams> = {}): Result {
  const specs = [...generateWorld(1337, overrides, undefined, ROOMS, LABELS), ...buildingSpecs()];
  const r = simulate(specs);
  const rows = doublings(r.samples);
  const maxDt = Math.max(...rows.map((x) => x.dt), 1);

  console.log(`\n${'═'.repeat(64)}\n${label}\n${'═'.repeat(64)}`);
  console.log('  구간              소요        개수   시간분포');
  for (const row of rows) {
    console.log(
      `  ${fmt(row.from).padStart(7)} → ${fmt(row.to).padEnd(8)}` +
      `${row.dt.toFixed(1).padStart(6)}s  ${String(row.count).padStart(5)}   ${bar(row.dt, maxDt)}`,
    );
  }

  const dts = rows.map((x) => x.dt);
  const mean = dts.reduce((a, b) => a + b, 0) / (dts.length || 1);
  const cv = Math.sqrt(dts.reduce((a, b) => a + (b - mean) ** 2, 0) / (dts.length || 1)) / mean;

  console.log(`\n  최종 ${fmt(r.finalDiameter)} · ${r.eaten}/${r.total}개 · ${r.samples.at(-1)!.t.toFixed(0)}초`);
  // **스테이지 목표에 언제 닿는가.** 곡선이 매끄러워도 3분 안에 10cm를 못 만들면
  // 그 스테이지는 클리어가 불가능하다. CV보다 이게 먼저 봐야 할 숫자다.
  for (const stage of STAGES) {
    const hit = r.samples.find((x) => x.diameter >= stage.target);
    const limit = stage.limit > 0 ? `${stage.limit}초` : '무제한';
    console.log(hit
      ? `  ${stage.name}: ${fmt(stage.target)} 도달 ${hit.t.toFixed(0)}초 / 제한 ${limit}`
      + (stage.limit > 0 && hit.t > stage.limit ? '  ⚠ 제한 초과' : '')
      : `  ${stage.name}: ${fmt(stage.target)} **도달 실패**`);
  }
  console.log(`  두 배 소요시간 편차(CV): ${cv.toFixed(3)}   ← 낮을수록 곡선이 매끄럽다`);
  if (r.stalledAt !== null) {
    console.log(`  ⚠ 막힘: ${fmt(r.stalledAt)} 짜리를 못 먹고 멈춤`);
  }
  return r;
}

// ─── 실행 ───────────────────────────────────────────────────
report('현재 설정');

if (process.argv.includes('--sweep')) {
  for (const placePower of [0.7, 0.85, 1.0, 1.15]) {
    report(`placePower = ${placePower}`, { placePower });
  }
  for (const growth of [2.0, 3.0, 4.5]) {
    const before = TUNING.growth;
    TUNING.growth = growth;
    report(`growth = ${growth}`);
    TUNING.growth = before;
  }
}

if (process.argv.includes('--csv')) {
  const specs = [...generateWorld(1337, {}, undefined, ROOMS, LABELS), ...buildingSpecs()];
  const r = simulate(specs);
  console.log('\nt,diameter,eaten');
  for (const s of r.samples) {
    console.log(`${s.t.toFixed(3)},${s.diameter.toFixed(5)},${s.eaten}`);
  }
}
