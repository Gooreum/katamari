import {
  BufferAttribute, CanvasTexture, RepeatWrapping, SRGBColorSpace, Vector2,
  type BufferGeometry, type Color, type ExtrudeGeometry, type UVGenerator,
} from 'three';
import type { BuildingKind } from './cityData';

/**
 * 타일 한 장 = 2칸 x 2칸. 한 칸이 창 하나다.
 *
 * 4칸에서 2칸으로 줄였다 — 총 256px은 그대로 두고 셀을 64px에서 128px로 키워
 * **창 하나를 크게** 만들기 위해서다. 괴혼 원작 건물은 촘촘한 격자가 아니라
 * 큰 사각형 몇 개다.
 *
 * 2칸이어도 건물마다 **다른 칸에서 시작**시켜 불 켜진 창 배치를 흩을 수 있다.
 * 흩는 폭이 4칸 때보다 좁아지지만, 어차피 색·층고·베이폭이 따로 흔들리고 있다.
 */
export const FACADE_GRID = 2;
const GRID = FACADE_GRID;
const CELL = 128;
const SIZE = GRID * CELL; // 256px

/**
 * 벽 바탕색. **순백이다.**
 *
 * 예전에는 0.94(`#efece6`)로 깔았다. 텍스처가 정점색에 **곱해지므로** 바탕이 1.0이면
 * 어떤 텍셀도 벽보다 밝을 수 없고, 그러면 "불 켜진 창"을 만들 방법이 없기 때문이었다.
 *
 * 괴혼 낮 화면에서 창은 벽보다 **어둡다.** 그 제약이 사라졌으므로 순백으로 두고
 * 정점색(= 팔레트)이 화면에 그대로 나오게 한다. 건물 전체가 6% 밝아지는 효과도 있다.
 */
const WALL = '#ffffff';

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

      // **칠해진 사각형 하나가 전부다.** 슬래브 줄도 세로 창틀도 없다.
      //
      // 심시티 전환에서는 층 구분선(9px)과 창틀(4px)을 굵게 넣어 "층이 읽히게" 했다.
      // 괴혼 원작 건물은 반대다 — 벽이 주인공이고 창은 점이다. 격자가 촘촘할수록
      // 단색 평면인 길거리 소품과 어긋난다.
      //
      // 창 면적은 셀의 58.0% → 30.6%. 격자를 4x4에서 2x2로 줄여 창 하나를 키웠다.
      const lit = ((i * 7 + j * 13) * 7919) % 100 < 8;
      // 꺼진 창 `#37404f`(거의 검정) → `#5d7183`(회청). 원작 창은 새까맣지 않다.
      // 켜진 창도 벽(순백)보다 어둡게 둔다 — 낮 화면이라 창이 빛날 이유가 없다.
      // **비율 8%는 건드리지 않는다** — 사용자가 "소수만 켜기"로 고른 값이다.
      cx.fillStyle = lit ? '#e8dcc0' : '#5d7183';
      cx.fillRect(x + 26, y + 22, CELL - 52, CELL - 62);
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
 * 창이 없는 텍셀 한 점. 옥상·옥탑·상가 띠처럼 창이 깔리면 안 되는 면이 쓴다.
 *
 * 좌표를 눈으로 고른 게 아니다. three는 기본이 `flipY = true`라 v=0이 캔버스 **아래쪽**이다.
 * (0.043, 0.957)은 캔버스 (11, 11) — 셀 왼쪽·위쪽 벽 여백이 겹치는 구석이다.
 *
 * 격자를 2x2로 줄이면서 셀이 128px이 됐고 창이 (26, 22)에서 시작하므로
 * 여백이 좌 15px · 상 11px 남는다. 슬래브 줄이 없어져서 피할 대상도 하나 줄었다.
 * 예전(4x4)에는 여백이 2.5px뿐이라 밉맵 한 단계만 내려가도 옥상에 창 색이 번졌다.
 */
export const FLAT_UV = new Vector2(0.043, 0.957);

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
 * @param uCell 0~1. 건물마다 타일의 다른 칸에서 시작하게 해 **불 켜진 창 배치를 흩는다.**
 *              타일이 2칸 주기로 이어지므로 정수 칸만큼 밀면 이음매가 생기지 않는다.
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
export const SIGN_HUE = [0xe2685c, 0x5b9ad6, 0xf0c04e, 0x6fc08a, 0xef8f4e];

/**
 * 1층 유리.
 *
 * **공 눈높이에서 화면을 지배하는 게 이 색이다.** 5cm 공의 카메라는 23cm 높이인데
 * 1층 띠는 지면에서 최대 4.2m까지 올라온다 — 화면의 거의 전부가 이 띠다.
 *
 * 0x2b3038 → 0x49515e로 한 번 올린 적이 있고(지상 컷이 새까매서), 그래도 부족했다.
 * 팔레트·그라데이션·조명을 전부 괴혼 값으로 바꾼 뒤에도 공 눈높이 벽이 #282f30이었고,
 * 원인을 추적하니 이 띠였다. 밝은 하늘 유리로 올린다.
 */
export const SHOP_GLASS = 0xa8cbdc;

/** 아파트·공공건물 저층부. 간판 대신 석재 — 아파트 1층에 간판이 붙으면 거짓말이다. */
export const PODIUM_STONE = 0xdcd6c8;

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
