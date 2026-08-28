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
import { buildWorldStage } from '../src/world/stage.world';
import { extentOf } from '../src/world/cityData';
import { STAGES, type StageArea } from '../src/game/Stage';

/**
 * 기본 스테이지의 방 배치. **게임과 같은 월드를 재야 한다** —
 * 도넛 공식으로 재면 지금은 존재하지도 않는 월드의 곡선을 보고 튜닝하게 된다.
 *
 * `--donut` 을 주면 예전처럼 경계 없는 평지를 잰다 (OSM 도시 경로 비교용).
 */
// `--donut`: 경계 없는 평지 (OSM 도시 경로 비교용)
// `--living`: 「별을 만들어라 1」의 세계 = 거실 한 칸. **star1이 클리어 가능한지는
//             여기서만 드러난다** — 거실 물건만으로 5cm → 10cm가 되어야 한다.
/** 이 실행이 재는 구역. `curve` 는 **이 구역을 쓰는 판만** 판정한다. */
const AREA: StageArea = process.argv.includes('--town') ? 'town'
  : process.argv.includes('--world') ? 'world'
  : process.argv.includes('--living') ? 'living'
  : 'house';
const STAGE = AREA === 'town' ? buildTownStage()
  : AREA === 'world' ? buildWorldStage()
  : buildHouseStage(AREA);
// **자리(spots)도 배치에 들어간다.** 게임이 `[...rooms, ...spots]` 로 물건을 까므로
// 도구가 방만 보면 자리에 모인 물건을 통째로 빠뜨린 월드를 재게 된다.
// `gateOf()` 도 이 배열을 순회하므로 자리의 openAt 이 자동으로 반영된다.
const PLACE = process.argv.includes('--donut') ? undefined : STAGE.placement;
const ROOMS = PLACE ? [...PLACE.rooms, ...(PLACE.spots ?? [])] : undefined;

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
/**
 * `--probe=시작:목표,…` — **아직 `STAGES` 에 없는 판을 미리 재본다.**
 *
 * 맵을 먼저 만들고 규칙을 나중에 붙이는 순서라, 규칙이 붙기 전에 그 맵이
 * 목표 크기까지 가는지 알아야 한다. 붙인 뒤엔 이 플래그가 필요 없다.
 */
const PROBES: Array<[number, number]> = (
  process.argv.find((a) => a.startsWith('--probe='))?.slice(8) ?? ''
).split(',').filter(Boolean).map((p) => {
  const [start, target] = p.split(':').map(Number);
  return [start!, target!] as [number, number];
});

/** 라벨 표도 스테이지가 갖는다 — 동네에 밥솥이 나오면 사다리 이름이 거짓말이 된다 */
const LABELS = process.argv.includes('--donut') ? undefined : STAGE.placement?.labels;

interface Sample { t: number; diameter: number; eaten: number }

/**
 * 물체 하나 + **그게 놓인 구역이 열리는 지름**.
 *
 * 시뮬이 게이트를 안 보면 아직 잠긴 방 물건까지 먹는다. 동네에 바깥 세 구역
 * (4·6·8m에 열린다)이 생기고 나서 이게 치명적이 됐다 — 별 3(50cm)이 야구장
 * 물건을 먹어서 곡선이 좋아진 것처럼 보인다. **게임에서는 못 먹는 것들이다.**
 *
 * 공은 줄지 않으므로 "한 번이라도 이 크기에 닿았나"는 곧 "지금 이 크기인가"다.
 */
interface Item { s: ObjectSpec; gate: number }

/** 물체가 놓인 구역의 개방 지름. 구역 밖이면 0 — 처음부터 열려 있다. */
function gateOf(x: number, z: number): number {
  if (!ROOMS) return 0;
  for (const r of ROOMS) {
    const [a, b, c, d] = r.rect;
    if (x >= a && x <= c && z >= b && z <= d) return r.openAt;
  }
  return 0;
}

const withGates = (specs: ObjectSpec[]): Item[] =>
  specs.map((s) => ({ s, gate: gateOf(s.x, s.z) }));

