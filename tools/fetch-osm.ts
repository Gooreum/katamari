/**
 * 실제 지형 받아오기.  `npm run fetch-city -- --preset jamsil`
 *
 * OpenStreetMap Overpass API에서 건물 외곽선·수역·랜드마크를 받아
 * src/world/city.<slug>.json 으로 저장한다.
 *
 * Overpass는 공용 무료 서버라 예의를 지켜야 한다:
 *   - 한 번 받으면 파일로 저장해두고 반복 호출하지 말 것
 *   - 반경을 필요 이상으로 키우지 말 것 (2km면 이미 꽤 무겁다)
 *   - 429가 뜨면 몇 분 기다릴 것
 *
 * 결과 파일은 커밋해도 된다. OSM 데이터는 ODbL이라 출처만 밝히면 된다 —
 * README와 게임 크레딧에 "© OpenStreetMap contributors" 를 남길 것.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  toLocalMeters,
  type BuildingKind, type CityBuilding, type CityData,
  type CityLandmark, type CityRoad, type CityWater, type RoadKind,
} from '../src/world/cityData';

/**
 * Overpass 미러. 위에서부터 순서대로 시도한다.
 *
 * 순서는 감이 아니라 실측이다 (2026-08-11, 서울 롯데타워 300m 반경 건물 수):
 *   overpass-api.de       20채  — 정상
 *   overpass.kumi.systems   —   — TCP는 붙는데 25초간 무응답
 *   overpass.osm.ch        0채  — 스위스 전용. 취리히는 241채인데 서울은 0채를
 *                                 HTTP 200으로 준다. 조용히 빈 도시를 만드는 함정이라
 *                                 아래 빈 결과 가드가 반드시 필요하다.
 */
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
] as const;

/** 미러당 상한. Overpass 자체 timeout(180s)보다 조금 길게 잡는다. */
const MIRROR_TIMEOUT_MS = 200_000;

interface OverpassResult { elements: OverpassElement[] }

/**
 * 미러 하나에 요청한다. 실패하면 throw — 호출자가 다음 미러로 넘어간다.
 *
 * 응답이 아예 안 오는 미러(kumi)가 있어서 타임아웃이 필수다.
 * 이게 없으면 폴백이 있어도 첫 미러에서 영원히 매달린다.
 */
async function requestMirror(endpoint: string, body: string): Promise<OverpassResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MIRROR_TIMEOUT_MS);
  try {
    // Overpass는 본문을 data= 로 폼 인코딩해서 받는다.
    // text/plain 으로 보내면 406(Not Acceptable)을 뱉는다 — 429와 무관하므로
    // 아무리 기다려도 안 된다. User-Agent도 필요하다. 기본 UA는 자주 차단된다.
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'katamari-web/0.1 (hobby project)',
      },
      body,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const hint = res.status === 429 || res.status === 504 ? ' (서버 혼잡)' : '';
      throw new Error(`HTTP ${res.status}${hint}`);
    }
    return (await res.json()) as OverpassResult;
  } finally {
    clearTimeout(timer);
  }
}

const PRESETS = {
  jamsil: {
    name: '잠실', slug: 'jamsil',
    origin: { lat: 37.5125, lon: 127.1025 },   // 롯데월드타워
    // 2800m — 잠실종합운동장이 원점(롯데월드타워) 서쪽 2.6km에 있다.
    // 1600m으로 자르면 사다리 꼭대기의 260m급 랜드마크가 실제로는 지역 밖이라
    // "PD가 상상한 서울"이 되어버린다. 굴려서 반박할 수 있어야 한다.
    radius: 2800, spawn: { x: -180, z: 260 },  // 석촌호수 서호 산책로
  },
  gangnam: {
    name: '강남', slug: 'gangnam',
    origin: { lat: 37.4979, lon: 127.0276 },   // 강남역
    radius: 1300, spawn: { x: 40, z: 120 },
  },
  seongsu: {
    name: '성수', slug: 'seongsu',
    origin: { lat: 37.5445, lon: 127.0557 },   // 성수동 카페거리
    radius: 1200, spawn: { x: 0, z: 60 },
  },
  hongdae: {
    name: '홍대', slug: 'hongdae',
    origin: { lat: 37.5568, lon: 126.9236 },   // 홍대입구역
    radius: 1200, spawn: { x: 60, z: 80 },
  },
} as const;
type PresetName = keyof typeof PRESETS;

