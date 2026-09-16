import {
  BoxGeometry, CircleGeometry, CylinderGeometry, ExtrudeGeometry, IcosahedronGeometry, Quaternion, Shape, SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ShapeIdGarden } from './generation';
import {
  assemble, hollow, invert, part, WHITE,
  type Part, type RGB,
} from './shapes.kit';
import { TILE } from './atlas';

/** X축으로 돌린 원기둥·토러스 — 축이 Z가 된다 */
const LIE_Z: readonly [number, number, number] = [Math.PI / 2, 0, 0];

/**
 * ── 일본식 정원 물건 일곱 ────────────────────────────────────
 *
 * 뒷마당이 흙바닥 한 장에 페트병·연어 캔·양동이가 널린 재활용 수거장이었다.
 * 이끼와 자갈(`floors.ts`)이 «땅»을 고쳤고, 이 파일이 «서 있는 것»을 고친다.
 *
 * ## 색은 팔레트가 아니라 계수로 벌린다
 *
 * 한 형상에 재질이 둘 이상이면(석등의 돌+구멍, 대나무의 줄기+잎) 팔레트에 색을
 * 실으면 **전부 그 색이 된다** — 찬장 유리가 갈색이 되고, 나무 줄기가 초록이 되고,
 * 욕조 안이 안 보이던 게 전부 이 실수였다. **세 번 겪었다.**
 * 그래서 여기 일곱은 `SHAPE_COLOR` 를 중성색으로 두고 아래 계수로 재질을 만든다.
 */
/** 화강암 — 석등·물확·징검돌의 돌 */
const STONE: RGB = [0.78, 0.77, 0.73];
/** 그늘진 돌 — 파인 자리·아랫면. 같은 회색이라도 어두워야 «깊이»가 생긴다 */
const STONE_DARK: RGB = [0.52, 0.52, 0.50];
/**
 * 이끼 낀 돌 — 징검돌 가장자리.
 * **`[0.42,0.55,0.28]` 이었다** — 화강암(STONE)과 대비가 0.02 라 화면에서 이끼가
 * 아예 없었다. 이끼는 돌보다 확실히 어둡고 푸르다.
 */
const MOSS: RGB = [0.22, 0.40, 0.16];
/** 대나무 줄기 — 마른 연둣빛 */
const BAMBOO: RGB = [0.70, 0.74, 0.42];
/** 물확 물대용 — 화강암(회색) 위에서 갈리려면 이만큼 밝아야 한다 */
const BAMBOO_LIT: RGB = [1.25, 1.30, 0.68];
/** 대나무 마디 — 줄기보다 짙어야 «마디»로 읽힌다 */
const BAMBOO_NODE: RGB = [0.52, 0.56, 0.30];
/** 잎 — 대나무·소나무 공통 */
const LEAF: RGB = [0.28, 0.46, 0.24];
/** 솔잎 — 대나무 잎보다 짙고 푸르다 */
const PINE: RGB = [0.22, 0.40, 0.26];
/** 정원돌 화강암 — 푸른빛 도는 회색 */
const GRANITE: RGB = [0.66, 0.66, 0.64];
/** 같은 화강암인데 볕에 바랜 것. 무리 안에서 돌이 «다 같은 돌»로 안 보이게 */
const GRANITE_WARM: RGB = [0.74, 0.71, 0.64];

/**
 * 대나무 줄기 한 대 — 마디 링을 `n` 개 두른 원기둥.
 *
 * **마디가 대나무의 정체다.** 매끈한 원기둥은 그냥 초록 막대고, 일정 간격
 * 도톰한 링이 있어야 대나무가 된다. `tap()`(수도꼭지)이 「기둥+주둥이+손잡이 셋이
 * 있어야 꼭지로 읽힌다」와 같은 이야기다.
 */
