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
 * 7 × 7 = 49칸. 5×5(25칸)에 데칼 19칸을 쓰고 있었는데 **재질 칸 16개**를 넣으면 넘친다.
 *
 * `tileUv()`·`cell()` 이 전부 `GRID` 에서 파생되므로 기존 칸 번호를 그대로 두고
 * **호출부를 한 줄도 안 고친다** — 칸의 «위치»만 재배치된다.
 *
 * 896px 은 2의 거듭제곱이 아니지만 **밉맵도 반복도 안 쓴다**(아래 `generateMipmaps`,
 * `wrapS` 미설정 참고). 그 둘이 NPOT 제약의 전부라 WebGL2 에서 문제가 없다.
 */
const GRID = 7;
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
  /**
   * 책 표지. 제목 띠 + 글줄.
   *
   * 여기부터 넷은 **거실을 알아보게 하려고** 생긴 칸이다. 사용자가
   * 「오브젝트들이 정확히 뭔지 잘 모르겠다」고 했을 때, 부품을 늘리는 것보다
   * 인쇄를 주는 게 훨씬 세다 — 시계는 문자판이 있어야 시계고 책은 표지가 있어야 책이다.
   */
  BOOK: 15,
  /** 비디오테이프 라벨. 손글씨 줄 + 릴 구멍 두 개 */
  VIDEO: 16,
  /** 탁상시계 문자판. 눈금 12개 + 바늘 둘 */
  CLOCK: 17,
  /** 액자 속 사진. 산·해 — 뭐가 됐든 «그림이 들어 있다»가 읽히면 된다 */
  PICTURE: 18,

  /**
   * ── 면 «재질» — 여러 물건이 나눠 쓴다 ────────────────────
   *
   * 위 19칸은 전부 **한 물건 전용 데칼**이다(주사위 눈, 우유팩 소 그림).
   * 여기부터는 **면 재질**이다 — 나뭇결 하나를 서랍장·책장·상·의자가 나눠 쓴다.
   *
   * ## 왜 필요한가
   *
   * 물체 146종 중 인쇄를 쓰는 게 18종이었고, 놓이는 크기 20cm 이상 85종 중
   * **81종의 «제일 큰 부품»이 단색**이었다. 화면을 채우는 건 형상의 제일 큰 면인데
   * 그게 전부 민무늬라 서랍장은 갈색 판, 벽은 베이지 평면으로 보인다 —
   * 형태를 세 번 다듬어도 안 바뀐 이유가 이것이다.
   *
   * ## 그리는 규약 — **흰 바탕에 어두운 무늬**
   *
   * 텍스처는 팔레트 색에 **곱해진다**. 흰 바탕(1.0)은 색을 그대로 통과시키고
   * 어두운 무늬만 얹힌다. 그래서 나뭇결 칸 하나가 갈색 서랍장에도, 붉은 의자에도
   * 각자 색을 살린 채 결만 얹는다. 무늬에 «색»을 넣으면 그 물건의 팔레트 색과
   * 곱해져 탁해진다 — 무늬는 **회갈색 반투명**으로만 그린다.
   */
  /** 나뭇결(거친) — 서랍장·책장·상 같은 큰 면 */
  WOOD_C: 19,
  /** 나뭇결(고운) — 젓가락·연필처럼 결이 촘촘해야 하는 것 */
  WOOD_F: 20,
  /** 천 짜임 — 방석·이불·백팩 */
  CLOTH: 21,
  /** 골판지 결 — 상자류 */
  CARDBOARD: 22,
  /** 종이 — 신문·전단·공책 */
  PAPER: 23,
  /** 브러시 금속 — 냄비·주전자·양동이 */
  METAL: 24,
  /** 도기 유약 얼룩 — 찻잔·접시·화분 */
  CERAMIC: 25,
  /** 플라스틱 성형 줄 — 페트병·휴지통 */
  PLASTIC: 26,
  /** 짚 짜임 — 방석·돗자리 */
  STRAW: 27,
  /** 책 표지(재질용) — 띠 두 줄 */
  COVER: 28,
  /** 나뭇잎 결 — 잎 덩이 */
  LEAF: 29,
  /** 돌 결 — 정원돌·징검돌·석등 */
  STONE: 30,
  /** 가전 패널 — 격자 + 버튼 자리 */
  PANEL: 31,
  /** 고무 — 타이어·손잡이 */
  RUBBER: 32,
  /** 흙·모래 */
  DIRT: 33,
  /** 벽지 잔무늬 — 벽·천장 */
  WALLPAPER: 34,
  /**
   * 잔물결 — 욕조·변기·물확에 담긴 물.
   *
   * 물을 부품 «두 장»(수면 + 뜬 김)으로 만들었더니 둘이 같은 평면에서 겹쳐
   * z-fighting 이 났다. **무늬는 부품이 아니라 인쇄로 넣는 게 맞다** —
   * 삼각형도 줄고 겹칠 데도 없다.
   */
  WATER: 35,
  /**
   * 단추 얼굴 — 테두리 단 + 구멍 넷.
   *
   * 단추는 **납작하고 민짜**라 튀어나올 데도 대비를 얹을 넓은 면도 없다. 게다가
   * 팔레트에 검정이 있어서 계수로는 어떤 대비도 못 만든다(검정 × 0.22 = 더 검정).
   * 그런 물건의 정답은 처음부터 «무늬»다.
   */
  BUTTON: 36,
  /** 각설탕 — 눌러 굳힌 알갱이 결. 민짜 정육면체는 흰 상자다 */
  SUGAR: 37,
  /** 비누 — 눌러 찍은 글자 자리. 판때기로 붙이면 대비가 0.05 라 안 보인다 */
  SOAP: 38,
  /** 달걀 껍질 얼룩 — 민짜 타원은 골프공과 구별이 안 된다 */
  EGG: 39,
  /** 유리 — 안이 비치는 결. 구슬·유리병처럼 «붙일 데가 없는» 것들이 쓴다 */
  GLASSY: 40,
  /** 브라운관 화면 — 주사선. 검은 판만으로는 「꺼진 상자」다 */
  SCREEN: 41,
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

  // ── 책 표지 ── 제목 띠와 글줄. 민짜 판때기와 책을 가르는 건 이것뿐이다.
  at(TILE.BOOK, () => {
    cx.fillStyle = '#a8442e';
    cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#f0e3c8';                     // 위아래 가름끈
    cx.fillRect(0, 16, CELL, 5);
    cx.fillRect(0, CELL - 21, CELL, 5);
    cx.fillStyle = '#f7efdc';                     // 제목 띠
    cx.fillRect(18, 36, CELL - 36, 34);
    cx.fillStyle = '#2a2724';                     // 제목 글줄 둘
    cx.fillRect(26, 44, 76, 8);
    cx.fillRect(26, 57, 48, 6);
    cx.fillStyle = '#e8d9b4';                     // 지은이
    cx.fillRect(26, 88, 54, 6);
    cx.fillRect(26, 100, 34, 5);
  });

  // ── 비디오테이프 라벨 ── 손글씨 줄과 릴 구멍. 90년대 거실의 물건이다.
  at(TILE.VIDEO, () => {
    cx.fillStyle = '#2e2c2a';
    cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#e9e4d6';                     // 라벨 종이
    cx.fillRect(12, 10, CELL - 24, 46);
    cx.fillStyle = '#3a5f8a';                     // 손글씨 세 줄
    cx.fillRect(20, 20, 70, 6);
    cx.fillRect(20, 32, 88, 5);
    cx.fillRect(20, 42, 44, 5);
    cx.fillStyle = '#1a1918';                     // 릴 창
    cx.fillRect(20, 72, 88, 34);
    cx.fillStyle = '#5c5854';
    cx.beginPath(); cx.arc(42, 89, 13, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.arc(86, 89, 13, 0, Math.PI * 2); cx.fill();
  });

  // ── 시계 문자판 ── 눈금 열둘과 바늘 둘. **이게 없으면 그냥 원통이다.**
  at(TILE.CLOCK, () => {
    cx.fillStyle = '#f6efdd';
    cx.fillRect(0, 0, CELL, CELL);
    const cxp = 64, cyp = 64;
    cx.fillStyle = '#2a2724';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const long = i % 3 === 0;
      const r0 = long ? 40 : 45, r1 = 52;
      cx.save();
      cx.translate(cxp + Math.sin(a) * (r0 + r1) / 2, cyp - Math.cos(a) * (r0 + r1) / 2);
      cx.fillRect(-(long ? 5 : 3), -(r1 - r0) / 2, long ? 10 : 6, r1 - r0);
      cx.restore();
    }
    cx.fillRect(cxp - 4, cyp - 34, 8, 36);        // 긴바늘 — 12시
    cx.fillRect(cxp - 2, cyp - 3, 28, 7);         // 짧은바늘 — 3시
    cx.fillStyle = '#c0392b';
    cx.beginPath(); cx.arc(cxp, cyp, 6, 0, Math.PI * 2); cx.fill();
  });

  // ── 액자 속 사진 ── 산과 해. 「그림이 들어 있다」만 읽히면 된다.
  at(TILE.PICTURE, () => {
    cx.fillStyle = '#bcd4e0';                     // 하늘
    cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#f2c14e';                     // 해
    cx.beginPath(); cx.arc(96, 34, 15, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = '#6f8f6a';                     // 뒷산
    cx.beginPath(); cx.arc(40, 118, 56, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = '#4f6b4c';                     // 앞산
    cx.beginPath(); cx.arc(96, 126, 46, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = '#8a9a72';                     // 들
    cx.fillRect(0, 112, CELL, CELL - 112);
  });

  /**
   * ── 면 «재질» 열여섯 ─────────────────────────────────────
   *
   * **전부 흰 바탕에 회갈색 반투명 무늬다.** 텍스처는 팔레트 색에 곱해지므로
   * 흰 바탕이 색을 통과시키고 무늬만 얹힌다 — 나뭇결 한 칸이 갈색 서랍장에도
   * 붉은 의자에도 각자 색을 살린 채 결만 준다.
   *
   * 무늬에 «색»을 넣으면 그 물건 색과 곱해져 탁해진다. 그래서 `rgba(회갈, a)` 만 쓴다.
   */
  /** 흰 바탕 — 재질 칸의 공통 시작 */
  const base = (): void => { cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, CELL, CELL); };
  /** 결정적 의사난수 — 새로고침해도 같은 무늬가 나와야 한다 */
  const rnd = (i: number, m: number): number => ((i * 9301 + 49297) % 233280) / 233280 * m;

  /**
   * 나뭇결. **결은 «폭이 다른 줄이 한 방향으로 흐르는 것»이다.**
   * 균일한 줄만 그으면 골덴이지 나무가 아니라, 줄 폭과 진하기를 흩어야 한다.
   * 그리고 **옹이가 하나 있어야 나무다** — 결만 있으면 빗살이다.
   */
  const grain = (lines: number, knot: boolean): void => {
    base();
    for (let i = 0; i < lines; i++) {
      const y = rnd(i * 7 + 3, CELL);
      const w = 16 + rnd(i * 13 + 5, 60);
      cx.fillStyle = i % 5 === 0 ? 'rgba(96,70,44,0.455)' : 'rgba(128,98,64,0.228)';
      cx.fillRect(rnd(i * 17 + 11, CELL) - w / 2, y, w, 1 + (i % 3));
    }
    if (!knot) return;
    cx.strokeStyle = 'rgba(96,70,44,0.525)';
    for (let r = 3; r < 16; r += 4) {
      cx.lineWidth = r < 8 ? 2.4 : 1.6;
      cx.beginPath(); cx.ellipse(40, 84, r, r * 0.58, 0.42, 0, Math.PI * 2); cx.stroke();
    }
  };
  at(TILE.WOOD_C, () => grain(44, true));
  at(TILE.WOOD_F, () => grain(78, false));

  /** 천 짜임. 씨실·날실이 «교차»해야 천이다 — 한 방향 줄이면 종이다 */
  at(TILE.CLOTH, () => {
    base();
    cx.fillStyle = 'rgba(110,100,88,0.245)';
    for (let k = 0; k < CELL; k += 4) { cx.fillRect(k, 0, 2, CELL); cx.fillRect(0, k + 2, CELL, 2); }
    // 보풀 — 완전히 균일하면 격자무늬 벽지가 된다
    cx.fillStyle = 'rgba(120,110,96,0.175)';
    for (let i = 0; i < 260; i++) cx.fillRect(rnd(i * 3 + 1, CELL), rnd(i * 5 + 2, CELL), 2, 2);
  });

  /** 짚 짜임. 천보다 굵고 한 방향이 도드라진다 */
  at(TILE.STRAW, () => {
    base();
    for (let k = 0; k < CELL; k += 8) {
      cx.fillStyle = 'rgba(120,104,58,0.280)'; cx.fillRect(0, k, CELL, 5);
      cx.fillStyle = 'rgba(150,132,80,0.175)'; cx.fillRect(0, k + 5, CELL, 3);
    }
    cx.fillStyle = 'rgba(110,96,54,0.210)';
    for (let k = 0; k < CELL; k += 26) cx.fillRect(k, 0, 2, CELL);
  });

  /** 골판지. 옆면의 «물결»과 겉면의 결 */
  at(TILE.CARDBOARD, () => {
    base();
    cx.strokeStyle = 'rgba(120,92,58,0.350)'; cx.lineWidth = 2;
    for (let k = 0; k < CELL; k += 9) {
      cx.beginPath();
      for (let x = 0; x <= CELL; x += 4) cx.lineTo(x, k + Math.sin(x * 0.22) * 2.2);
      cx.stroke();
    }
    cx.fillStyle = 'rgba(140,110,72,0.175)';
    for (let i = 0; i < 180; i++) cx.fillRect(rnd(i * 11 + 7, CELL), rnd(i * 19 + 3, CELL), 3, 1);
  });

  /** 종이. 아주 옅은 얼룩 + 접힌 자국 하나 — 완전히 매끈하면 플라스틱이다 */
  at(TILE.PAPER, () => {
    base();
    cx.fillStyle = 'rgba(110,106,96,0.096)';
    for (let i = 0; i < 340; i++) cx.fillRect(rnd(i * 7 + 5, CELL), rnd(i * 13 + 9, CELL), 3, 2);
    cx.fillStyle = 'rgba(110,106,96,0.228)'; cx.fillRect(0, 62, CELL, 1);
  });

  /** 브러시 금속. **한 방향** 가는 줄이 금속을 금속으로 만든다 */
  at(TILE.METAL, () => {
    base();
    for (let i = 0; i < 200; i++) {
      const y = rnd(i * 9 + 1, CELL);
      cx.fillStyle = i % 3 === 0 ? 'rgba(90,96,104,0.263)' : 'rgba(120,128,138,0.140)';
      cx.fillRect(0, y, CELL, 1);
    }
    // 넓은 하이라이트 띠 — 금속은 한 줄이 밝다
    const gr = cx.createLinearGradient(0, 0, 0, CELL);
    gr.addColorStop(0, 'rgba(70,78,88,0.245)');
    gr.addColorStop(0.42, 'rgba(255,255,255,0.000)');
    gr.addColorStop(1, 'rgba(70,78,88,0.280)');
    cx.fillStyle = gr; cx.fillRect(0, 0, CELL, CELL);
  });

  /** 도기 유약. 큰 얼룩 몇 개 + 가장자리로 갈수록 짙어지는 굽 */
  /**
   * 도기 유약. **얼룩을 3분의 1로 줄이고 옅게 했다.**
   *
   * 예전 값(반지름 8~26px · 알파 0.123 · 26개)은 128px 칸을 큰 타원으로 뒤덮어서,
   * 그 무늬가 1m 짜리 욕조 한 면에 그대로 늘어나면 **위장무늬**로 보였다.
   * 화면에서 욕조가 얼룩덜룩한 군용 상자였다. 유약은 «가까이서만 보이는» 것이라
   * 작고 옅어야 맞다.
   */
  at(TILE.CERAMIC, () => {
    base();
    cx.fillStyle = 'rgba(96,104,112,0.055)';
    for (let i = 0; i < 34; i++) {
      cx.beginPath();
      cx.ellipse(rnd(i * 23 + 3, CELL), rnd(i * 31 + 7, CELL),
        3 + rnd(i * 7, 7), 2 + rnd(i * 11, 5), rnd(i * 5, 3), 0, Math.PI * 2);
      cx.fill();
    }
    // 아주 옅은 세로 광택 — 도기는 곡면이라 세로로 빛이 흐른다
    cx.fillStyle = 'rgba(255,255,255,0.30)';
    cx.fillRect(CELL * 0.16, 0, 5, CELL);
    cx.fillStyle = 'rgba(96,104,112,0.10)';
    cx.strokeStyle = 'rgba(96,104,112,0.10)'; cx.lineWidth = 2;
    cx.strokeRect(1, 1, CELL - 2, CELL - 2);
  });

  /** 플라스틱 성형 줄. 일정 간격 «세로» 골 — 사출 자국이다 */
  at(TILE.PLASTIC, () => {
    base();
    for (let k = 6; k < CELL; k += 14) {
      cx.fillStyle = 'rgba(88,96,104,0.228)'; cx.fillRect(k, 0, 3, CELL);
      cx.fillStyle = 'rgba(255,255,255,0.000)'; cx.fillRect(k + 3, 0, 2, CELL);
    }
    cx.fillStyle = 'rgba(88,96,104,0.158)'; cx.fillRect(0, CELL - 14, CELL, 3);
  });

  /** 책 표지(재질). 위아래 띠 두 줄 — 제목 자리 */
  at(TILE.COVER, () => {
    base();
    cx.fillStyle = 'rgba(70,64,58,0.385)'; cx.fillRect(0, 16, CELL, 10);
    cx.fillStyle = 'rgba(70,64,58,0.245)'; cx.fillRect(0, 100, CELL, 5);
    cx.fillStyle = 'rgba(70,64,58,0.280)';
    for (let i = 0; i < 4; i++) cx.fillRect(18, 44 + i * 9, 60 - i * 9, 3);
  });

  /** 나뭇잎. 가운데 주맥 + 갈라지는 잎맥 */
  at(TILE.LEAF, () => {
    base();
    cx.strokeStyle = 'rgba(56,78,44,0.350)'; cx.lineWidth = 3;
    cx.beginPath(); cx.moveTo(64, 4); cx.lineTo(64, CELL - 4); cx.stroke();
    cx.lineWidth = 1.6;
    for (let y = 14; y < CELL - 10; y += 11) {
      cx.beginPath(); cx.moveTo(64, y); cx.lineTo(14, y + 16); cx.stroke();
      cx.beginPath(); cx.moveTo(64, y); cx.lineTo(114, y + 16); cx.stroke();
    }
  });

  /** 돌 결. 불규칙한 금 + 알갱이 */
  at(TILE.STONE, () => {
    base();
    cx.strokeStyle = 'rgba(84,84,80,0.315)'; cx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      cx.beginPath();
      let x = rnd(i * 13 + 1, CELL), y = 0;
      cx.moveTo(x, y);
      while (y < CELL) { x += rnd(i * 7 + y, 26) - 13; y += 14; cx.lineTo(x, y); }
      cx.stroke();
    }
    cx.fillStyle = 'rgba(84,84,80,0.175)';
    for (let i = 0; i < 420; i++) cx.fillRect(rnd(i * 5 + 3, CELL), rnd(i * 17 + 11, CELL), 2, 2);
  });

  /** 가전 패널. 통풍 격자 + 버튼 자리 — 「기계다」가 읽히는 최소치 */
  at(TILE.PANEL, () => {
    base();
    cx.fillStyle = 'rgba(58,60,66,0.350)';
    for (let k = 20; k < 84; k += 7) cx.fillRect(14, k, 54, 3);
    cx.fillStyle = 'rgba(58,60,66,0.455)';
    for (let i = 0; i < 3; i++) {
      cx.beginPath(); cx.arc(92, 30 + i * 22, 6, 0, Math.PI * 2); cx.fill();
    }
    cx.strokeStyle = 'rgba(58,60,66,0.280)'; cx.lineWidth = 2;
    cx.strokeRect(8, 100, CELL - 16, 18);
  });

  /** 고무. 오돌토돌한 돌기 — 미끄럼 방지 무늬 */
  at(TILE.RUBBER, () => {
    base();
    cx.fillStyle = 'rgba(40,40,44,0.280)';
    for (let y = 0; y < CELL; y += 10) {
      for (let x = (y / 10) % 2 ? 5 : 0; x < CELL; x += 10) {
        cx.beginPath(); cx.arc(x, y, 3, 0, Math.PI * 2); cx.fill();
      }
    }
  });

  /** 흙·모래. 알갱이 크기가 섞여야 흙이다 */
  at(TILE.DIRT, () => {
    base();
    for (const [n, sz, a] of [[240, 4, 0.13], [420, 2, 0.09], [700, 1, 0.07]] as const) {
      cx.fillStyle = `rgba(96,76,52,${a})`;
      for (let i = 0; i < n; i++) cx.fillRect(rnd(i * 7 + sz, CELL), rnd(i * 11 + sz * 3, CELL), sz, sz);
    }
  });

  /** 벽지. 아주 옅은 잔무늬 — 벽은 넓어서 무늬가 세면 어지럽다 */
  at(TILE.WALLPAPER, () => {
    base();
    cx.fillStyle = 'rgba(120,112,100,0.096)';
    for (let y = 0; y < CELL; y += 16) {
      for (let x = (y / 16) % 2 ? 8 : 0; x < CELL; x += 16) {
        cx.beginPath(); cx.arc(x, y, 2.4, 0, Math.PI * 2); cx.fill();
      }
    }
    cx.fillStyle = 'rgba(120,112,100,0.070)';
    for (let k = 0; k < CELL; k += 3) cx.fillRect(0, k, CELL, 1);
  });

  /**
   * 물. **동심원이 아니라 «중심이 셋인» 잔물결**이다 — 동심원 한 벌은
   * 과녁으로 읽힌다. 여기에 흰 반사 줄 몇 개를 얹어야 수면이 «빛난다».
   */
  at(TILE.WATER, () => {
    base();
    cx.lineWidth = 1.5;
    for (const [cxp, cyp, n] of [[38, 44, 6], [92, 30, 4], [70, 96, 5]] as const) {
      for (let k = 1; k <= n; k++) {
        cx.strokeStyle = `rgba(58,96,128,${0.16 - k * 0.015})`;
        cx.beginPath();
        cx.ellipse(cxp, cyp, k * 9, k * 6.5, 0.3, 0, Math.PI * 2);
        cx.stroke();
      }
    }
    // 반사 — 흰 줄. 곱셈 텍스처라 흰색은 「그 자리를 밝게 두라」는 뜻이다
    cx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const [x, y, w] of [[18, 22, 34], [64, 58, 26], [30, 100, 40]] as const) {
      cx.fillRect(x, y, w, 2);
    }
  });

  /** 단추 얼굴 — 테두리 단 + 구멍 넷. 곱셈이라 어떤 팔레트에서도 단이 진다 */
  at(TILE.BUTTON, () => {
    base();
    const c = CELL / 2;
    cx.strokeStyle = 'rgba(70,64,56,0.30)'; cx.lineWidth = 6;
    cx.beginPath(); cx.arc(c, c, CELL * 0.34, 0, Math.PI * 2); cx.stroke();
    cx.strokeStyle = 'rgba(255,255,255,0.55)'; cx.lineWidth = 3;
    cx.beginPath(); cx.arc(c, c, CELL * 0.30, 0, Math.PI * 2); cx.stroke();
    cx.fillStyle = 'rgba(48,44,38,0.42)';
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      cx.beginPath();
      cx.arc(c + x * CELL * 0.15, c + z * CELL * 0.15, CELL * 0.075, 0, Math.PI * 2);
      cx.fill();
    }
  });

  /** 각설탕 — 굵은 알갱이. 눌러 굳힌 자국이라 알갱이가 «면»으로 보인다 */
  at(TILE.SUGAR, () => {
    base();
    for (let i = 0; i < 150; i++) {
      const r = 2 + rnd(i * 13, 4);
      cx.fillStyle = `rgba(122,118,108,${(0.05 + rnd(i * 17, 0.09)).toFixed(3)})`;
      cx.beginPath();
      cx.arc(rnd(i * 7 + 3, CELL), rnd(i * 11 + 5, CELL), r, 0, Math.PI * 2);
      cx.fill();
    }
    cx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 60; i++) {
      cx.fillRect(rnd(i * 23 + 9, CELL), rnd(i * 29 + 13, CELL), 2, 2);
    }
  });

  /** 비누 — 눌러 찍은 상표 자국. 가운데만 한 단 들어간다 */
  at(TILE.SOAP, () => {
    base();
    cx.fillStyle = 'rgba(86,82,74,0.10)';
    cx.beginPath(); cx.ellipse(CELL / 2, CELL / 2, CELL * 0.30, CELL * 0.17, 0, 0, Math.PI * 2);
    cx.fill();
    cx.fillStyle = 'rgba(255,255,255,0.55)';
    cx.beginPath(); cx.ellipse(CELL / 2, CELL / 2 - 3, CELL * 0.27, CELL * 0.14, 0, 0, Math.PI * 2);
    cx.fill();
    cx.fillStyle = 'rgba(86,82,74,0.16)';
    for (let i = 0; i < 3; i++) cx.fillRect(CELL * 0.32, CELL * 0.46 + i * 7, CELL * 0.36, 3);
  });

  /** 달걀 — 아주 옅은 반점. 세면 메추리알이 된다 */
  at(TILE.EGG, () => {
    base();
    for (let i = 0; i < 90; i++) {
      cx.fillStyle = `rgba(150,126,96,${(0.03 + rnd(i * 19, 0.05)).toFixed(3)})`;
      cx.beginPath();
      cx.ellipse(rnd(i * 7 + 5, CELL), rnd(i * 13 + 3, CELL),
        2 + rnd(i * 11, 5), 2 + rnd(i * 5, 4), rnd(i * 3, 3), 0, Math.PI * 2);
      cx.fill();
    }
  });

  /** 유리 — 비스듬한 반사 줄. 곱셈이라 흰 줄이 「빛난다」가 된다 */
  at(TILE.GLASSY, () => {
    base();
    cx.save();
    cx.translate(CELL / 2, CELL / 2); cx.rotate(-0.5); cx.translate(-CELL / 2, -CELL / 2);
    for (const [x, w, a] of [[18, 14, 0.62], [40, 6, 0.42], [86, 10, 0.5]] as const) {
      cx.fillStyle = `rgba(255,255,255,${a})`;
      cx.fillRect(x, -CELL, w, CELL * 3);
    }
    cx.fillStyle = 'rgba(60,78,96,0.12)';
    cx.fillRect(58, -CELL, 20, CELL * 3);
    cx.restore();
  });

  /** 브라운관 — 가로 주사선 + 모서리 비네팅. 곱셈이라 흰 줄이 「켜진 화면」이 된다 */
  at(TILE.SCREEN, () => {
    base();
    for (let y = 0; y < CELL; y += 3) {
      cx.fillStyle = 'rgba(255,255,255,0.55)';
      cx.fillRect(0, y, CELL, 1);
    }
    // 왼쪽 위 반사 — 유리는 늘 뭔가를 비춘다
    cx.fillStyle = 'rgba(255,255,255,0.42)';
    cx.beginPath();
    cx.moveTo(10, 10); cx.lineTo(52, 10); cx.lineTo(20, 58); cx.lineTo(10, 58);
    cx.closePath(); cx.fill();
    // 모서리는 어둡다
    cx.fillStyle = 'rgba(20,20,24,0.30)';
    for (const [x, y, w, h] of [[0, 0, CELL, 6], [0, CELL - 6, CELL, 6],
      [0, 0, 6, CELL], [CELL - 6, 0, 6, CELL]] as const) cx.fillRect(x, y, w, h);
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
