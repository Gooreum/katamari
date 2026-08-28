import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three';

/**
 * 인쇄 아틀라스. 물건 표면의 **인쇄물**을 한 장에 모아 그린다.
 *
 * ## 왜 필요한가
 *
 * 원작(REROLL) 거실의 우유팩은 **소 그림과 「牛乳」가 인쇄돼 있어서** 우유팩이다.
 * 주사위 눈, 성냥갑 라벨, 카드 무늬도 마찬가지다. 우리 물건은 면당 단색이라
 * 형태만 남고 화면에서는 색덩어리로 읽혔다.
 *
 * ## 정점색으로는 원리상 안 되는 이유
 *
 * `shapes.kit.ts` 의 정점색은 팔레트 색에 **곱해지는 계수**다. 계수는 1.0 을 못 넘으므로
 * **본체보다 밝아질 수 없다.** 그래서 `PAPER = [0.92, 0.9, 0.86]` 같은 종이 계수는
 * 본체를 8% 어둡게 만들 뿐이고, 실측 대비가 **1.2:1** 이었다 — 눈에 안 보인다.
 * 「종이 띠가 있어야 지우개로 읽힌다」고 적어둔 그 띠가 원리상 안 보이고 있었다.
 * 텍스처는 그 제약을 안 받는다.
 *
 * ## 드로우콜은 안 는다
 *
 * 월드 인스턴스는 머티리얼 **하나**를 공유한다. 거기에 `map` 을 하나 붙일 뿐이라
 * 조합이 늘지 않는다. 그래서 아틀라스여야 한다 — 물건마다 텍스처를 주면
 * 머티리얼이 갈라져서 드로우콜이 물건 종류만큼 는다.
 *
 * ## 타일 0 은 순백이다
 *
 * `assemble()` 의 기본값이라, 타일을 안 지정한 부품은 흰색을 곱하는 것과 같아
 * **지금까지와 픽셀 하나 안 달라진다.** 88종 중 8종만 실제 인쇄를 받는다.
 */

/**
 * 5 × 5 = 25칸. 4×4(16칸)로 시작했는데 인쇄가 15종이 되면서 꽉 찼다 —
 * 다음에 한 종만 더 늘려도 못 넣는다.
 *
 * 640px 은 2의 거듭제곱이 아니지만 **밉맵도 반복도 안 쓴다**(아래 `generateMipmaps`,
 * `wrapS` 미설정 참고). 그 둘이 NPOT 제약의 전부라 WebGL2 에서 문제가 없다.
 */
const GRID = 5;
const CELL = 128;                        // 한 칸 128px
const SIZE = GRID * CELL;                // 640px

export const TILE = {
  /** 순백. 기본값 — 이걸 쓰면 텍스처가 없는 것과 같다 */
  BLANK: 0,
  DICE: 1,
  MATCHBOX: 2,
  NEWSPAPER: 3,
  FLYER: 4,
  CARAMEL: 5,
  GUM: 6,
  BATTERY: 7,
  ERASER: 8,
  /**
   * 우유팩. 소 얼룩 + 색 띠.
   *
   * 이 파일 첫 문단에 「원작 우유팩은 소 그림이 인쇄돼 있어서 우유팩이다」라고
   * 적어놓고 정작 안 만들었었다. 레퍼런스 한 프레임에 넷이 나오는 물건이다.
   */
  MILK: 9,
  /** 화투. 붉은 띠 + 검은 문양 */
  CARD: 10,
  /** 접시. 청색 테두리 — 흰 원반을 접시로 만드는 것 */
  PLATE: 11,
  /** 찻잔. 청색 띠 */
  TEACUP: 12,
  /** 연필깎이. 라벨 띠 + 눈금 */
  SHARPENER: 13,
  /** RC 컨트롤러. 버튼판 */
  RC: 14,
} as const;

/**
 * 타일 n 이 차지하는 UV 사각형 `[u0, v0, u1, v1]`.
 *
 * **가장자리를 반 픽셀 물린다.** 안 그러면 이웃 타일의 색이 새어 들어온다
 * (`NearestFilter` 라도 부동소수 오차로 경계에서 튄다).
 */
export function tileUv(tile: number): readonly [number, number, number, number] {
  const i = Math.max(0, Math.min(GRID * GRID - 1, tile | 0));
  const pad = 0.5 / SIZE;
  const u0 = (i % GRID) / GRID, v0 = Math.floor(i / GRID) / GRID;
  return [u0 + pad, v0 + pad, u0 + 1 / GRID - pad, v0 + 1 / GRID - pad];
}