function culm(
  x: number, z: number, h: number, r: number, tilt: number, nodes: number,
  /**
   * 마디 위상(0~1). **대마다 달라야 한다** — 세 대의 마디 높이가 같으면
   * 링이 가로로 줄을 맞춰서 「사다리 가로대」로 읽힌다. 화면이 잡은 결함이다.
   */
  phase = 0,
  /** 대 색. 물확은 화강암 위에 서므로 기본값(`BAMBOO`)으로는 대비가 0.05 다 */
  rgb: RGB = BAMBOO,
): Part[] {
  const p: Part[] = [
    part(new CylinderGeometry(r * 0.82, r, h, 7), rgb, [x, h / 2, z], [0, 0, tilt]),
  ];
  for (let i = 1; i <= nodes; i++) {
    const y = (h * (i - 1 + phase + 0.6)) / (nodes + 1);
    // 기울인 줄기를 따라가야 마디가 «줄기 위»에 남는다 — 안 따라가면 공중에 뜬 고리다
    // **링은 (3, 6) 이다.** (4, 7) 로 두면 링 하나가 56 삼각형이고, 세 대에
    // 열두 마디면 그것만 672 개다 — 대나무 한 종이 리포 최대(`가로수` 920)를
    // 넘겼다. 마디는 «있다/없다»가 전부라 해상도를 올릴 값어치가 없다.
    p.push(part(new TorusGeometry(r * 0.94, r * 0.20, 3, 6), BAMBOO_NODE,
      [x - Math.sin(tilt) * y, y, z], [Math.PI / 2, 0, tilt]));
  }
  return p;
}

/**
 * 정원 바위(景石) 한 덩이.
 *
 * ## 왜 이게 정원의 «첫 번째» 요소인가
 *
 * 레퍼런스가 한목소리로 말한다 — **「일본 정원에서 돌이 가장 중요한 요소다」**.
 * 명인은 돌 하나를 고르는 데 몇 해를 쓴다. 그런데 이 마당에는 **바위가 하나도
 * 없었다.** 석등·물확·대나무를 아무리 잘 만들어도 그건 정원에 «놓는 물건»이지
 * 정원의 «뼈대»가 아니다.
 *
 * ## 정이십면체를 흔들어 깎는다
 *
 * `IcosahedronGeometry(0.5, 0)` 은 면 스물짜리 볼록 다면체다. 꼭짓점을 밀면
 * **각진 화강암**이 되고, 매끈한 구로는 절대 안 나오는 «깨진 면»이 생긴다.
 * 이 리포의 다른 형상이 상자·원기둥·구를 «쌓아» 만드는 것과 달리, 돌은
 * 한 덩이를 **깎아야** 돌이다.
 *
 * **밀기 값은 좌표에서 뽑는다.** `toNonIndexed()` 하면 한 꼭짓점이 인접한 면
 * 수만큼 중복되는데, 인덱스로 난수를 뽑으면 같은 자리의 복제본이 **다른 값**을
 * 받아 면이 벌어진다. 좌표를 반올림해 키로 쓰면 복제본이 같은 값을 받는다.
 *
 * @param flat  y 배율. 크면 엎드린 돌(伏石·고요·물), 작으면 선 돌(立石·힘·산)
 * @param lean  기울기(rad). 협석(脇石)은 주석 쪽으로 기울어 받친다
 */
/** 솔가지 껍질 — 잎(몸통)과 갈려야 「가지가 덩이를 받친다」가 보인다(WOOD 는 대비 0.07) */
const PINE_BARK: RGB = [0.26, 0.18, 0.12];

