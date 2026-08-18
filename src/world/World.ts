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
import type { CityData } from './cityData';

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

    if (cityData) {
      const p = this.findClearSpawn(cityData);
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
    const specs: ObjectSpec[] = generateWorld(
      seed,
      cityData ? {
        count: Math.round(GENERATION.count * Math.min(3, reach / 190)),
        placeMax: reach,
      } : {},
      isBlocked && ((x, z) => isBlocked(x + spawnX, z + spawnZ)),
    );
    if (cityData) {
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
    for (const c of PALETTE) {
      this.materials.push(new MeshLambertMaterial({ color: c, flatShading: true, vertexColors: true }));
    }
    // 인스턴스는 색을 instanceColor로 받으므로 머티리얼 하나면 충분하다.
    const instanceMaterial = new MeshLambertMaterial({
      color: 0xffffff, flatShading: true, vertexColors: true,
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

    scene.add(this.buildGround());
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