// ─── OSM 태그 → 게임 분류 ─────────────────────────────────────

/** 층수 → 미터. 한국 주거 기준 층고 약 2.9m, 상업은 좀 더 높다. */
function heightFromTags(tags: Record<string, string>): number {
  const direct = parseFloat(tags['height'] ?? '');
  if (Number.isFinite(direct) && direct > 0) return direct;

  const levels = parseFloat(tags['building:levels'] ?? '');
  if (Number.isFinite(levels) && levels > 0) {
    const perLevel = tags['building'] === 'apartments' ? 2.9 : 3.6;
    return levels * perLevel + 1.2;
  }
  // 태그가 없으면 종류로 추정한다. OSM 한국 데이터는 높이 누락이 흔하다.
  const b = tags['building'] ?? 'yes';
  if (b === 'apartments' || b === 'residential') return 45;
  if (b === 'house' || b === 'detached') return 7;
  if (b === 'retail' || b === 'kiosk') return 5;
  if (b === 'school' || b === 'public' || b === 'civic') return 16;
  if (b === 'commercial' || b === 'office') return 24;
  return 12;
}

function kindFromTags(tags: Record<string, string>): BuildingKind {
  const b = tags['building'] ?? '';
  if (b === 'apartments') return 'apartment';
  if (b === 'house' || b === 'detached' || b === 'residential') return 'lowrise';
  if (b === 'retail' || b === 'kiosk' || b === 'supermarket') return 'retail';
  if (['school', 'university', 'hospital', 'public', 'civic', 'sports_hall', 'stadium'].includes(b)) return 'civic';
  return 'commercial';
}

/**
 * 지표에 그릴 highway 값만. proposed/construction/raceway/bus_guideway 등은 뺀다 —
 * 아직 없는 도로나 게임과 무관한 것을 그리면 지도에 유령이 생긴다.
 */
const ROAD_RE = '^(motorway|trunk|primary|secondary|tertiary|residential|unclassified'
  + '|living_street|service|footway|pedestrian|path|cycleway|steps)$';

export function query(lat: number, lon: number, radius: number, roadsOnly: boolean): string {
  const around = `(around:${radius},${lat},${lon})`;
  const roads = `  way["highway"~"${ROAD_RE}"]${around};`;
  // 도로만 받을 때는 건물을 아예 요청하지 않는다. 건물이 바뀌면 ladder/spawncheck
  // 숫자가 흔들려서 이전 측정과 비교 자체가 불가능해진다.
  if (roadsOnly) return `[out:json][timeout:180];\n(\n${roads}\n);\nout geom;`;
  // way와 relation 모두 필요하다. 큰 건물은 multipolygon relation인 경우가 많다.
  return `[out:json][timeout:180];
(
  way["building"]${around};
  relation["building"]${around};
  way["natural"="water"]${around};
  way["waterway"="riverbank"]${around};
  relation["natural"="water"]${around};
${roads}
);
out geom;`;
}

const ROAD_KIND: Record<string, RoadKind> = {
  motorway: 'arterial', trunk: 'arterial', primary: 'arterial', secondary: 'arterial',
  tertiary: 'street', residential: 'street', unclassified: 'street', living_street: 'street',
  service: 'alley',
  footway: 'walk', pedestrian: 'walk', path: 'walk', cycleway: 'walk', steps: 'walk',
};