interface Result {
  samples: Sample[];
  finalDiameter: number;
  eaten: number;
  total: number;
  stalledAt: number | null;
}

function simulate(items: Item[], startRadius = TUNING.startRadius): Result {
  const alive = items.map((it) => ({ ...it, dead: false }));
  let px = 0, pz = 0;
  let radius = startRadius;
  let volume = volumeFromRadius(radius);
  let t = 0;
  let eaten = 0;
  const samples: Sample[] = [{ t: 0, diameter: radius * 2, eaten: 0 }];

  const eat = (o: ObjectSpec) => {
    volume += o.volume * TUNING.growth;
    radius = radiusFromVolume(volume);
    eaten++;
  };

  for (let guard = 0; guard < items.length + 10; guard++) {
    // 1) 가장 가까운 흡수 가능 물체
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < alive.length; i++) {
      const a = alive[i]!;
      if (a.dead || a.gate > radius * 2 || !canAbsorb(radius, a.s.size)) continue;
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
      if (a.dead || a.gate > radius * 2) continue;
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
    total: items.length,
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
  const specs = withGates([...generateWorld(1337, overrides, undefined, ROOMS, LABELS), ...buildingSpecs()]);
  /**
   * **이 구역을 쓰는 판만 본다.**
   * 거실 전용 월드(최대 28cm)에서 별 4(1m)를 재면 당연히 "도달 실패"가 나온다 —
   * 그 맵에 없는 판이라 실패가 아니라 무의미한 숫자다.
   * `--donut` 은 스테이지가 없는 비교용 월드라 전부 찍는다.
   */
  const judged = process.argv.includes('--donut')
    ? STAGES
    : STAGES.filter((x) => x.area === AREA);
  /**
   * **시작 크기가 다르면 곡선도 다르다.** 같은 동네 맵이라도 3·5번은 5cm에서,
   * 8번은 10cm에서 시작한다. 한 번만 돌려서 셋을 다 판정하면 8번 숫자가 거짓말이 된다.
   * 주 곡선은 그 구역에서 **가장 작은 시작값**(제일 긴 경로)으로 그린다.
   */
  const starts = [...new Set(judged.map((x) => x.start))].sort((a, b) => a - b);
  const baseStart = (starts[0] ?? TUNING.startRadius * 2) / 2;
  const r = simulate(specs, baseStart);
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
  const byStart = new Map<number, Result>();
  for (const start of starts) {
    byStart.set(start, start / 2 === baseStart ? r : simulate(specs, start / 2));
  }
  for (const stage of judged) {
    const run = byStart.get(stage.start) ?? r;
    const hit = run.samples.find((x) => x.diameter >= stage.target);
    const limit = stage.limit > 0 ? `${stage.limit}초` : '무제한';
    console.log(hit
      ? `  ${stage.name}: ${fmt(stage.target)} 도달 ${hit.t.toFixed(0)}초 / 제한 ${limit}`
      + (starts.length > 1 ? ` (시작 ${fmt(stage.start)})` : '')
      + (stage.limit > 0 && hit.t > stage.limit ? '  ⚠ 제한 초과' : '')
      : `  ${stage.name}: ${fmt(stage.target)} **도달 실패**`);
  }
  for (const [start, target] of PROBES) {
    const run = simulate(specs, start / 2);
    const hit = run.samples.find((x) => x.diameter >= target);
    console.log(hit
      ? `  [탐침] 시작 ${fmt(start)} → ${fmt(target)} 도달 ${hit.t.toFixed(0)}초`
        + ` (실플레이 ×3 ≈ ${(hit.t * 3).toFixed(0)}초)`
      : `  [탐침] 시작 ${fmt(start)} → ${fmt(target)} **도달 실패** (최종 ${fmt(run.finalDiameter)})`);
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
  const specs = withGates([...generateWorld(1337, {}, undefined, ROOMS, LABELS), ...buildingSpecs()]);
  const r = simulate(specs);
  console.log('\nt,diameter,eaten');
  for (const s of r.samples) {
    console.log(`${s.t.toFixed(3)},${s.diameter.toFixed(5)},${s.eaten}`);
  }
}
