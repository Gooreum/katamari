import {
  BoxGeometry, CapsuleGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, LatheGeometry, PlaneGeometry,
  RingGeometry, SphereGeometry, TorusGeometry, Vector2,
  type BufferGeometry,
} from 'three';
import type { ShapeIdTown } from './generation';
import {
  assemble, evenProfile, invert, METAL, part, warp, WHITE,
  type RGB,
} from './shapes.kit';

import { TILE } from './atlas';

const LIE_Z: readonly [number, number, number] = [Math.PI / 2, 0, 0];

/**
 * 동네 맵(Pigeon Town) 전용 형태.
 *
 * **집 표와 겹치는 건 여기 없다.** 화분·휴지통·고양이처럼 마당에 있어도 어색하지
 * 않은 것은 기존 형태를 그대로 쓴다 — 같은 물건을 두 벌 만들 이유가 없다.
 *
 * 우선순위는 **원작 「별을 만들어라 3」 동선에 이름이 나온 물건**이다:
 * 꽃 · 연어 캔 · 공 · 삽 · 개밥그릇 · 페트병 · 쥐 · 개 · 모래성.
 * 나머지(꽃잎·자갈·도토리·솔방울·비둘기·참새·삼각콘·양동이·동전·병뚜껑·모종삽)는
 * 마을 광장과 공사장을 채우는 흔한 것들이다.
 *
 * 규약은 `shapes.kit.ts` 그대로 — 단위 정육면체, 바닥 y=−0.5, 최장축 1.0,
 * 색은 절대색이 아니라 팔레트에 곱해지는 계수.
 */
