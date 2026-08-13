import {
  BufferAttribute, CanvasTexture, RepeatWrapping, SRGBColorSpace, Vector2,
  type BufferGeometry, type Color, type ExtrudeGeometry, type UVGenerator,
} from 'three';
import type { BuildingKind } from './cityData';

/**
 * 타일 한 장 = 4칸 x 4칸. 한 칸이 창 하나 + 그 층의 슬래브다.
 *
 * 4칸인 이유: 건물마다 **다른 칸에서 시작**시켜 불 켜진 창 배치를 흩기 위해서다.
 * 1칸이면 모든 건물이 같은 자리에 불이 켜진다. 8칸이면 텍스처가 4배 무거워지는데
 * 그만큼 다양해지지는 않는다 — 어차피 색·층고·베이폭이 따로 흔들리고 있다.
 */
const GRID = 4;
const CELL = 64;
const SIZE = GRID * CELL; // 256px

/**
 * 벽 바탕색. 흰색(1.0)이 아니라 살짝 낮춘다.
 *
 * 텍스처는 정점색에 **곱해진다.** 바탕이 1.0이면 어떤 텍셀도 벽보다 밝을 수 없어서
 * "불 켜진 창"을 만들 방법이 없다. 0.94로 깔아두면 창 하나를 1.0 근처로 올릴 여지가 생긴다.
 * 대신 건물 전체가 6% 어두워지는데, KIND_COLOR가 원래 밝은 쪽이라 보정하지 않는다.
 */
const WALL = '#efece6';

/**
 * 건물 외벽 한 장. 가로세로 모두 이어붙는다(RepeatWrapping).
 *
 * `fillStyle`과 `fillRect`만 쓴다 — `tools/citycheck.ts`의 document 스텁이 그 둘만
 * 흉내내기 때문이다. 그라데이션이나 path를 쓰면 헤드리스 도구가 죽는다.
 * `World.ts`의 지면 텍스처가 같은 제약 아래 같은 수법을 쓴다.
 */
export function buildFacadeTexture(): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  const cx = cv.getContext('2d')!;
  cx.fillStyle = WALL;
  cx.fillRect(0, 0, SIZE, SIZE);

  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const x = i * CELL;
      const y = j * CELL;
      // 층 경계 슬래브. 이 줄 하나가 멀리서 층수를 읽히게 한다 —
      // 창은 거리가 멀어지면 뭉개지는데 가로줄은 끝까지 남는다.
      // 5px → 9px. 심시티는 층 구분선이 굵다.
      cx.fillStyle = '#b9b2a6';
      cx.fillRect(x, y + CELL - 9, CELL, 9);

      // 불 켜진 창 8%. 결정적 수열이라 새로고침해도 같은 창에 불이 켜진다.
      // World.ts 지면 얼룩과 같은 수법.
      // **비율은 건드리지 않는다** — 사용자가 "소수만 켜기"로 고른 값이다.
      const lit = ((i * 7 + j * 13) * 7919) % 100 < 8;
      // 창을 키운다. 셀 면적의 43.4% → 58.0%. 꺼진 창도 더 진하게 —
      // 얇고 흐린 격자는 조금만 멀어져도 뭉개져서 벽이 얼룩덜룩한 판이 됐다.
      //
      // 더 키우지 않는 이유는 **`FLAT_UV`가 설 자리** 때문이다. 창을 키울수록 벽 여백이
      // 얇아지는데, 그 여백이 옥상·물탱크·1층 띠가 집어가는 무지 텍셀의 유일한 후보다.
      // 지금 여백이 5~6px이고 그 절반이 `FLAT_UV`의 안전거리다.
      cx.fillStyle = lit ? '#fff8e2' : '#37404f';
      cx.fillRect(x + 5, y + 6, CELL - 10, CELL - 20);
      // 세로 창틀. 없으면 창 하나가 통유리 한 장으로 뭉개져서 창이 아니라 얼룩이 된다.
      // 2px → 4px. 굵은 격자는 거리가 멀어져도 격자로 남는다.
      cx.fillStyle = lit ? '#dcd0b0' : '#5c6675';
      cx.fillRect(x + CELL / 2 - 2, y + 6, 4, CELL - 20);
    }
  }

  const tex = new CanvasTexture(cv);
  // 이걸 빼면 three가 캔버스의 sRGB 값을 **선형값으로 착각**해서 두 배 가까이 밝게 그린다.
  // World.ts:325가 같은 이유로 같은 줄을 갖고 있다.
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  // 눈높이에서 벽이 비스듬히 보일 때 창이 죽처럼 뭉개지는 걸 막는다.
  // NearestFilter는 쓰지 않는다 — 지면과 달리 건물은 먼 거리가 대부분이라 지글거린다.
  tex.anisotropy = 4;
  return tex;
}

