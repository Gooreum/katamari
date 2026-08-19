import {
  BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshLambertMaterial,
  Quaternion, Scene, SphereGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TUNING, canAbsorb, radiusFromVolume, speedAt, volumeFromRadius } from './tuning';
import { SurfacePacking, type Bump } from './SurfacePacking';

export { TUNING } from './tuning';

/** 아직 안 구워진 부착물. 최근 것일수록 바깥이라 먼저 떨어진다. */
export interface AttachedItem {
  mesh: Mesh;
  volume: number;
  size: number;
  label: string;
  bump: Bump;
  /** 겹침 판정 반경 */
  packRadius: number;
  /** 빨려들어가는 연출: 접촉 지점 → 확정 지점 */
  from: Vector3;
  to: Vector3;
  baseScale: Vector3;
  t: number;
}

/** ease-out cubic — 빨려들어가는 느낌은 초반이 빨라야 한다 */
function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

const UP = new Vector3(0, 1, 0);

/**
 * 노드 3단 구성:
 *   pivot  : 위치 (이동)
 *   squash : 비등방 스케일 (찌그러짐) — 회전하지 않아야 충격 방향이 유지된다
 *   group  : 회전 (구르기) — 붙은 물체는 전부 여기 자식
 *
 * 콜라이더는 끝까지 반지름 하나짜리 구(球)다. 원작도 그렇다 —
 * 울퉁불퉁해 보이는 건 메시가 삐져나와서 생기는 착시일 뿐이다.
 */
export class Katamari {
  readonly pivot = new Group();
  readonly squash = new Group();
  readonly group = new Group();

  readonly velocity = new Vector3();
  radius: number;
  /**
   * 이 판의 시작 반지름. **`shed()`의 하한이 이 값이다** —
   * 50cm로 시작한 공이 부딪혀서 5cm까지 쪼그라들면 판이 망가진다.
   */
  private readonly startRadius: number;
  stun = 0;

  /** 렌더 보간용 이전 스텝 상태 */
  readonly prevPos = new Vector3();
  readonly prevQuat = new Quaternion();

  private core: Mesh;
  private volume: number;
  /** 표면을 타는 중 — 공이 커지면 같이 밀려난다 */
  private riding: AttachedItem[] = [];
  /** 고정됨 — 굽기 대기열. 이제부터 표면이 지나가며 삼킨다 */
  private pending: AttachedItem[] = [];
  private readonly packing = new SurfacePacking();
  private animating: AttachedItem[] = [];
  private bakedCount = 0;
  private totalCount = 0;

  // 연출 상태
  private pulse = 0;
  private squashAmount = 0;
  private readonly squashAxis = new Vector3(0, 1, 0);

  private readonly axis = new Vector3();
  private readonly deltaQ = new Quaternion();
  private readonly desired = new Vector3();
  private readonly squashQuat = new Quaternion();
  private readonly dirScratch = new Vector3();

  constructor(scene: Scene, startRadius = TUNING.startRadius) {
    this.startRadius = startRadius;
    this.radius = startRadius;
    this.core = new Mesh(
      new SphereGeometry(1, 28, 20),
      new MeshLambertMaterial({ color: 0x39304f }),
    );
    this.group.add(this.core);
    this.squash.add(this.group);
    this.pivot.add(this.squash);
    this.pivot.position.set(0, this.radius, 0);
    scene.add(this.pivot);

    this.volume = volumeFromRadius(this.radius);
    this.prevPos.copy(this.pivot.position);
  }

  get count(): number { return this.totalCount; }
  get diameter(): number { return this.radius * 2; }
  get speed(): number { return speedAt(this.radius); }
  get shedCandidates(): number { return this.riding.length; }

  snapshot(): void {
    this.prevPos.copy(this.pivot.position);
    this.prevQuat.copy(this.group.quaternion);
  }

