import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry,
  Material, Mesh, MeshBasicMaterial, MeshLambertMaterial, NearestFilter, Object3D, PlaneGeometry,
  RepeatWrapping, Scene, SphereGeometry, SRGBColorSpace, Vector3,
} from 'three';
import { InstancePool } from './InstancePool';
import { SpatialHash } from './SpatialHash';
import {
  colorOf, generateWorld, geoIndexOf, GENERATION, mulberry32, PALETTE,
  type BlockedFn, type ObjectSpec,
} from './generation';
import { buildShapeGeometries, withWhiteColors } from './shapes';
import { City } from './City';
import { FLOOR_TEX, TILE_M } from './floors';
import { getPrintAtlas } from './atlas';
import type { CityData, CityRug, StageProp, StageRoom } from './cityData';

export const GROUND_SIZE = 500;

/**
 * 천장색. 벽(0xfbf0d2 회벽)보다 한 단 어둡게 — 같은 색이면 벽과 천장의 모서리가
 * 안 보여서 방이 여전히 뚜껑 없는 상자로 읽힌다.
 */
const CEILING_COLOR = 0xe0d6b8;
const CELL = 4;

/**
 * 돌아다니는 물체 하나. 「집」(`hx`, `hz`)에서 반경 `r` 안을 돈다.
 *
 * **`stepNudges` 의 흔들림과 같은 급이다** — 렌더 트랜스폼만 다시 쓰고
 * `half`·`colY` 는 안 건드린다. 다른 건 `pos` 를 실제로 옮긴다는 것뿐인데,
 * 좁은 충돌 판정이 매 프레임 `pos` 를 새로 읽으므로 그게 곧 물리다.
 */
interface Wanderer {
  readonly index: number;
  readonly hx: number;
  readonly hz: number;
  readonly r: number;
  /** 지금 가는 방향(rad) */
  heading: number;
  /** 가고 싶은 방향 — `heading` 이 «천천히» 따라간다 */
  target: number;
  /** m/s */
  speed: number;
  /** 방향을 새로 고를 때까지 남은 시간(s) */
  turnIn: number;
}

/** 초당 회전 상한(rad). 순간이동하듯 꺾이면 개가 아니라 커서다 */
const WANDER_TURN = 2.2;

/** 해시에 «넓게» 넣을 때 재사용하는 그릇. `insert` 가 읽기만 하므로 하나면 된다 */
const WIDE = new Vector3();

/**
 * 건물 막힘 판정용 격자 한 칸(m).
 * 물체 4,200개 × 건물 6,340채 = 2,660만 번 대조를 피하려고 나눈다.
 */
const BLOCK_CELL = 64;

/** 흔들림이 잦아드는 데 걸리는 시간(초). 길면 물건이 흐느적거린다 */
const NUDGE_TIME = 0.45;
/** 잦아드는 동안 몇 번 흔들리는가(라디안). 2π 면 한 바퀴 */
const NUDGE_WOBBLE = Math.PI * 3;

/**
 * 오브젝트는 Mesh가 아니라 순수 데이터로 산다.
 * 렌더는 InstancePool이, 충돌은 이 배열이 담당 — 완전히 분리되어 있다.
 */
export interface WorldObject {
  readonly pos: Vector3;
  readonly half: Vector3;
  /**
   * **충돌 상자 중심의 y.** 보통은 `pos.y` 와 같다.
   *
   * 밥상처럼 밑이 뚫린 가구만 달라진다 — 형상은 다리까지 전부 그리지만
   * 충돌은 상판만 잡아야 공이 밑으로 지나간다. 그래서 렌더 중심(`pos`)과
   * 충돌 중심(`colY`)이 갈라진다. x·z 는 갈라질 일이 없어서 y 만 둔다.
   */
  readonly colY: number;
  readonly scale: Vector3;
  /**
   * 바라보는 방향(라디안).
   *
   * **`readonly` 가 아니다.** 지금까지 물체는 하나도 안 움직여서 읽기 전용이 맞았는데,
   * `roam` 이 있는 물건(마당 강아지)은 **가는 쪽을 본다** — `stepWander` 가 매 프레임
   * 다시 쓴다. `picked` 다음으로 이 인터페이스에서 변하는 두 번째 필드다.
   *
   * `pos` 는 `readonly` 로 남는다 — 참조는 안 바뀌고 `Vector3` 안의 값만 바뀐다.
   * 흡수될 때 `promote()` 가 이 값을 읽으므로 **먹히는 순간에도 향하던 쪽을 본다.**
   */
  rotY: number;
  /**
   * 기울기(라디안). `arrange: 'lean'` 으로 세운 물건만 0이 아니다.
   *
   * **충돌에는 안 쓴다** — AABB 는 축 정렬이라 기울여도 상자가 그대로다.
   * 여기 들고 있는 이유는 `promote()` 때문이다: 흡수될 때 Mesh 를 다시 만드는데
   * 기울기를 안 들고 있으면 **물건이 삼켜지는 순간 벌떡 선다.**
   */
  readonly rotX: number;
  readonly rotZ: number;
  /** InstancePool 인덱스 = geometry 인덱스 */
  readonly combo: number;
  readonly slot: number;
  readonly color: number;
  /** 최대 변 길이. 흡수 가능 판정에 쓴다. */
  readonly size: number;
  readonly volume: number;
  readonly label: string;
  picked: boolean;
}