/** 칸 n 의 좌상단 픽셀 좌표 */
function cell(tile: number): readonly [number, number] {
  return [(tile % GRID) * CELL, Math.floor(tile / GRID) * CELL];
}

export function buildPrintAtlas(): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  const cx = cv.getContext('2d')!;

  // **전체를 흰색으로 시작한다.** 안 그린 칸을 누가 참조해도 무해하다.
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, SIZE, SIZE);

  /** 칸 안 좌표계로 그린다 — 각 그리기 함수가 0~128 을 쓰게 해준다 */
  const at = (tile: number, draw: () => void): void => {
    const [ox, oy] = cell(tile);
    cx.save();
    cx.translate(ox, oy);
    cx.beginPath();
    cx.rect(0, 0, CELL, CELL);
    cx.clip();
    draw();
    cx.restore();
  };

  // ── 주사위 ── 눈이 곧 주사위다. 5면을 한 칸에 넣고 부품이 골라 쓴다.
  at(TILE.DICE, () => {
    cx.fillStyle = '#fdfaf2';
    cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#2a2724';
    const pip = (x: number, y: number): void => {
      cx.beginPath();
      cx.arc(x, y, 11, 0, Math.PI * 2);
      cx.fill();
    };
    pip(64, 64);                                   // 가운데 = 1
    cx.fillStyle = '#c0392b';                      // 원작 주사위는 1이 붉다
    pip(64, 64);
    cx.fillStyle = '#2a2724';
    pip(28, 28); pip(100, 100);                    // 대각 = 2
    pip(100, 28); pip(28, 100);                    // 나머지 대각 = 4
  });

  // ── 성냥갑 ── 라벨과 마찰지. 이 둘이 성냥갑을 상자와 가른다.
  at(TILE.MATCHBOX, () => {
    cx.fillStyle = '#d9534f';
    cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#f5efe0';
    cx.fillRect(16, 30, 96, 62);                   // 라벨 바탕
    cx.fillStyle = '#8b2b28';
    cx.fillRect(16, 30, 96, 8);
    cx.fillRect(16, 84, 96, 8);
    // 상표 자리 — 글자는 이 해상도에서 뭉개지므로 도형으로 낸다
    cx.beginPath(); cx.arc(64, 61, 18, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = '#3a3330';
    cx.fillRect(0, 0, CELL, 14);                   // 마찰지
    cx.fillRect(0, CELL - 14, CELL, 14);
  });

  // ── 신문 ── 활자 덩어리. 읽히지 않아도 "인쇄면"으로 읽힌다.
  at(TILE.NEWSPAPER, () => {
    cx.fillStyle = '#efe9dc';
    cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#2b2b2b';
    cx.fillRect(10, 10, 108, 12);                  // 제호
    cx.fillStyle = '#7a7770';
    for (let row = 0; row < 9; row++) {
      const y = 32 + row * 10;
      // 3단 조판. 줄 길이를 결정적으로 흔들어 활자처럼 보이게 한다
      for (let col = 0; col < 3; col++) {
        const x = 10 + col * 37;
        const w = 22 + ((row * 7 + col * 13) % 12);
        cx.fillRect(x, y, w, 3);
      }
    }
  });

  // ── 찌라시 ── 신문과 달리 색이 있고 큼직하다. 그게 전단이다.
  at(TILE.FLYER, () => {
    cx.fillStyle = '#fff8e6';
    cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#e04b32';
    cx.fillRect(8, 12, 112, 26);
    cx.fillStyle = '#2f6fb5';
    cx.fillRect(8, 48, 60, 10);
    cx.fillRect(8, 66, 84, 10);
    cx.fillStyle = '#f2b21e';
    cx.beginPath(); cx.arc(96, 92, 22, 0, Math.PI * 2); cx.fill();
  });

  // ── 캐러멜 상자 ── 세로 띠 포장.
  at(TILE.CARAMEL, () => {
    cx.fillStyle = '#c9762a';
    cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#f5e3c0';
    cx.fillRect(30, 0, 68, CELL);
    cx.fillStyle = '#8a3f1c';
    cx.fillRect(30, 40, 68, 48);
    cx.fillStyle = '#f5e3c0';
    cx.fillRect(42, 54, 44, 8);
    cx.fillRect(42, 70, 44, 8);
  });

  // ── 껌 ── 은박 + 띠지.
  at(TILE.GUM, () => {
    cx.fillStyle = '#d7dce0';
    cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#3fbfc4';
    cx.fillRect(0, 34, CELL, 60);
    cx.fillStyle = '#f4f1e8';
    cx.fillRect(0, 52, CELL, 10);
    cx.fillRect(0, 70, CELL, 6);
  });

  // ── 건전지 ── 라벨 띠 + 극 표시.
  at(TILE.BATTERY, () => {
    cx.fillStyle = '#2f2e2c';
    cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#e0a020';
    cx.fillRect(0, 26, CELL, 76);
    cx.fillStyle = '#2f2e2c';
    cx.fillRect(0, 26, CELL, 8);
    cx.fillRect(0, 94, CELL, 8);
    cx.fillStyle = '#f4f1e8';
    cx.fillRect(48, 52, 32, 8);                    // +
    cx.fillRect(60, 40, 8, 32);
  });

  // ── 지우개 ── 종이 띠. 정점색 계수로는 원리상 못 만들던 바로 그 부품이다.
  at(TILE.ERASER, () => {
    cx.fillStyle = '#f4f1e8';
    cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#2f6fb5';
    cx.fillRect(0, 24, CELL, 80);
    cx.fillStyle = '#f4f1e8';
    cx.fillRect(0, 44, CELL, 6);
    cx.fillRect(0, 78, CELL, 6);
    cx.fillStyle = '#e58aa8';
    cx.fillRect(20, 56, 88, 16);
  });

  // ── 우유팩 ── 흰 바탕 + 위아래 색 띠 + 소 얼룩. 이 셋이면 우유팩으로 읽힌다.
  // 「牛乳」 글자는 128px 에서 뭉개져서 얼룩으로 대신한다 (성냥갑 상표와 같은 판단).
  at(TILE.MILK, () => {
    cx.fillStyle = '#fbf7ee';
    cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#d94b3a';
    cx.fillRect(0, 10, CELL, 16);
    cx.fillStyle = '#2f6fb5';
    cx.fillRect(0, 102, CELL, 14);
    cx.fillStyle = '#2a2724';
    cx.beginPath(); cx.arc(46, 62, 21, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.arc(84, 47, 12, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.arc(88, 82, 15, 0, Math.PI * 2); cx.fill();
    // 소 얼룩만 있으면 젖소 무늬 상자다. 붉은 점 하나가 상표 자리를 만든다
    cx.fillStyle = '#d94b3a';
    cx.beginPath(); cx.arc(64, 62, 7, 0, Math.PI * 2); cx.fill();
  });

  // ── 화투 ── 붉은 띠 + 검은 문양. 원작 거실 바닥에 흩어져 있는 그것.
  at(TILE.CARD, () => {
    cx.fillStyle = '#f7f2e6';
    cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#2a2724';
    cx.fillRect(6, 6, CELL - 12, CELL - 12);
    cx.fillStyle = '#f7f2e6';
    cx.fillRect(10, 10, CELL - 20, CELL - 20);
    cx.fillStyle = '#c0392b';
    cx.fillRect(10, 10, CELL - 20, 30);          // 윗단 붉은 띠
    cx.fillStyle = '#2a2724';                     // 솔가지 느낌의 검은 덩이
    cx.beginPath(); cx.arc(48, 78, 16, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.arc(80, 92, 11, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = '#f2b21e';
    cx.beginPath(); cx.arc(84, 62, 9, 0, Math.PI * 2); cx.fill();
  });

  // ── 접시 ── 청색 테두리. 흰 원반을 접시로 만드는 건 이 띠 하나다.
  at(TILE.PLATE, () => {
    cx.fillStyle = '#fbfaf6';
    cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#2f6fb5';
    cx.fillRect(0, 14, CELL, 7);
    cx.fillRect(0, 106, CELL, 7);
    // 테두리 문양 — 점선이라야 손그림 도자기로 읽힌다
    cx.fillStyle = '#4f8fd0';
    for (let k = 4; k < CELL; k += 16) cx.fillRect(k, 28, 8, 5);
    cx.fillStyle = '#3fbfc4';
    cx.beginPath(); cx.arc(64, 68, 13, 0, Math.PI * 2); cx.fill();
  });

  // ── 찻잔 ── 몸통을 두르는 청색 띠.
  at(TILE.TEACUP, () => {
    cx.fillStyle = '#fbfaf6';
    cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#2f6fb5';
    cx.fillRect(0, 40, CELL, 18);
    cx.fillStyle = '#fbfaf6';
    for (let k = 0; k < CELL; k += 20) cx.fillRect(k, 40, 8, 18);
    cx.fillStyle = '#3fbfc4';
    cx.fillRect(0, 74, CELL, 6);
  });

  // ── 연필깎이 ── 라벨 띠 + 눈금. 회색 상자를 기계로 만든다.
  at(TILE.SHARPENER, () => {
    cx.fillStyle = '#e8e4da';
    cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#2f6fb5';
    cx.fillRect(0, 30, CELL, 34);
    cx.fillStyle = '#f4f1e8';
    cx.fillRect(12, 40, 60, 14);                 // 상표 자리
    cx.fillStyle = '#2a2724';
    for (let k = 12; k < CELL - 12; k += 10) cx.fillRect(k, 84, 3, 12);   // 눈금
    cx.fillStyle = '#e0483c';
    cx.beginPath(); cx.arc(100, 47, 8, 0, Math.PI * 2); cx.fill();
  });

  // ── RC 컨트롤러 ── 버튼판. 검은 판 위의 표시가 조종기를 조종기로 만든다.
  at(TILE.RC, () => {
    cx.fillStyle = '#3a3936';
    cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#f5c22b';
    cx.fillRect(10, 12, CELL - 20, 10);
    cx.fillStyle = '#c9ccd1';
    cx.fillRect(16, 40, 40, 40);
    cx.fillRect(72, 40, 40, 40);
    cx.fillStyle = '#3a3936';
    cx.fillRect(32, 46, 8, 28);                  // 십자 표시
    cx.fillRect(22, 56, 28, 8);
    cx.fillStyle = '#e0483c';
    cx.beginPath(); cx.arc(92, 60, 11, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = '#8fcf3a';
    cx.fillRect(16, 96, 96, 8);
  });

  const tex = new CanvasTexture(cv);
  // 빼면 three 가 캔버스의 sRGB 값을 선형값으로 착각해 두 배 밝게 그린다
  // (`World.buildGround()` 주석에 그 버그 이력이 남아 있다).
  tex.colorSpace = SRGBColorSpace;
  // 타일 경계가 보간으로 섞이면 옆 칸 색이 샌다. 반복도 안 한다 —
  // UV 가 이미 자기 칸 안으로 접혀 있어서 wrap 이 일어날 일이 없다.
  tex.magFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.minFilter = NearestFilter;
  /**
   * **뒤집지 않는다.** three 는 기본으로 캔버스를 세로 반전해서 올린다(`flipY = true`).
   * 그런데 `tileUv()` 는 캔버스 좌표(위→아래) 그대로 칸을 계산한다 — 반전이 끼면
   * 칸이 어긋나서 주사위 자리에서 빈 칸을 읽는다. 실제로 주사위가 민짜로 나왔다.
   * 좌표계를 하나로 맞추는 게 UV 쪽에 보정을 넣는 것보다 헷갈릴 여지가 적다.
   */
  tex.flipY = false;
  return tex;
}

/** `getPrintAtlas()` 가 들고 있는 한 장. 모듈 수준이라 import 하는 쪽이 같은 걸 본다. */
let cached: CanvasTexture | null = null;

/**
 * 아틀라스 **한 장**을 공유한다.
 *
 * 월드 인스턴스·팔레트(`World`)와 **구운 공**(`Katamari.bake`)이 같은 장을 봐야
 * GPU 텍스처가 하나로 유지된다. 각자 `buildPrintAtlas()` 를 부르면 같은 그림을
 * 두 장 올리게 된다.
 *
 * **DOM 이 없으면 null.** `tools/placecheck.ts` 같은 Node 검사는 `World` 를 그대로
 * 생성하는데, 생성자에서 `document.createElement('canvas')` 를 타면 그 도구들이
 * 통째로 죽는다 — 실제로 죽였다. 가드를 호출부마다 두는 대신 여기 한 곳에 모은다.
 *
 * 스테이지 전환은 페이지 리로드라(`main.ts:52`) 캐시가 낡을 일이 없다.
 */
export function getPrintAtlas(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  if (!cached) cached = buildPrintAtlas();
  return cached;
}