  /**
   * 입력을 목표 속도로 삼고 그쪽으로 가속한다.
   * 위치를 직접 대입하던 이전 방식은 관성이 없어서 조작이 로봇 같았고,
   * 무엇보다 튕겨나가기를 구현할 수가 없었다.
   *
   * 가속률이 반지름에 반비례하므로 커질수록 묵직해진다 — 무게감의 정체.
   * 단 그 둔함은 **포화한다**. 선형으로 두면 지름 40m에서 응답이 1.33초가 되어
   * 후반부가 통째로 조작 불능이 된다 (`npm run handling` 참고).
   */
  drive(direction: Vector3, dashing: boolean, dt: number): void {
    if (this.stun > 0) {
      this.stun -= dt;
      this.desired.set(0, 0, 0);
    } else {
      const target = this.speed * (dashing ? TUNING.dashMultiplier : 1);
      this.desired.copy(direction).multiplyScalar(target);
    }

    // 반지름을 그대로 쓰지 않고 dragKnee 로 포화시킨다.
    // 작을 때는 radius 와 거의 같고(2.5cm → 0.0248), 클 때는 dragKnee 로 수렴한다.
    const effRadius = this.radius / (1 + this.radius / TUNING.dragKnee);
    const rate = TUNING.accelRate / (1 + effRadius * TUNING.massDrag);
    this.velocity.lerp(this.desired, 1 - Math.exp(-rate * dt));
  }

  /** 속도를 위치에 적분하고, 실제 이동량으로 굴린다. */
  integrate(dt: number): void {
    const distance = this.velocity.length() * dt;
    if (distance > 1e-9) {
      this.pivot.position.addScaledVector(this.velocity, dt);

      // 회전축 = up × 진행방향, 회전각 = 이동거리 / 반지름.
      // premultiply여야 월드 기준으로 누적되어 굴러가는 것처럼 보인다.
      this.axis.copy(UP).cross(this.velocity);
      if (this.axis.lengthSq() > 1e-12) {
        this.axis.normalize();
        this.deltaQ.setFromAxisAngle(this.axis, distance / this.radius);
        this.group.quaternion.premultiply(this.deltaQ);
      }
    }
    this.pivot.position.y = this.radius;
    this.core.scale.setScalar(this.radius);
  }

  canAbsorb(size: number): boolean {
    return canAbsorb(this.radius, size);
  }

  /**
   * 흡수. mesh는 월드 좌표계에 놓인 상태로 들어와야 한다.
   * Object3D.attach()가 월드 트랜스폼을 보존하며 부모를 갈아끼운다.
   *
   * 배치가 이 함수의 핵심이다:
   *   1. 먼저 성장시킨다 — 새 반지름 기준으로 표면을 잡아야 하니까
   *   2. 접촉 방향에서 시작해 이미 붙은 것들과 겹치지 않는 방향을 찾는다
   *   3. 표면에 **얹는다**. 중심을 안으로 끌어당기는 게 아니라,
   *      물체가 표면을 뚫고 나오도록 거리를 계산한다
   */
  absorb(mesh: Mesh, volume: number, size: number, label: string): void {
    this.group.attach(mesh);
    const from = mesh.position.clone();

    this.volume += volume * TUNING.growth;
    this.radius = radiusFromVolume(this.volume);

    // 겹침 판정용 반경. 실제보다 조금 작게 잡아야 서로 파고들며 뭉쳐 보인다.
    const packRadius = 0.5 * this.maxExtent(mesh) * TUNING.packScale;

    const dist = this.surfaceDistance(packRadius);

    this.dirScratch.copy(from);
    if (this.dirScratch.lengthSq() < 1e-12) this.dirScratch.set(0, 1, 0);
    this.dirScratch.normalize();

    const ang = Math.asin(Math.min(packRadius / dist, 0.999));
    this.packing.resolve(this.dirScratch, ang);

    const bump: Bump = {
      dir: this.dirScratch.clone(),
      dist,
      radius: packRadius,
      ang,
      dead: false,
    };
    this.packing.add(bump);

    const item: AttachedItem = {
      mesh, volume, size, label, bump,
      packRadius,
      from,
      to: this.dirScratch.clone().multiplyScalar(dist),
      baseScale: mesh.scale.clone(),
      t: TUNING.attachTime > 0 ? 0 : 1,
    };
    if (item.t === 1) mesh.position.copy(item.to);
    else this.animating.push(item);

    mesh.visible = true;
    mesh.updateMatrix();

    this.riding.push(item);
    this.totalCount++;

    // 자기 크기에 비해 큰 걸 먹을수록 크게 부푼다
    this.pulse = Math.min(this.pulse + Math.min(size / this.diameter, 1) * TUNING.pulseGain, 1.4);

    this.rideSurface();
    this.freezeOverflow();
    if (this.pending.length >= TUNING.bakeEvery) this.bake();
  }