/**
 * 종류별 층고·베이폭(m).
 *
 * **같은 텍스처인데 밀도가 달라 다른 건물로 읽힌다.** 이게 팔레트 다음가는 변주 장치다.
 * 오피스는 층고가 높고 창이 촘촘하고(커튼월), 빌라는 층고가 낮고 창이 성기다.
 *
 * 예전에는 실측값에 맞췄다 — 주거 층고 2.8~2.9m, 업무 3.8m가 한국 표준이다.
 * 심시티는 **비례를 과장한다.** 층고를 25% 키우면 같은 높이 건물의 층수가 그만큼 줄고,
 * 창 하나가 그만큼 커진다. 텍스처를 아무리 굵게 그려도 45m 건물에 층이 15겹이면
 * 눈높이 밖에서는 결국 뭉갠다 — 크게 보이게 하는 건 텍스처가 아니라 **층수**다.
 * 베이폭도 같이 키워서 가로 방향 창도 넓힌다.
 */
export const FACADE_SCALE: Record<BuildingKind, { readonly floor: number; readonly bay: number }> = {
  apartment: { floor: 3.6, bay: 4.6 },
  lowrise: { floor: 3.4, bay: 4.8 },
  commercial: { floor: 4.4, bay: 4.0 },
  civic: { floor: 4.6, bay: 5.4 },
  retail: { floor: 4.0, bay: 4.4 },
};

/**
 * 창이 없는 텍셀 한 점. 옥상·옥탑·상가 띠처럼 창 격자가 깔리면 안 되는 면이 쓴다.
 *
 * 좌표를 눈으로 고른 게 아니다. three는 기본이 `flipY = true`라 v=0이 캔버스 **아래쪽**이다.
 * (0.0098, 0.9902)는 캔버스 (2.5, 2.5) — 칸 왼쪽·위쪽 벽 여백이 겹치는 구석이다.
 * v를 0.004 근처로 내리면 슬래브 줄에 얹혀서 옥상이 회색으로 나온다.
 *
 * **창을 키우면서 같이 옮겨야 했다.** 예전 값 (0.008, 0.98)은 캔버스 (2.05, 5.12)인데,
 * 새 창이 y=6에서 시작해 여백이 0.88px밖에 안 남았다. 그 정도면 밉맵 한 단계만 내려가도
 * 옥상에 창 색이 번진다. 지금 값은 좌 2.5px · 하 3.5px를 확보한다.
 */
export const FLAT_UV = new Vector2(0.0098, 0.9902);

/**
 * ExtrudeGeometry용 UV 생성기. 건물 한 채마다 새로 만든다.
 *
 * three 기본 `WorldUVGenerator`는 월드 좌표를 그대로 uv로 쓴다 — 창 크기가 건물이 서 있는
 * **위치**에 따라 달라진다. 원점에서 먼 건물일수록 창이 잘게 쪼개진다. 그래서 직접 만든다.
 *
 * **창을 딱 떨어지게 넣는다.** 벽 길이를 베이폭으로 나눠 반올림한 개수로 다시 나눈다.
 * 그래서 모서리에서 창이 반토막 나지 않는다. 층도 같은 방식이다 —
 * 대신 실제 층고가 종류별 기준값에서 조금씩 어긋나는데, 잘린 창보다 그게 낫다.
 *
 * @param uCell 0~3. 건물마다 타일의 다른 칸에서 시작하게 해 **불 켜진 창 배치를 흩는다.**
 *              타일이 4칸 주기로 이어지므로 정수 칸만큼 밀면 이음매가 생기지 않는다.
 */
