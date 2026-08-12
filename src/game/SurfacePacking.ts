import { Vector3 } from 'three';
import { TUNING } from './tuning';

/**
 * 공 표면에 붙은 물체 하나가 차지하는 영역.
 *
 * 최근 부착물은 공이 커질 때 표면을 "타고" 바깥으로 밀려난다(dist 증가).
 * 그러면 각반경이 줄어들어 새 물체가 그 사이를 파고들 여지가 생긴다 —
 * 커질수록 표면이 촘촘해지는 게 이래서다.
 *
 * 오래된 것은 고정(freeze)되고, 그때부터 표면이 지나가며 삼킨다.
 */
export interface Bump {
  /** 단위벡터. 공의 회전 프레임 기준이라 굴러도 유효하다. */
  readonly dir: Vector3;
  /** 중심으로부터의 거리. 표면을 타는 동안 갱신된다. */
  dist: number;
  /** 겹침 판정 반경 */
  readonly radius: number;
  /** 중심에서 본 각반경 = asin(radius / dist) */
  ang: number;
  dead: boolean;
}

/**
 * 구면 패킹.
 *
 * 새 물체를 붙일 때 접촉 방향에서 시작해서, 이미 붙은 것들과 겹치면
 * 접선 방향으로 밀어내며 반복 완화한다. Lloyd relaxation의 구면 버전.
 *
 * 이게 없으면 물체들이 같은 자리에 겹쳐 박혀서 공이 그냥 커지기만 한다 —
 * "덩어리" 느낌의 정체가 이 겹침 해소다.
 *
 * 가속 구조 없이 선형 검사다. 묻힌 범프를 계속 쳐내서 후보 수를 낮게 유지하고,
 * 그래도 많으면 각반경 큰 것 위주로 자른다 (작은 건 시각적으로 덜 중요).
 * 구면 격자는 필요해지면 그때 넣는다.
 */
export class SurfacePacking {
  private bumps: Bump[] = [];
  private readonly candidates: Bump[] = [];
  private readonly push = new Vector3();
  private readonly tangent = new Vector3();
  private readonly best = new Vector3();
  private readonly trial = new Vector3();

  get count(): number { return this.bumps.length; }

  add(bump: Bump): void {
    this.bumps.push(bump);
  }

  /**
   * dir을 제자리에서 수정한다 — 겹치지 않는 가장 가까운 방향으로.
   *
   * 완화만으로는 부족하다: 이웃에 대칭적으로 둘러싸이면 밀어내는 힘이 서로
   * 상쇄되어 제자리에 갇힌다. 그래서 완화 후에도 겹쳐 있으면 무작위 지점에서
   * 다시 시도하고, 침범량이 가장 적은 결과를 택한다.
   */
  resolve(dir: Vector3, ang: number): void {
    this.collect(dir, ang);
    if (this.candidates.length === 0) return;

    this.relax(dir, ang);
    let bestPenalty = this.penalty(dir, ang);
    if (bestPenalty <= 0) return;

    this.best.copy(dir);
    for (let attempt = 0; attempt < TUNING.packRestarts; attempt++) {
      this.randomDirection(this.trial);
      // 무작위 지점은 후보 집합이 다르므로 다시 모은다
      this.collect(this.trial, ang);
      this.relax(this.trial, ang);
      const p = this.penalty(this.trial, ang);
      if (p < bestPenalty) {
        bestPenalty = p;
        this.best.copy(this.trial);
        if (p <= 0) break;
      }
    }
    dir.copy(this.best);
  }

  /** 겹친 총량(라디안). 0이면 자리를 찾은 것. */
  private penalty(dir: Vector3, ang: number): number {
    let sum = 0;
    for (const b of this.candidates) {
      const cos = Math.min(1, Math.max(-1, dir.dot(b.dir)));
      const over = ang + b.ang - Math.acos(cos);
      if (over > 0) sum += over;
    }
    return sum;
  }

  private randomDirection(out: Vector3): void {
    // 구면 균등 샘플링 — z를 균등하게 뽑아야 극에 뭉치지 않는다
    const z = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    out.set(r * Math.cos(t), r * Math.sin(t), z);
  }

  private relax(dir: Vector3, ang: number): void {
    for (let iter = 0; iter < TUNING.relaxIterations; iter++) {
      this.push.set(0, 0, 0);
      let overlapping = false;

      for (const b of this.candidates) {
        const cos = Math.min(1, Math.max(-1, dir.dot(b.dir)));
        const actual = Math.acos(cos);
        const needed = ang + b.ang;
        if (actual >= needed) continue;
        overlapping = true;

        // b.dir에 수직이면서 dir 쪽을 향하는 성분 = b에서 멀어지는 접선
        this.tangent.copy(dir).addScaledVector(b.dir, -cos);
        if (this.tangent.lengthSq() < 1e-10) {
          // dir이 b.dir과 같거나 정반대 — 아무 수직 방향이나 잡는다
          this.tangent.set(dir.z, dir.x, dir.y).cross(dir);
          if (this.tangent.lengthSq() < 1e-10) this.tangent.set(1, 0, 0);
        }
        this.tangent.normalize();
        this.push.addScaledVector(this.tangent, needed - actual);
      }

      if (!overlapping) break;
      dir.addScaledVector(this.push, TUNING.relaxStrength).normalize();
    }
  }

  /** 완화 중 이동할 여유까지 감안해 넉넉히 후보를 뽑는다. */
  private collect(dir: Vector3, ang: number): void {
    this.candidates.length = 0;
    const limit = Math.min(this.bumps.length, TUNING.packCheckLimit);
    for (let i = 0; i < limit; i++) {
      const b = this.bumps[i]!;
      if (b.dead) continue;
      const cos = Math.min(1, Math.max(-1, dir.dot(b.dir)));
      if (Math.acos(cos) < ang + b.ang + 0.4) this.candidates.push(b);
    }
  }

  /**
   * 표면 아래로 완전히 잠긴 범프를 버린다.
   * 후보 수를 낮게 유지하는 유일한 장치이므로 주기적으로 꼭 불러야 한다.
   * 남은 것은 각반경 내림차순으로 정렬 — 잘라야 할 때 큰 것부터 남기려고.
   */
  prune(ballRadius: number): void {
    let write = 0;
    for (const b of this.bumps) {
      if (b.dead || b.dist + b.radius < ballRadius) continue;
      this.bumps[write++] = b;
    }
    this.bumps.length = write;
    this.bumps.sort((a, b) => b.ang - a.ang);
  }

  clear(): void {
    this.bumps.length = 0;
  }
}