function rock(seed: number, flat: number, lean: number, rgb: RGB): Part[] {
  /**
   * **세분 1(면 80개)이다.** 0(면 20)으로 만들었더니 각이 너무 커서 화강암이
   * 아니라 «깎은 보석»이었다. 80면이면 면 하나가 손바닥만 해져서 흔들었을 때
   * 바위의 깨진 결로 읽힌다. 20 → 80 은 리포 평균(371)에 비하면 공짜다.
   */
  const geo = new IcosahedronGeometry(0.5, 1);      // 이미 non-indexed 다
  const pos = geo.getAttribute('position');
  const cs = Math.cos(lean), sn = Math.sin(lean);
  const cy = Math.cos(seed), sy = Math.sin(seed);
  const cut = -0.5 * flat + 0.24 * flat;
  for (let i = 0; i < pos.count; i++) {
    const x0 = pos.getX(i), y0 = pos.getY(i), z0 = pos.getZ(i);
    // 좌표를 키로 — 중복된 꼭짓점이 «같은» 값을 받아야 면이 안 벌어진다
    const k = Math.round(x0 * 64) * 7919 + Math.round(y0 * 64) * 104729
      + Math.round(z0 * 64) * 1299709;
    const j = 0.70 + ((Math.sin(seed * 12.9898 + k * 0.0001) * 43758.5453) % 1 + 1) % 1 * 0.50;
    const x1 = x0 * j, y1 = y0 * j * flat, z1 = z0 * j;
    /**
     * **기울이고 «나서» 자른다.** 그리고 **높이의 24% 를 묻는다.**
     *
     * 처음엔 10% 만 잘랐는데, 그러면 «면»이 아니라 아래쪽 꼭짓점 몇 개만 눌려서
     * 돌이 뾰족한 점 몇 개로 서 있었다 — 바닥 높이 삼각형이 0·0·1개였다.
     * 24% 면 정이십면체 아래 고리가 통째로 눌려 **진짜 밑면**이 생긴다(5~10면).
     * 레퍼런스도 「3분의 1 이상을 묻는다」고 한다.
     *
     * 처음엔 `part()` 의 `rot` 인자로 기울였는데, 그러면 평평하게 잘라놓은 밑면이
     * 같이 기울어 **비스듬돌이 한 모서리로 서 있었다.** 실제 정원돌은 기울어도
     * 밑은 땅에 박혀 있다 — 잘린 면은 늘 수평이어야 한다.
     * 그래서 회전을 여기서 직접 먹이고 그 «다음»에 y 를 누른다.
     */
    const xr = x1 * cs - y1 * sn, yr = x1 * sn + y1 * cs;    // Z축 기울기
    pos.setXYZ(i, xr * cy - z1 * sy, Math.max(yr, cut), xr * sy + z1 * cy);   // Y축 회전
  }
  // 흔든 뒤 다시 계산해야 «깨진 면»이 산다. 안 하면 원래 구의 매끈한 법선이 남는다
  geo.computeVertexNormals();
  // **돌 결 인쇄를 문다.** 부품이 하나뿐이라 표식을 붙일 데가 없다 —
  // 민짜 다면체는 「깎은 보석」이지 화강암이 아니다
  return [part(geo, rgb, undefined, undefined, TILE.STONE)];
}

/**
 * 이어지는 줄기 한 토막.
 *
 * **끝점을 계산해서 넘겨줘야 한다.** 처음엔 토막마다 중심 좌표를 손으로 적었는데,
 * 원기둥은 «자기 중심»을 기준으로 회전하므로 기울인 토막의 끝이 다음 토막의 시작과
 * 안 맞았다 — 화면에서 소나무가 **부러진 막대 셋**으로 나왔다.
 * `rotation.z = a` 는 +Y 축을 (−sin a, cos a) 로 돌린다.
 */
function stem(
  from: readonly [number, number, number], a: number, h: number,
  rBot: number, rTop: number,
): { part: Part; end: readonly [number, number, number] } {
  const dx = -Math.sin(a) * h, dy = Math.cos(a) * h;
  return {
    // 껍질 — 잎 덩이(몸통)와 갈려야 「줄기가 굽었다」가 보인다(`WOOD` 는 대비 0.07)
    part: part(new CylinderGeometry(rTop, rBot, h, 8), PINE_BARK,
      [from[0] + dx / 2, from[1] + dy / 2, from[2]], [0, 0, a]),
    end: [from[0] + dx, from[1] + dy, from[2]],
  };
}

