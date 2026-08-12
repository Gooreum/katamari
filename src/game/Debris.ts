import { Mesh, Scene, Vector3 } from 'three';
import type { AttachedItem } from './Katamari';

const GRAVITY = -18;
const BOUNCE = 0.35;
const FRICTION = 0.86;
const SPIN = 6;

export interface Debris {
  mesh: Mesh;
  velocity: Vector3;
  spin: Vector3;
  volume: number;
  size: number;
  label: string;
  resting: boolean;
  /** 다시 먹히기까지의 유예. 없으면 튕겨나가자마자 재흡수된다. */
  cooldown: number;
}

/**
 * 충돌로 떨어져 나간 부착물들.
 *
 * 공간 해시는 정적이라 여기 넣을 수 없다. 대신 별도 배열로 관리하고
 * 선형 검사한다 — 수십 개 규모라 충분하고, 오히려 이게 단순하다.
 */
export class DebrisField {
  readonly items: Debris[] = [];
  private readonly tmp = new Vector3();

  constructor(private readonly scene: Scene) {}

  get count(): number { return this.items.length; }

  /**
   * 부착물을 월드로 돌려보낸다.
   * scene.attach()가 월드 트랜스폼을 보존하며 부모를 되돌린다 —
   * 흡수의 정확한 역연산이다.
   */
  scatter(attached: AttachedItem[], origin: Vector3, impulse: Vector3, spread: number): void {
    for (const item of attached) {
      this.scene.attach(item.mesh);

      // 공 중심에서 바깥으로 + 충격 반대 방향 + 랜덤 산란
      this.tmp.subVectors(item.mesh.position, origin);
      if (this.tmp.lengthSq() < 1e-9) this.tmp.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      this.tmp.normalize();

      const velocity = new Vector3()
        .addScaledVector(this.tmp, spread * (0.6 + Math.random() * 0.8))
        .addScaledVector(impulse, 0.5 + Math.random() * 0.5);
      velocity.y = spread * (0.5 + Math.random() * 0.9);

      this.items.push({
        mesh: item.mesh,
        velocity,
        spin: new Vector3(
          (Math.random() - 0.5) * SPIN,
          (Math.random() - 0.5) * SPIN,
          (Math.random() - 0.5) * SPIN,
        ),
        volume: item.volume,
        size: item.size,
        label: item.label,
        resting: false,
        cooldown: 0.7,
      });
    }
  }

  step(dt: number): void {
    for (const d of this.items) {
      if (d.cooldown > 0) d.cooldown -= dt;
      if (d.resting) continue;

      d.velocity.y += GRAVITY * dt;
      d.mesh.position.addScaledVector(d.velocity, dt);
      d.mesh.rotation.x += d.spin.x * dt;
      d.mesh.rotation.y += d.spin.y * dt;
      d.mesh.rotation.z += d.spin.z * dt;

      const rest = d.size * 0.5;
      if (d.mesh.position.y <= rest) {
        d.mesh.position.y = rest;
        if (Math.abs(d.velocity.y) < 0.4) {
          // 충분히 느려졌으면 눕힌다 — 계속 시뮬하면 프레임만 먹는다
          d.velocity.set(0, 0, 0);
          d.spin.set(0, 0, 0);
          d.resting = true;
        } else {
          d.velocity.y *= -BOUNCE;
          d.velocity.x *= FRICTION;
          d.velocity.z *= FRICTION;
          d.spin.multiplyScalar(FRICTION);
        }
      }
    }
  }

  remove(index: number): Debris {
    const d = this.items[index]!;
    this.items.splice(index, 1);
    return d;
  }
}