export const TOWN_BUILDERS: Record<ShapeIdTown, () => BufferGeometry> = {
  // ── 버킷 0 (1~2cm) ────────────────────────────────────────
  // **`assemble()` 뒤에 `scale()`을 걸면 안 된다** — 정규화가 이미 끝난 뒤라
  // 최장축 1.0·바닥 −0.5 규약이 깨진다 (shapecheck 이 이걸 잡았다).
  // 눌러야 하면 다시 `normalize()` 를 태운다.
  /**
   * 꽃잎(벚꽃) — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/꽃잎/` (천 위에 떨어진 벚꽃잎 한 장 · 떨어진 꽃잎 더미)
   *
   * 앞의 것은 눌린 구 한 장에 초록 꼭지를 단 «잎»이었다. 사진과 대보니:
   *   ① 길이 : 폭 = **1 : 0.73**, 가장 넓은 곳이 가운데, **밑동 쪽으로 뾰족하게** 모인다 — 꼭지는 없다
   *   ② 둥근 끝 가장자리에 길이의 **0.06~0.09 깊이 V자 홈**
   *   ③ 거의 흰 몸에 **밑동 0.2 만 분홍**(`TILE.PETAL`), 가장자리가 들린 오목한 휨
   * 판 하나를 사진 폭 표로 오므리고 끝에 홈을 판다. 치수는 길이 = 1 로 쓴다(끝 +x).
   */
  꽃잎: () => {
    // [밑동에서의 비율, 폭/최대폭] — 사진에서 0.05 · 0.1 · 0.2 … 0.9 지점마다 잰 폭
    const W = [[0, 0.05], [0.05, 0.45], [0.1, 0.6], [0.2, 0.8], [0.3, 0.92], [0.5, 1.0], [0.7, 0.84], [0.8, 0.71], [0.9, 0.6], [1, 0.35]];
    const half = (t: number): number => {
      let i = 1; while (i < W.length - 1 && W[i]![0]! < t) i++;
      const [t0, w0] = W[i - 1]!, [t1, w1] = W[i]!;
      return (0.73 / 2) * (w0! + (w1! - w0!) * (t - t0!) / (t1! - t0!));
    };
    const petal = warp(new PlaneGeometry(1, 1, 10, 6).rotateX(-Math.PI / 2), (x, _y, z) => {
      const t = x + 0.5, zn = z * 2;                                  // zn ∈ [-1, 1]
      const notch = Math.max(0, 1 - Math.abs(zn) / 0.35) * 0.08 * Math.max(0, (t - 0.85) / 0.15);
      return [x - notch, 0.07 * zn * zn + 0.03 * t * t, zn * half(t)];
    });
    return assemble([part(petal, WHITE, [0, 0.001, 0], undefined, TILE.PETAL)]);
  },

  /**
   * 자갈 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/자갈/` (아오모리 바닷가 자갈밭 + 100엔 동전 · 쌓은 조약돌 옆모습 · 교토 玉砂利)
   *
   * 앞의 것은 16 × 10 구를 1 : 0.72 : 0.86 으로 누른 둥근 알이었다. 사진과 대보니:
   *   ① 위에서 긴 : 짧은 지름 = **1 : 0.75**, 옆에서 두께 = 폭의 **0.47**
   *   ② 위아래가 **평평하고** 옆 가장자리가 둥글게 말린 **빵 모양** — 공이 아니다
   *   ③ 짙은 청회색 · 밝은 회색 · 회갈색 베이지 · 흰색이 섞인다(팔레트 넷에 흰 점 인쇄)
   * 치수는 긴 지름 = 1 로 쓴다.
   */
  자갈: () => {
    const stone = warp(new SphereGeometry(1, 12, 8).scale(0.5, 0.176, 0.375), (x, y, z) =>
      // ② 위아래를 초타원 쪽으로 밀어 평평하게 — 옆 가장자리만 둥글다
      [x, Math.sign(y) * 0.176 * Math.abs(y / 0.176) ** 0.55, z]);
    return assemble([part(stone, WHITE, undefined, undefined, TILE.STONE)]);
  },

  /**
   * 병뚜껑(왕관) — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/병뚜껑/` (아사히 슈퍼드라이 헌 뚜껑 위 · 인쇄 없는 금색 새 뚜껑 비스듬히)
   *
   * 앞의 것은 곧은 원판(지름 : 높이 = 1 : 0.26)에 가는 고리를 두른 것이었다. 사진과 대보니:
   *   ① 지름 : 높이 ≈ **1 : 0.23**, 윗면(지름의 0.8)보다 **톱니 쪽이 넓게 벌어진 치마**
   *   ② 가장자리를 도는 **톱니 21개**(간격 17°) — 고리 하나가 아니다
   *   ③ 윗면 전체를 덮는 한 가지 색 인쇄와 톱니의 대비
   * 치수는 톱니 지름 = 1 로 쓴다.
   */
  병뚜껑: () => {
    const H = 0.23, TOP = 0.40;
    // ② 치마 — 원뿔대 옆면을 21번 물결치게 민다(아래로 갈수록 깊게)
    const skirt = warp(new CylinderGeometry(TOP, 0.5, H * 0.8, 42, 2, true), (x, y, z) => {
      const a = Math.atan2(z, x), t = 0.5 - y / (H * 0.8);             // 0 = 위, 1 = 아래
      const k = 1 + 0.07 * t * Math.cos(21 * a);
      return [x * k, y, z * k];
    });
    return assemble([
      part(skirt, WHITE, [0, H * 0.4, 0]),
      // 윗면 — 어깨 둥근 테 + 인쇄 원판
      part(new TorusGeometry(TOP - 0.015, 0.02, 4, 24), [0.92, 0.92, 0.94], [0, H * 0.8, 0], LIE_Z),
      part(new CylinderGeometry(TOP, TOP, 0.02, 24), WHITE, [0, H * 0.8 + 0.01, 0], undefined, TILE.COVER),
    ]);
  },

  /**
   * 도토리 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/도토리/` (고베의 졸참나무 도토리, 깍정이를 쓴 채 옆으로 누운 모습)
   *
   * 앞의 것은 **선** 달걀에 깍정이 반구와 꼭지를 위로 얹은 것이었다. 사진과 대보니:
   *   ① 도토리는 바닥에 **눕는다** — 길이 : 두께 = **1 : 0.46** 의 총알꼴. 뒤 0.37 이 깍정이, 앞 0.63 이 매끈한 밤색 알
   *   ② 깍정이 지름은 알 두께의 **1.02배**, 약 **19° 비뚜름하게** 씌워졌고 겉에 짙은 갈색 점이 비늘처럼 줄지었다(`TILE.CUPULE`)
   *   ③ 알 끝은 뾰족하지 않고 **뭉툭하게 둥글다**
   * 치수는 길이 = 1 로 쓴다(알 끝 +x).
   */
  도토리: () => {
    const R = 0.23, NUT: RGB = [0.85, 0.64, 0.49], CAP: RGB = [0.84, 0.73, 0.68];
    // ③ 알 — 앞 1/3 이 가장 굵고 끝이 뭉툭한 돌림면. y 가 알 길이(깍정이 속 0 → 끝 0.66)
    const nut = [[0.20, 0], [0.225, 0.1], [0.23, 0.25], [0.22, 0.4], [0.19, 0.5], [0.14, 0.58], [0.07, 0.64], [0.001, 0.66]]
      .map(([r, y]) => new Vector2(r!, y!));
    return assemble([
      part(new LatheGeometry(nut, 12), NUT, [-0.16, R, 0], [0, 0, -Math.PI / 2]),
      // ② 깍정이 — 반구 껍질을 뒤(−x)로 열고 19° 비튼다. 알 두께의 1.02 배
      part(new SphereGeometry(R * 1.02, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.25, 1), CAP,
        [-0.14, R, 0], [0, 0, Math.PI / 2 + 0.33], TILE.CUPULE),
      // 깍정이 밑 꼭지
      part(new CylinderGeometry(0.03, 0.035, 0.05, 6), [0.55, 0.45, 0.38], [-0.475, R + 0.08, 0], [0, 0, Math.PI / 2 + 0.33]),
    ]);
  },

  /**
   * 솔방울 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/솔방울/` (비늘이 벌어진 곰솔 솔방울 옆모습 · 공원 잔디의 솔방울들)
   *
   * 앞의 것은 긴 달걀(높이 : 폭 = 1 : 0.57)에 비늘 대신 고리 셋을 두른 것이었다. 사진과 대보니:
   *   ① 높이 : 폭 = **1 : 0.8** 의 달걀꼴, 가장 넓은 곳은 꼭지 쪽에서 **0.4** 높이
   *   ② 위 2/3 는 비늘이 **바깥 · 위로 벌어져** 틈이 검게 보이고, 아래 1/4 은 작은 비늘이 오므라진다
   *   ③ 비늘마다 끝에 솔방울 폭의 **0.2** 크기 밝은 황갈색 판이 달려 **대각선으로 엇갈려** 쌓인다
   * 고리는 비늘이 아니다 — 판 40 장을 층마다 반 칸씩 엇갈려 꽂는다. 치수는 높이 = 1 로 쓴다.
   */
  솔방울: () => {
    const PLATE: RGB = [1.05, 1.09, 1.27], BODY: RGB = [0.55, 0.50, 0.63];
    const rAt = (y: number): number => 0.36 * Math.sin(Math.PI * Math.min(1, Math.max(0, (y - 0.04) / 0.96)) ** 0.75);
    const tiers = [0.14, 0.30, 0.46, 0.62, 0.78];
    return assemble([
      // 속 — 어두운 달걀(비늘 사이 틈으로 보인다)
      part(new SphereGeometry(1, 10, 6).scale(0.28, 0.46, 0.28), BODY, [0, 0.5, 0]),
      part(new CylinderGeometry(0.04, 0.05, 0.06, 6), BODY, [0, 0.03, 0]),
      // ③ 비늘 끝 판 — 층마다 8장, 반 칸씩 엇갈린다. ② 위층일수록 바깥 · 위로 벌어진다
      ...tiers.flatMap((y, ti) => Array.from({ length: 8 }, (_, k) => {
        const a = (k + (ti % 2) * 0.5) * Math.PI / 4, open = 0.15 + 0.55 * (ti / (tiers.length - 1));
        const r = rAt(y) + 0.02 + 0.05 * open;
        // 판은 바깥을 보는 넓은 면(접선 0.16 × 높이 0.09, 두께 0.07). 먼저 위로 젖히고(Z) 그다음 둘레로 돌린다(Y)
        return part(new BoxGeometry(0.07, 0.09, 0.2 * 0.8).rotateZ(open), PLATE, [Math.cos(a) * r, y, Math.sin(a) * r], [0, -a, 0]);
      })),
    ]);
  },

  동전: () => assemble([
    // 안쪽 원반이 몸통과 «같은 두께로 겹쳐» 위·아랫면이 같은 평면이었다.
    // 얇게 얹어 도드라지게 한다 — 실제 동전도 안쪽이 한 단 낮다
    part(new CylinderGeometry(0.5, 0.5, 0.08, 20), METAL, undefined, undefined, TILE.METAL),
    part(new CylinderGeometry(0.34, 0.34, 0.05, 20), [0.52, 0.53, 0.56], [0, 0.022, 0]),
  ]),

  // ── 버킷 2~3 (4~16cm) ─────────────────────────────────────
  /**
   * 꽃(튤립) — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/꽃/` (땅에서 꽃머리까지 찍은 튤립 · 1930 기록 사진 옆모습)
   *
   * 앞의 것은 둥근 꽃잎 다섯을 수평으로 편 들꽃이었다. 사진과 대보니:
   *   ① 너비 : 높이 = **1 : 0.8** 인 **컵꼴** 꽃머리 — 가장 넓은 곳은 위에서 0.25, 밑은 둥글게 모이고
   *      위 가장자리에 **꽃잎 끝 셋**이 뾰족하게 솟는다. 꽃잎 밑동에만 노랑
   *   ② 꽃머리 너비의 0.05~0.06 굵기로 **곧게** 선 초록 줄기
   *   ③ 줄기 밑을 감싸고 올라와 끝이 꽃머리 바로 아래까지 닿는 넓은 **피침꼴 잎**(길이 : 폭 = 1 : 0.3)
   * **줄기만 사진(꽃머리 높이의 3.6배)보다 짧게 — 2배로 두었다.** 이 꽃은 4~16cm 칸이라 사진대로면
   * 꽃머리가 폭 4cm 밖에 안 되어 판정 크기에서 점이 된다. 치수는 꽃머리 너비 = 1 로 쓴다.
   */
  꽃: () => {
    const HH = 0.8, STEM = HH * 2.0, GREEN: RGB = [0.40, 0.58, 0.34];
    // ① 컵 — 밑(좁다) → 위에서 0.25 가장 넓다 → 입. 위 가장자리를 세 번 물결쳐 꽃잎 끝을 세운다
    const cup = warp(new LatheGeometry(evenProfile([[0.08, 0], [0.30, 0.10], [0.44, 0.28], [0.50, 0.55], [0.47, 0.75], [0.42, HH]], 7)
      .map(([r, y]) => new Vector2(r, y)), 12), (x, y, z) => {
      const t = Math.max(0, (y - HH * 0.6) / (HH * 0.4));
      return [x, y + 0.09 * t * Math.max(0, Math.cos(3 * Math.atan2(z, x))) ** 2, z];
    });
    return assemble([
      part(cup, WHITE, [0, STEM, 0]),
      // 꽃잎 밑동의 노랑 — 컵 밑을 감싼 짧은 띠
      part(new CylinderGeometry(0.31, 0.10, 0.10, 12, 1, true), [1.2, 1.1, 0.25], [0, STEM + 0.05, 0]),
      // 속 — 입 안쪽이 어둡게 보인다
      part(new CircleGeometry(0.40, 12), [0.45, 0.30, 0.20], [0, STEM + HH - 0.04, 0], [-Math.PI / 2, 0, 0]),
      // ② 줄기
      part(new CylinderGeometry(0.03, 0.035, STEM, 6), GREEN, [0, STEM / 2, 0]),
      // ③ 잎 둘 — 줄기 밑에서 감싸고 올라와 꽃머리 밑까지. 한 장은 거의 서고 한 장은 비스듬히
      ...([[0.10, 0.12, 1.0], [-0.12, -0.35, 0.8]] as const).map(([x, tilt, len]) =>
        part(new SphereGeometry(1, 8, 4).scale(0.14, STEM * 0.5 * len, 0.03), [0.46, 0.60, 0.44],
          [x, STEM * 0.5 * len, 0.02], [0, 0.6, tilt])),
    ]);
  },

  /**
   * 연어 캔 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/연어 캔/` (나무 상판 위 풀탭 연어 통조림을 18° 위에서)
   *
   * 앞의 것은 높이가 지름의 0.36 인 민 원통에 금속 원판과 고리를 얹은 것이었다. 사진과 대보니:
   *   ① 높이 : 지름 = **0.38** — 위아래 **시밍 테가 몸통보다 굵게** 한 번씩 꺾여 나온다
   *   ② 뚜껑은 평평하지 않고 가운데가 꺼져 있으며 테두리와 나란한 **압인 홈이 3겹** 돈다
   *   ③ 풀탭 고리는 지름의 **0.33** 이고 뚜껑 한가운데가 아니라 **한쪽으로 치우쳐** 눕는다
   *   ④ 붉은 종이 라벨이 옆 높이의 **0.95** 를 덮고 바닥에 0.05 만 맨 금속이 남는다
   * 은색·초록 팔레트(6·11)를 곱하면 붉은 라벨이 회색이 된다 — 팔레트는 흰색, 색은 인쇄가 낸다.
   * 치수는 지름 = 1 로 쓴다.
   */
  '연어 캔': () => {
    const H = 0.38, GOLD: RGB = [0.62, 0.60, 0.36];
    return assemble([
      // ④ 라벨 — 옆 높이의 0.95. 바닥 0.05 만 맨 금속
      part(new CylinderGeometry(0.482, 0.482, H * 0.95, 16, 1, true), WHITE, [0, H * 0.525, 0], undefined, TILE.CANLABEL),
      part(new CylinderGeometry(0.482, 0.482, H * 0.08, 16), GOLD, [0, H * 0.04, 0], undefined, TILE.METAL),
      // ① 위아래 시밍 테 — 몸통보다 굵다
      part(new CylinderGeometry(0.5, 0.5, H * 0.10, 16), GOLD, [0, H * 0.95, 0], undefined, TILE.METAL),
      part(new CylinderGeometry(0.5, 0.5, H * 0.08, 16), GOLD, [0, H * 0.05, 0], undefined, TILE.METAL),
      // ② 뚜껑 — 테보다 한 단 꺼진 원판에 압인 홈 3 겹
      part(new CylinderGeometry(0.455, 0.455, H * 0.06, 16), GOLD, [0, H * 0.93, 0], undefined, TILE.METAL),
      ...[0.37, 0.28, 0.19].map((r) =>
        part(new TorusGeometry(r, 0.012, 3, 14), GOLD, [0, H * 0.955, 0], LIE_Z)),
      // ③ 풀탭 — 지름의 0.33 짜리 고리가 한쪽으로 치우쳐 눕는다
      part(new TorusGeometry(0.135, 0.022, 3, 14).scale(1, 0.62, 1), GOLD, [-0.09, H * 0.99, -0.05], LIE_Z),
      part(new CylinderGeometry(0.05, 0.05, 0.02, 10), GOLD, [0.03, H * 0.99, -0.02]),
    ]);
  },

  /**
   * 쥐(생쥐) — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/쥐/` (생쥐 비스듬한 옆모습, 꼬리 전체 · 시궁쥐 정옆)
   *
   * 앞의 것은 몸통 · 목 · 머리 구 셋에 짧은 꼬리(몸의 0.4)였다. 사진과 대보니:
   *   ① 꼬리가 **머리+몸통과 같은 길이(1.06)** 로 뒤로 곧게 뻗는다(뿌리 굵기 = 몸의 0.05)
   *   ② 몸은 목 없는 **물방울** — 엉덩이에서 둥글게 솟았다가 뾰족한 분홍 코끝까지 한 번에 좁아진다
   *   ③ 몸의 **0.19** 크기로 둥글게 선 분홍 귀, 코끝에서 0.18 뒤에 **까맣고 큰 눈**(0.07)
   *   ④ 등 회갈색 (128,101,66), 옆구리가 밝아진다 — 검은 팔레트(5)에 곱하면 사진 색이 안 나와 흰색으로 옮겼다
   * 치수는 코끝 ~ 꼬리 끝 = 1 로 쓴다(코 +x).
   */
  쥐: () => {
    const HB = 1 / 2.06, TAIL = 1 - HB, CX = 0.5 - HB / 2, A = HB / 2;
    const FUR: RGB = [0.54, 0.43, 0.29], BELLY: RGB = [0.74, 0.63, 0.46], PINKY: RGB = [0.84, 0.66, 0.58];
    // ② 물방울 몸 — 앞으로 갈수록 가늘어져 코끝이 된다. 엉덩이 쪽 등이 높다
    const body = warp(new SphereGeometry(1, 14, 8).scale(A, 0.15, 0.13), (x, y, z) => {
      const t = x / A;                                                // −1 엉덩이 · +1 코
      const k = t > 0 ? 1 - 0.75 * t ** 1.6 : 1;
      return [x, y * k + (t < 0 ? 0.02 * (1 + t) : 0), z * k];
    });
    return assemble([
      part(body, FUR, [CX, 0.15, 0]),
      // 배 — 밝은 아랫면
      part(new SphereGeometry(1, 10, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(A * 0.85, 0.08, 0.11), BELLY, [CX - 0.01, 0.10, 0]),
      // 코끝
      part(new SphereGeometry(0.018, 6, 4), PINKY, [0.495, 0.15, 0]),
      // ③ 귀 · 눈
      ...([1, -1] as const).flatMap((k) => [
        part(new CylinderGeometry(0.046, 0.046, 0.008, 12), PINKY, [CX + A * 0.35, 0.25, k * 0.07], [Math.PI / 2, k * 0.5, 0]),
        part(new SphereGeometry(0.017, 6, 4), [0.12, 0.12, 0.12], [0.5 - HB * 0.18, 0.175, k * 0.055]),
      ]),
      // ① 꼬리 — 엉덩이 아래에서 뒤로 곧게, 끝이 가늘다
      part(new CylinderGeometry(0.006, 0.012, TAIL, 6), [0.62, 0.52, 0.44], [0.5 - HB - TAIL / 2 + 0.01, 0.035, 0], [0, 0, Math.PI / 2]),
      // 발 넷
      ...([[0.35, 1], [0.35, -1], [0.12, 1], [0.12, -1]] as const).map(([x, k]) =>
        part(new SphereGeometry(0.02, 5, 3).scale(1.4, 0.6, 1), PINKY, [x, 0.012, k * 0.07])),
    ]);
  },

  골프공: () => assemble([
    /**
     * **딤플을 인쇄로 옮겼다.** 반지름 0.07 짜리 구 넷을 박아놨는데 계수가
     * `[0.85,0.85,0.85]` 라 대비가 0.05 였다 — 「전부 찍으면 폴리곤만 늘고
     * 안 보인다」고 적어놓고, 넷을 찍었는데도 안 보였다. 인쇄면 온 면에 다 찍힌다.
     */
    part(new SphereGeometry(0.5, 16, 10), WHITE, undefined, undefined, TILE.GOLF),
  ]),

  /**
   * 참새 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/참새/` (오사카 참새 옆모습 · 네팔 참새 깃을 부풀린 옆모습)
   *
   * 앞의 것은 몸통 · 목 · 머리를 이은 흰 새에 나무색 날개였다. 사진과 대보니:
   *   ① **정수리부터 뒷목까지 덮은 밤색 모자**(머리 길이 전체)
   *   ② 흰 뺨 한가운데, 눈 뒤 아래에 머리 길이 **1/3** 크기로 찍힌 **까만 점** · 부리 밑 좁은 까만 턱받이
   *   ③ 목은 거의 안 보이고 머리가 달걀꼴 몸에 **바로 붙는다**. 몸 축은 수평에서 29° 들렸다
   *   ④ 꼬리는 몸 축과 **한 직선**으로 뒤로 뻗는다(몸길이의 0.29), 날개 갈색에 옅은 날개띠
   * 나무 팔레트(7)에 흰 뺨 · 까만 점이 같이 곱해지면 대비가 없어진다 — 팔레트는 흰색, 깃 색은 계수로.
   * 치수는 부리 끝 ~ 꼬리 끝 = 1 로 쓴다(부리 +x).
   */
  참새: () => {
    const TILT = 0.5, CAPC: RGB = [0.62, 0.40, 0.30], CHEEK: RGB = [0.86, 0.88, 0.84], INKY: RGB = [0.10, 0.10, 0.12];
    const BACK: RGB = [0.64, 0.50, 0.36], WING: RGB = [0.45, 0.30, 0.15], BELLY: RGB = [0.68, 0.66, 0.60];
    const HEAD: [number, number, number] = [0.29, 0.53, 0];
    return assemble([
      // ③ 몸 — 29° 들린 달걀. 윗면 밤갈색, 배는 회베이지
      part(new SphereGeometry(1, 12, 8).scale(0.29, 0.20, 0.19), BELLY, [0.0, 0.30, 0], [0, 0, TILT]),
      part(new SphereGeometry(1, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.285, 0.12, 0.195), BACK, [-0.02, 0.33, 0], [0, 0, TILT]),
      // 머리 — 흰 뺨 공 위에 ① 밤색 모자(위 절반을 조금 크게)
      part(new SphereGeometry(0.13, 10, 7), CHEEK, HEAD),
      part(new SphereGeometry(0.137, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.52), CAPC, HEAD, [0, 0, 0.35]),
      // ② 뺨 점 · 눈 · 턱받이
      ...([1, -1] as const).flatMap((k) => [
        part(new SphereGeometry(0.045, 6, 4).scale(1, 1.1, 0.4), INKY, [HEAD[0] - 0.035, HEAD[1] - 0.035, k * 0.118]),
        part(new SphereGeometry(0.017, 6, 4), INKY, [HEAD[0] + 0.055, HEAD[1] + 0.02, k * 0.098]),
      ]),
      part(new SphereGeometry(0.05, 6, 4).scale(0.6, 1.3, 0.8), INKY, [HEAD[0] + 0.085, HEAD[1] - 0.075, 0]),
      // 부리 — 짧은 원뿔(몸길이의 0.063)
      part(new ConeGeometry(0.032, 0.075, 6), [0.40, 0.38, 0.38], [HEAD[0] + 0.155, HEAD[1] - 0.01, 0], [0, 0, -Math.PI / 2]),
      // ④ 날개 + 옅은 날개띠 · 꼬리(몸 축과 한 직선)
      ...([1, -1] as const).flatMap((k) => [
        part(new SphereGeometry(1, 8, 5).scale(0.22, 0.08, 0.04), WING, [-0.05, 0.33, k * 0.17], [0, 0, TILT]),
        part(new BoxGeometry(0.12, 0.012, 0.012), [0.80, 0.72, 0.58], [-0.02, 0.36, k * 0.205], [0, 0, TILT]),
      ]),
      part(new BoxGeometry(0.28, 0.025, 0.09), [0.58, 0.52, 0.47], [-0.36, 0.13, 0], [0, 0, TILT]),
      // 분홍빛 다리
      ...([1, -1] as const).map((k) =>
        part(new CylinderGeometry(0.012, 0.012, 0.13, 5), [0.85, 0.70, 0.62], [0.04, 0.065, k * 0.05])),
    ]);
  },

  /**
   * 페트병 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/페트병/` (KIRIN 午後の紅茶 500 ml 옆모습 + 마개 비례용 한 병 전체)
   *
   * 앞의 것은 몸통 위에 어깨 · 목 · 뚜껑을 쌓고 라벨을 몸통보다 굵게 두른 것이었다. 사진과 대보니:
   *   ① 라벨 띠 높이가 **몸통 지름과 거의 같다(0.99)** — 몸통 한가운데를 넓게 감는다.
   *      라벨이 몸통보다 굵으면 병이 아니라 실패다
   *   ② 마개는 지름이 몸통의 **0.54**, 높이가 **0.32** 로 짧고 굵다
   *   ③ 마개 밑에서 몸통 굵기까지 어깨가 펴지는 데 몸통 지름의 **0.45** 밖에 안 든다 — 가파른 어깨
   *   ④ 라벨 아래 **0.84** 구간에 마름모 압인 두 줄과 세로 골, 밑동은 몸통의 0.93 으로 좁아진다
   * 연두 팔레트(12)를 곱하면 홍차 색이 안 나온다 — 팔레트는 흰색, 색은 인쇄와 계수가 낸다.
   * 치수는 전체 높이 = 1 로 쓴다(가게 규격 높이 : 지름 ≈ 3.1).
   */
  페트병: () => {
    const D = 1 / 3.1, R = D / 2, TEA: RGB = [0.62, 0.28, 0.10];
    const yLabel = 0.84 * D, hLabel = 0.99 * D, yTop = yLabel + hLabel;
    return assemble([
      // ④ 밑동 — 몸통의 0.93 으로 좁아지고 마름모 압인이 돈다
      part(new CylinderGeometry(R, R * 0.93, yLabel, 18, 1, true), WHITE, [0, yLabel / 2, 0], undefined, TILE.PETFACET),
      part(new CircleGeometry(R * 0.93, 18), TEA, [0, 0.001, 0], [Math.PI / 2, 0, 0]),
      // ① 라벨 — 높이가 몸통 지름과 같다. 몸통과 같은 굵기로 감긴다(도드라지지 않는다)
      part(new CylinderGeometry(R * 1.01, R * 1.01, hLabel, 18, 1, true), WHITE, [0, yLabel + hLabel / 2, 0], undefined, TILE.PETLABEL),
      // ③ 어깨 — 라벨 위에서 0.45 D 만에 목 굵기로 좁아진다
      part(new CylinderGeometry(R * 0.30, R, 0.45 * D, 18, 1, true), TEA, [0, yTop + 0.225 * D, 0]),
      // 목 — 마개 밑까지. 나사산 자리
      part(new CylinderGeometry(R * 0.27, R * 0.30, 1 - yTop - 0.45 * D - 0.32 * D, 14), TEA,
        [0, (yTop + 0.45 * D + 1 - 0.32 * D) / 2, 0]),
      // ② 마개 — 몸통의 0.54 굵기, 0.32 높이. 세로 널이 있어 매끈하지 않다
      part(new CylinderGeometry(R * 0.54, R * 0.54, 0.32 * D, 14), [0.36, 0.51, 0.26],
        [0, 1 - 0.16 * D, 0], undefined, TILE.PLASTIC),
    ]);
  },

  /**
   * 모종삽 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/모종삽/` (파란 강철 날 · 나무 자루 모종삽을 위에서, 10 cm 눈금자)
   *
   * 앞의 것은 눌린 구(날)에 가는 목 · 원기둥 자루였다. 사진과 대보니:
   *   ① 길이가 자루 **0.435** · 쇠 고리 **0.125** · 날 **0.44** 로 거의 반반
   *   ② 날은 길이 : 폭 = **1 : 0.37**, 앞 57% 는 폭이 일정하고 끝만 둥글게 좁아진다. 양옆이 들린 **국자꼴**,
   *      쇠 고리에서 날 길이 0.55 까지 **도드라진 등뼈 줄**. 파랑 (0,74,140)
   *   ③ 끝이 굵고(0.103) 허리가 잘록한(0.069) 밝은 나무 자루
   * 은색 팔레트(6)에 곱하면 파란 날이 안 나온다 — 팔레트는 흰색. 치수는 길이 = 1 로 쓴다(날 끝 +x).
   */
  모종삽: () => {
    const BLUE: RGB = [0.0, 0.31, 0.60], WOODY: RGB = [0.93, 0.83, 0.67];
    const H0 = -0.5, H1 = H0 + 0.435, F1 = H1 + 0.125, BL = 0.44, BW = 0.162 / 2, Y = 0.052;
    // ③ 자루 — 끝 굵고(0.103) 허리(0.069) 잘록, 쇠 고리 앞 0.082. y 가 자루 길이
    const handle = evenProfile([[0.001, 0], [0.045, 0.004], [0.0515, 0.04], [0.045, 0.12], [0.0345, 0.22], [0.037, 0.33], [0.041, 0.435]], 8)
      .map(([r, y]) => new Vector2(r, y));
    // ② 날 — 판을 사진 폭으로 오므리고 양옆을 들어 국자꼴로. 위아래 두 장(뒤집은 판)이라 어느 쪽에서도 보인다
    const hw = (t: number): number => (t < 0.57 ? BW : BW * Math.sqrt(Math.max(0, 1 - ((t - 0.57) / 0.43) ** 2)));
    const blade = (): BufferGeometry => warp(new PlaneGeometry(1, 1, 8, 4).rotateX(-Math.PI / 2), (x, _y, z) => {
      const t = x + 0.5, zn = z * 2;
      return [F1 + t * BL, 0.02 * zn * zn, zn * Math.max(0.004, hw(t))];
    });
    return assemble([
      part(new LatheGeometry(handle, 8), WOODY, [H0, Y, 0], [0, 0, -Math.PI / 2]),
      part(new CylinderGeometry(0.043, 0.043, 0.125, 8), [0.0, 0.26, 0.52], [H1 + 0.0625, Y, 0], [0, 0, Math.PI / 2]),
      part(blade(), BLUE, [0, Y - 0.02, 0]),
      part(invert(blade()), [0.0, 0.28, 0.56], [0, Y - 0.023, 0]),
      // 등뼈 줄 — 날 길이의 0.55 까지
      part(new BoxGeometry(BL * 0.55, 0.012, 0.014), BLUE, [F1 + BL * 0.275, Y - 0.012, 0]),
    ]);
  },

  // ── 버킷 4~5 (16~60cm) ────────────────────────────────────
  /**
   * 비둘기(집비둘기) — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/비둘기/` (방갈로르 정옆 · 비스듬한 옆 · 고베 뒤 3/4)
   *
   * 앞의 것은 천 무늬 몸통에 짚 무늬 머리, 날개띠 없는 회색 날개였다. 사진과 대보니:
   *   ① 옅은 회색 날개를 가로지르는 **짙은 날개띠 두 줄**(첫째 띠 길이 = 몸길이의 0.22)
   *   ② 목 둘레의 **초록(위) → 자주(아래) 광택 띠** — 머리는 광택 없는 푸른 회색
   *   ③ 몸길이 0.16 의 **까만 꼬리 끝 띠**, 꼬리는 수평에서 30° 아래로
   *   ④ 몸길이 0.12 의 **새빨간 다리**, 흰 납막이 얹힌 가는 부리(0.075)
   * 치수는 부리 끝 ~ 꼬리 끝 = 1 로 쓴다(부리 +x).
   */
  비둘기: () => {
    const WINGC: RGB = [0.84, 0.85, 0.90], BAR: RGB = [0.22, 0.22, 0.26], HEADC: RGB = [0.55, 0.64, 0.82];
    const TILT = -0.52;                                              // 몸 축 — 가슴이 높고 꼬리가 낮다
    return assemble([
      // 몸 — 가슴이 도톰한 달걀, 꼬리 쪽으로 기운다
      part(new SphereGeometry(1, 12, 8).scale(0.30, 0.20, 0.19), [0.72, 0.75, 0.80], [-0.02, 0.36, 0], [0, 0, -TILT * 0.5]),
      // ② 목 — 아래 자주 · 위 초록 광택, 머리 밑이 가늘다
      part(new CylinderGeometry(0.10, 0.14, 0.12, 10), [0.72, 0.52, 0.72], [0.20, 0.50, 0], [0, 0, -0.35]),
      part(new CylinderGeometry(0.085, 0.10, 0.10, 10), [0.30, 0.52, 0.48], [0.25, 0.60, 0], [0, 0, -0.35]),
      // 머리 · 부리 · 흰 납막 · 주황 눈
      part(new SphereGeometry(0.105, 10, 7), HEADC, [0.30, 0.70, 0]),
      part(new ConeGeometry(0.022, 0.08, 6), [0.36, 0.38, 0.42], [0.43, 0.68, 0], [0, 0, -Math.PI / 2 - 0.15]),
      part(new SphereGeometry(0.018, 5, 3).scale(1.4, 0.7, 1), [1.30, 1.34, 1.38], [0.39, 0.695, 0]),
      ...([1, -1] as const).map((k) => part(new SphereGeometry(0.018, 6, 4), [1.3, 0.55, 0.15], [0.35, 0.72, k * 0.078])),
      // ① 날개 — 옅은 회색 판 위에 짙은 띠 둘
      ...([1, -1] as const).flatMap((k) => [
        part(new SphereGeometry(1, 10, 5).scale(0.28, 0.09, 0.05), WINGC, [-0.08, 0.40, k * 0.16], [0, 0, TILT * 0.5]),
        part(new BoxGeometry(0.20, 0.022, 0.012), BAR, [-0.08, 0.40, k * 0.207], [0, 0, TILT * 0.5 + 0.2]),
        part(new BoxGeometry(0.15, 0.020, 0.012), BAR, [-0.06, 0.36, k * 0.205], [0, 0, TILT * 0.5 + 0.1]),
      ]),
      // ③ 꼬리 + 까만 끝 띠
      part(new BoxGeometry(0.22, 0.03, 0.12), [0.45, 0.48, 0.56], [-0.34, 0.25, 0], [0, 0, 0.52]),
      part(new BoxGeometry(0.08, 0.032, 0.125), [0.08, 0.08, 0.10], [-0.46, 0.18, 0], [0, 0, 0.52]),
      // ④ 빨간 다리
      ...([1, -1] as const).map((k) =>
        part(new CylinderGeometry(0.014, 0.014, 0.13, 5), [1.26, 0.57, 0.66], [0.02, 0.065, k * 0.05])),
    ]);
  },

  /**
   * 삽(剣先スコップ) — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/삽/` (ESCO 뾰족 삽 정면, 표기 980 mm · 쓰던 옛 삽 넷)
   *
   * 앞의 것은 네모 판 날에 원뿔 끝, 둥근 고리(D) 손잡이였다. 사진과 대보니:
   *   ① 날 **0.286** · 소켓 **0.128** · 나무 자루 **0.362** · Y 손잡이 **0.223** 으로 나뉜 약 1 m
   *   ② 날은 길이 : 폭 = **1 : 0.79** 의 **방패꼴** — 위 0.56 은 나란하고 아래가 둥글게 모여 뾰족하다.
   *      어깨 윗변이 평평한 **발판**, 소켓에서 날 가운데로 0.56 까지 내려오는 **V 등줄**
   *   ③ 손잡이는 둥근 고리가 아니라 날 폭의 0.57 인 가로 막대를 두 팔로 받친 **Y자**
   * 치수는 전체 길이 = 1 로 쓴다(날 끝이 바닥, 서 있다).
   */
  삽: () => {
    const BL = 0.286, BW = 0.225 / 2, S1 = BL + 0.128, R1 = S1 + 0.362, TUBE = R1 + 0.079;
    const STEEL: RGB = [0.62, 0.62, 0.60], WOODY: RGB = [0.80, 0.66, 0.46];
    // ② 방패꼴 날 — 판을 오므리고 가운데를 조금 우묵하게. 앞뒤 두 장
    const hw = (t: number): number => (t > 0.44 ? BW * (0.93 + 0.07 * (t - 0.44) / 0.56) : BW * 0.93 * Math.sin((Math.PI / 2) * (t / 0.44)) ** 0.7);
    const blade = (): BufferGeometry => warp(new PlaneGeometry(1, 1, 4, 8), (x, y) => {
      const t = y + 0.5, xn = x * 2;
      return [xn * Math.max(0.003, hw(t)), t * BL, -0.012 * (1 - xn * xn)];
    });
    return assemble([
      part(blade(), STEEL),
      part(invert(blade()), [0.52, 0.52, 0.50], [0, 0, -0.002]),
      // 어깨 발판 · V 등줄
      part(new BoxGeometry(BW * 2, 0.012, 0.022), STEEL, [0, BL - 0.006, 0.004]),
      part(new BoxGeometry(0.018, BL * 0.56, 0.014), [0.50, 0.50, 0.48], [0, BL * (1 - 0.28), 0.006]),
      // 소켓 — 날 쪽이 굵다
      part(new CylinderGeometry(0.022, 0.030, S1 - BL, 8), [0.46, 0.46, 0.44], [0, (BL + S1) / 2, 0]),
      // 나무 자루
      part(new CylinderGeometry(0.0195, 0.0195, R1 - S1, 8), WOODY, [0, (S1 + R1) / 2, 0]),
      // ③ Y 손잡이 — 금속 통 · 두 팔 · 가로 막대
      part(new CylinderGeometry(0.021, 0.021, TUBE - R1, 8), [0.64, 0.64, 0.62], [0, (R1 + TUBE) / 2, 0]),
      ...([1, -1] as const).map((k) =>
        part(new CylinderGeometry(0.011, 0.011, 0.155, 6), [0.64, 0.64, 0.62], [k * 0.032, TUBE + 0.07, 0], [0, 0, -k * 0.43])),
      part(new CylinderGeometry(0.016, 0.016, 0.127, 8), [0.55, 0.45, 0.30], [0, 0.985, 0], [0, 0, Math.PI / 2]),
    ]);
  },

  /**
   * 개밥그릇(常滑焼) — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/개밥그릇/` (갈색 유약 도기 그릇 위 · 밑면, 표기 지름 20 × 높이 7 cm)
   *
   * 앞의 것은 위가 넓은 플라스틱 원뿔대(지름 : 높이 = 1 : 0.34)에 짙은 속이었다. 사진과 대보니:
   *   ① 높이가 지름의 **0.3** 안팎인 납작하고 **곧은 원통**(밑과 테두리 폭이 거의 같다)
   *   ② 지름의 **0.05~0.06** 두께 두툼한 벽, 평평한 테두리 윗면의 **밝은 주황 띠**(205,144,111)
   *   ③ 짙은 갈색 유약 바깥벽(90,61,42)과 대비되는 **밝은 베이지 안바닥**(201,177,140)
   * 초록 · 빨강 팔레트(11 · 8)는 도기 색이 아니다 — 흰색 팔레트에 계수로. 치수는 지름 = 1 로 쓴다.
   */
  개밥그릇: () => {
    const H = 0.3, R = 0.5, WALL = 0.055;
    return assemble([
      part(new CylinderGeometry(R, R * 0.97, H, 20, 1, true), [0.30, 0.20, 0.14], [0, H / 2, 0]),
      part(new CircleGeometry(R * 0.97, 20), [0.25, 0.16, 0.11], [0, 0.002, 0], [Math.PI / 2, 0, 0]),
      // ② 테두리 윗면 — 밝은 주황 띠
      part(new RingGeometry(R - WALL, R, 20), [0.84, 0.60, 0.48], [0, H, 0], [-Math.PI / 2, 0, 0]),
      // ③ 안벽 · 밝은 베이지 안바닥
      part(invert(new CylinderGeometry(R - WALL, R - WALL, H - 0.04, 20, 1, true)), [0.70, 0.56, 0.44], [0, H / 2 + 0.02, 0]),
      part(new CircleGeometry(R - WALL, 20), [0.82, 0.73, 0.60], [0, 0.04, 0], [-Math.PI / 2, 0, 0]),
    ]);
  },

  /**
   * 양동이(함석) — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/양동이/` (옛 아연 도금 양동이 지름 31 × 높이 30 cm · 나무 손잡이 · 손잡이를 세운 요즘 것)
   *
   * 앞의 것은 초록 플라스틱 원뿔대(입 : 바닥 : 높이 = 1 : 0.77 : 0.82)에 반원 손잡이를 세운 것이었다.
   *   ① 입 지름 1 : 바닥 **0.62** : 높이 **0.87** — 아래가 더 좁다. 입술은 둥글게 **말린 테**(0.017)
   *   ② 높이 0.27 ~ 0.50 에 두 쌍으로 도는 **가로 돌출 띠 4줄**, 바닥에 따로 끼운 **치마 띠**(0.074)
   *   ③ 양옆 리벳 **귀판**(너비 0.12)에 걸린 굵은 철사 손잡이 + 가운데 **나무 손잡이**(길이 0.29 · 굵기 0.088)
   *   ④ 아연 도금 회색에 밝은 결정 얼룩(`TILE.SPANGLE`) — 초록 팔레트(11)를 흰색으로 옮겼다
   * 손잡이는 사진처럼 **입술 위로 눕혔다** — 세우면(입술 위 0.52) 높이가 최장축이 되어 통이 작아진다.
   * 치수는 입 지름 = 1 로 쓴다.
   */
  양동이: () => {
    // 도금 색 — 짙은 바탕에 검은 얼룩이 「위장무늬」로 읽혔다(트랙 D). 밝은 은회색으로, 얼룩은 인쇄에서 옅게
    const H = 0.87, RT = 0.5, RB = 0.31, SKIRT = 0.074, ZINC: RGB = [0.86, 0.89, 0.88];
    const rAt = (y: number): number => RB + (RT - RB) * (y / H);        // 높이 y 에서 몸통 반지름
    const TILT = 1.35;                                                    // 손잡이를 세운 자리에서 +x 로 눕힌 각
    return assemble([
      part(new CylinderGeometry(RT, RB, H, 20, 1, true), ZINC, [0, H / 2, 0], undefined, TILE.SPANGLE),
      part(invert(new CylinderGeometry(RT - 0.01, RB - 0.01, H - 0.01, 20, 1, true)), [0.62, 0.64, 0.62], [0, H / 2 + 0.005, 0]),
      part(new CylinderGeometry(RB - 0.01, RB - 0.01, 0.01, 20), [0.55, 0.57, 0.55], [0, 0.012, 0]),
      // ① 말린 입술 테
      part(new TorusGeometry(RT + 0.004, 0.012, 4, 24), [0.82, 0.84, 0.82], [0, H, 0], [Math.PI / 2, 0, 0]),
      // ② 돌출 띠 넷 — 입술에서 높이의 0.27 · 0.33 · 0.44 · 0.50 아래
      ...[0.27, 0.33, 0.44, 0.50].map((f) => {
        const y = H * (1 - f);
        return part(new TorusGeometry(rAt(y) + 0.002, 0.006, 3, 16), [0.74, 0.77, 0.76], [0, y, 0], [Math.PI / 2, 0, 0]);
      }),
      // 바닥 치마 띠
      part(new CylinderGeometry(rAt(SKIRT) + 0.008, RB + 0.008, SKIRT, 20, 1, true), [0.80, 0.82, 0.80], [0, SKIRT / 2, 0]),
      // ③ 귀판 둘(±z) + 입술 위로 눕힌 철사 손잡이 + 나무 손잡이
      ...([1, -1] as const).map((k) =>
        part(new BoxGeometry(0.12, 0.10, 0.012), ZINC, [0, H - 0.03, k * (RT + 0.004)])),
      part(new TorusGeometry(RT + 0.01, 0.0075, 4, 16, Math.PI), [0.62, 0.64, 0.62], [0, H + 0.02, 0], [0, -Math.PI / 2, -TILT]),
      part(new CylinderGeometry(0.044, 0.044, 0.29, 8), [0.46, 0.39, 0.31],
        [(RT + 0.01) * Math.sin(TILT), H + 0.02 + (RT + 0.01) * Math.cos(TILT), 0], [Math.PI / 2, 0, 0]),
    ]);
  },

  /**
   * 모래성 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/모래성/` (양동이로 찍어 만든 백사장 모래성, 30° 위에서)
   *
   * 앞의 것은 원통 성채 위에 원뿔 지붕 탑 넷을 얹은 «서양 성»이었다. 사진과 대보니:
   *   ① 높이 : 폭 = **1 : 1.5** 로 뾰족하지 않고 옆으로 퍼진 **둔덕**이다
   *   ② 탑은 지붕이 없다 — 양동이를 엎어 찍은 **원뿔대**라 위가 아래의 0.83 이고 윗면이 평평하다
   *   ③ 탑 하나가 성 폭의 **0.095** 굵기에 그 1.46 배 높이, 꼭대기 한 무리와 중턱 · 아래 두 겹
   *      고리로 나뉘어 **스무 개쯤** 선다
   *   ④ 노란 모래가 아니라 **푸른 기 도는 회색 젖은 모래**다 — 주황 팔레트(9)를 흰색으로 옮겼다
   * 치수는 폭 = 1 로 쓴다.
   */
  모래성: () => {
    const RT = 0.0475, HT = 0.139, SAND: RGB = [0.80, 0.80, 0.79], TOP: RGB = [0.90, 0.91, 0.91];
    // ② 탑 하나 — 위가 아래의 0.83 인 원뿔대. 윗면만 매끈해 제일 밝다
    const tower = (x: number, z: number, y: number) => [
      part(new CylinderGeometry(RT * 0.83, RT, HT, 7, 1, true), SAND, [x, y + HT / 2, z], undefined, TILE.DIRT),
      part(new CircleGeometry(RT * 0.83, 7), TOP, [x, y + HT, z], [-Math.PI / 2, 0, 0]),
    ];
    const ring = (n: number, r: number, y: number, phase: number) =>
      Array.from({ length: n }, (_, k) => 2 * Math.PI * (k + phase) / n)
        .flatMap((a) => tower(Math.cos(a) * r, Math.sin(a) * r, y));
    return assemble([
      // ① 둔덕 — 높이가 폭의 0.667. 위가 평평하게 눌린 돔
      part(new SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.5, 0.30, 0.5), SAND,
        [0, 0, 0], undefined, TILE.DIRT),
      part(new CylinderGeometry(0.26, 0.33, 0.055, 14), SAND, [0, 0.285, 0], undefined, TILE.DIRT),
      // ③ 탑 스물 — 꼭대기 다섯 · 중턱 일곱 · 아래 여덟
      ...tower(0, 0, 0.315),
      ...ring(4, 0.155, 0.30, 0.5),
      ...ring(7, 0.30, 0.215, 0),
      ...ring(8, 0.44, 0.055, 0.5),
      // 둔덕을 두른 파낸 모래 두둑 — 사진의 얕은 도랑이 남긴 테
      part(new TorusGeometry(0.47, 0.03, 3, 16), SAND, [0, 0.012, 0], LIE_Z, TILE.DIRT),
    ]);
  },

  /**
   * 삼각콘 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/삼각콘/` (벽돌 보도에 홀로 선 주황 콘 정면)
   *
   * 앞의 것은 밑판 0.72 에 밑지름 0.56 인 뭉툭한 원뿔이었다 — 판 위에 고깔을 얹은 꼴이다. 사진과 대보니:
   *   ① 높이 : 받침 너비 = 1 : **0.371**, 받침 높이는 전체의 **0.166** 인 낮은 계단
   *   ② 몸통은 100 px 내려갈 때 22 px 벌어지는 **곧은 직선**이라 밑지름이 높이의 **0.25** 뿐이다.
   *      꼭대기 0.11 구간만 둥글게 마무리된다
   *   ③ 반사 띠는 몸통과 같은 기울기로 **두 줄** — 위는 0.117 에서 폭 0.166, 아래는 0.49 에서 폭 0.128
   *   ④ 받침과 몸통이 한 덩어리로 흘러내리듯 이어지고 판 윗면에 몸통을 두른 홈이 한 줄 파인다
   * 치수는 높이 = 1 로 쓴다.
   */
  삼각콘: () => {
    const BASE = 0.166, ORANGE: RGB = [0.86, 0.82, 0.78], BAND: RGB = [1.04, 1.06, 1.02];
    // ② 높이 y 에서의 반지름 — 밑(0.125)에서 꼭대기까지 곧게 좁아진다
    const rAt = (y: number): number => 0.125 * (1 - (y - BASE) / (1 - BASE - 0.05));
    return assemble([
      // ① 받침 — 네 귀가 몸통보다 크게 튀어나온 낮은 판
      part(new BoxGeometry(0.371, BASE * 0.72, 0.371), ORANGE, [0, BASE * 0.36, 0], undefined, TILE.PLASTIC),
      part(new BoxGeometry(0.33, BASE * 0.35, 0.33), ORANGE, [0, BASE * 0.84, 0]),
      // ④ 받침 윗면에 몸통을 두른 홈 한 줄
      part(new TorusGeometry(0.135, 0.008, 3, 16), [0.72, 0.68, 0.64], [0, BASE, 0], LIE_Z),
      // ② 몸통 — 곧은 직선 테이퍼. 꼭대기 0.11 만 둥글다
      part(new CylinderGeometry(rAt(0.95), 0.125, 0.95 - BASE, 14, 1, true), ORANGE,
        [0, (0.95 + BASE) / 2, 0], undefined, TILE.PLASTIC),
      part(new SphereGeometry(rAt(0.95), 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.7, 1), ORANGE, [0, 0.95, 0]),
      // ③ 반사 띠 둘 — 몸통과 같은 기울기로 얇게 덧씌운다
      ...([[0.117, 0.166], [0.49, 0.128]] as const).map(([y0, h]) =>
        part(new CylinderGeometry(rAt(1 - y0) * 1.03, rAt(1 - y0 - h) * 1.03, h, 14, 1, true), BAND,
          [0, 1 - y0 - h / 2, 0])),
    ]);
  },

  // ── 버킷 6 (60cm~1.2m) ────────────────────────────────────
  /**
   * 개(시바) — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/개/` (시바 옆모습 2012 · 1953 흑백 시바)
   *
   * 앞의 것은 긴 몸통에 **늘어진 귀**, 곧게 치켜든 막대 꼬리였다. 사진과 대보니:
   *   ① 꼬리가 등 위로 **한 바퀴 말려** 올라간다(폭이 몸길이의 0.33, 윗면이 흰 크림)
   *   ② 귀는 늘어지지 않고 **곧게 서서 앞으로 조금 기운 세모**(몸길이의 0.12)
   *   ③ 붉은 황갈 몸에 **볼 · 주둥이 · 가슴 · 엉덩이 · 다리 아래만 흰 크림**(裏白)
   *   ④ 머리가 몸길이의 0.31, 주둥이가 짧고 코끝이 까맣다. 몸길이 : 어깨 높이 = 1 : 0.72(두 사진 사이)
   * 치수는 코끝 ~ 엉덩이 = 1 로 쓴다(머리 +x).
   */
  개: () => {
    const RED: RGB = [0.97, 0.69, 0.40], CREAM: RGB = [1.02, 0.99, 0.92];
    const BODY_L = 0.70, SH = 0.72 * BODY_L, LEG = 0.43 * SH, BT = 0.24 * BODY_L;
    const HEAD: [number, number, number] = [0.33, SH + 0.07, 0];
    return assemble([
      // 몸통 — 옆으로 누운 캡슐, 어깨가 조금 높다
      part(new CapsuleGeometry(BT * 0.52, BODY_L - BT, 4, 10).scale(1, 1, 0.85), RED, [-0.08, LEG + BT / 2, 0], [0, 0, Math.PI / 2 - 0.08]),
      // ③ 가슴 · 엉덩이 크림
      part(new SphereGeometry(1, 8, 6).scale(0.08, 0.11, 0.10), CREAM, [0.23, LEG + BT * 0.45, 0]),
      part(new SphereGeometry(1, 8, 6).scale(0.08, 0.10, 0.10), CREAM, [-0.41, LEG + BT * 0.55, 0]),
      // 목 — 가슴에서 머리로
      part(new CylinderGeometry(0.075, 0.10, 0.16, 8), RED, [0.27, SH - 0.02, 0], [0, 0, -0.55]),
      // ④ 머리 · 볼 · 짧은 주둥이 · 까만 코 · 눈
      part(new SphereGeometry(0.105, 10, 7), RED, HEAD),
      part(new SphereGeometry(1, 8, 6).scale(0.08, 0.06, 0.095), CREAM, [HEAD[0] + 0.05, HEAD[1] - 0.04, 0]),
      part(new CylinderGeometry(0.035, 0.05, 0.08, 8), CREAM, [HEAD[0] + 0.11, HEAD[1] - 0.035, 0], [0, 0, -Math.PI / 2]),
      part(new SphereGeometry(0.022, 6, 4), [0.30, 0.30, 0.30], [HEAD[0] + 0.155, HEAD[1] - 0.03, 0]),
      ...([1, -1] as const).flatMap((k) => [
        part(new SphereGeometry(0.014, 5, 3).scale(1.4, 0.7, 1), [0.12, 0.10, 0.08], [HEAD[0] + 0.075, HEAD[1] + 0.02, k * 0.055]),
        // ② 선 세모 귀 — 앞으로 조금 기운다
        part(new ConeGeometry(0.042, 0.085, 4).scale(1, 1, 0.5), RED, [HEAD[0] - 0.02, HEAD[1] + 0.12, k * 0.055], [k * 0.15, 0, -0.18]),
      ]),
      // 다리 넷 — 위는 붉고 아래 절반은 크림
      ...([[0.18, 1], [0.18, -1], [-0.34, 1], [-0.34, -1]] as const).flatMap(([x, k]) => [
        part(new CylinderGeometry(0.032, 0.034, LEG * 0.5, 6), RED, [x, LEG * 0.75, k * 0.065]),
        part(new CylinderGeometry(0.028, 0.032, LEG * 0.5, 6), CREAM, [x, LEG * 0.25, k * 0.065]),
      ]),
      // ① 말린 꼬리 — 등 뒤 위에서 한 바퀴. 윗면 크림
      part(new TorusGeometry(0.075, 0.038, 5, 10, Math.PI * 1.6), CREAM, [-0.36, LEG + BT + 0.09, 0], [0, 0, -0.4]),
    ]);
  },
};