export const GARDEN_BUILDERS: Record<ShapeIdGarden, () => BufferGeometry> = {
  /**
   * ── 정원돌 셋 ────────────────────────────────────────────
   *
   * 홀수 무리(3·5·7)로 놓는다 — 짝수는 대칭이 생겨 인공적으로 보인다.
   * **삼존석**(三尊石)은 큰 세로돌 하나에 작은 돌 둘이 붙는 구도이고,
   * 세 변이 **부등변**이라야 자연이다.
   *
   * 종류를 셋 둔 이유: 무리 안의 돌이 다 같으면 「복제한 것」으로 읽힌다.
   * 세로·가로·비스듬이 각각 산·물·받침이라는 다른 말을 한다.
   */
  /** 세로돌(立石) — 삼존석의 주석(主石). 서 있어야 「산」이다 */
  // `flat` 2.05 — **묻는 24% 를 미리 벌어야 한다.** 1.55 로 뽑았더니 밑을 자른 뒤
  // 높이/너비가 1.13 까지 내려와서 「선 돌」이 아니라 「좀 큰 돌」이었다
  세로돌: () => assemble(rock(3.1, 2.05, 0.09, GRANITE)),
  /** 가로돌(伏石) — 엎드린 돌. 고요·물. 주석보다 낮고 넓다 */
  가로돌: () => assemble(rock(7.4, 0.40, 0.05, GRANITE_WARM)),
  /** 비스듬돌(斜石) — 기울어 주석을 받치는 협석(脇石) */
  비스듬돌: () => assemble(rock(5.8, 0.92, 0.30, GRANITE)),

  /**
   * 석등 (115cm) — 카스가도로(春日灯籠).
   *
   * **정원의 초점이다.** 여섯 마디가 다 있어야 석등으로 읽힌다:
   * 기단(基礎) · 간(竿, 기둥) · 중대(中台) · 화사석(火袋, 불집) · 갓(笠) · 보주(宝珠).
   * 하나라도 빼면 「돌기둥에 뭘 얹은 것」이 된다. 특히 **갓이 처마처럼 넓어야** 한다 —
   * 좁으면 버섯이다.
   */
  석등: () => assemble([
    // 기단 — 아래가 넓은 8각 받침
    part(new CylinderGeometry(0.15, 0.19, 0.09, 14), STONE, [0, 0.045, 0], undefined, TILE.STONE),
    // 0.15 → **0.168**. 기단 위(0.15)와 같은 반지름으로 만나면 돌 두 장이
    // 한 덩어리로 녹는다. 실제 석등은 돌을 «얹는» 것이라 단이 진다
    part(new CylinderGeometry(0.13, 0.168, 0.04, 14), STONE_DARK, [0, 0.11, 0]),
    // 간 — 기둥. 가운데가 살짝 잘록해야 «깎은 돌»이다
    part(new CylinderGeometry(0.062, 0.072, 0.20, 10), STONE, [0, 0.23, 0]),
    part(new TorusGeometry(0.068, 0.014, 4, 8), STONE_DARK, [0, 0.33, 0], LIE_Z, TILE.STONE),
    // SEAM-OK: 바로 위 `TorusGeometry` 가 이미 단을 만든다 — 간(竿) 가운데의
    // 잘록한 마디가 그것이고, 원기둥 반지름이 같은 건 그 마디를 사이에 둔 것이다
    part(new CylinderGeometry(0.072, 0.062, 0.16, 10), STONE, [0, 0.41, 0]),
    // 중대 — 화사석 받침. 위로 퍼진다
    part(new CylinderGeometry(0.125, 0.085, 0.06, 14), STONE, [0, 0.52, 0]),
    // 화사석 — 불집. **네 벽 사이가 뚫려야 «불이 드는 집»이다**
    /**
      * 화사석 네 벽. **축을 손으로 지정한다.**
      *
      * 예전엔 `[0, 0.635, ±0.080]` 을 π/2 씩 돌려 네 장을 만들었는데,
      * `part()` 은 **회전을 먼저, 이동을 나중에** 먹인다 — 돌려도 이동은 여전히
      * z 축이라 옆벽 둘이 앞뒤 벽 «사이»로 들어가 서로 뚫고 있었다.
      * 자가 `6×8 7×9 8×9` 로 잡은 게 이것이다. 옆벽은 두께만큼 짧아야 맞물린다.
      */
    part(new BoxGeometry(0.19, 0.17, 0.030), STONE, [0, 0.635, 0.080]),
    part(new BoxGeometry(0.19, 0.17, 0.030), STONE, [0, 0.635, -0.080]),
    part(new BoxGeometry(0.13, 0.17, 0.030), STONE, [0.080, 0.635, 0], [0, Math.PI / 2, 0]),
    part(new BoxGeometry(0.13, 0.17, 0.030), STONE, [-0.080, 0.635, 0], [0, Math.PI / 2, 0]),
    // 안쪽 어둠 — 뒤집은 상자. 없으면 구멍 너머로 하늘이 보여서 «집»이 안 된다
    // 0.13 → **0.126**. 벽 네 장의 안쪽 면(±0.065)과 «같은 평면»이면
    // z-fighting 이다 — `basin()` 에서 겪은 것과 같은 결함이다
    // 0.124 — 벽 안쪽 면(±0.065)보다 3mm 안쪽. 딱 맞추면 같은 평면이 된다
    part(invert(new BoxGeometry(0.124, 0.16, 0.124)), [0.10, 0.09, 0.08],
      [0, 0.635, 0]),
    // 갓 — 8각 처마. 넓어야 석등이다
    part(new CylinderGeometry(0.145, 0.115, 0.035, 14), STONE, [0, 0.738, 0]),
    part(new CylinderGeometry(0.055, 0.150, 0.085, 14), STONE, [0, 0.798, 0]),
    // 갓 끝 반전(蕨手) — 여덟 귀퉁이가 살짝 들린다
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return part(new SphereGeometry(0.024, 6, 4), STONE,
        [Math.cos(a) * 0.148, 0.762, Math.sin(a) * 0.148]);
    }),
    // 보주 — 꼭대기 구슬
    part(new CylinderGeometry(0.030, 0.048, 0.028, 10), STONE_DARK, [0, 0.855, 0]),
    part(new SphereGeometry(0.042, 10, 7), STONE, [0, 0.905, 0]),
  ]),

  /**
   * 물확 / 쓰쿠바이 (55cm) — 손 씻는 돌그릇.
   *
   * **셋이 한 벌이다**: 파인 그릇 · 앞에 딛는 납작 돌(前石) · 물을 떨구는 대나무 물대.
   * 그릇만 두면 「구멍 난 돌」이고, 물대가 있어야 물이 흐르는 곳으로 읽힌다.
   * `hollow()` 는 원기둥이라 둥근 돌그릇에 그대로 맞는다.
   */
  물확: () => assemble([
    // 그릇 — 위가 뚫린 원통. 안쪽을 어둡게 해야 «파였다»가 읽힌다
    // **그릇을 괸 돌 «위»에 올린다.** 둘 다 y=0 이면 밑면 두 장이 같은 평면이다.
    // 안쪽도 더 짙게 — 물확은 물이 고여 어둡다
    ...hollow(0.24, 0.26, 0.20, 0.045, 0.05, 12, STONE, [0.16, 0.19, 0.18], TILE.STONE)
      .map((q) => part(q.geo, q.rgb, [0, 0.05, 0], undefined, q.tile)),
    // 밑에 괸 돌 — 그릇이 흙에 박힌 게 아니라 «놓인» 것으로 보이게
    part(new CylinderGeometry(0.27, 0.30, 0.05, 14), STONE_DARK, [0, 0.025, 0]),
    // 고인 물 — 「파였다」를 확정하는 건 결국 물이다
    part(new CylinderGeometry(0.185, 0.185, 0.012, 14), [1.05, 1.25, 1.35],
      [0, 0.175, 0], undefined, TILE.WATER),
    // 앞에 딛는 납작 돌
    part(new CylinderGeometry(0.15, 0.16, 0.045, 10), STONE, [0.34, 0.022, 0.16]),
    // 대나무 물대 — 세운 대 + 기울여 뻗은 홈통. 끝이 그릇 위에 와야 한다
    /**
      * 대나무 물대. **`BAMBOO`(0.70,0.74,0.42)는 화강암과 대비가 0.05** 라
      * 화면에서 돌에 파묻혔다 — 마른 대는 돌보다 확실히 «밝고 노랗다».
      */
    // 대를 2cm 띄운다 — 괸 돌과 밑면이 같은 평면이면 z-fighting 이다(자가 `5×8`)
    ...culm(-0.30, -0.12, 0.44, 0.032, 0, 2, 0, BAMBOO_LIT)
      .map((q) => part(q.geo, q.rgb, [0, 0.02, 0], undefined, q.tile)),
    part(new CylinderGeometry(0.028, 0.028, 0.34, 8), BAMBOO_LIT,
      [-0.17, 0.455, -0.06], [0.32, 0.42, 0.30], TILE.WOOD_F),
    part(new TorusGeometry(0.032, 0.010, 5, 8), BAMBOO_NODE, [-0.30, 0.46, -0.12], LIE_Z),
  ]),

  /**
   * 징검돌 (30cm) — 도비이시(飛石).
   *
   * **높이가 5cm 다.** 공이 마당에 들어오는 건 지름 10cm 때인데, 발판이 두꺼우면
   * 열린 마당 한가운데 걸림돌 일곱이 생긴다. 낮게 깔고 윗면에 이끼를 한 겹 얹어
   * 「길」로 읽히게 한다 — 이끼가 없으면 그냥 회색 원반이다.
   */
  징검돌: () => assemble([
    // SEAM-OK-ALL: 높이 5.6cm 짜리 **납작한 돌**이다. 얇은 판 셋을 겹쳐 두께를 낸
    // 것이라 옆에서 보이는 면이 거의 없다 — 여기에 턱을 주면 돌이 아니라 «케이크»가
    // 된다. 이 형상의 이음매는 전부 «일부러» 이어져 있다
    part(new CylinderGeometry(0.145, 0.155, 0.036, 10), STONE_DARK, [0, 0.018, 0], undefined, TILE.STONE),
    part(new CylinderGeometry(0.150, 0.145, 0.016, 10), STONE, [0, 0.044, 0], undefined, TILE.STONE),
    // 이끼 — 가장자리에만 낀다. 가운데는 밟아서 닳는다.
    // `MOSS` 는 돌과 대비가 0.02 였다 — 이끼는 확실히 «어둡고 푸르다»
    part(new CylinderGeometry(0.153, 0.150, 0.007, 10), MOSS, [0, 0.0495, 0]),
    // 밟아 닳은 가운데 — 이끼보다 «밝다». 두께를 이끼와 다르게 해서 같은 평면을 피한다
    part(new CylinderGeometry(0.112, 0.112, 0.010, 8), [1.15, 1.12, 1.05],
      [0.008, 0.0525, -0.006], undefined, TILE.STONE),
  ]),

  /**
   * 대나무 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/대나무/` (한 포기로 선 대나무 · 마디 접사 · 대숲)
   *
   * 앞의 것은 굵기 0.038 짜리 대 **셋**을 세우고 잎을 위 절반에 얹은 것이었다. 사진과 대보니:
   *   ① 한 밑동(폭은 높이의 **0.16**)에서 **열 대 안팎**이 부채처럼 벌어져 서고 위로 갈수록 바깥으로 휜다
   *   ② 대 굵기는 높이의 **0.007** 로 훨씬 가늘고, 마디 간격은 지름의 **2~5배**
   *   ③ 아래 **1/4 은 잎 없는 맨대**, 위 3/4 에만 좁은 잎이 층층이
   * 치수는 높이 = 1 로 쓴다.
   */
  대나무: () => {
    // 대 수는 사진(열 대 안팎)보다 적은 일곱 — 마디 고리가 대마다 넷이라 열 대면 1,900 삼각형이 넘는다
    const N = 7, R = 0.009;
    const culms = Array.from({ length: N }, (_, i) => {
      const a = (i / (N - 1) - 0.5) * 2;                       // −1 … 1
      const x = a * 0.08, z = ((i % 3) - 1) * 0.045;
      return culm(x, z, 0.86 + ((i * 7) % 5) * 0.03, R * (1 - Math.abs(a) * 0.2), a * 0.10, 3, (i * 0.37) % 1);
    }).flat();
    return assemble([
      ...culms,
      // ③ 잎 — 위 3/4 에만, 바깥으로 갈수록 낮게 늘어진다
      ...([
        [0.02, 0.96, 0.00, 0.15, 0.4], [-0.12, 0.90, 0.06, 0.13, -0.6], [0.13, 0.86, -0.05, 0.13, 1.1],
        [0.03, 0.80, 0.10, 0.12, 2.0], [-0.15, 0.74, -0.04, 0.11, -1.5], [0.14, 0.68, 0.07, 0.11, 0.8],
        [-0.06, 0.60, -0.10, 0.10, 2.6], [0.10, 0.52, 0.03, 0.09, -2.2], [-0.11, 0.44, 0.06, 0.08, 1.7],
      ] as const).map(([x, y, z, r, a]) =>
        part(new SphereGeometry(r, 6, 4).scale(1, 0.30, 1), LEAF, [x, y, z], [0.18, a, 0.22], TILE.LEAF)),
    ]);
  },

  /**
   * 소나무(仕立て松) — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/소나무/` (일본정원의 전정한 흑송 정측면)
   *
   * 앞의 것도 층진 잎 덩이였지만 사진과 대보니 값이 달랐다:
   *   ① 잎덩이는 **셋**(위 폭 0.57 · 가운데 0.75 · 아래 0.65), 두께는 폭의 **1/3** 로 더 납작하다
   *   ② 층 사이에 **하늘이 보이는 틈**이 남는다 — 붙이면 한 덩어리 수관이다
   *   ③ 맨 줄기는 높이의 **0.26**, 굵기 0.065. 200 px 오르며 44 px 기우는 S자
   *   ④ 덩이 밑면은 평평하고 윗면만 둥글게 부푼다
   * 치수는 높이 = 1 로 쓴다.
   */
  소나무: () => {
    const s0 = stem([0, 0, 0], 0.16, 0.30, 0.065, 0.053);
    const s1 = stem(s0.end, -0.24, 0.24, 0.053, 0.043);
    const s2 = stem(s1.end, 0.28, 0.20, 0.043, 0.034);
    const s3 = stem(s2.end, -0.12, 0.14, 0.034, 0.026);
    /**
     * ① · ④ 잎 층 — 폭은 사진 값(0.65 · 0.75 · 0.57), 두께는 폭의 1/3.
     * 밑면이 평평해야 「다듬은 층」이고, 반구를 얹으면 솜사탕이 된다.
     */
    const pad = (at: readonly [number, number, number], dx: number, dz: number, w: number): Part[] => [
      part(new CylinderGeometry(0.016, 0.022, Math.hypot(dx, dz) * 1.9, 5), PINE_BARK,
        [at[0] + dx * 0.5, at[1] - 0.02, at[2] + dz * 0.5],
        [0, Math.atan2(dx, dz), Math.PI / 2 - 0.25], TILE.LEAF),
      part(new SphereGeometry(1, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(w / 2, w / 3, w / 2), PINE,
        [at[0] + dx, at[1] + 0.02, at[2] + dz], undefined, TILE.LEAF),
      part(new CircleGeometry(w / 2, 10), [0.55, 0.62, 0.42], [at[0] + dx, at[1] + 0.018, at[2] + dz], [Math.PI / 2, 0, 0]),
    ];
    return assemble([
      s0.part, s1.part, s2.part, s3.part,
      ...pad(s0.end, 0.16, -0.05, 0.65),
      ...pad(s1.end, -0.18, 0.06, 0.75),
      ...pad(s2.end, 0.13, 0.04, 0.57),
      // 꼭대기 — 가지 없이 줄기 끝에 바로
      part(new SphereGeometry(1, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.13, 0.09, 0.13), PINE,
        [s3.end[0], s3.end[1], s3.end[2]], undefined, TILE.LEAF),
    ]);
  },

  /**
   * 게타 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/게타/` (会津桐 남성용, 검은 벨벳 끈 — 옆 · 위 · 밑 · 줄자)
   *
   * 앞의 것은 좁고 긴 판(폭 : 길이 = 0.42)에 굽 둘을 가운데 모아 단 것이었다. 사진과 대보니:
   *   ① 폭이 길이의 **0.5**, 네 모서리가 폭의 **0.25** 로 둥근 납작한 판(두께 길이의 0.05)
   *   ② 판 밑 굽 둘 — 길이 방향 폭 **0.15**, 판 두께의 **2.5배** 높이. **앞코 쪽이 0.32 로 길게** 남고 뒤끝은 0.15
   *   ③ 앞코에서 0.15 지점에서 V자로 모여 뒤쪽 0.65~0.69 의 양옆으로 내려가는 **굵고 둥근 검은 벨벳 끈**
   *   ④ 옅은 오동나무 윗면 (231,208,168)
   * 나무 팔레트(7)는 오동나무보다 짙어 흰색 팔레트에 계수로. 치수는 길이 = 1 로 쓴다(앞코 +x).
   */
  게타: () => {
    const L = 1, W = 0.5, T = 0.05, TH = 0.12, R = 0.125, TOE = 0.5;
    const KIRI: RGB = [0.95, 0.86, 0.72], SIDE: RGB = [0.68, 0.56, 0.42], STRAP: RGB = [0.05, 0.05, 0.06];
    // ① 판 — 모서리 둥근 직사각형을 밀어 올린다
    const plan = new Shape();
    const hx = L / 2, hz = W / 2;
    plan.moveTo(-hx + R, -hz);
    plan.lineTo(hx - R, -hz); plan.quadraticCurveTo(hx, -hz, hx, -hz + R);
    plan.lineTo(hx, hz - R); plan.quadraticCurveTo(hx, hz, hx - R, hz);
    plan.lineTo(-hx + R, hz); plan.quadraticCurveTo(-hx, hz, -hx, hz - R);
    plan.lineTo(-hx, -hz + R); plan.quadraticCurveTo(-hx, -hz, -hx + R, -hz);
    const board = mergeVertices(new ExtrudeGeometry(plan, { depth: T, bevelEnabled: false, curveSegments: 4 })
      .deleteAttribute('uv').deleteAttribute('normal')).rotateX(-Math.PI / 2);
    board.computeVertexNormals();
    // ③ 끈 — 앞 매듭(앞코에서 0.15)에서 양옆 뒤(0.67)로 둥글게 휜 두 가닥
    const front: [number, number, number] = [TOE - 0.15, TH + T + 0.035, 0];
    const strap = (k: number): Part[] => {
      const back: [number, number, number] = [TOE - 0.67, TH + T + 0.01, k * (hz - 0.03)];
      const mid: [number, number, number] = [(front[0] + back[0]) / 2, TH + T + 0.075, k * (hz - 0.03) / 2];
      return [front, mid].map((a, n) => {
        const b = n === 0 ? mid : back;
        const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(d[0]!, d[1]!, d[2]!);
        // 원기둥 축(y)을 a → b 방향으로 돌린다
        const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(d[0]! / len, d[1]! / len, d[2]! / len));
        return part(new CylinderGeometry(0.022, 0.022, len, 6).applyQuaternion(q), STRAP, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
      });
    };
    return assemble([
      part(board, KIRI, [0, TH, 0]),
      // ② 굽 둘 — 앞코에서 0.32 뒤 · 뒤끝에서 0.15 앞
      part(new BoxGeometry(0.15, TH, W * 0.98), SIDE, [TOE - 0.32 - 0.075, TH / 2, 0]),
      part(new BoxGeometry(0.16, TH, W * 0.98), SIDE, [-TOE + 0.15 + 0.08, TH / 2, 0]),
      ...strap(1), ...strap(-1),
      part(new SphereGeometry(0.03, 6, 4), STRAP, front),
    ]);
  },

  /**
   * 갈퀴(대나무 갈퀴) — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/갈퀴/` (타일 벽 앞에 세운 대나무 갈퀴, 타일 칸으로 잼)
   *
   * 앞의 것은 짧은 자루 끝에 살 **다섯**이 좁게 벌어진 것이었다. 사진과 대보니:
   *   ① 머리가 전체의 **0.33** 길이 · **0.32** 폭으로 약 **60°** 벌어진 부채꼴, 가는 대나무 살 약 **29 개**
   *   ② 살 끝에서 머리 길이의 0.3 자리를 호로 한 줄 묶은 **초록 철사**(64,104,98)
   *   ③ 머리 길이의 0.72 자리를 가로지르는 **가로대**와 그 위로 살짝 솟은 자루 끝, 살 끝은 아래로 꺾인 갈고리
   *   ④ 전체의 **0.67** 을 차지하는 마디 있는 곧은 대나무 자루
   * 치수는 전체 길이 = 1 로 쓴다(머리가 위, 세워 둔다).
   */
  갈퀴: () => {
    const POLE = 0.67, HEAD = 0.34, HALF = 0.52, N = 29;
    const tine = (i: number): Part[] => {
      const a = -HALF + (2 * HALF * i) / (N - 1);
      const dx = Math.sin(a), dy = Math.cos(a);
      return [
        part(new CylinderGeometry(0.0035, 0.004, HEAD, 3), BAMBOO, [dx * HEAD / 2, POLE + dy * HEAD / 2, 0], [0, 0, -a]),
        // 갈고리 — 끝이 앞으로 꺾인다
        part(new BoxGeometry(0.006, 0.006, 0.03), BAMBOO_NODE, [dx * HEAD, POLE + dy * HEAD, 0.012]),
      ];
    };
    return assemble([
      ...culm(0, 0, POLE + 0.10, 0.009, 0, 3).map((q) => part(q.geo, q.rgb, undefined, undefined, TILE.WOOD_F)),
      ...Array.from({ length: N }, (_, i) => tine(i)).flat(),
      // ② 초록 철사 — 살 끝에서 머리 길이의 0.3 안쪽을 호로
      part(new TorusGeometry(HEAD * 0.7, 0.004, 3, 16, 2 * HALF), [0.26, 0.43, 0.40], [0, POLE, 0], [0, 0, Math.PI / 2 - HALF]),
      // ③ 가로대 — 머리 길이의 0.72 자리(모이는 곳에서 0.28)
      part(new CylinderGeometry(0.006, 0.006, 0.17, 5), BAMBOO_NODE, [0, POLE + HEAD * 0.28, 0.006], [0, 0, Math.PI / 2]),
    ]);
  },

};

void WHITE;
