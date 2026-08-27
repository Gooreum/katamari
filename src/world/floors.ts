import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace } from 'three';

/**
 * 실내 바닥 텍스처. 전부 **절차적으로 그린다** — 이미지 파일을 안 쓴다.
 *
 * `World.buildGround()` 가 이미 같은 수법을 쓰고 있고, 그 규약을 그대로 따른다:
 *
 *   1. **`colorSpace = SRGBColorSpace`** — 빼면 three 가 캔버스의 sRGB 값을 선형값으로
 *      착각해서 두 배 가까이 밝게 그린다. `buildGround` 주석에 그 버그 이력이 남아 있다.
 *   2. **`magFilter = NearestFilter`** — 저해상도 타일을 흐리게 늘리지 않는다.
 *      다다미 짜임결은 1px 줄이라 보간하면 뭉개져서 그냥 초록 얼룩이 된다.
 *   3. **무작위 대신 결정적 수열** — 새로고침해도 같은 무늬가 나와야 한다.
 *
 * ## 왜 단색으로는 안 되는가
 *
 * 원작(Katamari Damacy REROLL) 거실 바닥은 **다다미·카펫·마루 세 재질**이고 각각
 * 텍스처가 있다. 우리는 `F_TATAMI = 0xc8d27a` 단색 평면 한 장이었다.
 * 화면 면적의 절반이 바닥이라 여기가 평평하면 나머지를 아무리 손봐도 평평해 보인다.
 */

/** 텍스처 한 장이 덮는 실제 크기(m). 다다미 두 장 × 두 장이 이 안에 들어간다. */
export const TILE_M = 1.8;

/** 공통 마무리. 세 함수가 같은 규약을 어기지 않도록 한 곳에 모은다. */
function finish(cv: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.magFilter = NearestFilter;
  return tex;
}

/**
 * 다다미. **매트마다 결 방향이 90° 교대**하는 게 이 바닥의 정체다 —
 * 원작 스크린샷에서도 결이 엇갈려 깔려 있다. 결이 한 방향이면 그냥 초록 장판이다.
 *
 * 128px = 1.8m 안에 64px(0.9m) 매트 넷을 2×2로 넣고, 대각선끼리 같은 방향을 준다.
 * 경계에는 **헤리**(다다미 테두리 천)를 어두운 띠로 깐다. 이 띠가 매트를 매트로 가른다.
 */
export function buildTatamiTexture(): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const cx = cv.getContext('2d')!;

  cx.fillStyle = '#c8d27a';               // 기존 F_TATAMI 와 같은 색을 바탕으로 쓴다
  cx.fillRect(0, 0, 128, 128);

  // 짜임결. 3px 주기 1px 줄. 2px 주기 + 강한 대비로 처음 그렸더니 골덴처럼 보였다 —
  // 원작 다다미는 결이 훨씬 은근하고, 매트를 가르는 건 결이 아니라 헤리다.
  const grain = (ox: number, oy: number, vertical: boolean): void => {
    cx.fillStyle = '#c1cb72';
    for (let k = 0; k < 64; k += 3) {
      if (vertical) cx.fillRect(ox + k, oy, 1, 64);
      else cx.fillRect(ox, oy + k, 64, 1);
    }
  };
  grain(0, 0, false);
  grain(64, 0, true);
  grain(0, 64, true);
  grain(64, 64, false);

  // 짚 얼룩. 완전히 균일하면 플라스틱처럼 보인다 (buildGround 와 같은 이유).
  for (let i = 0; i < 260; i++) {
    const v = 198 + ((i * 7919) % 14);
    cx.fillStyle = `rgb(${v},${v + 8},${v - 78})`;
    cx.fillRect((i * 37) % 128, (i * 53) % 128, 1, 1);
  }

  // 헤리 — 매트 경계의 짙은 천. 안쪽 십자 + 타일 바깥 테두리.
  cx.fillStyle = '#4a5533';
  cx.fillRect(62, 0, 3, 128);
  cx.fillRect(0, 62, 128, 3);
  cx.fillRect(0, 0, 128, 2);
  cx.fillRect(0, 0, 2, 128);

  return finish(cv);
}

/**
 * 러그. 원작 거실에서 분홍 카펫이 다다미를 **대각선으로** 가른다 —
 * 그 한 장이 "바닥이 여러 재질"이라는 인상의 절반을 만든다.
 *
 * 무늬는 테두리의 점선 하나면 충분하다. 카펫 면적이 넓어서 무늬가 촘촘하면
 * 그 위에 놓인 물건이 안 읽힌다.
 */
export function buildRugTexture(): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const cx = cv.getContext('2d')!;

  cx.fillStyle = '#d98a90';
  cx.fillRect(0, 0, 64, 64);

  // 보풀. 카펫이 천으로 보이려면 면이 미세하게 흔들려야 한다.
  for (let i = 0; i < 200; i++) {
    const v = 208 + ((i * 6151) % 12);
    cx.fillStyle = `rgb(${v},${v - 70},${v - 62})`;
    cx.fillRect((i * 29) % 64, (i * 47) % 64, 1, 1);
  }

  // 안쪽 점선 테두리. 러그가 "깔린 물건"이라는 걸 이 선이 말한다.
  cx.fillStyle = '#f2dcd0';
  for (let k = 0; k < 64; k += 4) {
    cx.fillRect(k, 4, 2, 1);
    cx.fillRect(k, 59, 2, 1);
    cx.fillRect(4, k, 1, 2);
    cx.fillRect(59, k, 1, 2);
  }

  return finish(cv);
}

/**
 * 마루. 판자 이음새가 방향을 주고, 나뭇결이 재질을 준다.
 * 판자 한 장을 세로로 길게 잡아 복도·툇마루에서 길이 방향이 읽히게 한다.
 */
export function buildWoodTexture(): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const cx = cv.getContext('2d')!;

  cx.fillStyle = '#cf9042';               // 기존 F_WOOD 와 같은 색
  cx.fillRect(0, 0, 64, 64);

  // 나뭇결 — 가로로 흐르는 옅은 줄.
  for (let i = 0; i < 150; i++) {
    const y = (i * 41) % 64;
    const w = 6 + ((i * 13) % 18);
    cx.fillStyle = i % 3 === 0 ? '#c4842f' : '#d99a51';
    cx.fillRect((i * 23) % 64, y, w, 1);
  }

  // 판자 이음새. 16px = 0.45m 폭 판자.
  cx.fillStyle = '#96601f';
  for (let k = 0; k < 64; k += 16) cx.fillRect(0, k, 64, 1);
  // 짧은 마구리 이음새를 엇갈리게 — 한 줄로 맞으면 판자가 아니라 격자가 된다.
  cx.fillRect(20, 0, 1, 16);
  cx.fillRect(46, 16, 1, 16);
  cx.fillRect(8, 32, 1, 16);
  cx.fillRect(34, 48, 1, 16);

  return finish(cv);
}

/** 방 정의(`StageRoom.floorTex`)가 고르는 이름 → 생성 함수. */
export const FLOOR_TEX = {
  tatami: buildTatamiTexture,
  rug: buildRugTexture,
  wood: buildWoodTexture,
} as const;

export type FloorTex = keyof typeof FLOOR_TEX;