  /**
   * 표면을 타는 부착물들을 새 반지름에 맞춰 바깥으로 밀어낸다.
   *
   * 이게 없으면 growth 배율(3.5) 때문에 공이 자기 껍질보다 빨리 커져서
   * 붙은 게 죄다 삼켜진다 — 흡수해도 아무 변화가 없어 보이는 원인이었다.
   *
   * dist가 커지면 각반경이 줄어들어 새 물체가 사이를 파고들 여지가 생긴다.
   * 커질수록 표면이 촘촘해지는 것도 이 부수효과다.
   */
  private rideSurface(): void {
    for (const item of this.riding) {
      const dist = this.surfaceDistance(item.packRadius);
      item.bump.dist = dist;
      item.bump.ang = Math.asin(Math.min(item.packRadius / dist, 0.999));
      item.to.copy(item.bump.dir).multiplyScalar(dist);
      if (item.t >= 1) {
        item.mesh.position.copy(item.to);
        item.mesh.updateMatrix();
      }
    }
  }

  /**
   * 표면이 꽉 차면 가장 오래된 것부터 고정한다 — 이제 묻히기 시작한다.
   *
   * 개수가 아니라 점유율 기준인 게 핵심이다. 구면 위 각반경 a인 원뿔의
   * 입체각은 2π(1-cos a)이므로, 전체 4π로 나눈 (1-cos a)/2 를 더하면 점유율이다.
   * 작은 공에는 적게, 큰 공에는 많이 — 자동으로 맞는다.
   */
  private freezeOverflow(): void {
    let coverage = 0;
    for (const item of this.riding) coverage += (1 - Math.cos(item.bump.ang)) / 2;

    while (
      this.riding.length > 1 &&
      (coverage > TUNING.surfaceCoverage || this.riding.length > TUNING.ridePoolSize)
    ) {
      const oldest = this.riding.shift()!;
      coverage -= (1 - Math.cos(oldest.bump.ang)) / 2;
      this.pending.push(oldest);
    }
  }

  /** sink=0.5면 딱 절반이 잠긴다. 낮출수록 많이 튀어나온다. */
  private surfaceDistance(packRadius: number): number {
    return Math.max(
      this.radius - packRadius * (1 - 2 * TUNING.sink),
      packRadius * 0.3,
    );
  }

  /**
   * 충격. 못 먹는 물체와 세게 부딪혔을 때.
   * @param normal 벽에서 공 쪽으로 향하는 단위 벡터
   * @param strength 0..1 로 정규화된 충격 세기
   */
  impact(normal: Vector3, strength: number): void {
    const into = this.velocity.dot(normal);
    if (into < 0) {
      this.velocity.addScaledVector(normal, -(1 + TUNING.restitution) * into);
    }
    this.squashAxis.copy(normal);
    this.squashAmount = Math.min(this.squashAmount + strength * 0.5, 0.45);
    this.stun = Math.max(this.stun, TUNING.stunTime * strength);
  }

  /**
   * 부착물을 떼어낸다. 최근 것부터 — 바깥에 있으니 물리적으로도 맞다.
   * 구워진 지오메트리는 못 뗀다. 깊이 파묻힌 건 안 떨어지는 게 자연스러우니
   * 이 제약이 오히려 규칙이 된다.
   */
  shed(count: number): AttachedItem[] {
    const n = Math.min(count, this.riding.length);
    if (n <= 0) return [];
    const items = this.riding.splice(this.riding.length - n, n);
    const floor = volumeFromRadius(this.startRadius);

    for (const item of items) {
      this.volume = Math.max(floor, this.volume - item.volume * TUNING.growth);
      item.mesh.visible = true;
      item.bump.dead = true;
      item.t = 1;
    }
    this.animating = this.animating.filter((a) => !items.includes(a));
    this.radius = radiusFromVolume(this.volume);
    this.totalCount -= n;
    this.rideSurface();
    return items;
  }