/**
 * 종류별 기본 폭(m). kind가 아니라 **highway 값**으로 잡는다 —
 * 보행자 광장(pedestrian 8m)과 인도(footway 2.5m)는 같은 'walk' 인데 3배 차이난다.
 */
const DEFAULT_WIDTH: Record<string, number> = {
  motorway: 24, trunk: 22, primary: 20, secondary: 16,
  tertiary: 12, residential: 8, unclassified: 8, living_street: 6,
  service: 4.5,
  pedestrian: 8, footway: 2.5, path: 2, cycleway: 2.5, steps: 2,
};

export function roadWidth(tags: Record<string, string>, hw: string): number {
  // width는 "3.5", "2 m", "wide" 등 뭐든 들어온다. 비현실적인 값은 태그 오류로 보고 버린다.
  const direct = parseFloat(tags['width'] ?? '');
  if (Number.isFinite(direct) && direct > 0.5 && direct < 60) return direct;
  const lanes = parseFloat(tags['lanes'] ?? '');
  if (Number.isFinite(lanes) && lanes > 0) return lanes * 3.25 + 1.5;
  return DEFAULT_WIDTH[hw] ?? 6;
}

interface OverpassElement {
  type: 'way' | 'relation' | 'node';
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
  members?: Array<{ role: string; geometry?: Array<{ lat: number; lon: number }> }>;
}

function ringOf(el: OverpassElement): Array<{ lat: number; lon: number }> | null {
  if (el.geometry && el.geometry.length >= 3) return el.geometry;
  // relation은 outer 멤버 중 가장 긴 것을 대표 외곽선으로 쓴다.
  // 구멍(inner)은 무시한다 — 게임에서는 어차피 덩어리로 취급한다.
  const outers = (el.members ?? []).filter((m) => m.role === 'outer' && m.geometry);
  if (outers.length === 0) return null;
  return outers.sort((a, b) => (b.geometry!.length - a.geometry!.length))[0]!.geometry!;
}

/**
 * 정점 솎아내기 (Douglas-Peucker 단순화 대신 각도 기반).
 * OSM 건물은 정점이 수십 개인 경우가 많은데 게임에서는 4~12개면 충분하다.
 */
function simplify(points: Array<[number, number]>, tolerance = 1.2): Array<[number, number]> {
  if (points.length <= 4) return points;
  const out: Array<[number, number]> = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1]!;
    const cur = points[i]!;
    if (Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) >= tolerance) out.push(cur);
  }
  const last = points[points.length - 1]!;
  const first = out[0]!;
  if (Math.hypot(last[0] - first[0], last[1] - first[1]) >= tolerance) out.push(last);
  return out;
}

/**
 * 폴리라인 솎아내기. 도로용 — 닫힌 링용 `simplify()` 와 **끝점 처리가 다르다.**
 *
 * `simplify()` 는 마지막 점을 첫 점과 비교해서 버릴지 정한다. 링에서는 맞는 판단이지만
 * 폴리라인에서는 틀리다 — 제자리로 돌아오는 순환 산책로의 끝점이 통째로 사라져서
 * 길이 열린 채로 남는다. 여기서는 끝점을 무조건 보존한다.
 *
 * tolerance가 건물(1.2m)보다 큰 이유: 도로는 폭이 2~24m라 2.5m 굴곡은 어차피 안 보이고,
 * 잠실 반경에 4,600개가 들어오므로 파일 크기를 눌러야 한다.
 */
export function simplifyLine(points: Array<[number, number]>, tolerance = 2.5): Array<[number, number]> {
  if (points.length <= 2) return points;
  const out: Array<[number, number]> = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1]!;
    const cur = points[i]!;
    if (Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) >= tolerance) out.push(cur);
  }
  out.push(points[points.length - 1]!);
  return out;
}

