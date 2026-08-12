import type { Vector3 } from 'three';

/**
 * 2D 그리드 공간 해시 (y축은 무시 — 전부 바닥에 놓여있으므로).
 * 공이 커지면 조회 셀 수가 O(R²)로 늘어나므로 셀 크기를 반지름에 맞춰 키우는 게
 * 다음 최적화 지점이다. 지금 규모(수천 개)에서는 고정 셀로 충분하다.
 */
export class SpatialHash {
  private cells = new Map<number, number[]>();
  /** 중복 방문 방지용 프레임 스탬프. Set 할당보다 훨씬 싸다. */
  private stamp: Int32Array;
  private frame = 0;

  constructor(private readonly cellSize: number, capacity: number) {
    this.stamp = new Int32Array(capacity).fill(-1);
  }

  private key(i: number, j: number): number {
    // 좌표를 32비트 하나로. ±32767 셀 범위면 충분하다.
    return ((i + 32768) << 16) | (j + 32768);
  }

  insert(index: number, pos: Vector3, half: Vector3): void {
    const c = this.cellSize;
    const i0 = Math.floor((pos.x - half.x) / c), i1 = Math.floor((pos.x + half.x) / c);
    const j0 = Math.floor((pos.z - half.z) / c), j1 = Math.floor((pos.z + half.z) / c);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const k = this.key(i, j);
        let bucket = this.cells.get(k);
        if (!bucket) this.cells.set(k, (bucket = []));
        bucket.push(index);
      }
    }
  }

  /** 원과 겹칠 가능성이 있는 인덱스를 out에 채운다. 중복 없음. */
  query(x: number, z: number, radius: number, out: number[]): number[] {
    out.length = 0;
    const f = ++this.frame;
    const c = this.cellSize;
    const i0 = Math.floor((x - radius) / c), i1 = Math.floor((x + radius) / c);
    const j0 = Math.floor((z - radius) / c), j1 = Math.floor((z + radius) / c);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const bucket = this.cells.get(this.key(i, j));
        if (!bucket) continue;
        for (let n = 0; n < bucket.length; n++) {
          const idx = bucket[n]!;
          if (this.stamp[idx] === f) continue;
          this.stamp[idx] = f;
          out.push(idx);
        }
      }
    }
    return out;
  }
}
