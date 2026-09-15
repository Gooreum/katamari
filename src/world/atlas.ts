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
 * **8 × 8 = 64칸으로 늘렸다(2026-09-10).** 사진 기준 전수 작업에서 휴지통 꽃무늬·
 * 전화기 다이얼처럼 «인쇄가 곧 단서»인 물건이 계속 나오는데 49칸 중 빈 칸이 다섯이었다.
 * 위와 같은 이유로 칸 번호는 그대로다. 1024px 은 2의 거듭제곱이기도 하다.
 *
 * **12 × 12 = 144칸으로 늘렸다(2026-09-16).** 부엌 묶음까지 62칸을 썼고 화장실 묶음에서 64칸을
 * 넘었다. 남은 56종(툇마루 · 정원 · 동네 · 거리)에도 인쇄 단서가 붙을 것이라 한 번에 넉넉히 늘린다.
 * 1536px 은 2의 거듭제곱이 아니지만 WebGL2 는 밉맵 없이(`generateMipmaps = false`) · 가장자리 고정 ·
 * `NearestFilter` 로 쓰는 NPOT 텍스처를 그대로 받는다. 이 아틀라스가 딱 그 조건이다.
 * GPU 메모리는 4MB → 9MB.
 */
const GRID = 12;
const CELL = 128;                        // 한 칸 128px
const SIZE = GRID * CELL;                // 1536px

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
  /** 골프공 딤플 — 구 넷을 박아도 대비가 0.05 라 안 보였다. 인쇄면 온 면에 찍힌다 */
  GOLF: 42,
  /** 캐러멜 알맹이 — 잘릴 때 눌린 가로 자국. 거의 흰색이라 팔레트 색이 그대로 나온다 */
  TOFFEE: 43,

  /**
   * ── 사진 기준 전수 작업에서 생긴 칸 (2026-09-10~) ─────────────
   * 근거는 전부 `.design-bounce/ref/<대상>/intent.md` 에 있다.
   */
  /** 휴지통 — 70년대 꽃무늬 플라스틱 통. 크림 바탕에 주황·노랑 큰 꽃, 위 물결 테, 아래 크림 띠 */
  BIN_FLORAL: 44,
  /** 전화기 다이얼 — 흰 숫자 테 · 투명 구멍판 · 가운데 노란 딱지. 원판 뚜껑면에 방사로 찍힌다 */
  PHONE_DIAL: 45,
  /** 방석 겉감 — 흰 점 흩뿌림. 정점색을 1 넘게 주면 점이 «본체보다 밝게» 나온다 */
  ZABUTON: 46,
  /** 사과 껍질 — 노란 연두 바탕에 벽돌빛 빨강 세로 줄이 81%. 돌림면에 감긴다(v=0 이 밑) */
  APPLE: 47,
  /** 나사산 — 사선 줄. 원기둥 옆면에 감기면 나선처럼 보인다. 나사·전구 꼭지쇠 */
  THREAD: 48,
  /** 쌓인 종이 옆면 — 가로 층 줄이 촘촘하고 가끔 빨간 광고면 줄. 신문더미 */
  PAPERSTACK: 49,
  /** 슬리퍼 겉감 — 짙은 남색 바탕에 빨강 다섯 잎 꽃 · 노랑 두 쪽 꽃 · 흰 꽃 */
  SLIPPER: 50,
  /** 구슬 — 연한 회녹색 유리 위를 30° 비스듬히 가로지르는 파란 잎 모양 심, 위쪽 흐린 창 반사 */
  MARBLE: 51,
  /** 딱지(원형 멘코) — 빨간 바탕 · 노란 번개 테 · 굵은 검은 윤곽의 인물 얼굴. 원판 뚜껑면 방사 */
  MENKO: 52,
  /** 공책(자포니카 학습장) 표지 — 남색 바탕 · 흰 이중선 둥근 틀 · 곤충 사진 · 위 로고 띠 · 아래 이름 칸 */
  JAPONICA: 53,
  /** 밥공기 몸통 — 흰 자기, 입술 바로 아래 갈색 선 둘 사이 청회색 띠(돌림면 v 위쪽 끝) */
  RICEBOWL: 54,
  /** 밥공기 굽 — 흰 바탕에 짙은 코발트 세로 줄 20개(원기둥 옆면 한 바퀴) */
  BOWLFOOT: 55,
  /** 도마(히노키) — 옅은 바탕에 가로로 곧게 흐르는 가는 곧은결 + 옅은 분홍 띠 한두 줄. 옹이 없음 */
  HINOKI: 56,
  /** 당근 — 흰 바탕에 몸통을 가로로 두르는 옅은 잔주름 줄(돌림면 v 방향 고리) */
  CARROT: 57,
  /** 유키히라 냄비 — 줄마다 반 칸씩 엇갈린 벌집 망치 자국 */
  HAMMERED: 58,
  /** 전기밥솥 몸통 — 아래 절반을 도는 빨간 다섯 잎 꽃 · 초록 · 회색 잎 꽃대 */
  FLOWERBAND: 59,
  /** 찬장 유리 — 옅은 청회색 유리에 비친 선반 줄 · 접시와 찻잔 그림자 · 모서리 둥근 흰 테 */
  CUPBOARD_GLASS: 60,
  /** 찬장 문·서랍 앞판 — 짙은 적갈색 나뭇결 판에 가장자리를 두른 모서리 둥근 가는 흰 선 */
  CUPBOARD_DOOR: 61,
  /** 체온계 눈금판 — 흰 판 위쪽 절반 노란 띠 · 아래쪽 절반 끝자리 숫자, 37 만 빨강 */
  THERMO: 62,
  /** 수건 — 흰 파일 바탕에 큰 꽃 한 송이, 긴 가장자리 안쪽 파란 실 한 줄씩 */
  TOWEL: 63,
  /** 함석(아연 도금) — 회색 바탕에 밝은 결정 얼룩(스팽글)이 흩어진 판 */
  SPANGLE: 64,
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

  /**
   * 신문 — `ref/신문/` (1980-09-14 毎日新聞 1면 + 1978~79년 접힌 신문 더미).
   * **반으로 접어 위 절반만 보이는 1면**을 그린다. 윗면이라 캔버스 위쪽이 +z(신문 윗가장자리)다.
   * 반쪽 면 기준으로 옮긴 비율:
   *   ① 오른쪽 위에 세로 제호 상자 — 가로의 0.09 · 세로의 0.36(전지 0.18)
   *   ② 그 왼쪽 검은 바탕 흰 글자 세로 제목 띠 — 가로의 0.08 · 세로의 0.62(전지 0.31)
   *   ③ 나머지는 세로쓰기 활자 단 — 가로 괘선으로 단이 나뉘고, 사진 몇 장만 검게 박힌다
   *   ④ 종이는 누렇게 바랜 크림색(177,160,130) — 흰색이 아니다
   */
  at(TILE.NEWSPAPER, () => {
    // 윗면 uv 는 캔버스 위쪽을 앞(+z)으로 보내는 «상하 반전»이다 — 뒤집어 그려야 앞에서 글자가 바로 읽힌다.
    // (부품을 180° 돌리면 이번엔 좌우가 뒤집힌다. 실제로 그랬다)
    cx.save();
    cx.translate(0, CELL); cx.scale(1, -1);
    // 흰 바탕에 **빽빽한 먹** — 규칙적인 세로 막대는 「블라인드」로 읽혔다(판정자).
    // 단마다 활자 굵기와 길이를 흔들고, 제목 상자·사진을 불규칙하게 박는다
    cx.fillStyle = '#f4f3ef';
    cx.fillRect(0, 0, CELL, CELL);
    for (let tier = 0; tier < 5; tier++) {
      const y0 = 4 + tier * 24;
      // 활자는 끊어진 점 — 이어진 세로선은 「바코드」로 읽혔다(판정자). 한 글자 = 한 점
      for (let x = 3; x < CELL - 24; x += 1.6) {
        for (let y = y0 + 1; y < y0 + 20; y += 1.6) {
          if ((x * 7 + y * 13 + tier) % 9 === 0) continue;
          const g = 60 + ((x * 13 + y * 7) % 60);
          cx.fillStyle = `rgb(${g},${g},${g - 4})`;
          cx.fillRect(x, y, 1, 1);
        }
      }
      cx.fillStyle = '#2d2b28';
      cx.fillRect(3, y0 + 22, CELL - 26, 0.8);
    }
    // 가로 제목 상자 둘 · 사진 둘 — 불규칙한 자리
    cx.fillStyle = '#efece4'; cx.fillRect(6, 5, 46, 16); cx.fillRect(30, 53, 36, 14);
    cx.fillStyle = '#1e1c1a'; cx.fillRect(8, 8, 42, 9); cx.fillRect(32, 56, 32, 7);
    cx.fillStyle = '#4a4744'; cx.fillRect(60, 28, 22, 20); cx.fillRect(10, 80, 26, 20);
    cx.fillStyle = '#8a8580'; cx.fillRect(63, 31, 16, 14); cx.fillRect(13, 83, 20, 14);
    // ② 검은 세로 제목 띠(흰 글자)
    cx.fillStyle = '#1f1d1b';
    cx.fillRect(CELL * 0.83 - 10, 4, CELL * 0.08, CELL * 0.62);
    cx.fillStyle = '#efece4';
    for (let y = 9; y < CELL * 0.6; y += 8) cx.fillRect(CELL * 0.83 - 8, y, CELL * 0.08 - 5, 5);
    // ① 제호 상자 — 흰 바탕에 굵은 먹 글자
    cx.fillStyle = '#faf8f2';
    cx.fillRect(CELL * 0.91 - 2, 2, CELL * 0.09, CELL * 0.36);
    // 제호 — 세로쓰기 굵은 먹 글자. 도형 막대로는 판정자가 「제호도 없다」고 했다
    cx.fillStyle = '#16140f'; cx.font = 'bold 10px serif';
    ['日', '報', '新', '聞'].forEach((ch, k) => cx.fillText(ch, CELL * 0.91, 12 + k * 11));
    cx.restore();
  });

  /**
   * 찌라시 — `ref/찌라시/` (1981년 サミットストア 개점 전단 + 1978년 2색 전단).
   *   ① 위아래 가장자리를 가로지르는 초록 줄 두 가닥(상표색)
   *   ② 왼쪽 위 노란 제목 상자(가로 0.11~0.53 · 세로 0.03~0.21)에 빨간 큰 글자
   *   ③ 상품 사진(고기 · 생선 · 과일 덩어리) 사이사이의 빨간 가격 딱지
   *   ④ 아래 1/4 에 파란 테두리 노란 상자 3칸(가로 0.41~0.90 · 세로 0.72~0.95)
   *   ⑤ 오른쪽 끝 0.08 폭 세로 안내 띠
   */
  at(TILE.FLYER, () => {
    // 윗면 uv 가 상하 반전이라 뒤집어 그린다(신문과 같다)
    cx.save();
    cx.translate(0, CELL); cx.scale(1, -1);
    const X = (f: number): number => f * CELL;
    cx.fillStyle = '#fbfbf8';
    cx.fillRect(0, 0, CELL, CELL);
    // ③ 상품 사진 — 네모 사진 칸(고기 · 생선 · 과일 · 병)과 그 옆 빨간 가격 딱지(흰 숫자)
    const photo = (x: number, y: number, w: number, h: number, c: string, c2: string): void => {
      cx.fillStyle = c; cx.fillRect(X(x), X(y), X(w), X(h));
      cx.fillStyle = c2; cx.fillRect(X(x + w * 0.2), X(y + h * 0.25), X(w * 0.55), X(h * 0.5));
    };
    photo(0.02, 0.27, 0.22, 0.14, '#8d98a2', '#c9d2d8');   // 생선
    photo(0.30, 0.47, 0.26, 0.17, '#9a3a32', '#c7584a');   // 고기
    photo(0.60, 0.26, 0.16, 0.16, '#c98a2e', '#e8c36a');   // 과자·병
    photo(0.04, 0.70, 0.16, 0.14, '#6f9a3c', '#a9c95a');   // 과일
    photo(0.62, 0.50, 0.20, 0.12, '#b0764a', '#d6a070');
    photo(0.24, 0.37, 0.20, 0.10, '#7b8a99', '#aab6c0');
    photo(0.58, 0.07, 0.30, 0.14, '#a4b6c8', '#dde5ea');   // 오른쪽 위 안내·그림
    photo(0.24, 0.66, 0.14, 0.18, '#6d4a2c', '#9a6a3e');
    photo(0.03, 0.47, 0.22, 0.20, '#c7553e', '#e08a62');
    /**
     * **가격은 글자로 찍는다.** 도형(흰 막대 셋)으로 흉내 냈더니 판정자가 「보드게임판」이라고 했다.
     * 전단을 전단으로 만드는 건 큼직한 빨간 숫자다. 128px 칸에서도 굵은 숫자 세 자리는 읽힌다.
     */
    const price = (x: number, y: number, t: string, big = false): void => {
      cx.font = `bold ${big ? 17 : 12}px sans-serif`;
      cx.fillStyle = '#c42f2a'; cx.fillText(t, X(x), X(y));
    };
    price(0.25, 0.37, '268'); price(0.46, 0.33, '198'); price(0.19, 0.60, '380', true);
    price(0.55, 0.47, '458', true); price(0.78, 0.42, '98'); price(0.36, 0.88, '100'); price(0.78, 0.26, '158');
    // ② 제목 상자
    cx.fillStyle = '#ddd05c'; cx.fillRect(X(0.11), X(0.03), X(0.42), X(0.18));
    cx.strokeStyle = '#175e90'; cx.lineWidth = 1.5; cx.strokeRect(X(0.11), X(0.03), X(0.42), X(0.18));
    cx.fillStyle = '#c42f2a'; cx.font = 'bold 13px sans-serif';
    cx.fillText('本日10時', X(0.13), X(0.17));
    // ④ 아래 3칸
    for (let k = 0; k < 3; k++) {
      const x0 = X(0.41 + k * 0.165);
      cx.fillStyle = '#ddd05c'; cx.fillRect(x0, X(0.72), X(0.155), X(0.23));
      cx.strokeStyle = '#175e90'; cx.lineWidth = 2; cx.strokeRect(x0, X(0.72), X(0.155), X(0.23));
      cx.fillStyle = '#c42f2a'; cx.font = 'bold 11px sans-serif';
      cx.fillText(['88', '98', '58'][k]!, x0 + 3, X(0.92));
    }
    // ⑤ 오른쪽 세로 안내 띠
    cx.fillStyle = '#e8efe6'; cx.fillRect(X(0.92), 0, X(0.08), CELL);
    cx.fillStyle = '#2f8f4a'; cx.fillRect(X(0.93), X(0.05), X(0.06), X(0.12));
    // ① 초록 줄 두 가닥 — 위아래
    cx.fillStyle = '#2f8f4a';
    cx.fillRect(0, 0, CELL, 2.5); cx.fillRect(0, CELL - 2.5, CELL, 2.5);
    cx.fillRect(0, 4, CELL, 1); cx.fillRect(0, CELL - 5, CELL, 1);
    cx.restore();
  });

  /**
   * ── 캐러멜 갑 ── **실물 사진을 보고 다시 그렸다.**
   * 근거: `.design-bounce/ref/캐러멜 상자/` (모리나가 공식 제품 페이지)
   *
   * 앞의 것은 주황 바탕에 크림색 세로 띠였다. 실물과 색부터 달랐다 —
   * 정답을 모르는 판정자가 「자판기」라고 답하면서 근거로 **「주황 테두리 패널」** 을
   * 댔다. 내가 지어낸 색이 물건의 정체를 덮은 것이다.
   *
   * 실물은 **노란 바탕에 흰 테두리 액자**가 둘리고, 채도가 높은 것은 위쪽의
   * **자주색 마크 하나**뿐이다. 아래쪽에는 코끼리와 낱개 그림이 작게 들어간다.
   */
  at(TILE.CARAMEL, () => {
    cx.fillStyle = '#f5c516';
    cx.fillRect(0, 0, CELL, CELL);
    /**
     * **위아래를 뒤집어 그린다.** 세운 갑의 앞면 uv 는 v 가 아래에서 위로 자라서,
     * 캔버스 좌표 그대로 그리면 화면에서 상하가 뒤집힌다 — 실물에서 «위»에 있는
     * 자주색 마크가 아래로 내려가고 낱개 그림이 위로 올라간다.
     * 좌우 대칭인 무늬에서는 안 드러나던 문제다.
     */
    cx.save();
    cx.translate(0, CELL);
    cx.scale(1, -1);
    // 흰 테두리 액자 — 갑의 윤곽을 그리는 것이 이 선이다
    cx.strokeStyle = '#fbf6e6';
    cx.lineWidth = 5;
    cx.strokeRect(9, 7, CELL - 18, CELL - 14);
    cx.lineWidth = 2;
    cx.strokeRect(17, 15, CELL - 34, CELL - 30);
    // 위쪽 흰 띠 한 줄 (뚜껑 아래)
    cx.fillStyle = '#fbf6e6';
    cx.fillRect(17, 22, CELL - 34, 6);
    // **자주색 마크 하나** — 실물에서 유일하게 채도가 높은 요소다
    cx.fillStyle = '#6b2560';
    cx.beginPath(); cx.arc(64, 44, 13, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = '#f0b81c';
    cx.beginPath(); cx.arc(64, 42, 6, 0, Math.PI * 2); cx.fill();
    // 세로 글자 기둥 — 흰 글씨가 세로로 흐른다. 획 하나하나는 이 크기에서 안 보인다
    cx.fillStyle = '#fbf6e6';
    for (let y = 62; y < 104; y += 9) cx.fillRect(58, y, 12, 5);
    // 아래쪽 낱개 그림 — 작은 크림색 사각 셋
    cx.fillStyle = '#f6ead0';
    cx.fillRect(88, 92, 11, 9);
    cx.fillRect(96, 103, 11, 9);
    cx.fillRect(84, 108, 11, 9);
    // 왼쪽 아래 코끼리 자리 — 흰 덩어리 하나로만 암시한다
    cx.beginPath(); cx.arc(32, 104, 9, 0, Math.PI * 2); cx.fill();
    cx.restore();
  });

  /**
   * ── 캐러멜 알맹이 ── 잘릴 때 눌린 가로 자국.
   *
   * **바탕이 거의 흰색이어야 한다.** 정점색이 그렇듯 인쇄 색도 팔레트에 «곱해진다» —
   * 갈색 팔레트(적갈 0x8a4f2a) 위에 갈색을 인쇄하면 두 번 곱해져 거의 검정이 된다.
   * 색은 팔레트가 정하고, 인쇄는 «어디가 더 어두운가»만 정한다.
   *
   * 실물에서 본 것: 옆면에 가로로 눌린 주름이 몇 줄 있고 면이 고르지 않다.
   * 무늬가 아니라 «흔적»이므로 아주 옅게만 넣는다 — 진하면 포장지로 보인다.
   */
  at(TILE.TOFFEE, () => {
    cx.fillStyle = '#f6f2ea';
    cx.fillRect(0, 0, CELL, CELL);
    /**
     * 자국은 **아주 옅어야 한다.** 진하면 상자 이음선으로 읽힌다 —
     * 실제로 「골판지 상자」로 보였다. 흔적은 있는 듯 없는 듯해야 흔적이다.
     */
    cx.fillStyle = '#f2ece2';
    cx.fillRect(0, 51, CELL, 2);
    /**
     * 얼룩 — 색이 한 톤으로 고르면 «지점토»로 보인다. 굳으면서 밀도가 달라진 자국이다.
     *
     * **네모로 넣었다가 골판지 상자가 됐다.** 직각 얼룩은 테이프나 라벨로 읽힌다.
     * 둥글게 바꿨더니 이번엔 «얼룩진 자국»으로 보였다 — 작고 여럿이면 무늬가 된다.
     * 셋으로 줄여도 판정자가 「하트 비슷한 굴곡 자국」·「마름모꼴 파인 자국」이라며
     * **정체불명의 흠집**으로 읽었다. 알아볼 수 있는 모양이 되면 그건 무늬다.
     * 둘만, 아주 크게, 아주 옅게 — 형태가 안 잡혀야 「색이 고르지 않다」가 된다.
     */
    for (const [x, y, r, c] of [
      [40, 40, 52, '#f8f5ef'], [96, 96, 46, '#f1ebe1'],
    ] as const) {
      cx.fillStyle = c;
      cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
    }
    // 잘린 면이 옆면보다 무디다 — 위아래 가장자리를 살짝 밝힌다
    cx.fillStyle = '#fcf9f3';
    cx.fillRect(0, 0, CELL, 7);
    cx.fillRect(0, CELL - 7, CELL, 7);
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

  /**
   * ── 건전지 ── 라벨 띠 + 극 표시.
   *
   * **팔레트를 검정(5)에서 흰색(0)으로 옮기고 색을 여기서 정한다.**
   * 인쇄 색도 팔레트에 «곱해지므로» 검은 팔레트 위에 검은 타일을 그리면
   * 금색 띠(224,160,32)가 (41,29,6)이 되어 통째로 까맣게 나온다 —
   * 화면에서 실제로 검은 막대였다. 캐러멜 갑에서 같은 실수를 했다.
   *
   * 잰 값(`ref/건전지/`): 띠는 전체 길이의 0.24, 위끝은 양극 끝에서 0.18 지점.
   * 세운 원기둥의 앞면 uv 는 v 가 아래에서 위로 자라므로 **위아래를 뒤집어 그린다.**
   */
  at(TILE.BATTERY, () => {
    cx.save();
    cx.translate(0, CELL); cx.scale(1, -1);
    cx.fillStyle = '#38352f';
    cx.fillRect(0, 0, CELL, CELL);
    // 라벨 띠 — 위끝 0.18 지점(y=23)부터 0.24 높이(31px)
    cx.fillStyle = '#e8b038';
    cx.fillRect(0, 23, CELL, 31);
    cx.fillStyle = '#2a2723';
    cx.fillRect(0, 23, CELL, 4);
    cx.fillRect(0, 50, CELL, 4);
    // 띠 안의 짙은 블록 — 잰 값으로 전체의 0.15
    cx.fillStyle = '#2f5f96';
    cx.fillRect(0, 30, CELL, 17);
    cx.fillStyle = '#f4f1e8';
    cx.fillRect(48, 36, 32, 5);                    // +
    cx.fillRect(60, 30, 8, 17);
    // 아래쪽(음극 쪽)에 옅은 띠 하나 — 위아래가 다른 물건임을 말한다
    cx.fillStyle = '#5c574e';
    cx.fillRect(0, 104, CELL, 6);
    cx.restore();
  });

  // ── 지우개 ── 종이 띠. 정점색 계수로는 원리상 못 만들던 바로 그 부품이다.
  /**
   * 지우개 슬리브 — `ref/지우개/` (톰보 MONO).
   * 윗면에 감긴다 — u 가 긴 변, v 가 폭. 폭을 가로지르는 3단 띠:
   *   위 파랑 0.38 (흰 「MONO」 글자) · 가운데 크림 0.19 (검은 글자) · 아래 검정 0.43 (흰 글자)
   *
   * **글자를 캔버스 글자로 찍는다.** 네모 막대로 흉내 냈더니 판정자가 「네모 구멍이 줄지어
   * 뚫렸다 — 키보드나 하모니카」라고 했다(2026-09-15). 찌라시 가격과 같은 처리다.
   * 신문처럼 **뒤집어 그린다** — 윗면 uv 는 캔버스 위쪽을 앞(+z)으로 보낸다. 뒤집으면 파랑이 뒤,
   * 검정이 앞에 오고, 앞에서 글자가 바로 읽힌다(사진을 눕힌 방향 그대로).
   * 이 칸은 길이 0.80 × 폭 0.39 판에 감기므로 가로가 2.05배 늘어난다 — 글자만 가로로 0.49배 눌러 쓴다.
   */
  at(TILE.ERASER, () => {
    const V = (f: number): number => f * CELL;
    cx.save();
    cx.translate(0, CELL); cx.scale(1, -1);
    cx.fillStyle = '#2d4fb0'; cx.fillRect(0, 0, CELL, V(0.38));
    cx.fillStyle = '#efe9d2'; cx.fillRect(0, V(0.38), CELL, V(0.19));
    cx.fillStyle = '#1c1b1a'; cx.fillRect(0, V(0.57), CELL, V(0.43));
    const text = (s: string, px: number, y: number, color: string): void => {
      cx.save();
      cx.scale(0.49, 1);
      cx.font = `bold ${px}px sans-serif`;
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillStyle = color;
      cx.fillText(s, (CELL * 0.55) / 0.49, y);
      cx.restore();
    };
    text('MONO', 38, V(0.20), '#f4f1e8');
    text('Tombow PENCIL', 19, V(0.476), '#1c1b1a');
    text('PLASTIC ERASER', 20, V(0.78), '#f4f1e8');
    cx.restore();
  });

  /**
   * 우유팩 옆면 — `ref/우유팩/` (1972 農協牛乳 1 L 신문 사진 + 요즘 雪印 팩 치수).
   * 앞면 높이를 1로 두면 위 짙은 띠 0.30 · 가운데 흰 띠 0.41 · 아래 짙은 띠 0.26, 띠 경계마다 가는 줄.
   * 흰 띠에 굵은 한자 넷을 2 × 2 로 — 「牛乳」 넉 자가 이 크기에서 뭉개질까 봐 예전엔 소 얼룩으로
   * 대신했는데, 사진 속 팩에 소 얼룩은 없다. 한 면이 폭 1 × 높이 2.79 라 세로로 2.79배 늘어난다 —
   * 글자만 세로로 0.36배 눌러 쓴다. 옆면 v 는 아래가 0 이라 뒤집어 그린다.
   * 1972 사진은 흑백이라 띠 색을 모른다 — 요즘 雪印 팩(main.jpg)의 진한 빨강으로 두었다(`intent.md` 「못 찾은 것」).
   */
  at(TILE.MILK, () => {
    const V = (f: number): number => f * CELL;
    cx.save();
    cx.translate(0, CELL); cx.scale(1, -1);
    cx.fillStyle = '#fbf7ee'; cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#dc1c14';
    cx.fillRect(0, 0, CELL, V(0.30));
    cx.fillRect(0, V(0.74), CELL, V(0.26));
    // 띠 경계의 가는 줄 두세 가닥
    for (const y of [0.32, 0.335, 0.70, 0.715]) cx.fillRect(0, V(y), CELL, 1);
    cx.fillStyle = '#dc1c14';
    cx.font = 'bold 50px serif';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    for (const [ch, col, row] of [['農', 0, 0], ['協', 1, 0], ['牛', 0, 1], ['乳', 1, 1]] as const) {
      cx.save();
      cx.translate(V(0.29 + col * 0.42), V(0.425 + row * 0.19));
      cx.scale(1, 0.36);
      cx.fillText(ch, 0, 0);
      cx.restore();
    }
    cx.restore();
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

  /**
   * 접시 앞면 — `ref/접시/` (쇼와 錦花 중간 접시, 지름 16.5cm).
   * 윗면 돌림면에 감긴다 — v 가 입술(0)에서 가운데(1)로 간다. 윤곽 점이 여섯이라
   * v 0.2 마다 한 점: 입술 r .50 · 테 안쪽 .44 · 우묵 시작 .395 · .34 · .20 · 가운데.
   *   ① 입술에 금선 두 줄(바깥에서 지름의 0.01 · 0.03 안쪽)
   *   ② 넓은 흰 테(지름의 0.106)
   *   ③ 가운데 붉은 두 줄 원(지름 0.65 · 0.57) 과 그 사이 금·붉은 물결 띠
   *   ④ 원 안에 주황 국화·모란과 남청·청록 잎
   */
  at(TILE.PLATE, () => {
    const V = (f: number): number => f * CELL;
    cx.fillStyle = '#f1f5f5';
    cx.fillRect(0, 0, CELL, CELL);
    // ① 금선 두 줄
    cx.fillStyle = '#4a3222';
    cx.fillRect(0, V(0.005), CELL, 2);
    cx.fillStyle = '#c9a85e';
    cx.fillRect(0, V(0.07), CELL, 1.5);
    // ③ 붉은 두 줄 원(r .325 → v .62, r .285 → v .68) 과 물결
    cx.fillStyle = '#8a2a18';
    cx.fillRect(0, V(0.62), CELL, 2); cx.fillRect(0, V(0.68), CELL, 2);
    cx.fillStyle = '#c9a85e';
    for (let k = 0; k < CELL; k += 8) { cx.beginPath(); cx.arc(k + 4, V(0.65), 2.5, Math.PI, 0); cx.fill(); }
    // ④ 꽃과 잎 — 원 안(v .70~1)
    for (let i = 0; i < 12; i++) {
      const x = (i + 0.5) * (CELL / 12), y = V(0.76 + (i % 3) * 0.07);
      cx.fillStyle = i % 2 ? '#385959' : '#63907f';
      cx.beginPath(); cx.ellipse(x + 4, y + 4, 4, 3, 0.6, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = '#b8683f';
      cx.beginPath(); cx.arc(x, y, 3.6, 0, Math.PI * 2); cx.fill();
    }
  });

  /**
   * 찻잔 — `ref/찻잔/` (회백색 유노미에 남색 붓무늬).
   * 몸통 옆면(돌림면)에 감기므로 위아래를 뒤집어 그린다 — y=0 이 입이다.
   * 둘레가 높이의 2.4배라 잎을 가로로 2.4분의 1로 눌러 그린다.
   *   ① 입 테두리에 가는 검은 선
   *   ② 입에서 늘어진 짙은 남색 줄기 — 끝이 높이의 0.83 까지, 잎 덩어리는 위 0.42 까지
   *   ③ 아래 0.17 은 무늬 없는 흰 바탕
   */
  at(TILE.TEACUP, () => {
    cx.save();
    cx.translate(0, CELL); cx.scale(1, -1);
    // 회색 기 도는 흰 바탕 — 누런 크림이면 판정자가 「누런 크림색」이라고 한다
    cx.fillStyle = '#e3e5e3';
    cx.fillRect(0, 0, CELL, CELL);
    const SQ = 1 / 2.4, N = 7, STEM_END = CELL * 0.83, LEAF_END = CELL * 0.42;
    for (let k = 0; k < N; k++) {
      const x0 = (k + 0.5) * (CELL / N);
      // 옅은 하늘빛 물결 줄기 — 줄기 사이로 번진다
      cx.strokeStyle = 'rgba(110,150,205,0.55)'; cx.lineWidth = 3;
      cx.beginPath();
      for (let y = 6; y < STEM_END; y += 3) {
        const x = x0 + CELL / N / 2 + Math.sin(y * 0.22 + k) * 2.4;
        if (y === 6) cx.moveTo(x, y); else cx.lineTo(x, y);
      }
      cx.stroke();
      // 가는 남색 줄기 — 입에서 0.83 까지
      cx.strokeStyle = '#26356a'; cx.lineWidth = 1.4;
      cx.beginPath();
      for (let y = 2; y < STEM_END - (k % 3) * 6; y += 3) {
        const x = x0 + Math.sin(y * 0.16 + k * 1.7) * 2.0;
        if (y === 2) cx.moveTo(x, y); else cx.lineTo(x, y);
      }
      cx.stroke();
      // 쉼표꼴 잎 — 위 0.42 안에만, 줄기 양옆으로 번갈아
      cx.fillStyle = '#22325f';
      for (let y = 6, i = 0; y < LEAF_END; y += 10, i++) {
        const side = i % 2 ? 1 : -1;
        cx.beginPath();
        cx.ellipse(x0 + side * 2.6, y, 6 * SQ, 4.2, side * 0.6, 0, Math.PI * 2);
        cx.fill();
      }
    }
    cx.fillStyle = '#141412';
    cx.fillRect(0, 0, CELL, 2.5);
    cx.restore();
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

  /**
   * RC 컨트롤러 앞면 — `ref/RC 컨트롤러/` (닛코 상자형 송신기 1982 · 1989).
   * 앞면(+z)에 찍힌다. 앞면 uv 는 위아래가 뒤집혀 들어오므로 뒤집어 그린다(y=0 이 윗변).
   * 면이 1 : 0.85 라 원은 세로로 1/0.85 늘여 그린다.
   *   ① 좌우 원형 스틱 우물 — 지름 = 가로의 0.34, 중심 높이 = 위에서 0.42
   *   ② 가운데 세로 칸 — 빨간 전원 램프와 스위치
   *   ③ 아래 흰 상표판 — 가로 0.84 · 세로 0.24, 윗변이 위에서 0.73
   *   ④ 윗변 오른쪽 작은 주파수 딱지
   */
  at(TILE.RC, () => {
    cx.save();
    cx.translate(0, CELL); cx.scale(1, -1);
    const X = (f: number): number => f * CELL;
    cx.fillStyle = '#383836';
    cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#2e2e2c';
    cx.fillRect(0, 0, CELL, X(0.20));
    // ① 좌우 조작부가 서로 다르다(1989 사진) — 왼쪽은 흰 판 위 세로 슬롯 레버, 오른쪽은 네모 홈 안 스틱
    cx.fillStyle = '#dcd8cc'; cx.fillRect(X(0.08), X(0.28), X(0.28), X(0.30));
    cx.fillStyle = '#1a1a19'; cx.fillRect(X(0.20), X(0.30), X(0.04), X(0.26));
    cx.fillStyle = '#3a3a38'; cx.fillRect(X(0.18), X(0.40), X(0.08), X(0.05));
    cx.fillStyle = '#1e1e1d'; cx.fillRect(X(0.62), X(0.27), X(0.30), X(0.32));
    cx.strokeStyle = '#111110'; cx.lineWidth = 2; cx.strokeRect(X(0.62), X(0.27), X(0.30), X(0.32));
    // ② 가운데 세로 칸
    cx.fillStyle = '#2a2a29'; cx.fillRect(X(0.45), X(0.20), X(0.10), X(0.50));
    cx.fillStyle = '#d23a2a'; cx.beginPath(); cx.arc(X(0.50), X(0.33), 3, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = '#9a9894'; cx.fillRect(X(0.48), X(0.50), X(0.04), X(0.08));
    // ④ 주파수 딱지
    cx.fillStyle = '#dcd8cc'; cx.fillRect(X(0.59), X(0.04), X(0.10), X(0.12));
    cx.fillStyle = '#b0483e'; cx.fillRect(X(0.61), X(0.08), X(0.06), X(0.03));
    // ③ 흰 상표판 — 굵은 상표 글자 한 줄(띄엄띄엄 획), 아래 잔 글자 두 줄, 오른쪽 끝 빨간 칸
    cx.fillStyle = '#e6e2d6'; cx.fillRect(X(0.06), X(0.66), X(0.88), X(0.30));
    cx.fillStyle = '#b0483e'; cx.fillRect(X(0.84), X(0.66), X(0.10), X(0.30));
    cx.fillStyle = '#232220';
    for (let k = 0; k < 8; k++) {
      const x = X(0.12 + k * 0.085);
      cx.fillRect(x, X(0.765), X(0.012), X(0.07)); cx.fillRect(x, X(0.765), X(0.05), X(0.012));
      cx.fillRect(x, X(0.823), X(0.05), X(0.012)); cx.fillRect(x + X(0.04), X(0.765), X(0.012), X(0.07));
    }
    cx.fillRect(X(0.12), X(0.875), X(0.16), X(0.045));
    cx.fillRect(X(0.38), X(0.868), X(0.42), X(0.022));
    cx.fillRect(X(0.38), X(0.905), X(0.42), X(0.022));
    cx.restore();
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
  /**
   * 비디오테이프 윗면 — `ref/비디오테이프/` (1981년 무렵 VHS, 창 있는 면 정면).
   * 윗면 한 장을 통째로 그린다. u 가 긴 변(x), v 가 짧은 변(z)이다.
   * 칸은 정사각형인데 면은 1 : 0.554 라 **세로(v)가 0.554배로 눌린다** — 원은 세로로 1/0.554 늘여 그린다.
   *   ① 짧은 변을 가로지르며: 뚜껑 쪽 띠 0.092 · 격자 띠 0.19 · 가운데 판 0.51 · 격자 띠 0.21
   *   ② 가운데 판 안, 양 끝에 **창 둘**(긴 변의 0.22 씩, 끝에서 0.03) — 흰 릴 허브와 감긴 갈색 테이프
   *   ③ 두 창 사이 **라벨 자리**(긴 변의 0.43) — 이 개체는 라벨이 없어 빈 판이다
   */
  at(TILE.VIDEO, () => {
    const V = (f: number): number => f * CELL, SQ = 0.554;
    cx.fillStyle = '#474745';
    cx.fillRect(0, 0, CELL, CELL);
    // ① 격자 띠 — 잔 격자
    cx.fillStyle = 'rgba(30,30,30,0.35)';
    for (let k = 0; k < CELL; k += 3) {
      cx.fillRect(k, 0, 1, CELL);
      cx.fillRect(0, k, CELL, 1);
    }
    cx.fillStyle = '#383836';
    cx.fillRect(0, 0, CELL, V(0.092));                      // 뚜껑 쪽 띠
    cx.fillStyle = '#e8e6e0';                                // 흰 글씨 한 줄과 화살표
    for (let k = 0; k < 9; k++) cx.fillRect(V(0.10 + k * 0.05), V(0.035), V(0.03), V(0.025));
    cx.beginPath(); cx.moveTo(V(0.70), V(0.02)); cx.lineTo(V(0.76), V(0.046)); cx.lineTo(V(0.70), V(0.072)); cx.fill();
    const P0 = V(0.282), P1 = V(0.792);
    cx.fillStyle = '#5d5b56';
    cx.fillRect(0, P0, CELL, P1 - P0);                      // 가운데 판
    // ② 창 둘
    const mid = (P0 + P1) / 2, wh = V(0.50);   // 창 폭 = 짧은 변의 0.47 — 조금 넉넉히
    for (const [u0, u1] of [[0.025, 0.265], [0.735, 0.975]] as const) {
      // 릴 허브는 창 안쪽 가장자리(라벨 쪽)에 치우친다(사진)
      const x0 = V(u0), x1 = V(u1), cxw = u0 < 0.5 ? x1 - V(0.07) : x0 + V(0.07);
      // 투명 창 — 검정에 묻히지 않게 연기빛 회색. 창이 이 물건에서 가장 눈에 띈다(사진)
      cx.fillStyle = '#8a8e95';
      cx.fillRect(x0, mid - wh / 2, x1 - x0, wh);
      cx.fillStyle = 'rgba(255,255,255,0.35)';
      cx.fillRect(x0 + 2, mid - wh / 2 + 2, (x1 - x0) * 0.3, wh - 4);
      // 감긴 테이프 — 짙은 갈색 원판
      cx.fillStyle = '#6e5d52';
      cx.beginPath(); cx.ellipse(cxw, mid, V(0.10), V(0.10) / SQ, 0, 0, Math.PI * 2); cx.fill();
      // 흰 릴 허브
      cx.fillStyle = '#f2f1ec';
      cx.beginPath(); cx.ellipse(cxw, mid, V(0.055), V(0.055) / SQ, 0, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = '#232427';
      cx.beginPath(); cx.ellipse(cxw, mid, V(0.015), V(0.015) / SQ, 0, 0, Math.PI * 2); cx.fill();
    }
    // ③ 라벨 자리 — 살짝 파인 빈 판
    cx.strokeStyle = '#3e3d3a'; cx.lineWidth = 2;
    cx.strokeRect(V(0.285), mid - wh / 2, V(0.43), wh);
  });

  // ── 시계 문자판 ── 눈금 열둘과 바늘 둘. **이게 없으면 그냥 원통이다.**
  /**
   * 탁상시계 문자판 — `ref/탁상시계/` (세이코샤 1915 자명종).
   * 원판 뚜껑면에 방사로 찍힌다 — 칸 가운데가 문자판 가운데, 반지름 64 가 문자판 테두리.
   *   ① 아이보리 바탕에 검은 로마 숫자 — 이 해상도에서는 굵은 획 묶음으로 낸다
   *   ② 12시 쪽 알람 보조판(앞면 지름의 0.25 → 문자판 반지름의 0.30),
   *      6시 쪽 초침 보조판(0.20 → 0.24)
   *   ③ 검은 바늘 둘
   */
  at(TILE.CLOCK, () => {
    const c = CELL / 2, R = CELL / 2;
    cx.fillStyle = '#f8f5ea';
    cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#26231f';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const strokes = [2, 1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3][i]!;   // 획 수로 로마 숫자의 폭을 흉내
      cx.save();
      cx.translate(c + Math.sin(a) * R * 0.78, c - Math.cos(a) * R * 0.78);
      cx.rotate(a);
      for (let k = 0; k < strokes; k++) cx.fillRect(-strokes * 2 + k * 4, -6, 2.4, 12);
      cx.restore();
    }
    cx.strokeStyle = '#26231f'; cx.lineWidth = 1.5;
    cx.beginPath(); cx.arc(c, c, R * 0.93, 0, Math.PI * 2); cx.stroke();
    // ② 보조판 둘
    cx.beginPath(); cx.arc(c, c - R * 0.40, R * 0.30, 0, Math.PI * 2); cx.stroke();
    cx.beginPath(); cx.arc(c, c + R * 0.42, R * 0.24, 0, Math.PI * 2); cx.stroke();
    // ③ 바늘 — 10시 10분
    cx.lineWidth = 4; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(c, c); cx.lineTo(c - R * 0.42, c - R * 0.24); cx.stroke();
    cx.beginPath(); cx.moveTo(c, c); cx.lineTo(c + R * 0.60, c - R * 0.34); cx.stroke();
    cx.fillStyle = '#26231f';
    cx.beginPath(); cx.arc(c, c, 5, 0, Math.PI * 2); cx.fill();
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

  /**
   * 비누 윗면 — `ref/비누/` (牛乳石鹸 赤箱). 한가운데 길이의 0.30 짜리 **오목한 정사각 틀**, 그 안에
   * 왼쪽을 보고 선 소 한 마리 돋을새김. 틀 위쪽 턱에 그늘이 진다(사진 (219,188,134)).
   * 비누 윗면 가운데 얹은 정사각 조각에 감긴다 — 칸 전체가 틀이다.
   */
  at(TILE.SOAP, () => {
    base();
    const w = CELL * 0.88, h = CELL * 0.88;
    const x0 = (CELL - w) / 2, y0 = (CELL - h) / 2;
    cx.fillStyle = 'rgba(150,120,80,0.30)'; cx.fillRect(x0, y0, w, 4);          // 위쪽 턱 그늘
    cx.fillStyle = 'rgba(150,120,80,0.14)'; cx.fillRect(x0, y0, 3, h);
    cx.strokeStyle = 'rgba(150,120,80,0.28)'; cx.lineWidth = 2; cx.strokeRect(x0, y0, w, h);
    // 소 — 몸통 · 머리 · 다리 넷 · 땅 선
    cx.fillStyle = 'rgba(140,110,80,0.30)';
    cx.fillRect(x0 + w * 0.30, y0 + h * 0.38, w * 0.46, h * 0.22);
    cx.fillRect(x0 + w * 0.18, y0 + h * 0.32, w * 0.14, h * 0.14);
    for (const f of [0.32, 0.42, 0.62, 0.72]) cx.fillRect(x0 + w * f, y0 + h * 0.58, 2, h * 0.16);
    cx.fillRect(x0 + w * 0.15, y0 + h * 0.76, w * 0.7, 1);
  });

  /**
   * 체온계 눈금판 — `ref/체온계/` (일본 수은 체온계). 흰 판 (219,216,209) 위쪽 절반을 노란 띠 (210,196,74) 가
   * 덮고 아래 절반에 끝자리 숫자 「5 6 7 8 9 0 1 2」, 37 만 빨강. 판 윗면(길이 방향 = u)에 감긴다.
   * 판은 길이 0.62 × 폭 0.045 라 가로가 14배 늘어난다 — 숫자를 가로로 0.07배 눌러 쓴다.
   * 윗면 uv 는 캔버스 위쪽을 앞(+z)으로 보낸다 — 뒤집어 그려 노란 띠가 뒤, 숫자가 앞에 오게 한다.
   */
  at(TILE.THERMO, () => {
    cx.save();
    cx.translate(0, CELL); cx.scale(1, -1);
    cx.fillStyle = '#dbd8d1'; cx.fillRect(0, 0, CELL, CELL);
    cx.fillStyle = '#d2c44a'; cx.fillRect(0, 0, CELL, CELL * 0.42);
    cx.fillStyle = '#1c1b1a';
    for (let k = 0; k <= 32; k++) cx.fillRect(k * CELL / 32, CELL * 0.42, 1, k % 4 === 0 ? CELL * 0.18 : CELL * 0.09);
    ['5', '6', '7', '8', '9', '0', '1', '2'].forEach((d, k) => {
      cx.save();
      cx.translate((k + 0.5) * CELL / 8, CELL * 0.80);
      cx.scale(0.28, 1);
      cx.font = 'bold 44px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillStyle = d === '7' ? '#ba3c28' : '#1c1b1a';
      cx.fillText(d, 0, 0);
      cx.restore();
    });
    cx.restore();
  });

  /**
   * 수건 — `ref/수건/` (쇼와 얇은 파일 수건). 흰 바탕 (219,222,216) 한가운데 큰 꽃 한 송이(노랑 (232,207,103)),
   * 두 긴 가장자리 안쪽에 파란 실 (68,68,86) 한 줄씩. 파일은 짧은 고리털이라 잔 점무늬.
   */
  at(TILE.TOWEL, () => {
    base();
    for (let i = 0; i < 220; i++) {
      cx.fillStyle = 'rgba(120,120,110,0.10)';
      cx.fillRect(rnd(i * 53 + 7, CELL), rnd(i * 29 + i * i + 1, CELL), 2, 2);
    }
    cx.fillStyle = '#444456';
    cx.fillRect(0, 6, CELL, 2); cx.fillRect(0, CELL - 8, CELL, 2);
    // 꽃 — 여섯 잎 + 가운데, 초록 잎 둘
    cx.fillStyle = '#5aa84e';
    cx.beginPath(); cx.ellipse(CELL * 0.38, CELL * 0.66, 16, 7, 0.6, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.ellipse(CELL * 0.64, CELL * 0.68, 15, 6, -0.6, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = '#e8cf67';
    for (let p = 0; p < 6; p++) {
      const a = p * Math.PI / 3;
      cx.beginPath(); cx.ellipse(CELL / 2 + Math.cos(a) * 15, CELL * 0.46 + Math.sin(a) * 15, 12, 8, a, 0, Math.PI * 2); cx.fill();
    }
    cx.fillStyle = '#d98a3a'; cx.beginPath(); cx.arc(CELL / 2, CELL * 0.46, 8, 0, Math.PI * 2); cx.fill();
  });

  /**
   * 함석 — `ref/양동이/` (아연 도금 양동이). 도금 결정이 얼룩덜룩하다 — 보통 (96,102,99) 에 밝은 조각
   * (165,170,168). 곱셈이라 바탕을 0.6 회색으로 칠하고 밝은 조각을 흰색으로 — 부품 계수가 전체 밝기를 정한다.
   */
  at(TILE.SPANGLE, () => {
    cx.fillStyle = '#999999'; cx.fillRect(0, 0, CELL, CELL);
    for (let i = 0; i < 60; i++) {
      cx.fillStyle = i % 3 ? 'rgba(255,255,255,0.85)' : 'rgba(90,90,90,0.5)';
      const x = rnd(i * 61 + 11, CELL), y = rnd(i * 37 + i * i + 5, CELL);
      cx.beginPath();
      cx.moveTo(x, y); cx.lineTo(x + 4 + rnd(i * 7, 10), y + rnd(i * 3, 6));
      cx.lineTo(x + 2 + rnd(i * 5, 8), y + 6 + rnd(i * 9, 8)); cx.lineTo(x - 3, y + 3 + rnd(i * 13, 5));
      cx.fill();
    }
  });

  /** 달걀 — 아주 옅은 반점. 세면 메추리알이 된다 */
  at(TILE.EGG, () => {
    base();
    // 사진(ref/계란)의 껍질은 잔 구멍이 촘촘한 무광 — 얼룩이 크면 돌림면에서 한 줄로 늘어나
    // 「비스듬한 얼룩 띠」가 됐다(2026-09-16 렌더). 점을 작고 옅게, 더 흩어서 찍는다
    for (let i = 0; i < 160; i++) {
      cx.fillStyle = `rgba(150,126,96,${(0.012 + rnd(i * 19, 0.018)).toFixed(3)})`;
      cx.fillRect(rnd(i * 71 + 5, CELL), rnd(i * 37 + i * i + 3, CELL), 1 + rnd(i * 11, 2), 1 + rnd(i * 5, 2));
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

  /** 골프공 — 육각 딤플. 가장자리에 그늘이 한 줄 있어야 «파인» 것으로 보인다 */
  at(TILE.GOLF, () => {
    base();
    const R = 9;
    for (let r = 0; r < CELL / R + 1; r++) {
      for (let c = 0; c < CELL / R + 1; c++) {
        const x = c * R + (r % 2 ? R / 2 : 0), y = r * R;
        cx.fillStyle = 'rgba(112,112,118,0.16)';
        cx.beginPath(); cx.arc(x, y, 3.4, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = 'rgba(255,255,255,0.55)';
        cx.beginPath(); cx.arc(x, y - 1.2, 2.2, 0, Math.PI * 2); cx.fill();
      }
    }
  });

  /**
   * 휴지통 꽃무늬 — `ref/휴지통/` (70년대 サンコープラスチック 꽃무늬 통).
   *
   * 원기둥 옆면에 감기므로 **위아래를 뒤집어 그린다**(y=0 이 통의 위 — 건전지와 같다).
   * 그리고 **가로로 2.6배 늘어난다** — 통 둘레(평균 지름 × π)가 높이의 2.6배다.
   * 그래서 꽃을 가로로 2.6분의 1로 눌러 그려야 통 위에서 둥근 꽃이 된다.
   *   ① 위 0.08 은 크림색 테, 그 밑단이 한 바퀴 12칸 물결로 0.13 까지 늘어진다
   *   ② 아래 0.07 은 크림색 띠
   *   ③ 사이는 크림 바탕에 주황빛 빨강 · 노랑 큰 꽃과 연두 잎이 빽빽하다
   */
  at(TILE.BIN_FLORAL, () => {
    cx.save();
    cx.translate(0, CELL); cx.scale(1, -1);
    const SQ = 1 / 2.6;
    cx.fillStyle = '#f6f3d8';
    cx.fillRect(0, 0, CELL, CELL);
    const flower = (x: number, y: number, r: number, petal: string, eye: string): void => {
      // 짙은 갈색 윤곽 — 사진의 꽃마다 있다. 없으면 「흐릿한 얼룩」으로 읽힌다(판정자)
      cx.fillStyle = '#703720';
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        cx.beginPath();
        cx.ellipse(x + Math.cos(a) * r * 0.55 * SQ, y + Math.sin(a) * r * 0.55, r * 0.5 * SQ + 0.8, r * 0.5 + 0.8, 0, 0, Math.PI * 2);
        cx.fill();
      }
      cx.fillStyle = petal;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        cx.beginPath();
        cx.ellipse(x + Math.cos(a) * r * 0.55 * SQ, y + Math.sin(a) * r * 0.55, r * 0.5 * SQ, r * 0.5, 0, 0, Math.PI * 2);
        cx.fill();
      }
      cx.fillStyle = eye;
      cx.beginPath(); cx.ellipse(x, y, r * 0.38 * SQ, r * 0.38, 0, 0, Math.PI * 2); cx.fill();
    };
    const leaf = (x: number, y: number): void => {
      cx.fillStyle = '#9ccb5a';
      cx.beginPath(); cx.ellipse(x, y, 5 * SQ, 3, 0.5, 0, Math.PI * 2); cx.fill();
    };
    for (let i = 0; i < 40; i++) leaf(rnd(i * 17 + 5, CELL), 14 + rnd(i * 29 + 11, 100));
    // 큰 꽃 — 빈틈없이. 사진은 꽃이 표면의 80% 넘게 덮는다(판정자: 렌더는 30%)
    for (let row = 0; row < 4; row++) {
      for (let c = 0; c < 4; c++) {
        const x = (c + (row % 2) * 0.5) * (CELL / 4) + 4;
        flower(x % CELL, 22 + row * 25, 19, ['#d8543a', '#e8653f', '#ecc54e', '#f07a50'][(row + c) % 4]!, row % 2 ? '#e2692f' : '#ecc54e');
      }
    }
    // 작은 꽃 — 빈자리를 메운다
    for (let i = 0; i < 30; i++) {
      flower(rnd(i * 41 + 7, CELL), 16 + rnd(i * 13 + 3, 96), 10,
        i % 3 === 0 ? '#f0c84a' : i % 3 === 1 ? '#f48a78' : '#e8653f', i % 2 ? '#e2692f' : '#f0c84a');
    }
    // ① 위 테 + 물결 밑단 — 12칸
    cx.fillStyle = '#f2eed2';
    cx.fillRect(0, 0, CELL, 10);
    const W = CELL / 12;
    for (let k = 0; k < 12; k++) {
      cx.beginPath(); cx.arc(k * W + W / 2, 10, W / 2, 0, Math.PI); cx.fill();
    }
    // ② 아래 크림 띠 — 받침
    cx.fillRect(0, CELL - 12, CELL, 12);
    cx.restore();
  });

  /**
   * 전화기 다이얼 — `ref/전화기/` (전전공사 600형).
   *
   * 원판 뚜껑면의 uv 는 원을 칸 전체에 방사로 편다 — 칸 가운데가 원판 가운데다.
   * 잰 비율(몸통 밑 폭 기준): 숫자 테 바깥 0.755 · 투명 구멍판 0.60 · 노란 딱지 = 구멍판의 0.51.
   * 원판 지름을 숫자 테 바깥으로 잡으므로 칸 반지름 64 = 0.755 다.
   */
  at(TILE.PHONE_DIAL, () => {
    const R = CELL / 2, c = CELL / 2;
    cx.fillStyle = '#1c1b1a';
    cx.fillRect(0, 0, CELL, CELL);
    // 흰 숫자 — 1시에서 시작해 반시계로 10개. 글자는 이 해상도에서 뭉개지므로 짧은 획으로
    cx.fillStyle = '#f2f0ea';
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 3 - (k / 12) * Math.PI * 2;
      cx.fillRect(c + Math.cos(a) * R * 0.9 - 2, c + Math.sin(a) * R * 0.9 - 3, 4, 6);
    }
    // 투명 구멍판 — 뒤의 검정이 비치는 옅은 회청
    const plate = R * (0.60 / 0.755);
    // 투명 구멍판 너머로 검은 몸통이 비친다 — 회색 판은 「몸통과 따로 논다」로 읽혔다(판정자)
    cx.fillStyle = '#2c3034';
    cx.beginPath(); cx.arc(c, c, plate, 0, Math.PI * 2); cx.fill();
    // 손가락 구멍 10개 — 흰 점이 밑에 보인다
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 3 - (k / 12) * Math.PI * 2;
      const hx = c + Math.cos(a) * plate * 0.74, hy = c + Math.sin(a) * plate * 0.74;
      cx.fillStyle = '#2a2b2d';
      cx.beginPath(); cx.arc(hx, hy, plate * 0.17, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = '#e8e6e0';
      cx.beginPath(); cx.arc(hx, hy, 1.6, 0, Math.PI * 2); cx.fill();
    }
    // 가운데 노란 딱지 — 구멍판의 0.51
    cx.fillStyle = '#e9c948';
    cx.beginPath(); cx.arc(c, c, plate * 0.51 * 0.8, 0, Math.PI * 2); cx.fill();
    // 은색 손가락 멈추개 — 4~5시 방향
    cx.fillStyle = '#c9ccd1';
    cx.fillRect(c + plate * 0.78, c + plate * 0.52, 7, 4);
  });

  /**
   * 방석 겉감 — `ref/방석/` (장밋빛 바탕에 크림색 잔꽃).
   *
   * 크림색 꽃을 «본체보다 밝게» 내야 하는데 텍스처는 곱하기라 1.0 을 못 넘는다.
   * 그래서 **바탕을 0.78 로 깔고 점을 1.0 으로 둔다.** 정점색을 1.28 로 주면
   * 바탕은 팔레트 색 그대로, 점만 28% 밝아진다 — 어느 팔레트 색에도 먹는다.
   */
  at(TILE.ZABUTON, () => {
    cx.fillStyle = '#c7c7c7';
    cx.fillRect(0, 0, CELL, CELL);
    // 잔꽃 — 한 줄에 40 개쯤 빽빽이(사진). 크게 성기면 판정자가 「큰 꽃이 드문드문」이라고 한다
    // 잔꽃 — 네 잎 십자(3px). 2px 네모는 「분홍 네모 점」으로 읽혔다(판정자)
    cx.fillStyle = '#fff6e6';
    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 20; c++) {
        const x = Math.round(c * 6.4 + (r % 2) * 3.2 + rnd(r * 31 + c, 1.5)), y = Math.round(r * 6.4 + rnd(c * 17 + r, 1.5));
        cx.fillRect(x, y - 1, 1, 3); cx.fillRect(x - 1, y, 3, 1);
      }
    }
  });

  /**
   * 사과 껍질 — `ref/사과/` (후지 사과).
   * 빨강은 한 면이 아니라 **꼭지에서 바닥으로 내려가는 가는 세로 줄이 촘촘히 겹친 결**이다.
   * 노란 연두가 약 19% — 한쪽 옆구리(u 0.12~0.34)에서 줄이 성겨 드러난다.
   * 돌림면 uv 는 v=0 이 밑이라 캔버스 위쪽이 사과 밑이다. 줄은 세로라 뒤집을 필요가 없다.
   */
  at(TILE.APPLE, () => {
    cx.fillStyle = '#bfc050';
    cx.fillRect(0, 0, CELL, CELL);
    // 붉은 바탕 — 한쪽 옆구리(u 0.10~0.36)만 비워 노란 연두가 드러나게 한다. 경계는 부드럽게
    for (let x = 0; x < CELL; x++) {
      const u = x / CELL;
      const d = Math.min(Math.abs(u - 0.23), 1 - Math.abs(u - 0.23));
      const a = Math.min(0.94, Math.max(0.08, (d - 0.10) * 5));
      cx.fillStyle = `rgba(150,22,48,${a.toFixed(3)})`;
      cx.fillRect(x, 0, 1, CELL);
    }
    // 세로 줄 — 옅고 불규칙하게. 또렷하면 골진 호박이 된다
    for (let i = 0; i < 180; i++) {
      const x = rnd(i * 31 + 3, CELL);
      const y0 = rnd(i * 17 + 5, CELL * 0.5), len = CELL * 0.3 + rnd(i * 13, CELL * 0.6);
      cx.fillStyle = i % 2 ? 'rgba(150,40,34,0.18)' : 'rgba(210,150,70,0.14)';
      cx.fillRect(x, y0, 0.8 + rnd(i * 7, 1.6), len);
    }
    // 어깨(캔버스 아래쪽 = 사과 위쪽)는 분홍빛 빨강으로 조금 짙다
    cx.fillStyle = 'rgba(150,50,60,0.22)';
    cx.fillRect(0, CELL * 0.75, CELL, CELL * 0.25);
    // 껍질 숨구멍 — 옅은 노란 점
    cx.fillStyle = 'rgba(235,220,120,0.7)';
    for (let i = 0; i < 60; i++) cx.fillRect(rnd(i * 41 + 9, CELL), rnd(i * 23 + 1, CELL), 1, 1);
  });

  /**
   * 나사산 — 사선 줄. 원기둥에 감으면 u(둘레)를 따라 비스듬히 올라가 나선으로 읽힌다.
   * 재질 칸 규약대로 흰 바탕에 회색 줄이다(팔레트 색을 그대로 통과시킨다).
   */
  at(TILE.THREAD, () => {
    base();
    for (let k = -CELL; k < CELL * 2; k += 11) {
      cx.strokeStyle = 'rgba(70,74,82,0.55)'; cx.lineWidth = 4;
      cx.beginPath(); cx.moveTo(k, 0); cx.lineTo(k + CELL * 0.35, CELL); cx.stroke();
      cx.strokeStyle = 'rgba(255,255,255,0.8)'; cx.lineWidth = 2;
      cx.beginPath(); cx.moveTo(k + 5, 0); cx.lineTo(k + 5 + CELL * 0.35, CELL); cx.stroke();
    }
  });

  /**
   * 쌓인 신문 옆면 — `ref/신문더미/`. 한 부 두께가 묶음 너비의 0.026 이라 칸 높이에 12 층.
   * 층마다 밝기를 흔들고, 두 층에 하나꼴로 빨간 광고면 줄(104,52,48)을 끼운다.
   */
  at(TILE.PAPERSTACK, () => {
    cx.fillStyle = '#e8e6df';
    cx.fillRect(0, 0, CELL, CELL);
    const L = CELL / 12;
    for (let i = 0; i < 12; i++) {
      const g = 200 + ((i * 37) % 40);
      cx.fillStyle = `rgb(${g},${g - 2},${g - 8})`;
      cx.fillRect(0, i * L + 1, CELL, L - 2);
      cx.fillStyle = '#7c7870';
      cx.fillRect(0, i * L, CELL, 1);
      if (i % 3 === 1) { cx.fillStyle = '#a4453c'; cx.fillRect(0, i * L + L * 0.45, CELL, 2); }
      // 접힌 층 사이로 보이는 컬러 지면 조각 — 사진 옆면은 흰 바탕에 빨강·파랑·주황 조각이 촘촘하다
      for (let k = 0; k < 4; k++) {
        cx.fillStyle = ['#c0453a', '#3c62a8', '#d88a3a', '#2a2826'][(i + k) % 4]!;
        cx.fillRect(rnd(i * 29 + k * 13, CELL - 12), i * L + 2, 6 + rnd(i + k * 7, 10), L - 4);
      }
    }
  });

  /**
   * 슬리퍼 겉감 — `ref/슬리퍼/` (쇼와 꽃무늬 천 슬리퍼). 짙은 남색(6,33,140) 바탕에
   * 덮개 폭 절반만 한 빨간 다섯 잎 꽃, 노란 두 쪽 꽃, 작은 흰 꽃, 초록 잎.
   */
  at(TILE.SLIPPER, () => {
    cx.fillStyle = '#0d2590';
    cx.fillRect(0, 0, CELL, CELL);
    const five = (x: number, y: number, r: number, c: string, eye: string): void => {
      cx.fillStyle = c;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        cx.beginPath(); cx.arc(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.5, 0, Math.PI * 2); cx.fill();
      }
      cx.fillStyle = eye; cx.beginPath(); cx.arc(x, y, r * 0.35, 0, Math.PI * 2); cx.fill();
    };
    five(30, 34, 20, '#d0204a', '#f2c81e'); five(96, 92, 20, '#d0204a', '#f2c81e');
    five(90, 26, 9, '#ffffff', '#f07a2a'); five(26, 100, 9, '#ffffff', '#f07a2a');
    cx.fillStyle = '#f2c81e';
    for (const [x, y] of [[70, 60], [20, 70], [110, 58]] as const) {
      cx.beginPath(); cx.arc(x - 6, y, 8, 0, Math.PI * 2); cx.arc(x + 6, y, 8, 0, Math.PI * 2); cx.fill();
    }
    cx.fillStyle = '#3aa048';
    for (const [x, y] of [[54, 40], [62, 110], [112, 112]] as const) { cx.beginPath(); cx.ellipse(x, y, 6, 3, 0.5, 0, Math.PI * 2); cx.fill(); }
  });

  /**
   * 구슬 — `ref/구슬/`. 구면 uv(u 둘레 · v 극→극)에 감긴다. 파란 잎 모양 심은 둘레 절반(u 0.25~0.75)을
   * 가로지르며 v 가운데를 30° 기울어 지난다 — 구 앞에서 보면 공 한가운데를 비스듬히 가로지른다.
   */
  at(TILE.MARBLE, () => {
    cx.fillStyle = '#e9efe6';
    cx.fillRect(0, 0, CELL, CELL);
    cx.save();
    cx.translate(64, 64); cx.rotate(-0.52);
    const leaf = cx.createLinearGradient(-40, 0, 40, 0);
    leaf.addColorStop(0, '#2b54b8'); leaf.addColorStop(0.5, '#3f76d8'); leaf.addColorStop(1, '#2b54b8');
    cx.fillStyle = leaf;
    cx.beginPath(); cx.ellipse(0, 0, 40, 6, 0, 0, Math.PI * 2); cx.fill();
    cx.restore();
    // 위쪽 1/4 의 흐린 창 반사
    cx.fillStyle = 'rgba(255,255,255,0.8)';
    cx.fillRect(40, 18, 18, 8); cx.fillRect(62, 18, 10, 8);
  });

  /**
   * 딱지(원형 멘코) — `ref/딱지/round.jpg`. 원판 뚜껑면에 방사로 찍힌다(칸 가운데 = 원판 가운데).
   * 빨간 바탕이 원 면적의 0.43, 노란 번개 테, 굵은 검은 윤곽의 큰 얼굴 하나.
   */
  at(TILE.MENKO, () => {
    const c = CELL / 2;
    cx.fillStyle = '#e0452a'; cx.fillRect(0, 0, CELL, CELL);
    // 노란 번개 테 — 톱니 별
    cx.fillStyle = '#f2cf2e';
    cx.beginPath();
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2, r = k % 2 ? 40 : 54;
      const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
      if (k) cx.lineTo(x, y); else cx.moveTo(x, y);
    }
    cx.closePath(); cx.fill();
    // 인물 — 흰 옷 어깨 · 살색 얼굴 · 모자 · 굵은 검은 윤곽
    cx.lineWidth = 3; cx.strokeStyle = '#1a1512';
    cx.fillStyle = '#f2ece0'; cx.beginPath(); cx.ellipse(c, c + 38, 36, 22, 0, Math.PI, 0); cx.fill(); cx.stroke();
    cx.fillStyle = '#f1c39b'; cx.beginPath(); cx.arc(c, c + 2, 22, 0, Math.PI * 2); cx.fill(); cx.stroke();
    cx.fillStyle = '#f2ece0'; cx.beginPath(); cx.ellipse(c, c - 16, 23, 12, 0, Math.PI, 0); cx.fill(); cx.stroke();
    cx.fillStyle = '#2d5d8a'; cx.fillRect(c - 22, c - 17, 44, 6);
    cx.fillStyle = '#1a1512';
    cx.beginPath(); cx.arc(c - 8, c + 1, 2.6, 0, Math.PI * 2); cx.arc(c + 8, c + 1, 2.6, 0, Math.PI * 2); cx.fill();
    cx.fillRect(c - 6, c + 12, 12, 2.5);
  });

  /**
   * 공책(자포니카 학습장) 표지 — `ref/공책/` (1981년판). 윗면에 감기므로 상하를 뒤집어 그린다.
   *   ① 짙은 남색 바탕 ② 위 0.18 에 짙은 띠와 흰 로고 줄 ③ 흰 이중선 둥근 틀(너비 0.86 · 높이 0.78)
   *   ④ 그 안 위쪽 0.58 을 채운 거의 정사각형 곤충 사진 ⑤ 사진 아래 흰 이름 칸(0.16)
   */
  at(TILE.JAPONICA, () => {
    const X = (f: number): number => f * CELL;
    cx.save();
    cx.translate(0, CELL); cx.scale(1, -1);
    cx.fillStyle = '#1d2f6e'; cx.fillRect(0, 0, CELL, CELL);
    // ② 로고 줄 — 네모 막대 흉내가 「작은 흰 네모 한 줄」로 읽혀(판정자) 글자로 찍는다.
    // 표지는 폭 0.71 × 길이 1.0 에 감겨 세로가 1.41배 늘어난다 — 글자만 세로로 0.71배 눌러 쓴다
    cx.save();
    cx.translate(X(0.5), X(0.105)); cx.scale(1, 0.71);
    cx.fillStyle = '#f4f1e8'; cx.font = 'bold 14px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText('ジャポニカ学習帳', 0, 0);
    cx.restore();
    // ③ 흰 이중선 틀
    cx.strokeStyle = '#f4f1e8'; cx.lineWidth = 2;
    cx.strokeRect(X(0.07), X(0.19), X(0.86), X(0.78));
    cx.strokeRect(X(0.09), X(0.21), X(0.82), X(0.74));
    // ④ 곤충 사진 — 초록 잎 바탕에 갈색 딱정벌레
    cx.fillStyle = '#5c9a3a'; cx.fillRect(X(0.10), X(0.22), X(0.80), X(0.58));
    cx.fillStyle = '#7fbf4d'; cx.beginPath(); cx.ellipse(X(0.4), X(0.45), X(0.3), X(0.12), 0.5, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = '#5a3218'; cx.beginPath(); cx.ellipse(X(0.52), X(0.52), X(0.13), X(0.18), -0.3, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = '#2a1608'; cx.lineWidth = 1.5;
    cx.beginPath(); cx.moveTo(X(0.52), X(0.36)); cx.lineTo(X(0.52), X(0.70)); cx.stroke();
    // 다리 여섯과 더듬이 둘 — 갈색 타원만으로는 「콩」이었다(판정자)
    for (const [dy, a] of [[-0.08, 0.6], [0, 0.1], [0.08, -0.4]] as const) {
      for (const sgn of [1, -1]) {
        cx.beginPath(); cx.moveTo(X(0.52), X(0.52 + dy));
        cx.lineTo(X(0.52 + sgn * 0.20), X(0.52 + dy - a * 0.12)); cx.stroke();
      }
    }
    for (const sgn of [1, -1]) {
      cx.beginPath(); cx.moveTo(X(0.52), X(0.35)); cx.lineTo(X(0.52 + sgn * 0.10), X(0.25)); cx.stroke();
    }
    // ⑤ 이름 칸
    cx.fillStyle = '#f4f1e8'; cx.fillRect(X(0.12), X(0.81), X(0.76), X(0.13));
    cx.restore();
  });

  /**
   * 밥공기 몸통 — `ref/밥공기/` (白山陶器 「紀の川」 1977).
   * 돌림면 v 는 윤곽 첫 점(굽 쪽)이 0 이라 **캔버스 아래쪽이 입술**이다. 띠는 입술에서 높이의
   * 0.045 아래서 시작해 0.055 두께 — 윤곽 길이로 환산하면 v 0.91~0.96 이다.
   * 갈색 선 (78,70,60) — 청회색 (92,110,117) — 갈색 선, 3겹.
   */
  at(TILE.RICEBOWL, () => {
    base();
    cx.fillStyle = '#4e463c'; cx.fillRect(0, CELL * 0.905, CELL, 2);
    cx.fillStyle = '#6a8591'; cx.fillRect(0, CELL * 0.905 + 2, CELL, 4);
    cx.fillStyle = '#4e463c'; cx.fillRect(0, CELL * 0.905 + 6, CELL, 2);
  });

  /** 밥공기 굽 — 한 바퀴 20줄. 사진은 앞 반쪽에 10줄, 줄 굵기가 흰 틈보다 조금 가늘다 */
  at(TILE.BOWLFOOT, () => {
    base();
    cx.fillStyle = '#255366';
    for (let k = 0; k < 20; k++) cx.fillRect(k * CELL / 20, 0, CELL / 20 * 0.42, CELL);
  });

  /**
   * 도마 — `ref/도마/` (木屋 히노키). 결은 판 길이(u) 방향으로 곧게, 옹이 없이.
   * 밝은 결 (236,209,168) 과 분홍 도는 결 (229,197,159) 이 번갈아 — 바탕색 대비 흰색 계수로 옮겼다.
   * `grain()` 은 옹이를 넣고 결이 끊겨 «막 켠 나무»라, 대패질한 곧은결 판은 따로 그린다.
   */
  at(TILE.HINOKI, () => {
    base();
    for (let i = 0; i < 34; i++) {
      cx.fillStyle = i % 7 === 0 ? 'rgba(214,150,120,0.20)' : 'rgba(150,120,80,0.16)';
      cx.fillRect(0, rnd(i * 11 + 7, CELL), CELL, i % 7 === 0 ? 5 : 1);
    }
  });

  /**
   * 당근 잔주름 — `ref/당근/`. 몸통을 가로로 두르는 가는 줄이 드문드문.
   * 곱셈이라 사진의 «흰» 잔뿌리 자국은 못 그린다(흰색 위로 밝게 못 간다) — 옅은 그늘 줄로 대신한다.
   */
  at(TILE.CARROT, () => {
    base();
    for (let i = 0; i < 16; i++) {
      cx.fillStyle = 'rgba(120,60,30,0.22)';
      const y = rnd(i * 29 + 5, CELL), x = rnd(i * 13 + 3, CELL);
      cx.fillRect(x - 30, y, 40 + rnd(i * 7, 50), 1);
    }
  });

  /**
   * 유키히라 망치 자국 — `ref/냄비/`. 실물은 한 알이 지름의 0.04 라 한 바퀴 78 알인데,
   * 128px 칸에 78 알이면 한 알이 1.6px 이라 무늬가 사라진다. 한 바퀴 16 알로 키웠다.
   * 줄마다 반 칸 엇갈린다 — 이 엇갈림이 «벌집»이다.
   */
  at(TILE.HAMMERED, () => {
    base();
    const n = 16, rows = 9, w = CELL / n, h = CELL / rows;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k <= n; k++) {
        const x = k * w + (r % 2 ? w / 2 : 0), y = r * h + h / 2;
        // 대비를 낮춘다 — 0.22 로는 「표범 무늬 같은 둥근 얼룩」이었다(트랙 D)
        cx.fillStyle = 'rgba(70,74,84,0.11)';
        cx.beginPath(); cx.ellipse(x, y, w * 0.42, h * 0.40, 0, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = 'rgba(255,255,255,0.9)';
        cx.beginPath(); cx.ellipse(x - 1, y - 1, w * 0.22, h * 0.20, 0, 0, Math.PI * 2); cx.fill();
      }
    }
  });

  /**
   * 전기밥솥 꽃무늬 — `ref/밥솥/` (東芝 RCK-200E).
   * 원기둥 옆면 v 는 아래가 0 이라 **캔버스 위쪽이 몸통 아래**다 — 꽃대가 아래(캔버스 위)에서
   * 위로 자라게 그린다. 빨간 꽃 (216,34,35) 에 흰 꽃술, 초록 (90,174,85) · 회색 (146,148,147) 잎.
   * 한 바퀴에 꽃 넷 — 앞에서 둘이 보인다.
   */
  at(TILE.FLOWERBAND, () => {
    base();
    for (let k = 0; k < 4; k++) {
      const cxp = (k + 0.5) * CELL / 4;
      // 줄기 — 몸통 아래(캔버스 위 0.05)에서 꽃(0.42)까지. 사진의 꽃은 몸통 아래 절반에 핀다
      cx.fillStyle = '#7f8a7c'; cx.fillRect(cxp - 1, CELL * 0.05, 2, CELL * 0.37);
      // 잎 — 줄기 양옆으로 초록·회색 번갈아
      for (let j = 0; j < 3; j++) {
        cx.fillStyle = j % 2 ? '#929493' : '#5aae55';
        const y = CELL * (0.10 + j * 0.10);
        cx.beginPath(); cx.ellipse(cxp - 6, y, 5, 3, -0.6, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = j % 2 ? '#5aae55' : '#929493';
        cx.beginPath(); cx.ellipse(cxp + 6, y + 3, 5, 3, 0.6, 0, Math.PI * 2); cx.fill();
      }
      // 꽃 — 다섯 잎
      cx.fillStyle = '#d82223';
      for (let p = 0; p < 5; p++) {
        const a = p * Math.PI * 2 / 5;
        cx.beginPath(); cx.arc(cxp + Math.cos(a) * 5, CELL * 0.42 + Math.sin(a) * 5, 4.5, 0, Math.PI * 2); cx.fill();
      }
      cx.fillStyle = '#f4f1e8';
      cx.beginPath(); cx.arc(cxp, CELL * 0.42, 2.5, 0, Math.PI * 2); cx.fill();
    }
  });

  /**
   * 찬장 유리 — `ref/찬장/` (1970년대 식기장). 머티리얼이 불투명이라 유리 너머 그릇을 «넣으면» 안 보인다
   * (예전 찬장의 그릇 셋이 유리 뒤에 숨어 있었다). 유리 면에 **비친 그림**으로 그린다 —
   * 선반 줄 하나와 그 위 접시 · 찻잔 윤곽, 창 가장자리의 모서리 둥근 흰 테(사진의 흰 선).
   * 부품 정점색은 흰색이라 이 칸의 색이 그대로 나온다. 칸이 세로로 늘어나도 읽히게 굵게 그린다.
   */
  at(TILE.CUPBOARD_GLASS, () => {
    cx.fillStyle = '#aec8cf'; cx.fillRect(0, 0, CELL, CELL);
    // 안쪽 그늘 — 아래로 갈수록 짙다(선반 밑)
    cx.fillStyle = 'rgba(60,50,45,0.28)'; cx.fillRect(0, CELL * 0.55, CELL, CELL * 0.45);
    // 선반 줄
    cx.fillStyle = '#7a6a5e'; cx.fillRect(0, CELL * 0.52, CELL, 4);
    // 접시 셋을 세워 기댄 윤곽 + 찻잔 둘
    cx.fillStyle = '#eef0ec';
    for (const x of [0.22, 0.34, 0.46]) { cx.beginPath(); cx.ellipse(CELL * x, CELL * 0.36, 11, 20, 0, 0, Math.PI * 2); cx.fill(); }
    for (const x of [0.66, 0.82]) cx.fillRect(CELL * x - 9, CELL * 0.72, 18, 16);
    // 반사 줄 — 비스듬히 두 줄
    cx.fillStyle = 'rgba(255,255,255,0.45)';
    cx.save(); cx.translate(CELL / 2, CELL / 2); cx.rotate(-0.6);
    cx.fillRect(-40, -CELL, 10, CELL * 2); cx.fillRect(-18, -CELL, 4, CELL * 2);
    cx.restore();
    // 모서리 둥근 흰 테
    cx.strokeStyle = '#f2f0ea'; cx.lineWidth = 5;
    cx.beginPath(); cx.roundRect(5, 5, CELL - 10, CELL - 10, 14); cx.stroke();
  });

  /** 찬장 문·서랍 — 짙은 적갈 (92,61,53) 판에 가장자리 흰 선. 흰 선은 곱셈으로 못 내므로 판 색까지 여기서 칠한다 */
  at(TILE.CUPBOARD_DOOR, () => {
    cx.fillStyle = '#5c3d35'; cx.fillRect(0, 0, CELL, CELL);
    for (let i = 0; i < 18; i++) {
      cx.fillStyle = 'rgba(40,24,18,0.35)';
      cx.fillRect(0, rnd(i * 17 + 3, CELL), CELL, 1);
    }
    cx.strokeStyle = '#eeeae2'; cx.lineWidth = 4;
    cx.beginPath(); cx.roundRect(9, 9, CELL - 18, CELL - 18, 12); cx.stroke();
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
