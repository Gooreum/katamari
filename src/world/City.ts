import {
  BufferAttribute, BufferGeometry, Color, ExtrudeGeometry,
  Group, Mesh, MeshLambertMaterial, Shape, ShapeGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { coveredByLandmark, displayHeight, displayKind, extentOf, type BuildingKind, type CityBuilding, type CityData } from './cityData';
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
  // 손배치 스테이지가 `building.color`로 덮어쓰는 게 보통이다. 여기 값은
  // 색을 안 준 벽이 새까맣게 나오지 않게 하는 안전망이다.
  wall: 0xf0e6d2, //       회벽
  door: 0xe8d4a8, //       나무틀 장지문
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
   * 벽 머티리얼. **텍스처가 없다.**
   *
   * 예전에는 창 격자 텍스처 한 장을 도시 전체가 공유하고, 건물마다 uv 축척과
   * 시작 칸을 달리해서 층고·창 밀도·불 켜진 자리를 갈랐다.
   *
   * 괴혼 벽은 색면 하나다. 창도 격자도 없다 — 단색 평면인 소품(World.ts)과
   * 카타마리 공(Katamari.ts)이 이미 그 규칙이었고, 벽만 혼자 사실적이었다.
   * 그 어긋남이 팔레트를 아무리 만져도 화면이 안 맞던 이유다.
   */
  private material = new MeshLambertMaterial({
    vertexColors: true, flatShading: true,
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
   * 순서라 아래에 두면 `roadMaterial`이 undefined를 물고 간다.
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

    const kind = displayKind(b);
    // **벽은 바닥부터 꼭대기까지 한 덩어리다.**
    //
    // 예전에는 세 토막이었다 — 1층 띠(유리+간판)만큼 올리고, 파라펫만큼 낮추고,
    // 남은 가운데만 압출했다. 그리고 창 격자 uv를 굽는 UVGenerator를 물렸다.
    // 셋 다 사실성 장치라 원작에는 없다. 압출 한 번으로 끝난다.
    const geo = new ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    // NaN 좌표 하나가 섞이면 병합된 청크 전체의 bounding sphere가 NaN이 되어
    // 프러스텀 컬링이 망가진다. 여기서 잡아야 한다.
    const pos = geo.attributes.position!;
    for (let i = 0; i < pos.array.length; i++) {
      if (!Number.isFinite(pos.array[i]!)) { (pos.array as Float32Array)[i] = 0; }
    }
    geo.rotateX(-Math.PI / 2);
    if (centered) geo.translate(0, -h / 2, 0);
    // uv를 버린다. 창 격자가 사라졌으니 실어 나를 게 없다 —
    // 예전에는 정점당 8바이트(도시 전체 2.6MB)를 uv에 쓰고 있었다.
    geo.deleteAttribute('uv');

    /**
     * 외벽 색. 두 갈래다.
     *
     * **손배치(`b.color`)면 그 색이 그대로 나간다 — 해시 변주를 끈다.**
     * 손으로 고른 색을 흔들면 고른 의미가 없다. 스테이지 작성자가 벽지 색을
     * 정했는데 벽마다 명도가 ±20%씩 달라지면 그건 벽이 아니라 얼룩이다.
     *
     * OSM 도시면 지금까지처럼 종류 색 + 동별 변주다. 안 흔들면 도시가
     * 플라스틱처럼 보인다. 색상 폭이 좁은(0.02) 이유는 종류 색 자체가 정보라서
     * 색상을 흔들면 그 정보를 지우기 때문이고, 동끼리 구분은 명도가 맡는다.
     */
    const handPicked = b.color !== undefined;
    const color = new Color(handPicked ? b.color! : KIND_COLOR[kind]);
    if (!handPicked) {
      color.offsetHSL(
        (hash01(e.cx * 31 + e.cz * 17) - 0.5) * 0.02,
        (hash01(e.cx * 57 + e.cz * 91) - 0.5) * 0.10,
        (hash01(e.cx * 13 + e.cz * 73) - 0.5) * 0.20,
      );
    }

    /**
     * 윗면 색.
     *
     * OSM 건물에서는 **외벽과 무관한 절대색**이다 — 외벽이 크림색이든 벽돌색이든
     * 옥상은 방수 도장 색으로 통일된다. 내려다보는 시점이 지배적인 게임이라
     * 옥상이 사실상 도시의 주 색면이고, 그래서 `color`에 곱하지 않고 갈아끼운다.
     *
     * **손배치는 반대다.** 벽 윗면에 벽돌빨강 지붕색이 얹히면 그건 벽이 아니라
     * 담장 위에 기와를 올린 게 된다. 같은 색을 살짝 눌러서 같은 재질로 읽히게 한다.
     */
    const roof = handPicked
      ? new Color(color).multiplyScalar(0.92)
      : new Color(ROOF_TONE[Math.floor(hash01(e.cx * 3 + e.cz * 29) * ROOF_TONE.length)]!);

    const n = pos.count;
    const nrm = geo.attributes.normal!;
    const colors = new Float32Array(n * 3);
    // **삼각형 단위**로 칠한다. 정점 단위면 지붕 삼각형이 벽과 색이 섞여서
    // 지붕만 따로 칠할 방법이 없다.
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
        // **벽은 위아래가 같은 색이다.**
        //
        // 세로 그라데이션이 "사실적 셰이딩"의 정체였고, 0.36 → 0.08로 줄이는 것까지
        // 해봤지만 방향이 틀렸다. 원작 벽에는 그라데이션이 아예 없다.
        // 면이 갈려 보이는 건 색이 아니라 조명이 할 일이다.
        cr = color.r; cg = color.g; cb = color.b;
      }
      for (let v = 0; v < 3; v++) {
        colors[(t + v) * 3] = cr;
        colors[(t + v) * 3 + 1] = cg;
        colors[(t + v) * 3 + 2] = cb;
      }
    }
    geo.setAttribute('color', new BufferAttribute(colors, 3));

    return geo;
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
  wall: '벽',
  door: '문',
};
