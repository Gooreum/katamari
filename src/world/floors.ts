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

/**
 * 이끼. **일본 정원 바닥의 바탕이다.**
 *
 * 한 가지 초록으로 칠하면 흙을 초록으로 바꾼 것에 그친다 — 뒷마당이
 * `F_DIRT` 색면 하나였을 때가 정확히 그 상태였고, 화면 절반이 그 한 장이었다.
 * 이끼가 이끼로 읽히는 건 **덩어리진 얼룩**이다: 밝기가 다른 초록 원반을
 * 반지름 6 → 3 → 2 로 줄여가며 겹쳐 깔면 가장자리가 서로 갉아먹어서 결이 생긴다.
 * 다다미의 짚 얼룩·`buildGround` 의 잔디 얼룩과 같은 수법이다.
 *
 * 128px = 1.8m. 반지름 6px 는 실제 8cm 짜리 이끼 덩어리다.
 */
export function buildMossTexture(): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const cx = cv.getContext('2d')!;

  cx.fillStyle = '#5f7a3a';                       // 바탕 이끼
  cx.fillRect(0, 0, 128, 128);

  // 덩어리. 소수 곱 나머지로 흩어야 새로고침해도 같은 무늬가 나온다
  const blob = (n: number, r: number, color: string, a: number, b: number): void => {
    cx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      cx.beginPath();
      cx.arc((i * a) % 128, (i * b) % 128, r, 0, Math.PI * 2);
      cx.fill();
    }
  };
  blob(90, 6, '#6d8a41', 3121, 4483);
  blob(140, 3, '#557033', 2657, 3931);
  blob(200, 2, '#7b9a4b', 1861, 2939);

  // 낙엽 몇 점. 이끼만 있으면 「초록 장판」이고, 떨어진 게 있어야 «바깥»이 된다
  cx.fillStyle = '#8a6a34';
  for (let i = 0; i < 24; i++) cx.fillRect((i * 5417) % 128, (i * 2711) % 128, 3, 2);

  return finish(cv);
}

/**
 * 갈퀴질한 흰 자갈 — 카레산스이(枯山水).
 *
 * **이 텍스처의 정체는 자갈이 아니라 «고랑»이다.** 흰 점만 찍으면 그냥 모래고,
 * 일정 간격 고랑이 있어야 「사람이 갈퀴로 그었다」가 읽힌다. 일본 정원을
 * 한눈에 알아보게 하는 표식이 이 줄 하나다.
 *
 * 128px = 1.8m 이므로 16px ≈ 22cm 주기 — 실제 갈퀴 이 간격이 그쯤이다.
 * 고랑은 **그림자 2px 바로 밑에 이랑 마루 1px** 을 붙여야 «패였다»로 보인다.
 * 어두운 줄만 그으면 종이에 그은 선이다.
 */
export function buildGravelTexture(): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const cx = cv.getContext('2d')!;

  cx.fillStyle = '#ddd8c8';
  cx.fillRect(0, 0, 128, 128);

  // 자갈알. 2px = 실제 2.8cm — 자갈 한 알의 크기다
  for (let i = 0; i < 700; i++) {
    const v = 196 + ((i * 6151) % 40);
    cx.fillStyle = `rgb(${v},${v - 4},${v - 18})`;
    cx.fillRect((i * 29) % 128, (i * 47) % 128, 2, 2);
  }

  // 고랑. 128 / 16 = 여덟 줄이라 타일 이음매에서 간격이 안 어긋난다
  for (let k = 0; k < 128; k += 16) {
    cx.fillStyle = '#b6b0a0'; cx.fillRect(0, k, 128, 2);
    cx.fillStyle = '#efeade'; cx.fillRect(0, k + 2, 128, 1);
  }

  return finish(cv);
}

/** 방 정의(`StageRoom.floorTex`)가 고르는 이름 → 생성 함수. */
export const FLOOR_TEX = {
  tatami: buildTatamiTexture,
  rug: buildRugTexture,
  wood: buildWoodTexture,
  moss: buildMossTexture,
  gravel: buildGravelTexture,
} as const;

export type FloorTex = keyof typeof FLOOR_TEX;