/**
 * 원 경계와의 교점. `a`(안) → `b`(밖) 선분에서 |p| = r 인 지점.
 * 근이 둘이면 a에서 가까운 쪽을 쓴다.
 */
function circleHit(
  a: readonly [number, number], b: readonly [number, number], r: number,
): [number, number] {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const A = dx * dx + dz * dz;
  const B = 2 * (a[0] * dx + a[1] * dz);
  const C = a[0] * a[0] + a[1] * a[1] - r * r;
  const disc = B * B - 4 * A * C;
  if (A === 0 || disc < 0) return [a[0], a[1]];
  const s = Math.sqrt(disc);
  const t1 = (-B - s) / (2 * A);
  const t2 = (-B + s) / (2 * A);
  const t = t1 >= 0 && t1 <= 1 ? t1 : t2;
  const c = Math.min(Math.max(t, 0), 1);
  return [a[0] + dx * c, a[1] + dz * c];
}

/**
 * 도로를 도시 반경 안으로 자른다. 나갔다 들어오면 여러 조각이 된다.
 *
 * **왜 필요한가:** Overpass의 `around` 는 way가 조금이라도 걸치면 **통째로** 준다.
 * 한강 자전거도로 하나가 259점 10.1km짜리로 들어와서 원점 7.3km까지 뻗는다.
 * 그런데 지면 평면은 `radius * 2.6`, 즉 원점 기준 ±3,640m에서 끝난다 —
 * 자르지 않으면 **지면 밖 허공에 회색 띠가 떠 있게 된다.**
 * 건물도 반경 2800m에서 끝나므로 도로도 같은 자리에서 끝나는 게 맞다.
 *
 * 한계: 두 끝점이 모두 밖인데 선분이 원을 관통하는 경우(접선에 가까운 짧은 현)는
 * 버린다. 2.5m로 솎은 선분 길이(평균 수십 m)가 반경 2800m에 비해 훨씬 짧아
 * 실제로는 경계에 살짝 스치는 조각만 해당한다.
 */
function clipToRadius(
  line: Array<[number, number]>, r: number,
): Array<Array<[number, number]>> {
  const pieces: Array<Array<[number, number]>> = [];
  let cur: Array<[number, number]> = [];
  const inside = (p: readonly [number, number]) => Math.hypot(p[0], p[1]) <= r;

  for (let i = 0; i < line.length; i++) {
    const p = line[i]!;
    if (inside(p)) {
      // 밖에서 들어왔으면 경계 위의 점을 먼저 찍어야 길이 도중에 끊겨 보이지 않는다
      if (cur.length === 0 && i > 0) cur.push(circleHit(p, line[i - 1]!, r));
      cur.push(p);
    } else if (cur.length > 0) {
      cur.push(circleHit(line[i - 1]!, p, r));
      if (cur.length >= 2) pieces.push(cur);
      cur = [];
    }
  }
  if (cur.length >= 2) pieces.push(cur);
  return pieces;
}