  /** 연출 상태 감쇠 + 스케일 적용 + 부착 애니메이션 */
  updateFeel(dt: number): void {
    if (this.animating.length > 0) {
      const rate = dt / TUNING.attachTime;
      let write = 0;
      for (const item of this.animating) {
        item.t = Math.min(1, item.t + rate);
        const e = easeOut(item.t);
        item.mesh.position.lerpVectors(item.from, item.to, e);
        // 자리잡는 순간 살짝 부풀었다 돌아온다 — 툭 박히는 느낌
        item.mesh.scale.copy(item.baseScale).multiplyScalar(1 + Math.sin(e * Math.PI) * 0.22);
        item.mesh.updateMatrix();
        if (item.t < 1) {
          this.animating[write++] = item;
        } else {
          item.mesh.scale.copy(item.baseScale);
          item.mesh.updateMatrix();
        }
      }
      this.animating.length = write;
    }

    this.pulse *= Math.exp(-TUNING.pulseDecay * dt);
    this.squashAmount *= Math.exp(-TUNING.squashDecay * dt);

    const u = 1 + this.pulse * 0.12;
    const s = this.squashAmount;
    if (s > 0.002) {
      // squash 노드의 Y축을 충격 방향에 맞추고 그 축으로만 누른다
      this.squashQuat.setFromUnitVectors(UP, this.squashAxis);
      this.squash.quaternion.copy(this.squashQuat);
      this.squash.scale.set(u * (1 + s * 0.5), u * (1 - s), u * (1 + s * 0.5));
    } else {
      this.squash.quaternion.identity();
      this.squash.scale.setScalar(u);
    }
  }

  private bake(): void {
    const geometries: BufferGeometry[] = [];
    const color = new Color();

    for (const item of this.pending) {
      const { mesh } = item;
      // 애니메이션 중이면 최종 위치로 스냅 — 중간 상태를 구우면 안 된다
      if (item.t < 1) {
        mesh.position.copy(item.to);
        mesh.updateMatrix();
        item.t = 1;
      }
      this.group.remove(mesh);

      // 완전히 잠긴 건 영원히 안 보인다 — 굽지 않고 버린다
      if (item.bump.dist + item.bump.radius < this.radius) {
        item.bump.dead = true;
        continue;
      }

      const geo = mesh.geometry.clone();
      geo.applyMatrix4(mesh.matrix);
      geo.deleteAttribute('uv');

      // 정점색은 머티리얼 색에 **곱해지는 계수**다 — 덮어쓰면 안 된다.
      //   · 형태 지오메트리: 바퀴·창문 대비가 구운 순간 사라진다
      //   · 건물(City.ts): 색이 전부 정점색에 있고 머티리얼은 흰색이라 통째로 하얘진다.
      //     흡수한 건물이 구워지는 순간 하얗게 변하던 게 이 버그였다.
      color.copy((mesh.material as MeshLambertMaterial).color);
      const n = geo.attributes.position!.count;
      const src = geo.getAttribute('color') as BufferAttribute | undefined;
      const colors = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        colors[i * 3] = color.r * (src ? src.getX(i) : 1);
        colors[i * 3 + 1] = color.g * (src ? src.getY(i) : 1);
        colors[i * 3 + 2] = color.b * (src ? src.getZ(i) : 1);
      }
      geo.setAttribute('color', new BufferAttribute(colors, 3));
      geometries.push(geo);
    }
    this.pending.length = 0;
    this.animating.length = 0;

    if (geometries.length === 0) return;
    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    if (!merged) return;

    const baked = new Mesh(
      merged,
      new MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    );
    baked.frustumCulled = false;
    baked.name = `baked_${this.bakedCount++}`;
    this.group.add(baked);
  }

  private maxExtent(mesh: Mesh): number {
    return Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z);
  }

  /**
   * 완전히 잠긴 것만 숨긴다.
   * 이전 기준(중심거리 < R * 0.92)은 근거 없는 숫자였고, 부착 직후의 물체를
   * 즉시 지워버려서 작은 것들이 통째로 증발하는 원인이었다.
   */
  cullBuried(): void {
    // 표면을 타는 것은 정의상 묻히지 않는다. 고정된 것만 검사한다.
    for (const item of this.pending) {
      if (!item.mesh.visible) continue;
      if (item.bump.dist + item.bump.radius < this.radius) item.mesh.visible = false;
    }
    this.packing.prune(this.radius);
  }

  get bumpCount(): number { return this.packing.count; }

  get drawCalls(): number {
    return 1 + this.bakedCount + this.riding.length +
      this.pending.filter((p) => p.mesh.visible).length;
  }

  /** 지금 표면에 보이는 부착물 수 — 덩어리감의 직접 지표 */
  get visibleAttached(): number {
    return this.riding.length + this.pending.filter((p) => p.mesh.visible).length;
  }
}