/** 광선 투사 방식 점-다각형 판정 */
function pointInPolygon(x: number, z: number, poly: ReadonlyArray<readonly [number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * 손배치 물건 → `ObjectSpec`.
 *
 * `generateWorld` 가 난수로 만드는 것과 **같은 모양의 데이터**를 이름·좌표에서 직접
 * 만든다. 세 축에 같은 배율을 주는 것도 `emit` 과 같은 이유다 — 가로세로 비율은
 * 이미 지오메트리에 굽혀 있다(`assemble()` 의 `normalize`).
 *
 * **AABB 는 기본이 정육면체다** — 기존 소품 1,170개와 같은 근사다.
 * 그런데 밥상에 그대로 쓰니 실제 높이 32cm 짜리 상이 95cm 벽이 됐다. 다리 사이가
 * 통짜로 막혀서 공이 밑으로 못 지나갔다. 그래서 `underPass` 가 있으면 형상 bbox 로
 * 실제 높이를 재서 **상판만** 충돌 상자로 남긴다(`ObjectSpec.colHalf`).
 *
 * 그러려면 형상이 이미 만들어져 있어야 한다 — 생성자가 지오메트리를 먼저 짓고
 * 이 함수에 넘긴다. 클래스 밖에 두는 이유는 생성자가 `this` 를 다 채우기 전에 부르기 때문이다.
 */
function buildProps(
  props: readonly StageProp[],
  geometries: readonly BufferGeometry[],
): ObjectSpec[] {
  return props.map((p) => {
    const geo = geoIndexOf(p.label);
    // **조용히 기본 도형으로 떨어뜨리지 않는다.** 그러면 상자가 놓인 걸 아무도 모른다
    if (geo === null) {
      throw new Error(`손배치 물건 '${p.label}' 은 SHAPE_IDS 에 없습니다`);
    }
    const s = p.size;
    const baseY = (p.y ?? 0) + s / 2;
    const spec: ObjectSpec = {
      x: p.x,
      // `y` 를 주면 그 높이에 얹는다 — TV장 위의 텔레비전
      y: baseY,
      z: p.z,
      sx: s, sy: s, sz: s,
      rotY: p.rotY ?? 0,
      geo,
      color: colorOf(p.label),
      size: s,
      volume: s ** 3,
      label: p.label,
    };

    // **충돌 상자를 형상 실측에 맞춘다.**
    //
    // 여태 `size` 짜리 정육면체를 썼는데, 재보니 거실 가구 열 종이 전부
    // **2~5배 부풀어 있었다**. TV장은 깊이 46cm 인데 상자가 1m — 방 안쪽으로
    // 54cm 짜리 투명 벽이 튀어나와 있었다. 방석은 높이 10cm 짜리가 50cm 벽이었다.
    // 사용자가 말한 「가구 밑에 안 들어간다」의 진짜 범위가 이것이다.
    const g = geometries[geo];
    if (!g) {
      throw new Error(`'${p.label}' 의 지오메트리가 아직 없습니다 — buildProps 는 지오메트리 생성 뒤에 불러야 한다`);
    }
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox!;

    const floor = p.y ?? 0;                              // 물건이 얹힌 면
    const top = floor + (bb.max.y - bb.min.y) * s;       // 형상 상단
    // `underPass` 가 있으면 그 높이부터 잡는다 — 밥상 다리 사이가 비워진다.
    // **다리에는 충돌이 없다**(형상은 그대로 그려진다). AABB 하나로 다리 넷을
    // 표현할 수 없고, 「밑으로 지나간다」가 다리에 부딪히는 것보다 중요하다.
    const lo = floor + (p.underPass ?? 0);
    if (lo >= top) {
      throw new Error(`'${p.label}' 의 underPass ${p.underPass} 가 형상 높이 ${(top - floor).toFixed(3)} 이상이다 — 충돌이 통째로 사라진다`);
    }

    const [halfX, halfZ] = propFootprint(p, g);
    spec.colHalf = [halfX, (top - lo) / 2, halfZ];
    spec.colOffsetY = (lo + top) / 2 - baseY;
    if (p.roam !== undefined) spec.roam = p.roam;
    return spec;
  });
}

/**
 * 손배치 물건의 **바닥 발판 반쪽(x, z)** — 형상 실측 × `size`, 회전 반영.
 *
 * 두 곳이 이걸 쓴다. **같은 자를 써야 한다:**
 *   - `buildProps` — 공이 부딪히는 충돌 상자
 *   - `World.buildBlocked` — 소품 흩뿌림이 피하는 자리
 *
 * 처음엔 `buildBlocked` 가 `size / 2` 짜리 정사각형으로 막았다. 스탠드는 최장축이
 * «높이»라 `size 1.20` 이면 발판을 1.2m 로 잡는데 실제 갓은 0.53m 다 —
 * **두 배 넘게 과하게 막아서** 자리가 통째로 막힌 것처럼 보였고, `emit` 의 재시도가
 * 다 실패한 뒤 어차피 그 자리에 놓여서 「묻혔다」로 잡혔다. 막는 자와 부딪히는 자가
 * 다르면 그 숫자는 거짓말이다.
 *
 * **회전을 먹인다.** 정육면체일 때는 돌려도 같아서 무시할 수 있었지만 이제는
 * 아니다 — 90° 돌린 TV장은 폭과 깊이가 바뀐다.
 */
export function propFootprint(
  p: StageProp, geo: BufferGeometry,
): readonly [number, number] {
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const hx = ((bb.max.x - bb.min.x) * p.size) / 2;
  const hz = ((bb.max.z - bb.min.z) * p.size) / 2;
  const ca = Math.abs(Math.cos(p.rotY ?? 0));
  const sa = Math.abs(Math.sin(p.rotY ?? 0));
  return [ca * hx + sa * hz, sa * hx + ca * hz];
}

export class World {
  readonly objects: WorldObject[] = [];
  readonly hash: SpatialHash;
  readonly pool: InstancePool;
  readonly geometries: BufferGeometry[] = [];
  /** 흡수되어 개별 Mesh로 승격된 것들이 쓰는 색상별 머티리얼 */
  readonly materials: Material[] = [];

  readonly city: City | null;
  readonly groundSize: number;
  /**
   * 지금 흔들리고 있는 물체. **비어 있는 게 보통**이라 `stepNudges` 가 즉시 빠진다.
   * 인덱스 → 남은 시간(1→0)과 축별 진폭.
   */
  private readonly nudged = new Map<number, { t: number; ax: number; az: number }>();
  /**
   * 돌아다니는 물체. **비어 있는 게 보통**이라 `stepWander` 가 즉시 빠진다
   * (`nudged` 와 같은 규약).
   */
  private readonly wanderers: Wanderer[] = [];
  /** 돌아다니는 물체의 방향을 고르는 난수. 씨앗을 쓰므로 판마다 같은 걸음이다 */
  private readonly wanderRnd: () => number;
  /** 트랜스폼을 다시 쓸 때 재사용하는 그릇. 프레임마다 new 하지 않는다 */
  private readonly proxy = new Object3D();
  readonly spawn = new Vector3();

  constructor(scene: Scene, cityData: CityData | null = null, seed = 1337) {
    this.city = cityData ? new City(cityData) : null;
    // 물체 배치용 난수(`generateWorld`)와 **다른 흐름**이어야 한다 —
    // 같은 걸 쓰면 개가 걸을 때마다 배치가 달라진다
    this.wanderRnd = mulberry32((seed ^ 0x5bf03635) >>> 0);

    // **지오메트리를 먼저 만든다.** 예전에는 스펙을 다 뽑은 뒤에 만들었는데,
    // `buildProps` 가 「밑이 뚫린 가구」의 충돌 상자를 자르려면 **형상의 실제 높이**를
    // 알아야 한다 — 그건 지오메트리 bbox 에만 있다. 둘 사이에 의존이 없어서 순서만 뒤집었다.
    //
    // 기본 도형 4개는 generation.ts 의 GEOMETRY_COUNT 와 개수·순서가 맞아야 하고,
    // 전용 형태는 그 뒤에 SHAPE_IDS 순서로 이어붙는다. spec.geo 가 이 배열의 인덱스다.
    for (const g of [
      new BoxGeometry(1, 1, 1),
      new CylinderGeometry(0.5, 0.5, 1, 10),
      new SphereGeometry(0.5, 10, 8),
      new ConeGeometry(0.5, 1, 8),
    ]) this.geometries.push(withWhiteColors(g));
    this.geometries.push(...buildShapeGeometries());
    // 지형이 있으면 그 반경에 맞추고, 없으면 기존 절차 월드 크기
    const reach = cityData ? cityData.radius : 190;
    this.groundSize = reach * 2.6;

    // **손배치 스테이지의 스폰은 건드리지 않는다.**
    //
    // `findClearSpawn`은 OSM 좌표가 석촌호수 한가운데일 수 있어서 만든 보정이다.
    // 손으로 지은 방에서는 해악이다 — 여유 3m가 5.4m짜리 거실을 통째로
    // "막힌 자리"로 판정해서 스폰을 집 밖 12m로 던져버린다.
    // 작성자가 거실 중앙을 고른 것이면 거실 중앙이 맞다.
    if (cityData) {
      const p = cityData.placement ? cityData.spawn : this.findClearSpawn(cityData);
      this.spawn.set(p.x, 0, p.z);
    }

    // 길거리 소품은 지역 전체에 깔리되 **스폰 지점을 중심으로** 배치한다.
    // 도시 원점 기준으로 깔면 스폰이 원점에서 멀 때 주변이 텅 비어서
    // 시작하자마자 먹을 게 하나도 없다.
    // placeCoef는 건드리지 않는다.
    // 지역이 넓다고 이걸 키우면 작은 소품이 멀리 퍼져서 시작 지점 밀도가 무너진다
    // (2.9배 키웠더니 밀도가 8배 떨어져서 첫 흡수까지 5.4m를 굴려야 했다).
    // 넓은 지역은 개수로 채우고, placeMax만 풀어준다.
    // generateWorld 는 **원점 기준**으로 뽑고 아래에서 스폰만큼 옮긴다.
    // 술어도 같은 오프셋을 더해서 봐야 실제로 놓일 자리를 검사하게 된다.
    const isBlocked = cityData ? this.buildBlocked(cityData) : undefined;
    const spawnX = this.spawn.x;
    const spawnZ = this.spawn.z;
    // 손배치 스테이지는 **방이 배치를 전부 정한다.** 개수 스케일링도 placeMax도 안 쓴다 —
    // 방마다 개수와 크기 범위를 직접 적어뒀고, 그게 곧 사다리다.
    // 좌표도 이미 월드 기준이라 아래 스폰 오프셋에서 빠진다.
    const rooms = cityData?.placement?.rooms;
    // **배치에는 자리까지, 바닥에는 방만.** 자리(`spots`)는 방 위에 겹치는 구역이라
    // 바닥을 그리면 같은 높이에 두 장이 깔려 깜빡인다. 아래 `buildRoomFloor` 루프는
    // 그대로 `rooms` 만 돈다.
    const placed = rooms
      ? [...rooms, ...(cityData?.placement?.spots ?? [])]
      : undefined;
    const specs: ObjectSpec[] = generateWorld(
      seed,
      rooms ? {} : cityData ? {
        count: Math.round(GENERATION.count * Math.min(3, reach / 190)),
        placeMax: reach,
      } : {},
      isBlocked && ((x, z) => isBlocked(x + spawnX, z + spawnZ)),
      placed,
      // 라벨 표도 스테이지가 갖는다 — 동네에 밥솥이 굴러다니면 안 된다
      cityData?.placement?.labels,
    );
    // **손배치 가구를 같은 배열에 이어 붙인다.**
    // 이 아래는 전부 공통 경로다 — 인스턴스 풀 개수 집계도, 공간 해시도, 충돌도
    // 소품과 가구를 구별하지 않는다. 그래서 새 렌더·충돌 코드가 한 줄도 없다.
    specs.push(...buildProps(cityData?.placement?.props ?? [], this.geometries));

    // 도넛 배치는 원점 기준으로 뽑으므로 스폰만큼 옮긴다.
    // **방 배치는 이미 월드 좌표다** — 여기서 또 옮기면 방이 통째로 어긋난다.
    // (지금 집 맵은 스폰이 (0,0)이라 티가 안 나지만, 스폰을 옮기는 순간 문다.)
    if (cityData && !rooms) {
      for (const s of specs) { s.x += this.spawn.x; s.z += this.spawn.z; }
    }


    // vertexColors를 켠다. 정점색은 팔레트 색에 **곱해지는 계수**라
    // 흰색(1,1,1)만 들어 있는 기본 도형 4개는 지금까지와 똑같이 보인다.
    // 형태 지오메트리만 바퀴·창문 같은 내부 대비를 갖는다.
    /**
     * 팔레트별 머티리얼. `promote()` 가 **공으로 날아가는 물건**에 쓴다.
     *
     * 인스턴스 머티리얼과 같이 아틀라스를 물린다 — 안 물리면 물건을 집는 순간
     * 인쇄가 사라져서 주사위가 민짜 상자로 변한다. 타일 0이 순백이라
     * 인쇄를 안 받는 형태는 지금까지와 똑같다.
     */
    /**
     * **DOM 가드는 `getPrintAtlas()` 안에 있다.** `tools/placecheck.ts` 같은 검사는
     * Node 에서 `World` 를 그대로 생성하는데, 아틀라스가 `document.createElement` 를
     * 타면 그 도구들이 통째로 죽는다 — 실제로 죽였다. 도구는 배치 숫자만 보므로
     * 텍스처가 없어도 재는 값이 안 달라진다.
     *
     * 구운 공(`Katamari.bake`)도 같은 함수를 부른다 — **텍스처는 한 장**이다.
     */
    const printAtlas = getPrintAtlas();
    const printMap = printAtlas ? { map: printAtlas } : {};
    // **`flatShading` 은 여기서도 껐다.** 공에 붙은 물건과 바닥의 물건이
    // 다르게 보이면 안 된다 — 삼키는 순간 물건이 각져지면 그게 더 이상하다
    for (const c of PALETTE) {
      this.materials.push(new MeshLambertMaterial({
        color: c, vertexColors: true, ...printMap,
      }));
    }
    /**
     * 인스턴스는 색을 instanceColor로 받으므로 머티리얼 하나면 충분하다.
     *
     * 인쇄는 **아틀라스 한 장**으로 붙인다. 물건마다 텍스처를 주면 머티리얼이
     * 갈라져서 드로우콜이 물건 종류만큼 는다 — 이 구조의 전제가 무너진다.
     * 타일 0이 순백이라 인쇄를 안 받는 형태는 지금까지와 똑같이 보인다.
     */
    /**
     * **`flatShading` 을 껐다.**
     *
     * 켜져 있으면 모든 곡면이 면으로 쪼개져 보인다 — 16각 원기둥이 16면으로,
     * 눌린 구인 방석이 각진 판때기로 보인다. 사용자가 「너무 다 각져서 딱딱해
     * 보인다」고 한 것의 원인이 형상 118종이 아니라 **이 한 줄**이었다.
     *
     * 상자는 그대로 상자로 보인다 — `BoxGeometry` 는 면마다 법선이 이미 갈라져 있다.
     * `assemble()` 이 부품을 병합만 하고 정점을 용접하지 않으므로 부품 경계에서
     * 법선이 섞이지도 않는다. **부드러워지는 건 원래 둥근 것뿐이다.**
     */
    const instanceMaterial = new MeshLambertMaterial({
      color: 0xffffff, vertexColors: true,
      ...printMap,
    });

    // InstancedMesh는 생성 시 크기가 고정이므로 geometry별 개수를 먼저 센다.
    const counts = new Int32Array(this.geometries.length);
    for (const s of specs) counts[s.geo]!++;

    this.pool = new InstancePool(
      this.geometries.map((geometry, i) => ({
        geometry,
        material: instanceMaterial,
        count: counts[i]!,
      })),
    );
    scene.add(this.pool.group);

    this.hash = new SpatialHash(CELL, specs.length);
    const proxy = new Object3D();
    const tint = new Color();

    for (const spec of specs) {
      const slot = this.pool.alloc(spec.geo);
      proxy.position.set(spec.x, spec.y, spec.z);
      // **기울기는 렌더에만 준다.** AABB 는 축 정렬이라 충돌 상자는 안 바뀐다 —
      // `arrange: 'lean'` 이 바닥에 누운 낱장을 세워 «면»이 보이게 하는 용도다
      proxy.rotation.set(spec.tiltX ?? 0, spec.rotY, spec.tiltZ ?? 0);
      proxy.scale.set(spec.sx, spec.sy, spec.sz);
      this.pool.setTransform(spec.geo, slot, proxy);
      this.pool.setColor(spec.geo, slot, tint.setHex(PALETTE[spec.color]!));

      // 충돌 상자. **렌더 배율과 분리돼 있다** — 안 주면 지금까지와 같은 정육면체 근사
      const half = spec.colHalf
        ? new Vector3(spec.colHalf[0], spec.colHalf[1], spec.colHalf[2])
        : new Vector3(spec.sx / 2, spec.sy / 2, spec.sz / 2);
      const colY = spec.y + (spec.colOffsetY ?? 0);

      const obj: WorldObject = {
        pos: new Vector3(spec.x, spec.y, spec.z),
        half,
        colY,
        scale: new Vector3(spec.sx, spec.sy, spec.sz),
        rotY: spec.rotY,
        rotX: spec.tiltX ?? 0,
        rotZ: spec.tiltZ ?? 0,
        combo: spec.geo,
        slot,
        color: spec.color,
        size: spec.size,
        volume: spec.volume,
        label: spec.label,
        picked: false,
      };
      this.objects.push(obj);
      const index = this.objects.length - 1;
      if (spec.roam === undefined) {
        this.hash.insert(index, obj.pos, obj.half);
      } else {
        /**
         * **돌아다니는 물체는 «돌아다닐 범위»로 넣는다.**
         *
         * `SpatialHash` 는 넣을 때 한 번 셀을 계산하고 **지우는 수단이 없다.**
         * 매 프레임 다시 넣는 대신 처음부터 넓게 넣으면, 좁은 판정(구 vs AABB)이
         * 어차피 «지금 `pos`» 를 읽으므로(`Game.resolveCollisions`) 결과가
         * **정확히 같다.** 해시도 게임의 충돌 코드도 한 줄을 안 고친다.
         *
         * `CELL` 이 4m 라 반경 1m 짜리 개는 많아야 셀 넷을 차지한다.
         */
        this.hash.insert(index, obj.pos, WIDE.set(
          obj.half.x + spec.roam, obj.half.y, obj.half.z + spec.roam));
        this.wanderers.push({
          index, hx: spec.x, hz: spec.z, r: spec.roam,
          heading: this.wanderRnd() * Math.PI * 2,
          target: this.wanderRnd() * Math.PI * 2,
          speed: 0.30 + this.wanderRnd() * 0.22,
          turnIn: this.wanderRnd() * 2,
        });
      }
    }
    this.pool.flush();

    if (rooms) {
      // 집 맵은 잔디 벌판이 아니다. 바탕 한 장(벽 밑·방 사이가 하늘로 뚫리지 않게)을
      // 깔고 그 위에 방 바닥을 얹는다. 방 7개면 드로우콜 +8.
      scene.add(this.buildFlatGround(0x7a6a4e));
      for (const r of rooms) scene.add(this.buildRoomFloor(r));
      // 천장은 **실내인 방만** 그린다. 뒷마당은 `ceiling` 이 없어서 하늘 그대로다
      for (const r of rooms) if (r.ceiling !== undefined) scene.add(this.buildCeiling(r));
      // 깔개는 방바닥 **뒤에** 더한다 — 먼저 깔면 방바닥이 덮는다
      for (const g of cityData?.rugs ?? []) scene.add(this.buildRug(g));
    } else {
      scene.add(this.buildGround());
    }
    if (this.city) scene.add(this.city.group);
  }

  /**
   * 사라질 표면들. **`hideAt` 이 있는 것만** 담는다 —
   * `City.gateEntries` 와 같은 이유다. 매 프레임 훑는 목록이라 전부를 담을 수 없다.
   */
  private readonly fading: Array<{ mesh: Mesh; at: number }> = [];

  /**
   * 상판·선반을 지운다. `City.openGates()` 의 짝이고 `Game` 이 같은 자리에서 부른다.
   *
   * 밥상 다리를 다 먹었는데 상판만 공중에 떠 있으면 안 된다. 다 지우고 나면
   * 배열이 비어서 첫 줄에서 빠져나온다.
   */
  updateSurfaces(diameter: number): void {
    if (this.fading.length === 0) return;
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const f = this.fading[i]!;
      if (diameter < f.at) continue;
      f.mesh.visible = false;
      this.fading.splice(i, 1);
    }
  }

  /** 흡수된 오브젝트를 개별 Mesh로 승격. 인스턴스에서는 지운다. */
  /**
   * **부딪힌 물건을 흔든다.**
   *
   * 여태 못 먹는 물건을 들이받으면 **공만 튕기고 화면만 흔들렸다** — 물건은
   * 미동도 없었다. 사용자가 「물건이 반응을 안 한다」고 한 게 이것이다.
   *
   * ## 렌더만 건드린다
   *
   * `pos`·`half`·`colY` 는 **한 톨도 안 바꾼다.** 물리가 바뀌면 `curve`/`ladder` 로
   * 실측해둔 성장 곡선과 사다리가 통째로 무너진다. 흔들리는 건 «그림»뿐이고,
   * 충돌은 원래 자리에서 그대로 일어난다.
   *
   * ## 큰 물건은 안 흔들린다
   *
   * 흔들림은 물건 크기가 아니라 **공과 물건의 크기 비**에 달렸다 —
   * `give = min(공 지름 / 물건 최대변, 1)`. 처음에 `min(0.25/size, 1)` 로 잡았다가
   * **5cm 공이 95cm 밥상을 1.5° 흔들어서** 검사에 걸렸다. 상을 흔드는 건
   * 상의 크기가 아니라 **때린 쪽이 얼마나 큰가**의 문제다.
   * 공이 커지면 같은 상이 흔들리기 시작한다 — 그게 맞는 동작이다.
   */
  nudge(index: number, dirX: number, dirZ: number, strength: number, ballDiameter: number): void {
    const o = this.objects[index];
    if (o === undefined || o.picked) return;
    const give = Math.min(ballDiameter / Math.max(o.size, 0.02), 1);
    const amp = Math.min(strength, 1) * give * 0.45;
    if (amp < 0.004) return;                       // 눈에 안 보이는 흔들림은 안 건다
    let n = this.nudged.get(index);
    if (n === undefined) this.nudged.set(index, (n = { t: 0, ax: 0, az: 0 }));
    // 들이받힌 방향으로 «넘어가는» 축을 고른다. 밀린 방향과 직각으로 기운다
    n.ax = dirZ * amp;
    n.az = -dirX * amp;
    n.t = 1;
  }

  /**
   * 흔들림을 감쇠 진동으로 되돌린다. 매 프레임.
   *
   * **흔드는 게 없으면 즉시 빠진다** — 물체 4,200개를 매 프레임 훑으면 안 된다.
   */
  stepNudges(dt: number): void {
    if (this.nudged.size === 0) return;
    for (const [index, n] of this.nudged) {
      n.t -= dt / NUDGE_TIME;
      const o = this.objects[index]!;
      if (n.t <= 0 || o.picked) {
        this.nudged.delete(index);
        // 원래 각도로 되돌려 놓는다 — 안 하면 마지막 프레임 각도로 굳는다
        if (!o.picked) this.applyTransform(o, 0, 0);
        continue;
      }
      // 감쇠 진동. 몇 번 흔들리고 잦아든다
      const k = n.t * Math.cos((1 - n.t) * NUDGE_WOBBLE);
      this.applyTransform(o, n.ax * k, n.az * k);
    }
  }

  /**
   * 돌아다니는 물체를 한 걸음 옮긴다. 매 프레임.
   *
   * **`stepNudges` 와 같은 경로다** — `applyTransform` 하나로 인스턴스 행렬만
   * 다시 쓴다. `half`·`colY` 는 안 건드리므로 **충돌 상자가 몸을 따라온다**
   * (좁은 판정이 `o.pos`·`o.half` 를 매 프레임 새로 읽는다).
   *
   * 길찾기는 없다. 「집에서 멀어지면 집 쪽으로 꺾는다」 한 줄이 담장·가구를
   * 피하는 전부이고, 그게 되려면 **돌아다니는 원판 안이 비어 있어야 한다** —
   * 그건 좌표를 고를 때 지키고 검사가 잰다(`wander.mts`).
   */
  stepWander(dt: number): void {
    if (this.wanderers.length === 0) return;      // 보통은 여기서 빠진다
    for (const w of this.wanderers) {
      const o = this.objects[w.index]!;
      if (o.picked) continue;                     // 먹혔으면 그만 — 공에 붙어 간다

      w.turnIn -= dt;
      if (w.turnIn <= 0) {
        w.target = this.wanderRnd() * Math.PI * 2;
        w.turnIn = 1.4 + this.wanderRnd() * 2.4;  // 1.4~3.8초마다 마음을 바꾼다
      }
      // 집에서 멀어지면 «집 쪽»으로 꺾는다. 담장에 부딪히는 대신 돌아온다
      const dx = o.pos.x - w.hx, dz = o.pos.z - w.hz;
      if (dx * dx + dz * dz > w.r * w.r) w.target = Math.atan2(-dx, -dz);

      /**
       * **최단 방향으로 따라간다.** 그냥 빼면 ±π 를 넘을 때 «반대로 한 바퀴»
       * 돌아서, 담장 앞에서 몸을 빙글 돌리고 나서야 되돌아온다.
       */
      const diff = w.target - w.heading;
      const d = Math.atan2(Math.sin(diff), Math.cos(diff));
      w.heading += Math.max(-WANDER_TURN * dt, Math.min(WANDER_TURN * dt, d));

      o.pos.x += Math.sin(w.heading) * w.speed * dt;
      o.pos.z += Math.cos(w.heading) * w.speed * dt;
      o.rotY = w.heading;                         // 가는 쪽을 본다
      this.applyTransform(o, 0, 0);
    }
  }

  /** 인스턴스 트랜스폼을 다시 쓴다. 흔들림 각도만 더한다 */
  private applyTransform(o: WorldObject, dx: number, dz: number): void {
    this.proxy.position.copy(o.pos);
    this.proxy.rotation.set(o.rotX + dx, o.rotY, o.rotZ + dz);
    this.proxy.scale.copy(o.scale);
    this.pool.setTransform(o.combo, o.slot, this.proxy);
  }

  promote(obj: WorldObject): Mesh {
    this.pool.hide(obj.combo, obj.slot);
    const mesh = new Mesh(this.geometries[obj.combo]!, this.materials[obj.color]!);
    mesh.position.copy(obj.pos);
    // 기울기까지 옮긴다 — 안 그러면 삼켜지는 순간 물건이 벌떡 선다
    mesh.rotation.set(obj.rotX, obj.rotY, obj.rotZ);
    mesh.scale.copy(obj.scale);
    mesh.updateMatrixWorld(true);
    return mesh;
  }

  /**
   * 물 위·건물 바닥면 안이면 true.
   *
   * **이 판정은 지금까지 스폰 지점 하나에만 쓰였다.** 그래서 길거리 물체 4,200개 중
   * 805개(19.2%)가 석촌호수 위에 떠 있었고, 15개는 건물 안에 파묻혀
   * 보이지도 먹히지도 않았다.
   *
   * 물은 폴리곤 23개뿐이라 그대로 훑는다. 건물은 6,340채라 격자로 나눈다 —
   * 안 나누면 물체당 6,340번, 전체 2,660만 번이다.
   *
   * 건물은 외곽선이 아니라 AABB로 본다. 살짝 과하게 막지만, 폴리곤 판정을
   * 6,340채에 돌리는 비용에 비하면 남는 장사다. 벽에 **붙는** 건 여전히 허용된다 —
   * 바닥면 안쪽만 막는다.
   */
  private buildBlocked(city: CityData): BlockedFn {
    const boxes: Array<readonly [number, number, number, number]> = [];
    const grid = new Map<number, number[]>();
    const add = (minX: number, maxX: number, minZ: number, maxZ: number): void => {
      const index = boxes.push([minX, maxX, minZ, maxZ]) - 1;
      for (let cx = Math.floor(minX / BLOCK_CELL); cx <= Math.floor(maxX / BLOCK_CELL); cx++) {
        for (let cz = Math.floor(minZ / BLOCK_CELL); cz <= Math.floor(maxZ / BLOCK_CELL); cz++) {
          const key = (cx + 2048) * 4096 + (cz + 2048);
          let list = grid.get(key);
          if (!list) grid.set(key, (list = []));
          list.push(index);
        }
      }
    };

    for (const b of city.buildings) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [px, pz] of b.outline) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (pz < minZ) minZ = pz;
        if (pz > maxZ) maxZ = pz;
      }
      // OSM에는 깨진 폴리곤이 섞여 들어온다. City 생성자도 같은 것을 걸러낸다.
      if (!Number.isFinite(minX) || !Number.isFinite(minZ)) continue;
      add(minX, maxX, minZ, maxZ);
    }

    /**
     * **손배치 가구도 발판을 비운다.**
     *
     * 가구가 `CityBuilding`(압출)일 때는 위 루프가 그 자리를 막아줘서 소품이
     * 가구 속에 안 파묻혔다. 거실 가구를 `placement.props` 로 옮기면서
     * **그 보호가 조용히 사라졌다** — 이 함수는 `buildings` 만 보기 때문이다.
     *
     * 거실에서는 피해가 작았다(바닥 물체 13개, 대부분 스탠드 기둥 둘레라 무해).
     * 그런데 부엌 140개·아이 방 200개를 뿌리는 방에 1.75m 싱크대를 옮기면
     * 그대로 묻힌다. 그래서 가구를 옮기기 «전»에 여기를 먼저 고친다.
     *
     * **`underPass` 가구는 안 막는다.** 「밑이 뚫려 있다」가 그 값의 정의고,
     * `spot-under-table` 은 상 밑에 동전을 놓으려고 있는 자리다.
     *
     * **표면(`surf-*`)은 원래 `blocked` 를 안 탄다** — `generation.ts` 의
     * 「표면 배치는 `retryPos` 를 안 넘긴다」가 그것이다. 그래서 상판 위 물건은
     * 여기서 무엇을 막든 영향을 안 받는다.
     *
     * 발판은 **공이 부딪히는 상자와 같은 것**이다(`propFootprint`). 처음엔
     * `size / 2` 짜리 정사각형으로 막았다가, 최장축이 «높이»인 물건(스탠드)에서
     * 두 배 넘게 과하게 막혀 자리가 통째로 막힌 것처럼 보였다.
     * **막는 자와 부딪히는 자가 다르면 그 숫자는 거짓말이다.**
     */
    for (const p of city.placement?.props ?? []) {
      if (p.underPass !== undefined) continue;
      // 돌아다니는 물건은 **「있던 자리」가 없다** — 막으면 마당에 빈 구멍이 남고
      // 정작 개는 거기 없다
      if (p.roam !== undefined) continue;
      const geo = this.geometries[geoIndexOf(p.label) ?? -1];
      if (geo === undefined) continue;
      const [hx, hz] = propFootprint(p, geo);
      add(p.x - hx, p.x + hx, p.z - hz, p.z + hz);
    }

    return (x: number, z: number): boolean => {
      for (const w of city.water) if (pointInPolygon(x, z, w.outline)) return true;
      const key = (Math.floor(x / BLOCK_CELL) + 2048) * 4096 + (Math.floor(z / BLOCK_CELL) + 2048);
      const list = grid.get(key);
      if (list) {
        for (const i of list) {
          const [minX, maxX, minZ, maxZ] = boxes[i]!;
          if (x > minX && x < maxX && z > minZ && z < maxZ) return true;
        }
      }
      return false;
    };
  }

  /**
   * 스폰 지점 보정.
   *
   * 손으로 찍은 좌표가 호수 안이거나 건물 속일 수 있다 —
   * 실제로 잠실 스폰이 석촌호수 한가운데였고, 카메라가 수면 아래로 들어가
   * 화면이 물 밑면으로 가득 찼다.
   *
   * 원래 자리부터 나선형으로 밖으로 훑어서 물·건물이 없는 첫 지점을 쓴다.
   */
  private findClearSpawn(city: CityData): { x: number; z: number } {
    const want = city.spawn;
    const blocked = (x: number, z: number): boolean => {
      for (const w of city.water) if (pointInPolygon(x, z, w.outline)) return true;
      for (const b of city.buildings) {
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const [px, pz] of b.outline) {
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (pz < minZ) minZ = pz;
          if (pz > maxZ) maxZ = pz;
        }
        // 건물 벽에 딱 붙어서 시작하지 않도록 여유 3m
        if (x > minX - 3 && x < maxX + 3 && z > minZ - 3 && z < maxZ + 3) return true;
      }
      return false;
    };

    if (!blocked(want.x, want.z)) return want;

    for (let r = 12; r <= 600; r += 12) {
      const steps = Math.max(8, Math.round((r / 12) * 6));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const x = want.x + Math.cos(a) * r;
        const z = want.z + Math.sin(a) * r;
        if (!blocked(x, z)) {
          console.warn(`[world] 스폰 (${want.x}, ${want.z}) 이 막혀 있어 ${r}m 밖으로 옮김`);
          return { x, z };
        }
      }
    }
    console.warn('[world] 빈 스폰 지점을 찾지 못했습니다');
    return want;
  }

  /** 남아있는 것 중 가장 작은 크기 — 막혔는지 판정용 */
  smallestRemaining(): number {
    let min = Infinity;
    for (const o of this.objects) if (!o.picked && o.size < min) min = o.size;
    return min;
  }

  get total(): number { return GENERATION.count; }

  /**
   * 방 바닥. 텍스처 없이 색면 하나 — 원작 실내 바닥이 그렇다.
   *
   * 5cm 공에게는 절대 크기 기준이 필요한데, 집 맵에서는 그 역할을 **가구와 방 경계**가
   * 한다. 잔디의 1m 격자선 같은 장치를 실내에 깔면 다다미도 마루도 아닌 게 된다.
   *
   * y = 4mm. 바탕(0)보다 위, 수면(12mm)·도로(20mm)보다 아래 — 어차피 집 맵에는
   * 물도 도로도 없지만 규약을 깨지 않는다.
   */
  /**
   * 깔개 한 장. 방바닥(y=0.004) 위 0.002m 에 띄운다 —
   * 같은 높이에 두면 z-fighting 으로 깜빡인다.
   *
   * **`rotY` 를 그대로 쓴다.** 축에 맞춰 눕히면 방바닥을 한 번 더 나눈 것에 불과하고,
   * 원작에서 카펫이 다다미를 비스듬히 자르는 그 인상이 안 나온다.
   */
  private buildRug(rug: CityRug): Mesh {
    const tex = FLOOR_TEX[rug.tex]();
    tex.repeat.set(rug.w / TILE_M, rug.d / TILE_M);
    const mesh = new Mesh(
      new PlaneGeometry(rug.w, rug.d),
      new MeshLambertMaterial({ map: tex }),
    );
    mesh.rotation.set(-Math.PI / 2, 0, rug.rotY);
    // `y` 가 있으면 상판·선반이다. 없으면 지금까지처럼 방바닥(0.004) 위 2mm
    mesh.position.set(rug.cx, (rug.y ?? 0) + 0.006, rug.cz);
    mesh.name = rug.y === undefined ? 'rug' : 'surface';
    // 깔개 위에 놓인 물건의 그림자가 여기 떨어진다
    mesh.receiveShadow = true;
    if (rug.hideAt !== undefined) this.fading.push({ mesh, at: rug.hideAt });
    return mesh;
  }

  /**
   * 천장 — **아래를 보는 평면 한 장.**
   *
   * ## 왜 이걸로 충분한가
   *
   * 공이 작을 땐 카메라가 천장 밑이라 천장이 보인다. 공이 커져 카메라가 천장 위로
   * 올라가면 **뒷면이라 저절로 안 보인다**(`FrontSide` 가 기본값). 숨기고 되살리는
   * 코드가 한 줄도 필요 없다 — `City` 의 수면이 `DoubleSide` 를 안 쓰는 것과 같은 이유다.
   *
   * ## `MeshBasicMaterial` 이어야 한다
   *
   * `MeshLambertMaterial` 을 쓰면 **천장이 이끼색이 된다.** 아래를 보는 면의 법선이
   * −y 라 `HemisphereLight` 의 groundColor(0x4c6b3c 짙은 초록)를 정면으로 받기 때문이다.
   * 조명을 안 태우는 쪽이 맞기도 하다 — 괴혼 벽은 색면 하나고, 이 리포의 소품·공·벽이
   * 전부 그 규칙이다.
   */
  private buildCeiling(room: StageRoom): Mesh {
    const [x0, z0, x1, z1] = room.rect;
    const mesh = new Mesh(
      new PlaneGeometry(x1 - x0, z1 - z0),
      new MeshBasicMaterial({ color: CEILING_COLOR }),
    );
    // +PI/2 라야 앞면이 아래를 본다. 바닥(-PI/2)의 반대다
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set((x0 + x1) / 2, room.ceiling!, (z0 + z1) / 2);
    mesh.name = `ceiling_${room.id}`;
    return mesh;
  }

  private buildRoomFloor(room: StageRoom): Mesh {
    const [x0, z0, x1, z1] = room.rect;
    const w = x1 - x0, d = z1 - z0;
    /**
     * 텍스처가 있으면 **색은 흰색으로 둔다.** `MeshLambertMaterial` 은 `color` 를
     * `map` 에 곱하므로 둘 다 주면 바닥이 두 번 어두워진다.
     * 타일 한 장이 `TILE_M`(1.8m)을 덮으니 방 크기로 나눠 반복 횟수를 낸다.
     */
    const tex = room.floorTex ? FLOOR_TEX[room.floorTex]() : null;
    if (tex) tex.repeat.set(w / TILE_M, d / TILE_M);
    const mesh = new Mesh(
      new PlaneGeometry(w, d),
      new MeshLambertMaterial(tex ? { map: tex } : { color: room.floor }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((x0 + x1) / 2, 0.004, (z0 + z1) / 2);
    mesh.name = `floor_${room.id}`;
    // **물건이 「바닥에 놓여 있다」로 읽히는 건 이 면이 받는 그림자다**
    mesh.receiveShadow = true;
    return mesh;
  }

  /** 방 밑에 까는 바탕 한 장. 벽 두께 밑이나 방 사이 틈으로 하늘이 보이지 않게 한다. */
  private buildFlatGround(color: number): Mesh {
    const mesh = new Mesh(
      new PlaneGeometry(this.groundSize, this.groundSize),
      new MeshLambertMaterial({ color }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.name = 'ground';
    // 방 바닥 밖(툇마루 아래·벽 밑)에 선 물건도 그림자를 남겨야 한다
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * 지면 — 도로가 **아닌** 곳. 블록 안쪽, 공원, 공터.
   *
   * **예전 결정을 명시적으로 뒤집는다.** 원래 초록 잔디였는데, Roads.ts 가 실제 도로
   * 4,554개를 그린 뒤에도 그 사이가 전부 잔디라 "서울이 잔디밭 위에 있다"고 판단해
   * 콘크리트로 바꿨다. **그 판단은 실사 목표에서 맞았다.**
   * 심시티 지형은 초록이고, 그게 이 스타일의 절반이다.
   *
   * **1m 격자는 유지한다** — 5cm 공에게는 이게 유일한 절대 크기 기준이다.
   * 다만 콘크리트 줄눈이 아니라 **잔디 깎은 결**로 읽히게 한다. 그래서 격자선을
   * 어둡게가 아니라 밝게 넣는다 — 잔디는 결이 뒤집히는 줄이 밝게 보인다.
   *
   * 괴혼 전환에서 한 단계 더 밝혔다(#5f9e46 → #7cb85e). 원작 지형은 명랑한 중간 초록이고,
   * 공 눈높이에서 화면의 절반이 지면이라 여기가 어두우면 전체가 가라앉는다.
   *
   * 도로(0x5f6268 ~ 0xa8a091)보다 **어둡게** 잡는 규칙은 그대로다.
   * 지면이 도로보다 밝으면 도로망이 배경에 묻혀서 Roads.ts 가 한 일이 안 보인다.
   */
  private buildGround(): Mesh {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;              // 64px = 2m. 타일 안에 1m 판 4장
    const cx = cv.getContext('2d')!;
    cx.fillStyle = '#7cb85e';
    cx.fillRect(0, 0, 64, 64);

    // 얼룩. 완전히 균일하면 플라스틱처럼 보인다.
    // 무작위가 아니라 결정적 수열이라 새로고침해도 같은 무늬가 나온다.
    // **초록 안에서만 흔든다** — 회색이 섞이면 잔디가 죽는다.
    for (let i = 0; i < 240; i++) {
      const v = 178 + ((i * 7919) % 20);
      cx.fillStyle = `rgb(${v - 63},${v},${v - 90})`;
      cx.fillRect((i * 37) % 64, (i * 53) % 64, 1, 1);
    }

    // 1m 깎은 줄
    cx.fillStyle = '#8ac46b';
    cx.fillRect(0, 0, 64, 1);
    cx.fillRect(0, 32, 64, 1);
    cx.fillRect(0, 0, 1, 64);
    cx.fillRect(32, 0, 1, 64);

    const tex = new CanvasTexture(cv);
    // 이걸 빼면 three 가 캔버스의 sRGB 값을 **선형값으로 착각**해서 두 배 가까이 밝게 그린다.
    // 도로는 Color.setHex() 가 sRGB→선형 변환을 해주므로 정상인데, 텍스처만 어긋나
    // 지면이 도로보다 밝아졌다. 잔디 시절에도 같은 버그였지만 초록이라 눈에 안 띄었다.
    tex.colorSpace = SRGBColorSpace;
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(this.groundSize / 2, this.groundSize / 2);
    tex.magFilter = NearestFilter;

    const ground = new Mesh(
      new PlaneGeometry(this.groundSize, this.groundSize),
      new MeshLambertMaterial({ map: tex }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.name = 'ground';
    return ground;
  }
}
