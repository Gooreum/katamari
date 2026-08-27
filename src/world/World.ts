import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry,
  Material, Mesh, MeshLambertMaterial, NearestFilter, Object3D, PlaneGeometry,
  RepeatWrapping, Scene, SphereGeometry, SRGBColorSpace, Vector3,
} from 'three';
import { InstancePool } from './InstancePool';
import { SpatialHash } from './SpatialHash';
import { generateWorld, GENERATION, PALETTE, type BlockedFn, type ObjectSpec } from './generation';
import { buildShapeGeometries, withWhiteColors } from './shapes';
import { City } from './City';
import { FLOOR_TEX, TILE_M } from './floors';
import { buildPrintAtlas } from './atlas';
import type { CityData, CityRug, StageRoom } from './cityData';

export const GROUND_SIZE = 500;
const CELL = 4;

/**
 * 건물 막힘 판정용 격자 한 칸(m).
 * 물체 4,200개 × 건물 6,340채 = 2,660만 번 대조를 피하려고 나눈다.
 */
const BLOCK_CELL = 64;

/**
 * 오브젝트는 Mesh가 아니라 순수 데이터로 산다.
 * 렌더는 InstancePool이, 충돌은 이 배열이 담당 — 완전히 분리되어 있다.
 */
export interface WorldObject {
  readonly pos: Vector3;
  readonly half: Vector3;
  readonly scale: Vector3;
  readonly rotY: number;
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

export class World {
  readonly objects: WorldObject[] = [];
  readonly hash: SpatialHash;
  readonly pool: InstancePool;
  readonly geometries: BufferGeometry[] = [];
  /** 흡수되어 개별 Mesh로 승격된 것들이 쓰는 색상별 머티리얼 */
  readonly materials: Material[] = [];

  readonly city: City | null;
  readonly groundSize: number;
  readonly spawn = new Vector3();

  constructor(scene: Scene, cityData: CityData | null = null, seed = 1337) {
    this.city = cityData ? new City(cityData) : null;
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
    const specs: ObjectSpec[] = generateWorld(
      seed,
      rooms ? {} : cityData ? {
        count: Math.round(GENERATION.count * Math.min(3, reach / 190)),
        placeMax: reach,
      } : {},
      isBlocked && ((x, z) => isBlocked(x + spawnX, z + spawnZ)),
      rooms,
      // 라벨 표도 스테이지가 갖는다 — 동네에 밥솥이 굴러다니면 안 된다
      cityData?.placement?.labels,
    );
    // 도넛 배치는 원점 기준으로 뽑으므로 스폰만큼 옮긴다.
    // **방 배치는 이미 월드 좌표다** — 여기서 또 옮기면 방이 통째로 어긋난다.
    // (지금 집 맵은 스폰이 (0,0)이라 티가 안 나지만, 스폰을 옮기는 순간 문다.)
    if (cityData && !rooms) {
      for (const s of specs) { s.x += this.spawn.x; s.z += this.spawn.z; }
    }

    // 기본 도형 4개는 generation.ts 의 GEOMETRY_COUNT 와 개수·순서가 맞아야 하고,
    // 전용 형태는 그 뒤에 SHAPE_IDS 순서로 이어붙는다. spec.geo 가 이 배열의 인덱스다.
    for (const g of [
      new BoxGeometry(1, 1, 1),
      new CylinderGeometry(0.5, 0.5, 1, 10),
      new SphereGeometry(0.5, 10, 8),
      new ConeGeometry(0.5, 1, 8),
    ]) this.geometries.push(withWhiteColors(g));
    this.geometries.push(...buildShapeGeometries());

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
     * **DOM 이 없으면 안 만든다.** 아틀라스는 `document.createElement('canvas')` 를
     * 쓰는데 `tools/placecheck.ts` 같은 검사는 Node 에서 `World` 를 그대로 생성한다.
     * 생성자에서 무조건 부르면 그 도구들이 통째로 죽는다 — 실제로 죽였다.
     * 도구는 배치 숫자만 보므로 텍스처가 없어도 재는 값이 안 달라진다.
     */
    const printAtlas = typeof document === 'undefined' ? null : buildPrintAtlas();
    const printMap = printAtlas ? { map: printAtlas } : {};
    for (const c of PALETTE) {
      this.materials.push(new MeshLambertMaterial({
        color: c, flatShading: true, vertexColors: true, ...printMap,
      }));
    }
    /**
     * 인스턴스는 색을 instanceColor로 받으므로 머티리얼 하나면 충분하다.
     *
     * 인쇄는 **아틀라스 한 장**으로 붙인다. 물건마다 텍스처를 주면 머티리얼이
     * 갈라져서 드로우콜이 물건 종류만큼 는다 — 이 구조의 전제가 무너진다.
     * 타일 0이 순백이라 인쇄를 안 받는 형태는 지금까지와 똑같이 보인다.
     */
    const instanceMaterial = new MeshLambertMaterial({
      color: 0xffffff, flatShading: true, vertexColors: true,
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
      proxy.rotation.set(0, spec.rotY, 0);
      proxy.scale.set(spec.sx, spec.sy, spec.sz);
      this.pool.setTransform(spec.geo, slot, proxy);
      this.pool.setColor(spec.geo, slot, tint.setHex(PALETTE[spec.color]!));

      const obj: WorldObject = {
        pos: new Vector3(spec.x, spec.y, spec.z),
        half: new Vector3(spec.sx / 2, spec.sy / 2, spec.sz / 2),
        scale: new Vector3(spec.sx, spec.sy, spec.sz),
        rotY: spec.rotY,
        combo: spec.geo,
        slot,
        color: spec.color,
        size: spec.size,
        volume: spec.volume,
        label: spec.label,
        picked: false,
      };
      this.objects.push(obj);
      this.hash.insert(this.objects.length - 1, obj.pos, obj.half);
    }
    this.pool.flush();

    if (rooms) {
      // 집 맵은 잔디 벌판이 아니다. 바탕 한 장(벽 밑·방 사이가 하늘로 뚫리지 않게)을
      // 깔고 그 위에 방 바닥을 얹는다. 방 7개면 드로우콜 +8.
      scene.add(this.buildFlatGround(0x7a6a4e));
      for (const r of rooms) scene.add(this.buildRoomFloor(r));
      // 깔개는 방바닥 **뒤에** 더한다 — 먼저 깔면 방바닥이 덮는다
      for (const g of cityData?.rugs ?? []) scene.add(this.buildRug(g));
    } else {
      scene.add(this.buildGround());
    }
    if (this.city) scene.add(this.city.group);
  }

  /** 흡수된 오브젝트를 개별 Mesh로 승격. 인스턴스에서는 지운다. */
  promote(obj: WorldObject): Mesh {
    this.pool.hide(obj.combo, obj.slot);
    const mesh = new Mesh(this.geometries[obj.combo]!, this.materials[obj.color]!);
    mesh.position.copy(obj.pos);
    mesh.rotation.set(0, obj.rotY, 0);
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
      const index = boxes.push([minX, maxX, minZ, maxZ]) - 1;
      for (let cx = Math.floor(minX / BLOCK_CELL); cx <= Math.floor(maxX / BLOCK_CELL); cx++) {
        for (let cz = Math.floor(minZ / BLOCK_CELL); cz <= Math.floor(maxZ / BLOCK_CELL); cz++) {
          const key = (cx + 2048) * 4096 + (cz + 2048);
          let list = grid.get(key);
          if (!list) grid.set(key, (list = []));
          list.push(index);
        }
      }
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
    mesh.position.set(rug.cx, 0.006, rug.cz);
    mesh.name = 'rug';
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
