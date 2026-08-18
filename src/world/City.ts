import {
  BufferAttribute, BufferGeometry, Color, ExtrudeGeometry,
  Group, Mesh, MeshLambertMaterial, Shape, ShapeGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { coveredByLandmark, displayHeight, displayKind, extentOf, type BuildingKind, type CityBuilding, type CityData } from './cityData';
import {
  buildFacadeTexture, FACADE_GRID, FACADE_SCALE, facadeUV, flattenUV,
  PODIUM_STONE, SHOP_GLASS, SIGN_HUE,
} from './facade';
import { buildRoadGeometry, buildRoadTexture } from './Roads';

/**
 * 청크 한 변(m).
 * 작으면 재빌드가 싸지고 드로우콜이 늘어난다.
 *
 * 예전에는 이 값이 재빌드 비용을 좌우했다 — 흡수할 때마다 청크의 모든 건물을
 * 다시 압출했기 때문이다. 지금은 압출 결과를 캐시하므로 재빌드가 병합뿐이고,
 * **청크를 키우는 비용이 사실상 사라졌다.** 그래서 드로우콜 쪽으로 최적화한다.
 *
 * 실측 (실제 OSM 잠실 반경 2800m, 건물 6340채):
 *   420m → 드로우콜 약 140
 *   500m → 드로우콜 107, 청크당 최대 522채
 *   700m → 드로우콜  61, 청크당 최대 961채
 *
 * 심시티 전환 때 삼각형이 27만 → 44만으로 늘면서 700에서 재빌드 중앙값이 8.54ms가 됐고
 * (자체 상한 8ms 초과) 500으로 내렸다. **괴혼 전환에서 옥상 설비를 지워 27만으로 돌아왔고,
 * 700에서 다시 재니 중앙값 4.19ms다** (표본 9개: 3.18/3.95/4.02/4.19/4.19/4.80/5.26/5.70/9.07).
 *
 * 그래서 700으로 되돌린다 — 재빌드는 예산의 절반이고 드로우콜은 109 → 63으로 준다.
 * 붙은 물체가 최대 110을 따로 쓰는데, 그건 흡수가 진행된 뒤의 이야기고
 * 그때는 도시 건물이 줄어 있다.
 */
const CHUNK = 700;

/**
 * 건물 외벽 색 — **괴혼 규칙**.
 *
 * 심시티 팔레트는 "종류가 색으로 읽히게" 채도를 올린 중명도였다.
 * 괴혼은 반대다 — 채도는 낮고 **명도가 높다.** 나무 블록에 칠한 페인트처럼 보여야 한다.
 * 종류 구분은 여전히 되지만 그게 목적이 아니다.
 *
 * **공 눈높이에서 검은 협곡이 나오던 게 이 팔레트 탓이 절반이었다.** 5cm 공의 카메라는
 * 23cm 높이라 화면에 보이는 건 벽 최하단인데, 중명도 색에 그라데이션 하한 0.70이
 * 곱해져 실제 화면에서는 거의 검정이 됐다. 명도를 L\* 56~87에서 71~92로 올린다.
 */
const KIND_COLOR: Record<BuildingKind, number> = {
  apartment: 0xf2e6cf, //  아이보리
  lowrise: 0xe89b7a, //    살구
  commercial: 0x8fc4dd, // 파스텔 하늘
  civic: 0x9fd9c4, //      민트
  retail: 0xf5cf72, //     버터
};

/**
 * 옥상 색 — 심시티에서 옥상은 **또 하나의 색면**이다.
 *
 * 예전에는 방수 도장 세 가지를 전부 어둡게 깔았다. 목적이 "항공 뷰가 크림색 벌판으로
 * 안 보이게" 하는 것뿐이었기 때문이다.
 *
 * 이제는 반대로 간다. 내려다보는 시점이 지배적인 게임이라 **옥상이 사실상 도시의 주
 * 색면**이고, 외벽 색상과 뚜렷이 대비되는 채도 있는 색을 줘야 도시가 살아난다.
 * 3색에서 4색으로 늘렸다 — 옥상이 화면을 채우는 만큼 반복이 더 잘 보인다.
 *
 * 괴혼 전환에서 네 색을 전부 밝은 쪽으로 옮겼다. 원작 지붕은 벽돌빨강·청기와가 또렷하다.
 */
const ROOF_TONE = [0xd0705c, 0x6f96b8, 0x8aa878, 0xc9a24e];

/**
 * 좌표 → 0~1. 결정적이어야 새로고침해도 같은 도시가 나온다.
 * `Math.random`을 쓰면 흡수로 청크를 다시 그릴 때 건물 색이 바뀐다.
 */
function hash01(v: number): number {
  const x = Math.sin(v) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * 옥상 설비(물탱크·환풍구)는 **없앴다.**
 *
 * 심시티 전환에서 "옥상 설비가 건물의 정체성"이라며 문턱을 6m로 낮추고 크기를 40% 키웠다.
 * 그건 내려다보는 시점을 전제한 판단이었다.
 *
 * 괴혼에서는 사실성 장치다 — 원작 옥상에도 물건은 있지만 그건 **먹을 수 있는 소품**이지
 * 건물에 구워붙인 장식이 아니다. 지우면서 삼각형도 크게 줄었다.
 * (`clutterHeight`·`CLUTTER_TONE`·`CYLINDER_FROM`·`clamp` 전부 삭제)
 */

/**
 * 파라펫(옥상 난간) 높이. 옥상 테두리에 세우는 낮은 담이다.
 *
 * **심시티 건물이 장난감으로 읽히는 가장 큰 이유가 굵은 옥상 테두리다.** 지금은 벽이
 * 옥상에서 칼같이 끝나서 종이 상자로 보인다.
 *
 * 옥상 **위**에 세우므로 벽과 동일 평면이 아니고 z-파이팅이 없다.
 * 대신 옥탑과 같은 규약으로 **본체에서 떼어낸다** — 위에 덧붙이면 보이는 높이가
 * `displayHeight`를 넘어 충돌 상자와 어긋난다.
 *
 * 6m(2층) 미만은 건너뛴다. 단층 점포에 난간을 두르면 그게 더 이상하다.
 */
function parapetHeight(h: number): number {
  return h >= 6 ? Math.min(0.8, h * 0.06) : 0;
}

/**
 * 파라펫 색 계수. 지붕색에 곱한다.
 *
 * 심시티에서는 0.55로 어둡게 깔아 실루엣 **윤곽선** 역할을 시켰다.
 * 괴혼에서는 윤곽선이 아니라 **지붕 슬래브**로 읽혀야 해서 0.78로 올린다 —
 * 원작 건물의 지붕 테두리는 지붕과 같은 계열의 살짝 짙은 띠다.
 */
const PARAPET_DARK = 0.78;

/**
 * 외곽선을 따라 세운 사각형 링. **캡이 없다.**
 *
 * `ExtrudeGeometry`를 쓰지 않는 이유가 캡 때문이다. 압출은 언제나 위아래 뚜껑을
 * 만드는데, 띠에서는 둘 다 안 보이는 자리라 순수한 낭비다.
 *
 * 1층 상가 띠와 옥상 파라펫이 이걸 공유한다 — 둘 다 "외곽선 따라 세운 띠"라 같은 물건이고,
 * 특히 **감김 판정**을 두 벌로 두면 안 된다. 틀리면 띠가 안쪽을 보고 서서
 * FrontSide 머티리얼에 통째로 컬링된다 — 개수 검사로는 절대 안 잡힌다.
 *
 * @param rows 높이 경계들. `[0, gh]`면 한 줄, `[0, a, gh]`면 두 줄.
 * @param colorAt (행 인덱스) → 그 줄의 색
 */
function outlineRing(
  outline: CityBuilding['outline'],
  ox: number, oz: number,
  rows: readonly number[], yBase: number,
  colorAt: (row: number) => Color,
): BufferGeometry | null {
  const n = outline.length;
  if (n < 3 || rows.length < 2) return null;

  // 외곽선의 감김 방향. 부호 있는 면적이면 오목한 외곽선에서도 정확하다.
  let area2 = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    area2 += outline[j]![0] * outline[i]![1] - outline[i]![0] * outline[j]![1];
  }
  const ccw = area2 > 0;

  const quads = n * (rows.length - 1);
  const verts = new Float32Array(quads * 18);   // 사각형 = 삼각형 2개 = 정점 6개
  const cols = new Float32Array(quads * 18);

  let v = 0, c = 0;
  for (let i = 0; i < n; i++) {
    const p0 = outline[i]!, p1 = outline[(i + 1) % n]!;
    const x0 = p0[0] - ox, z0 = p0[1] - oz;
    const x1 = p1[0] - ox, z1 = p1[1] - oz;
    for (let r = 0; r + 1 < rows.length; r++) {
      const lo = yBase + rows[r]!, hi = yBase + rows[r + 1]!;
      // 아래 두 점 → 위 두 점. ccw면 감김을 뒤집어야 바깥을 본다
      const a = [x0, lo, z0], bb = [x1, lo, z1], cc = [x1, hi, z1], d = [x0, hi, z0];
      const tri = ccw ? [a, cc, bb, a, d, cc] : [a, bb, cc, a, cc, d];
      for (const p of tri) { verts[v++] = p[0]!; verts[v++] = p[1]!; verts[v++] = p[2]!; }
      const col = colorAt(r);
      for (let k = 0; k < 6; k++) { cols[c++] = col.r; cols[c++] = col.g; cols[c++] = col.b; }
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(verts, 3));
  geo.setAttribute('color', new BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  flattenUV(geo);   // 띠에 창 격자가 겹치면 안 된다
  return geo;
}

export interface CityBuildingEntry {
  readonly building: CityBuilding;
  readonly center: Vector3;
  readonly half: Vector3;
  readonly size: number;
  readonly volume: number;
  readonly label: string;
  readonly chunk: number;
  absorbed: boolean;
}

/**
 * 실제 지형 렌더러.
 *
 * 건물을 개별 메시로 그리면 드로우콜이 건물 수만큼 나온다 —
 * OSM으로 받은 잠실은 수천 채라 그대로는 못 쓴다.
 * 그래서 180m 격자로 묶어 청크당 메시 하나로 굽는다.
 *
 * 흡수되면 그 청크만 다시 굽는다. 건물을 먹는 건 후반에만 일어나고
 * 청크당 건물이 십수 채뿐이라 재빌드가 싸다.
 * 색은 vertex color로 넣어서 머티리얼도 하나로 공유한다.
 */
export class City {
  readonly group = new Group();
  readonly entries: CityBuildingEntry[] = [];

  private chunks = new Map<number, Mesh>();
  private chunkMembers = new Map<number, number[]>();
  private dirty = new Set<number>();
  /**
   * entries 인덱스 → 압출 결과 (월드 좌표).
   * 건물당 약 1.6KB니까 3280채 기준 약 5MB. 재빌드에서 압출을 통째로 걷어내는 값이다.
   */
  private geometryCache = new Map<number, BufferGeometry>();
  /**
   * 창 격자. **`material`보다 먼저 선언해야 한다** — 필드 초기화는 선언 순서라
   * 아래에 두면 `material`이 undefined를 물고 간다.
   *
   * 도시 전체가 이 한 장을 공유한다. 건물마다 uv 축척과 시작 칸이 달라서
   * 같은 텍스처인데 층고도 창 밀도도 불 켜진 자리도 갈린다.
   */
  private facade = buildFacadeTexture();
  // flatShading은 길거리 소품(World.ts)·카타마리 공(Katamari.ts)과 설정을 맞추는 것이다.
  // **시각적으로는 거의 안 바뀐다** — ExtrudeGeometry가 인덱스 없는 지오메트리라
  // 이미 면 법선을 갖고 있다. 실제 변화는 그라데이션과 팔레트가 만든다.
  private material = new MeshLambertMaterial({
    vertexColors: true, map: this.facade, flatShading: true,
  });
  // FrontSide여야 한다. DoubleSide면 공이 작을 때 카메라가 수면 아래로 들어가
  // 물 밑면이 화면을 가득 채운다 — 실제로 그래서 화면이 통째로 회청색이 됐다.
  //
  // polygonOffset: 수면은 지면 위 12mm에 불과해서 먼 거리에서는 깊이 값이 지면과 뭉개진다.
  // 실제 OSM 한강 폴리곤이 47km²(도시 반경 1600m 원의 7배)라 화면 대부분이 그 "먼 거리"다.
  // 오프셋을 키우는 건 답이 아니다 — 5cm 공의 카메라 높이가 23cm라 수면을 올리면
  // 시작부터 물에 잠긴다. 그래서 깊이 값을 당겨 거리와 무관하게 지면을 이기게 한다.
  private waterMaterial = new MeshLambertMaterial({
    color: 0x5b8fa8,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  private roadMesh: Mesh | null = null;
  /**
   * 차선·보도블록. **`roadMaterial`보다 먼저 선언해야 한다** — 필드 초기화는 선언
   * 순서라 아래에 두면 `roadMaterial`이 undefined를 물고 간다 (`facade`와 같은 함정).
   */
  private roadTexture = buildRoadTexture();
  // 수면과 같은 수법이되 한 단계 더 앞으로 당긴다.
  // 도로가 수면보다 **위**여야 한다 — 잠실대교·올림픽대교가 한강 폴리곤 위를 지나가는데
  // 아래로 깔면 다리가 물에 잠긴다.
  //
  // 종류별 색은 이제 정점색이 아니라 텍스처 밴드가 갖는다.
  private roadMaterial = new MeshLambertMaterial({
    map: this.roadTexture,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  constructor(readonly data: CityData) {
    this.group.name = 'City';

    let skipped = 0;
    let covered = 0;
    data.buildings.forEach((building) => {
      // 흡수 판정·성장 계산이 전부 이 높이를 본다. 지오메트리도 같은 값을 쓴다 —
      // 어긋나면 안 보이는 벽에 부딪히거나 건물을 뚫고 지나간다.
      const h = displayHeight(building);
      const e = extentOf(building.outline, h);
      // OSM 데이터는 깨진 폴리곤이 섞여 들어온다. 조용히 건너뛴다.
      // 검사는 원본 높이로 한다 — displayHeight는 NaN을 그대로 통과시킨다.
      if (
        building.outline.length < 3 ||
        !Number.isFinite(e.size) || e.size <= 0 ||
        !Number.isFinite(building.height) || building.height <= 0
      ) {
        skipped++;
        return;
      }
      // 랜드마크가 이미 대표하는 자리의 건물은 빼낸다.
      // 안 그러면 같은 물체가 둘이 된다 — 롯데월드몰이 랜드마크로도 건물로도 존재했다.
      if (coveredByLandmark(e.cx, e.cz, e.size, data.landmarks)) {
        covered++;
        return;
      }

      const chunk = this.chunkKey(e.cx, e.cz);
      // push가 돌려주는 길이로 entries 인덱스를 잡는다.
      // forEach의 i는 data.buildings 인덱스라, 위에서 깨진 폴리곤을 하나라도 건너뛰는
      // 순간 둘이 어긋난다 — rebuild()의 entries[i]와 Game이 부르는 absorb(i)가
      // 서로 다른 건물을 가리키게 된다.
      const entryIndex = this.entries.push({
        building,
        center: new Vector3(e.cx, h / 2, e.cz),
        half: new Vector3(e.width / 2, h / 2, e.depth / 2),
        size: e.size,
        volume: e.volume,
        label: building.name ?? KIND_LABEL[displayKind(building)],
        chunk,
        absorbed: false,
      }) - 1;
      let members = this.chunkMembers.get(chunk);
      if (!members) this.chunkMembers.set(chunk, (members = []));
      members.push(entryIndex);
    });

    if (skipped > 0) console.warn(`[city] 잘못된 건물 ${skipped}채 건너뜀`);
    if (covered > 0) console.log(`[city] 랜드마크와 겹쳐 숨긴 건물 ${covered}채`);
    for (const key of this.chunkMembers.keys()) this.rebuild(key);
    this.buildWater();
    this.buildRoads();
  }

  private chunkKey(x: number, z: number): number {
    const i = Math.floor(x / CHUNK) + 512;
    const j = Math.floor(z / CHUNK) + 512;
    return (i << 10) | j;
  }

  /**
   * 흡수. 청크에서 빼고 개별 메시를 만들어 돌려준다.
   * 실제 재빌드는 flush()에서 한 번에 — 한 프레임에 여러 채를 먹을 수 있다.
   */
  absorb(index: number): Mesh {
    const e = this.entries[index]!;
    e.absorbed = true;
    this.dirty.add(e.chunk);

    // 흡수된 건물은 다시 청크에 병합되지 않는다. 캐시에서 빼서 메모리를 돌려준다.
    const cached = this.geometryCache.get(index);
    if (cached) {
      cached.dispose();
      this.geometryCache.delete(index);
    }

    const geometry = this.geometryFor(e.building, true);
    const mesh = new Mesh(geometry, this.material);
    mesh.position.copy(e.center);
    mesh.updateMatrixWorld(true);
    return mesh;
  }

  /** 렌더 직전 한 번. 더러워진 청크만 다시 굽는다. */
  flush(): void {
    if (this.dirty.size === 0) return;
    for (const key of this.dirty) this.rebuild(key);
    this.dirty.clear();
  }

  get drawCalls(): number {
    return this.chunks.size
      + (this.data.water.length > 0 ? 1 : 0)
      + (this.roadMesh ? 1 : 0);
  }

  private rebuild(key: number): void {
    const old = this.chunks.get(key);
    if (old) {
      this.group.remove(old);
      old.geometry.dispose();
      this.chunks.delete(key);
    }

    const members = this.chunkMembers.get(key);
    if (!members) return;

    const parts: BufferGeometry[] = [];
    for (const i of members) {
      const e = this.entries[i]!;
      if (e.absorbed) continue;
      // 외곽선은 흡수돼도 변하지 않는다. 매번 다시 압출할 이유가 없다 —
      // 재빌드 15.8ms 중 15.2ms(96%)가 압출이었다. 캐시하면 병합 0.6ms만 남는다.
      let geo = this.geometryCache.get(i);
      if (!geo) {
        geo = this.geometryFor(e.building, false);
        this.geometryCache.set(i, geo);
      }
      parts.push(geo);
    }
    if (parts.length === 0) return;

    // parts는 캐시가 소유한다. 여기서 dispose하면 다음 재빌드가 빈 지오메트리를 병합한다.
    const merged = mergeGeometries(parts, false);
    if (!merged) return;

    const mesh = new Mesh(merged, this.material);
    mesh.name = `chunk_${key}`;
    this.chunks.set(key, mesh);
    this.group.add(mesh);
  }

  /**
   * 외곽선 + 높이 → 압출 지오메트리.
   *
   * @param centered true면 자기 중심 기준 (흡수되어 공에 붙을 때),
   *                 false면 월드 좌표 그대로 (청크에 병합될 때)
   *
   * Shape은 (x, y) 평면이고 ExtrudeGeometry는 +Z로 뽑는다.
   * rotateX(-90°)를 걸면 (x, y, z) → (x, z, -y) 가 되므로
   * Shape을 (x, -z)로 만들어야 월드 z 부호가 맞는다.
   */
  private geometryFor(b: CityBuilding, centered: boolean): BufferGeometry {
    // 보이는 높이와 부딪히는 높이가 다르면 안 된다. 생성자와 여기가 같은 함수를 쓴다.
    const h = displayHeight(b);
    const e = extentOf(b.outline, h);
    const ox = centered ? e.cx : 0;
    const oz = centered ? e.cz : 0;

    const shape = new Shape();
    b.outline.forEach(([x, z], i) => {
      const px = x - ox;
      const py = -(z - oz);
      i === 0 ? shape.moveTo(px, py) : shape.lineTo(px, py);
    });

    // 파라펫을 얹을 만큼 본체를 낮춘다. 총높이는 h 그대로다.
    // 옥탑을 없앴으므로 뺄 것은 파라펫 하나뿐이다.
    const parapetH = parapetHeight(h);
    const mass = h - parapetH;
    // 1층 띠. 본체를 이만큼 올려서 시작한다 — 덧붙이는 게 아니라 떼어내는 것이다.
    // 저층 건물에서 띠가 건물을 통째로 잡아먹지 않도록 h의 35%로 묶는다.
    const groundH = Math.min(4.2, h * 0.35);

    const kind = displayKind(b);
    const fs = FACADE_SCALE[kind];
    // 건물마다 타일의 다른 칸에서 시작한다. 안 하면 불 켜진 창이 전 도시에서
    // 같은 자리에 박혀 격자무늬가 보인다.
    //
    // 칸 수는 `FACADE_GRID`에서 가져온다. 예전에는 여기에 4를 박아뒀는데,
    // 격자를 2로 줄이자 두 파일이 조용히 어긋났다 — 랩어라운드 덕에 화면은 멀쩡했지만
    // 그런 종류의 어긋남은 다음에 반드시 문다.
    const geo = new ExtrudeGeometry(shape, {
      depth: mass - groundH,
      bevelEnabled: false,
      UVGenerator: facadeUV(
        mass - groundH, fs.floor, fs.bay,
        Math.floor(hash01(e.cx * 7 + e.cz * 3) * FACADE_GRID),
        Math.floor(hash01(e.cx * 5 + e.cz * 11) * FACADE_GRID),
      ),
    });
    // NaN 좌표 하나가 섞이면 병합된 청크 전체의 bounding sphere가 NaN이 되어
    // 프러스텀 컬링이 망가진다. 여기서 잡아야 한다.
    const pos = geo.attributes.position!;
    for (let i = 0; i < pos.array.length; i++) {
      if (!Number.isFinite(pos.array[i]!)) { (pos.array as Float32Array)[i] = 0; }
    }
    geo.rotateX(-Math.PI / 2);
    // 본체는 1층 띠 위에서 시작한다. 바닥 캡이 띠 안에 묻혀 안 보인다.
    geo.translate(0, groundH, 0);
    if (centered) geo.translate(0, -h / 2, 0);
    // uv를 지우지 않는다 — 창 격자가 거기 실려 있다.
    // 정점당 8바이트가 늘지만(도시 전체 2.6MB) 창을 지오메트리로 만드는 것보다 훨씬 싸다.

    const color = new Color(KIND_COLOR[kind]);
    // 같은 종류라도 동마다 살짝 다르게 — 안 하면 도시가 플라스틱처럼 보인다.
    //
    // **색상 폭을 1/4로 줄였다 (0.08 → 0.02).** 예전에는 종류 색이 저채도라 구분에
    // 아무 도움이 안 됐고, 이 변주가 다양성의 전부라서 색상까지 크게 흔들었다.
    // 지금은 종류 색 자체가 정보다 — 색상을 흔들면 그 정보를 지운다.
    // 동끼리의 구분은 명도가 맡는다. 심시티도 같은 색 건물의 밝기만 다르다.
    color.offsetHSL(
      (hash01(e.cx * 31 + e.cz * 17) - 0.5) * 0.02,
      (hash01(e.cx * 57 + e.cz * 91) - 0.5) * 0.10,
      (hash01(e.cx * 13 + e.cz * 73) - 0.5) * 0.20,
    );

    /**
     * 옥상 색. **건물 색과 무관한 절대색이다.**
     *
     * 외벽이 크림색이든 벽돌색이든 옥상은 방수 도장 색으로 통일된다 —
     * 실제로 그렇다. 그래서 `color`에 곱하지 않고 갈아끼운다.
     *
     * 내려다보는 시점이 지배적인 게임인데 지금까지 옥상이 세로 그라데이션의 맨 위,
     * 즉 **건물에서 가장 밝은 면**이었다. 항공 뷰가 크림색 벌판으로 보인 원인이다.
     */
    const roof = new Color(ROOF_TONE[Math.floor(hash01(e.cx * 3 + e.cz * 29) * ROOF_TONE.length)]!);

    const n = pos.count;
    const nrm = geo.attributes.normal!;
    const colors = new Float32Array(n * 3);
    const yBase = centered ? -h / 2 : 0;
    // **삼각형 단위**로 칠한다. 정점 단위면 지붕 삼각형이 벽 그라데이션의 맨 위 값을
    // 그대로 물려받아서 지붕만 따로 칠할 방법이 없다.
    //
    // ExtrudeGeometry는 인덱스가 없고 computeVertexNormals()만 부른다
    // (ExtrudeGeometry.js:63). 그래서 삼각형마다 면 법선을 갖고, ny로 면이 갈린다.
    for (let t = 0; t < n; t += 3) {
      const ny = nrm.getY(t);
      let cr: number, cg: number, cb: number;
      if (ny > 0.9) {
        cr = roof.r; cg = roof.g; cb = roof.b;
      } else if (ny < -0.9) {
        // 바닥면 — 지면에 눌려 절대 안 보인다. 그래도 값은 채워야 병합이 된다
        cr = color.r * 0.5; cg = color.g * 0.5; cb = color.b * 0.5;
      } else {
        // 세로 그라데이션. **괴혼 벽은 위아래가 같은 색이다.**
        //
        // 이게 "사실적 셰이딩"의 정체였고, 단색 평면인 길거리 소품(flatShading, 텍스처 없음)과
        // 가장 크게 어긋나던 지점이다. 무엇보다 하한 0.70이 **공 눈높이에서 실제로 보이는
        // 부분을 30% 어둡게** 만들고 있었다 — 0.25m 컷이 검은 협곡으로 나온 원인의 절반.
        //
        // 폭을 0.36 → 0.08로 줄인다. 완전히 0으로 두지 않는 건 멀리서 벽이 통짜로
        // 뭉개지는 걸 막기 위해서다.
        const cy = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3 - yBase - groundH;
        const k = 0.96 + Math.min(cy / Math.max(mass - groundH, 1), 1) * 0.08;
        cr = color.r * k; cg = color.g * k; cb = color.b * k;
      }
      for (let v = 0; v < 3; v++) {
        colors[(t + v) * 3] = cr;
        colors[(t + v) * 3 + 1] = cg;
        colors[(t + v) * 3 + 2] = cb;
      }
    }
    geo.setAttribute('color', new BufferAttribute(colors, 3));

    const parts: BufferGeometry[] = [geo];

    // 1층. 5cm 공으로 시작하는 게임이라 초반 내내 보는 게 여기다.
    const band = this.groundBand(b, kind, ox, oz, groundH, yBase, color, e.cx, e.cz);
    if (band) parts.push(band);

    // 파라펫. 옥상 **위**에 서므로 벽과 겹치지 않는다 — z-파이팅이 없다.
    // 건물당 외곽선 변 × 2 삼각형이라 도시 전체로도 싸다.
    if (parapetH > 0) {
      const rim = new Color(roof).multiplyScalar(PARAPET_DARK);
      const ring = outlineRing(b.outline, ox, oz, [mass, mass + parapetH], yBase, () => rim);
      if (ring) parts.push(ring);
    }

    if (parts.length === 1) return geo;
    const merged = mergeGeometries(parts, false);
    if (!merged) {
      // 병합 실패 시 본체만 돌려준다 — 옥탑이 없을 뿐 안전하다.
      // 다만 만들어둔 상자는 여기서 버려야 한다. 본체(parts[0])는 그대로 쓴다.
      for (let i = 1; i < parts.length; i++) parts[i]!.dispose();
      return geo;
    }
    for (const p of parts) p.dispose();
    return merged;
  }

  /**
   * 1층 띠. 외곽선 변마다 사각형을 직접 깐다.
   *
   * `ExtrudeGeometry`를 한 번 더 쓰지 않는 이유는 **캡** 때문이다. 압출은 언제나
   * 위아래 뚜껑을 만드는데, 여기서는 둘 다 안 보이는 자리(지면과 본체 바닥)라
   * 순수한 낭비다. 변당 사각형만 깔면 캡이 없다.
   *
   * 종류로 갈린다:
   *   상가·점포·빌라 → 어두운 유리 + 그 위 간판 띠 (변당 4삼각형)
   *   아파트·공공     → 화강암 저층부, 간판 없음 (변당 2삼각형)
   *
   * 아파트 1층에 간판을 붙이면 거짓말이다. 실제로 잠실 아파트 1층은 상가가 아니다.
   */
  private groundBand(
    b: CityBuilding, kind: BuildingKind,
    ox: number, oz: number, gh: number, yBase: number, wallColor: Color,
    hx: number, hz: number,
  ): BufferGeometry | null {
    if (gh <= 0) return null;
    const shop = kind === 'commercial' || kind === 'retail' || kind === 'lowrise';

    // 해시는 **건물 중심(hx, hz)** 으로 뽑는다. ox/oz 를 쓰면 안 된다 —
    // 청크에 병합될 때(centered=false) 그 둘이 항상 0이라 도시 전체 간판이 한 색이 된다.
    const glass = new Color(shop ? SHOP_GLASS : PODIUM_STONE);
    // 유리·화강암도 동마다 밝기를 흔든다. 안 하면 길 하나가 통짜 띠로 보인다.
    //
    // **곱셈이어야 한다.** `offsetHSL`로 명도를 ±0.07 흔들었더니 유리가 새까매졌다 —
    // 유리 기준색의 선형 명도가 0.035라 폭이 기준값의 두 배였고, 아래로 흔들린 건물은
    // 전부 0에 눌렸다. 비율로 흔들면 어두운 색도 검게 죽지 않는다.
    glass.multiplyScalar(0.78 + hash01(hx * 61 + hz * 13) * 0.5);
    const sign = new Color(SIGN_HUE[Math.floor(hash01(hx * 97 + hz * 43) * SIGN_HUE.length)]!);
    // 간판은 벽 색을 살짝 섞어야 스티커처럼 떠 보이지 않는다
    sign.lerp(wallColor, 0.18);

    const rows = shop ? [0, gh * 0.72, gh] : [0, gh];
    return outlineRing(b.outline, ox, oz, rows, yBase, (r) => (shop && r === 1 ? sign : glass));
  }

  private buildWater(): void {
    if (this.data.water.length === 0) return;
    const parts: BufferGeometry[] = [];
    for (const w of this.data.water) {
      const shape = new Shape();
      w.outline.forEach(([x, z], i) => {
        i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z);
      });
      const geo = new ShapeGeometry(shape);
      geo.rotateX(-Math.PI / 2);
      // 5cm 공의 카메라 높이가 23cm다. 수면이 그보다 높으면 시작부터 물에 잠긴다.
      geo.translate(0, 0.012, 0);
      geo.deleteAttribute('uv');
      parts.push(geo);
    }
    const merged = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    if (!merged) return;
    const mesh = new Mesh(merged, this.waterMaterial);
    mesh.name = 'water';
    this.group.add(mesh);
  }

  /**
   * 도로·보도. 흡수되지 않으므로 재빌드가 없다 —
   * 청크로 나눌 이유가 없어서 4,554개를 통째로 하나에 병합한다.
   * 종류별 색은 정점색이라 머티리얼도 하나. 드로우콜 1개로 끝난다.
   */
  private buildRoads(): void {
    const roads = this.data.roads;
    if (!roads || roads.length === 0) return;
    const geo = buildRoadGeometry(roads);
    if (!geo) return;
    // 지면 0 → 수면 0.012 → 도로 0.020. 2cm는 5cm 공의 카메라 높이(23cm)보다
    // 한참 낮아서 시작 시점에 시야를 가리지 않는다.
    geo.translate(0, 0.02, 0);
    const mesh = new Mesh(geo, this.roadMaterial);
    mesh.name = 'roads';
    this.roadMesh = mesh;
    this.group.add(mesh);
  }

  dispose(): void {
    for (const mesh of this.chunks.values()) mesh.geometry.dispose();
    this.roadMesh?.geometry.dispose();
    this.roadMesh = null;
    this.roadMaterial.dispose();
    this.roadTexture.dispose();
    this.chunks.clear();
    for (const geo of this.geometryCache.values()) geo.dispose();
    this.geometryCache.clear();
    this.material.dispose();
    this.facade.dispose();
    this.waterMaterial.dispose();
    this.group.clear();
  }
}

const KIND_LABEL: Record<BuildingKind, string> = {
  apartment: '아파트',
  lowrise: '빌라',
  commercial: '상가 건물',
  civic: '공공건물',
  retail: '점포',
};
