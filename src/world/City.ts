import {
  BufferAttribute, BufferGeometry, Color, ExtrudeGeometry, Group,
  Mesh, MeshLambertMaterial, Shape, ShapeGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { coveredByLandmark, displayHeight, displayKind, extentOf, type BuildingKind, type CityBuilding, type CityData } from './cityData';
import { buildFacadeTexture, FACADE_SCALE, facadeUV } from './facade';
import { buildRoadGeometry } from './Roads';

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
 *   700m → 드로우콜 61, 청크당 최대 961채, 재빌드 1.6ms (프레임 예산의 10%)
 * 붙은 물체가 최대 110 드로우콜을 따로 쓰므로 지형 쪽을 낮게 유지하는 게 이득이다.
 */
const CHUNK = 700;

/**
 * 건물 외벽 색.
 *
 * 예전 다섯 색은 전부 명도 74~82% 안에 몰려 있었다 — 색상만 조금씩 달라서
 * 안개까지 끼면 도시 전체가 한 덩어리 회색으로 보였다.
 *
 * 실제 서울은 **밝기가 갈린다**: 흰 타일 아파트는 밝고, 붉은 벽돌 빌라는 어둡고,
 * 회청 콘크리트 상가는 그 사이다. 종류를 읽히게 하는 건 색상이 아니라 명도다.
 * 그래서 명도 폭을 8에서 32로 벌렸다.
 */
const KIND_COLOR: Record<BuildingKind, number> = {
  apartment: 0xdcd6c9, // 크림 화이트 — 아파트 외벽 도장   명도 83%
  civic: 0xbfc4b4, //     연회록 — 학교·관공서             명도 74%
  retail: 0xc4a07a, //    베이지 — 점포                    명도 62%
  commercial: 0x7e8894, // 회청 콘크리트 — 상가·오피스     명도 54%
  lowrise: 0x9c7f68, //   붉은 벽돌 — 빌라·다세대          명도 51%
};

/**
 * 좌표 → 0~1. 결정적이어야 새로고침해도 같은 도시가 나온다.
 * `Math.random`을 쓰면 흡수로 청크를 다시 그릴 때 건물 색이 바뀐다.
 */
function hash01(v: number): number {
  const x = Math.sin(v) * 43758.5453;
  return x - Math.floor(x);
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
  private material = new MeshLambertMaterial({
    vertexColors: true, map: this.facade, flatShading: false,
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
  // 수면과 같은 수법이되 한 단계 더 앞으로 당긴다.
  // 도로가 수면보다 **위**여야 한다 — 잠실대교·올림픽대교가 한강 폴리곤 위를 지나가는데
  // 아래로 깔면 다리가 물에 잠긴다.
  private roadMaterial = new MeshLambertMaterial({
    vertexColors: true,
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
    const fs = FACADE_SCALE[kind];
    // 건물마다 타일의 다른 칸에서 시작한다. 안 하면 불 켜진 창이 전 도시에서
    // 같은 자리에 박혀 격자무늬가 보인다.
    const geo = new ExtrudeGeometry(shape, {
      depth: h,
      bevelEnabled: false,
      UVGenerator: facadeUV(
        h, fs.floor, fs.bay,
        Math.floor(hash01(e.cx * 7 + e.cz * 3) * 4),
        Math.floor(hash01(e.cx * 5 + e.cz * 11) * 4),
      ),
    });
    // NaN 좌표 하나가 섞이면 병합된 청크 전체의 bounding sphere가 NaN이 되어
    // 프러스텀 컬링이 망가진다. 여기서 잡아야 한다.
    const pos = geo.attributes.position!;
    for (let i = 0; i < pos.array.length; i++) {
      if (!Number.isFinite(pos.array[i]!)) { (pos.array as Float32Array)[i] = 0; }
    }
    geo.rotateX(-Math.PI / 2);
    if (centered) geo.translate(0, -h / 2, 0);
    // uv를 지우지 않는다 — 창 격자가 거기 실려 있다.
    // 정점당 8바이트가 늘지만(도시 전체 2.6MB) 창을 지오메트리로 만드는 것보다 훨씬 싸다.

    const color = new Color(KIND_COLOR[kind]);
    // 같은 종류라도 동마다 살짝 다르게 — 안 하면 도시가 플라스틱처럼 보인다.
    //
    // 예전에는 전 채널에 같은 수를 곱해 **밝기만** 흔들었다. 그래서 같은 종류끼리는
    // 색조가 완전히 같았고, 아파트 단지가 통째로 한 색 덩어리로 보였다.
    // 색상·채도까지 흔들면 같은 종류여도 동마다 다른 건물로 읽힌다.
    //
    // 폭은 실제 렌더를 보고 정했다. 처음엔 절반(l 0.14)이었는데, 잠실 중심은 100%가
    // 아파트라 종류 색이 아무 도움이 안 되고 이 변주가 전부다 — 그 폭으로는 눈높이에서
    // 여전히 한 톤이었다. 지금 폭이면 종류당 명도가 22 벌어져 동마다 갈린다.
    // 더 키우면 KIND_COLOR가 뭉개져 종류 구분이 사라진다.
    color.offsetHSL(
      (hash01(e.cx * 31 + e.cz * 17) - 0.5) * 0.08,
      (hash01(e.cx * 57 + e.cz * 91) - 0.5) * 0.16,
      (hash01(e.cx * 13 + e.cz * 73) - 0.5) * 0.28,
    );

    const n = pos.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // 위로 갈수록 밝게 — 평면 조명만으로는 층이 안 읽힌다
      const y = pos.getY(i) - (centered ? -h / 2 : 0);
      const t = 0.82 + Math.min(y / Math.max(h, 1), 1) * 0.24;
      colors[i * 3] = color.r * t;
      colors[i * 3 + 1] = color.g * t;
      colors[i * 3 + 2] = color.b * t;
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
