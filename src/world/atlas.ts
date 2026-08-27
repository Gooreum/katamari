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

const GRID = 4;                          // 4 × 4 = 16칸
const CELL = 128;                        // 한 칸 128px
const SIZE = GRID * CELL;                // 512px

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
