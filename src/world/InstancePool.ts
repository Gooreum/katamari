import {
  BufferGeometry, Color, Group, InstancedMesh, Material, Matrix4, Object3D,
} from 'three';

const HIDDEN = new Matrix4().makeScale(0, 0, 0);
const WHITE = new Color(1, 1, 1);

/**
 * (geometry, material) 조합마다 InstancedMesh 하나.
 * 월드 오브젝트 수천 개 → 드로우콜 십여 개.
 *
 * 이게 모바일 성패를 가른다. 타일 기반 GPU는 드로우콜 하나하나가 비싸서
 * 개별 Mesh 1000개면 그냥 죽는다. 그리고 이 구조는 나중에 retrofit이
 * 거의 불가능하니 처음부터 깔고 간다.
 *
 * 흡수된 오브젝트는 행렬을 0 스케일로 눌러서 숨긴다 —
 * 슬롯 재활용은 필요 없다 (한 번 먹으면 안 돌아옴).
 */
export class InstancePool {
  readonly group = new Group();
  private meshes: InstancedMesh[] = [];
  private cursors: number[] = [];
  private dirty = new Set<number>();
  private dirtyColor = new Set<number>();

  /**
   * @param combos 조합별 (geometry, material, 최대 개수)
   */
  constructor(combos: ReadonlyArray<{ geometry: BufferGeometry; material: Material; count: number }>) {
    this.group.name = 'InstancePool';
    for (const { geometry, material, count } of combos) {
      // 버퍼는 최소 1칸 잡되(0이면 three가 거부한다), 실제로 쓰는 개수가 0이면
      // count를 0으로 둬서 렌더를 건너뛴다. 63종이 다 채워지면 기본 도형 4개는
      // 아무 물체도 안 쓰는데, 그대로 두면 빈 InstancedMesh 4개가 드로우콜만 먹는다.
      const mesh = new InstancedMesh(geometry, material, Math.max(count, 1));
      mesh.count = count;
      mesh.frustumCulled = false;   // 인스턴스 전체 AABB가 월드만 하므로 컬링 의미 없음
      for (let i = 0; i < mesh.count; i++) {
        mesh.setMatrixAt(i, HIDDEN);
        // 색을 인스턴스 속성으로 넘기면 머티리얼을 공유할 수 있다.
        // geometry×material 조합마다 메시를 만들 필요가 없어져서 드로우콜이 1/12로 준다.
        mesh.setColorAt(i, WHITE);
      }
      this.meshes.push(mesh);
      this.cursors.push(0);
      this.group.add(mesh);
    }
  }

  /** 슬롯을 할당하고 인덱스를 돌려준다. 꽉 찼으면 -1. */
  alloc(combo: number): number {
    const cursor = this.cursors[combo]!;
    if (cursor >= this.meshes[combo]!.count) return -1;
    this.cursors[combo] = cursor + 1;
    return cursor;
  }

  setTransform(combo: number, slot: number, obj: Object3D): void {
    obj.updateMatrix();
    this.meshes[combo]!.setMatrixAt(slot, obj.matrix);
    this.dirty.add(combo);
  }

  setColor(combo: number, slot: number, color: Color): void {
    this.meshes[combo]!.setColorAt(slot, color);
    this.dirtyColor.add(combo);
  }

  hide(combo: number, slot: number): void {
    this.meshes[combo]!.setMatrixAt(slot, HIDDEN);
    this.dirty.add(combo);
  }

  /** 변경된 인스턴스 버퍼만 GPU에 올린다. 렌더 직전 한 번. */
  flush(): void {
    for (const combo of this.dirty) {
      this.meshes[combo]!.instanceMatrix.needsUpdate = true;
    }
    for (const combo of this.dirtyColor) {
      const attr = this.meshes[combo]!.instanceColor;
      if (attr) attr.needsUpdate = true;
    }
    this.dirty.clear();
    this.dirtyColor.clear();
  }

  /** 실제로 그려지는 조합 수. count가 0인 것은 GPU에 안 간다. */
  get drawCalls(): number {
    return this.meshes.reduce((n, m) => n + (m.count > 0 ? 1 : 0), 0);
  }
}