export function facadeUV(
  height: number, floorM: number, bayM: number, uCell: number, vCell: number,
): UVGenerator {
  const floors = Math.max(1, Math.round(height / floorM));
  const vScale = floors / Math.max(height, 0.01) / GRID;
  const uBase = uCell / GRID;
  const vBase = vCell / GRID;

  return {
    // 캡(옥상·바닥)은 창이 아니다. 세 꼭짓점을 무지 텍셀 한 점으로 보낸다.
    // 세 점이 같으므로 삼각형 전체가 그 한 텍셀 색이 된다.
    generateTopUV: (): Vector2[] => [FLAT_UV, FLAT_UV, FLAT_UV],

    generateSideWallUV: (
      _geometry: ExtrudeGeometry, vertices: number[],
      ia: number, ib: number, ic: number, id: number,
    ): Vector2[] => {
      // a, b는 벽 아래 모서리 두 점. c, d는 그 위. a→b가 벽이 뻗는 방향이다.
      const ax = vertices[ia * 3], ay = vertices[ia * 3 + 1];
      const dx = vertices[ib * 3] - ax, dy = vertices[ib * 3 + 1] - ay;
      const len = Math.hypot(dx, dy) || 1;
      const uScale = Math.max(1, Math.round(len / bayM)) / len / GRID;
      // z가 압출 축이다. 회전(rotateX)은 압출이 끝난 뒤라 여기서는 y가 아니라 z가 높이다.
      const at = (i: number): Vector2 => new Vector2(
        ((vertices[i * 3] - ax) * dx + (vertices[i * 3 + 1] - ay) * dy) / len * uScale + uBase,
        vertices[i * 3 + 2] * vScale + vBase,
      );
      return [at(ia), at(ib), at(ic), at(id)];
    },
  };
}

/**
 * 1층 간판 색.
 *
 * 서울 길거리가 색색인 건 건물이 아니라 **간판** 때문이다. 외벽 팔레트는 전부
 * 무채에 가까운 저채도인데, 눈높이에서 보이는 띠 하나만 채도를 올리면
 * 같은 건물들이 전혀 다른 거리로 읽힌다.
 */
export const SIGN_HUE = [0xc4433a, 0x2f6fb0, 0xe0a020, 0x3f9257, 0xd2621f];

/**
 * 1층 유리. 벽보다 확실히 어두워야 유리로 읽히지만, **너무 어두우면 구멍이 된다.**
 * 처음 0x2b3038로 잡았다가 지상 컷에서 새까만 띠가 나와서 올렸다 —
 * 반사가 없는 램버트라 실제 유리보다 밝게 잡아야 유리처럼 보인다.
 */
export const SHOP_GLASS = 0x49515e;

/** 아파트·공공건물 저층부. 간판 대신 화강암 — 아파트 1층에 간판이 붙으면 거짓말이다. */
export const PODIUM_STONE = 0x6b6862;

/** 창 격자를 지운다. 물탱크·상가 유리처럼 벽이 아닌 면에 쓴다. */
export function flattenUV(geo: BufferGeometry): void {
  const n = geo.attributes.position.count;
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    uv[i * 2] = FLAT_UV.x;
    uv[i * 2 + 1] = FLAT_UV.y;
  }
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
}

/** 지오메트리 전체를 한 색으로 칠한다. 청크 병합은 정점색을 요구한다. */
export function paint(geo: BufferGeometry, color: Color): void {
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = color.r;
    c[i * 3 + 1] = color.g;
    c[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new BufferAttribute(c, 3));
}