async function main(): Promise<void> {
  const arg = process.argv.indexOf('--preset');
  const key = (arg >= 0 ? process.argv[arg + 1] : 'jamsil') as PresetName;
  const preset = PRESETS[key];
  if (!preset) {
    console.error(`알 수 없는 프리셋: ${key}. 가능: ${Object.keys(PRESETS).join(', ')}`);
    process.exit(1);
  }

  // --only roads: 도로만 받고 건물·수역은 기존 파일 것을 그대로 물려받는다.
  // 도로를 추가하겠다고 건물까지 새로 받으면 ladder/spawncheck 숫자가 흔들린다.
  const onlyArg = process.argv.indexOf('--only');
  const only = onlyArg >= 0 ? process.argv[onlyArg + 1] : undefined;
  if (only !== undefined && only !== 'roads') {
    console.error(`알 수 없는 --only 값: ${only}. 가능: roads`);
    process.exit(1);
  }
  const roadsOnly = only === 'roads';

  const out = resolve(process.cwd(), `src/world/city.${preset.slug}.json`);
  const prev: CityData | null = existsSync(out)
    ? (JSON.parse(readFileSync(out, 'utf8')) as CityData)
    : null;
  // 도로만 받는데 물려받을 파일이 없으면 건물 0채짜리 도시가 만들어진다.
  // 조용히 쓰지 말고 여기서 멈춘다.
  if (roadsOnly && !prev) {
    console.error(`--only roads 는 기존 도시 파일이 있어야 합니다: ${out}`);
    console.error('먼저 전체 수집을 실행하세요:  npm run fetch-city -- --preset ' + preset.slug);
    process.exit(1);
  }

  console.log(`${preset.name} 반경 ${preset.radius}m ${roadsOnly ? '도로만 ' : ''}요청 중... (30초~2분 걸립니다)`);
  const body = new URLSearchParams({
    data: query(preset.origin.lat, preset.origin.lon, preset.radius, roadsOnly),
  }).toString();

  let json: OverpassResult | null = null;
  let usedEndpoint = '';
  const failures: string[] = [];

  for (const endpoint of ENDPOINTS) {
    const host = new URL(endpoint).host;
    try {
      console.log(`  ${host} 시도 중...`);
      const got = await requestMirror(endpoint, body);
      // 지역 전용 미러는 범위 밖 좌표에 대해 HTTP 200 + 빈 결과를 준다.
      // (osm.ch는 취리히 241채 / 서울 0채) 이걸 성공으로 받으면
      // 건물 0채짜리 도시 파일을 조용히 써버린다.
      //
      // 무엇을 세는지는 요청한 것에 맞춰야 한다. --only roads 로는 건물을 아예
      // 요청하지 않으므로 건물 0채가 정상이다 — 건물로 세면 멀쩡한 미러를 전부 버린다.
      const want = roadsOnly ? '도로' : '건물';
      const hitCount = got.elements.filter(
        (el) => el.tags?.[roadsOnly ? 'highway' : 'building'],
      ).length;
      if (hitCount === 0) {
        failures.push(`${host}: ${want} 0개 — 이 지역을 담고 있지 않은 미러로 보임`);
        console.log(`  ${host} ${want} 0개 → 다음 미러로`);
        continue;
      }
      json = got;
      usedEndpoint = host;
      break;
    } catch (err) {
      const msg = err instanceof Error
        ? (err.name === 'AbortError' ? `${MIRROR_TIMEOUT_MS / 1000}초 내 응답 없음` : err.message)
        : String(err);
      failures.push(`${host}: ${msg}`);
      console.log(`  ${host} 실패 (${msg}) → 다음 미러로`);
    }
  }

  if (!json) {
    console.error('\n모든 Overpass 미러 실패:');
    for (const f of failures) console.error(`  - ${f}`);
    console.error('\n잠시 후 다시 시도하거나, 합성 데이터로 계속하세요:  npm run synth-city');
    process.exit(1);
  }

  console.log(`\n${usedEndpoint} 에서 요소 ${json.elements.length}개 수신`);

  const buildings: CityBuilding[] = [];
  const water: CityWater[] = [];
  const roads: CityRoad[] = [];

  for (const el of json.elements) {
    const tags = el.tags ?? {};

    const hw = tags['highway'];
    if (hw && ROAD_KIND[hw]) {
      // 지하차도·지하보도는 지표에 그리면 안 된다.
      // 다리는 그린다 — 한강 위를 지나가야 하므로 렌더에서 수면 위로 올린다.
      if (tags['tunnel'] && tags['tunnel'] !== 'no') continue;
      if (parseFloat(tags['layer'] ?? '0') < 0) continue;
      // 광장처럼 면으로 매핑된 것(area=yes)은 폴리라인이 아니다.
      // 리본으로 그리면 광장 테두리만 두른 이상한 띠가 되므로 지금은 버린다.
      if (tags['area'] === 'yes') continue;

      // ringOf()는 3점 이상을 요구한다. 도로는 2점(직선 구간)이 정상이라 직접 쓴다.
      const geom = el.geometry;
      if (!geom || geom.length < 2) continue;
      const full = simplifyLine(geom.map((p) => toLocalMeters(p.lat, p.lon, preset.origin)));
      if (full.length < 2) continue;
      if (full.some(([x, z]) => !Number.isFinite(x) || !Number.isFinite(z))) continue;

      // 지면 밖으로 뻗은 부분은 버린다. 한 도로가 여러 조각이 될 수 있다.
      const kind = ROAD_KIND[hw]!;
      const width = roadWidth(tags, hw);
      for (const line of clipToRadius(full, preset.radius)) {
        roads.push({ line, kind, width });
      }
      continue;
    }

    const ring = ringOf(el);
    if (!ring) continue;

    const outline = simplify(
      ring.map((p) => toLocalMeters(p.lat, p.lon, preset.origin)),
    );
    // 단순화 후 퇴화한 것들은 버린다. ExtrudeGeometry가 NaN을 뱉는 원인이 된다.
    if (outline.length < 3) continue;
    if (outline.some(([x, z]) => !Number.isFinite(x) || !Number.isFinite(z))) continue;

    if (tags['natural'] === 'water' || tags['waterway'] === 'riverbank') {
      water.push({ outline, name: tags['name'] });
      continue;
    }
    if (!tags['building']) continue;

    const height = heightFromTags(tags);
    const name = tags['name:ko'] ?? tags['name'];
    buildings.push({ outline, height, kind: kindFromTags(tags), name });
  }

  // 사다리 꼭대기는 분포가 아니라 손배치 랜드마크다 (README 참고).
  // OSM에서 새로 받는 건 buildings/water/roads 뿐이고, 손으로 넣은 landmarks와
  // 실제로 검증된 spawn은 기존 파일에서 물려받는다. 안 그러면 재수집 한 번에
  // 롯데월드타워(555m)가 사라져 사다리 상단이 통째로 비어버린다.
  let landmarks: CityLandmark[] = [];
  let spawn = preset.spawn;
  if (prev) {
    if (prev.landmarks?.length) {
      landmarks = prev.landmarks;
      console.log(`기존 랜드마크 ${landmarks.length}개 보존`);
    }
    if (prev.spawn) {
      spawn = prev.spawn;
      console.log(`기존 spawn (${spawn.x}, ${spawn.z}) 유지`);
    }
    copyFileSync(out, `${out}.bak`);
    console.log(`기존 파일 백업 → ${out}.bak`);
  }

  // --only roads 면 건물·수역은 애초에 요청하지 않았으므로 기존 것을 그대로 둔다.
  // (roadsOnly일 때 prev가 null이 아님은 main 앞부분에서 이미 보장했다)
  const data: CityData = {
    name: preset.name,
    slug: preset.slug,
    origin: preset.origin,
    radius: preset.radius,
    spawn,
    buildings: roadsOnly ? prev!.buildings : buildings,
    water: roadsOnly ? prev!.water : water,
    landmarks,
    roads,
  };

  writeFileSync(out, JSON.stringify(data));
  console.log(`건물 ${data.buildings.length}개, 수역 ${data.water.length}개, `
    + `도로 ${roads.length}개 → ${out}`);
  console.log('다음: npm run ladder  (크기 사다리에 구멍이 없는지 확인)');
  console.log('\n데이터 출처를 반드시 표기할 것: © OpenStreetMap contributors (ODbL)');
}

// 직접 실행할 때만 네트워크를 친다.
// 이게 없으면 query/simplifyLine/roadWidth 를 테스트하려고 import 하는 순간
// Overpass에 요청이 나가고 도시 파일을 덮어쓴다.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  void main();
}
