import {
  BoxGeometry, CircleGeometry, CylinderGeometry, ExtrudeGeometry, LatheGeometry, Shape,
  SphereGeometry, TorusGeometry, Vector2,
  type BufferGeometry,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ShapeIdHouse } from './generation';
import {
  assemble, evenProfile, invert, INK, part, SHINE, soft, warp, WHITE,
  type RGB,
} from './shapes.kit';
import { TILE } from './atlas';

/** X축으로 돌린 원기둥 — 축이 Z가 된다 */
const LIE_Z: readonly [number, number, number] = [Math.PI / 2, 0, 0];

/**
 * **방 정체성 전용 형태** — 부엌 7 · 화장실 4 · 아이 방 5.
 *
 * ## 왜 크기가 아니라 방으로 묶었나
 *
 * 기존 `shapes.small/mid/large.ts` 는 **크기 축**으로 갈라져 있다. 그건 빌더 파일이
 * 1,000줄을 넘어서 나눈 것이라 자연스러운 축이었다. 이 16종이 존재하는 이유는
 * 다르다 — 크기가 아니라 **「부엌에 부엌 물건이 있어야 한다」** 다.
 * 라벨 표가 방마다 갈리는 순간(`ROOM_TABLES`) 이 묶음이 그 표의 재료가 된다.
 *
 * ## 이 16종을 고른 기준
 *
 * 집 맵에는 이미 49종이 있었는데 **전부 거실 물건**이었다. 크레용·주사위·신문·
 * 리모컨·방석·찻잔. 그래서 부엌에 들어가도 크레용이 깔리고 화장실에 밥솥이 굴렀다.
 * 없는 건 「부엌·화장실·아이 방에만 있는 것」이었다.
 *
 * 이름 옆 숫자가 **실물 최대 변(cm)** 이다. 라벨 버킷 경계(1·2·4·8·15·30·60·120cm)
 * 안에 들어가는지 확인하고 넣었다 — 안 그러면 15cm 자리에 35cm짜리 이름이 붙는다.
 *
 * ## 규약
 *
 * `shapes.kit.ts` 만 import 한다 (`shapes.ts` 를 import 하면 순환 참조).
 * 치수는 **실제 cm 감각**으로 쓴다 — `assemble()` 의 `normalize()` 가 최장축을 1.0으로
 * 맞추므로 0~1 로 환산할 필요가 없고, 그러면 비율이 눈에 안 보인다.
 *
 * **`part()` 의 5번째 인자는 배율이 아니라 인쇄 칸 번호다.** 축별로 눌러야 하는
 * 형태(계란·비누·곰인형)는 지오메트리에 `.scale()` 로 직접 굽는다.
 */
export const HOUSE_BUILDERS: Record<ShapeIdHouse, () => BufferGeometry> = {

  // ─── 부엌 ────────────────────────────────────────────────────

  /**
   * 계란 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/계란/` (뭉툭한 끝으로 세운 흰 달걀 정측면)
   *
   * 앞의 것은 타원 구에 작은 구를 한쪽에 붙인 것이라 좁은 쪽에 «혹»이 났다. 사진과 대보니:
   *   ① 폭 : 길이 = **0.75**
   *   ② 가장 넓은 곳이 **뭉툭한 끝에서 0.46** — 뭉툭한 쪽 1/4 지점 폭 0.90, 뾰족한 쪽 1/4 지점 0.82
   *   ③ 모서리 없이 끊김 없는 한 곡선이다 — 부품 둘을 붙이면 이음매가 생긴다
   * 반타원 둘을 가장 넓은 곳에서 이은 돌림면 하나로 만든다. 이 식으로 네 지점(10%·25%)의 폭이
   * 잰 값과 0.03 안에서 맞는다. 바닥에서는 **옆으로 눕는다**. 치수는 길이 = 1 로 쓴다.
   */
  계란: () => {
    const R = 0.375, WIDE = 0.46;
    const pts = Array.from({ length: 15 }, (_, k) => {
      // 0 = 뭉툭한 끝, 1 = 뾰족한 끝. 양 끝을 촘촘히 뽑는다 — 고르게 뽑으면 끝 두 점 사이가 원뿔로 뾰족해졌다
      const t = (1 - Math.cos(Math.PI * k / 14)) / 2;
      const u = t < WIDE ? (t - WIDE) / WIDE : (t - WIDE) / (1 - WIDE);
      return new Vector2(Math.max(0.001, R * Math.sqrt(Math.max(0, 1 - u * u))), t);
    });
    // 돌림축 y 를 −x 로 눕힌다(뭉툭한 끝 +x). 껍질 얼룩은 옅게 — 세면 메추리알이 된다
    return assemble([
      part(new LatheGeometry(pts, 14), [1.0, 0.99, 0.95], [0.5, R, 0], [0, 0, Math.PI / 2], TILE.EGG),
    ]);
  },

  /**
   * 밥공기 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/밥공기/` (白山陶器 「紀の川」 1977, 판매 표기 Φ12 × 5.5 cm)
   *
   * 앞의 것은 곧은 원뿔대 사발(입 1 : 높이 0.54)에 굽 지름 0.58, 입술 밖에 푸른 고리를 두른 것이었다.
   *   ① 입지름 : 높이 : 굽 지름 = **1 : 0.44 : 0.37** — 더 얕고 굽이 좁다
   *   ② 옆선이 **아래로 갈수록 빨리 좁아지는 둥근 사발꼴**(깊이 1/6 에서 입의 0.96, 1/3 에서 0.88, 1/2 에서 0.76)
   *   ③ 입술 바로 아래 **가는 띠**(높이의 0.055) — 고리를 얹지 않고 인쇄로 두른다(`TILE.RICEBOWL`)
   *   ④ 높이의 0.18 인 짧은 굽에 **코발트 세로 줄 20개**(`TILE.BOWLFOOT`)
   * 사진이 흰 자기라 팔레트는 흰색 하나 — 민트(13)를 곱하면 띠와 굽 줄이 묻힌다.
   * 치수는 입지름 = 1 로 쓴다.
   */
  밥공기: () => {
    const H = 0.44, FOOT = 0.18 * H, FOOT_R = 0.185, WALL = 0.025;
    // ② 바깥 윤곽 — 굽 안쪽에서 입까지. 길이 기준으로 고르게 뽑아야 띠가 v 0.91~0.96 에 앉는다
    const outer = evenProfile([[FOOT_R, FOOT], [0.26, 0.105], [0.33, 0.155], [0.38, 0.22], [0.44, 0.293], [0.48, 0.367], [0.50, H]], 8)
      .map(([r, y]) => new Vector2(r, y));
    const inner = evenProfile([[0.001, FOOT + 0.035], [0.20, FOOT + 0.045], [0.31, 0.17], [0.36, 0.23], [0.42, 0.30], [0.458, 0.37], [0.50 - WALL, H]], 6)
      .map(([r, y]) => new Vector2(r, y));
    return assemble([
      part(new LatheGeometry(outer, 16), WHITE, undefined, undefined, TILE.RICEBOWL),
      part(invert(new LatheGeometry(inner, 16)), [0.93, 0.94, 0.94]),
      // 입술 — 가장 밝은 한 줄
      part(new TorusGeometry(0.50 - WALL / 2, WALL / 2, 3, 16), [1.02, 1.02, 1.02], [0, H, 0], LIE_Z),
      // ④ 굽 — 목이나 턱 없이 몸통 밑에 곧장 붙는다
      part(new CylinderGeometry(FOOT_R, FOOT_R, FOOT, 16, 1, true), WHITE, [0, FOOT / 2, 0], undefined, TILE.BOWLFOOT),
      part(new CircleGeometry(FOOT_R, 16), [0.86, 0.86, 0.84], [0, 0.002, 0], [Math.PI / 2, 0, 0]),
    ]);
  },

  /**
   * 젓가락 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/젓가락/` (도쿄의 옻칠 젓가락 한 벌, 옆에서 곧게)
   *
   * 앞의 것은 끝까지 고르게 가늘어지는 흰 막대 둘에 나무색 끝동(0.18)이었다. 사진과 대보니:
   *   ① 머리 굵기가 길이의 **0.042**, 끝은 머리의 **0.30** — 가늘어지는 건 **끝 쪽 2/3** 에 몰려 있고
   *      손잡이 쪽 1/3 은 0.87 → 1.0 으로 거의 곧다
   *   ② 끝에서 0.635 까지 **짙은 붉은 칠**, 손잡이 쪽은 **검은 칠** — 그 사이 초록 무늬 판(0.15)
   *   ③ 두 짝 사이 틈은 굵기의 1/4
   * 칠 색이 팔레트(나무)에 곱해지면 붉은 칠이 흙색이 된다 — 팔레트는 흰색, 색은 칠이 정한다.
   * 치수는 길이 = 1 로 쓴다(끝 +x, 머리 −x).
   */
  젓가락: () => {
    const HEAD = 0.021, TIP = HEAD * 0.30, MID = HEAD * 0.87;
    const RED: RGB = [0.36, 0.04, 0.02], BLACK: RGB = [0.03, 0.03, 0.03], GREEN: RGB = [0.08, 0.22, 0.12];
    // 구간 [끝 쪽 x, 머리 쪽 x, 끝 쪽 반지름, 머리 쪽 반지름, 색] — 끝(+0.5)에서 머리(−0.5)로
    const bands: readonly (readonly [number, number, number, number, RGB])[] = [
      [0.5, 0.5 - 0.635, TIP, MID, RED],
      [0.5 - 0.635, 0.5 - 0.68, MID, MID * 1.01, BLACK],
      [0.5 - 0.68, 0.5 - 0.83, MID * 1.01, HEAD * 0.95, GREEN],
      [0.5 - 0.83, -0.5, HEAD * 0.95, HEAD, BLACK],
    ];
    return assemble([0.026, -0.026].flatMap((z) => bands.map(([x0, x1, r0, r1, rgb]) =>
      // 원기둥 위(+y)가 끝 쪽 — Z 로 −90° 눕히면 +x 를 본다
      part(new CylinderGeometry(r0, r1, x0 - x1, 6), rgb, [(x0 + x1) / 2, HEAD, z], [0, 0, -Math.PI / 2])))
      .concat([
        // 초록 판 위 작은 금색 꽃 — 짝마다 둘
        ...[0.026, -0.026].flatMap((z) => [-0.22, -0.28].map((x) =>
          part(new SphereGeometry(0.006, 5, 4), [0.62, 0.57, 0.36], [x, HEAD * 1.9, z]))),
      ]));
  },

  /**
   * 숟가락 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/숟가락/` (스테인리스 숟가락을 바로 위에서)
   *
   * 앞의 것은 눌린 구(머리) 0.46 에 곧은 막대 자루였다. 사진과 대보니:
   *   ① 머리는 전체의 **0.34**, 폭 : 길이 = **0.62** 의 달걀꼴 — 떠먹는 끝 쪽이 더 넓다
   *   ② 목이 머리 폭의 **0.10** 까지 조였다가 자루가 끝에서 0.30 지점에서 **머리 폭의 0.30** 까지
   *      넓어지고, 다시 좁아져 끝이 둥글다 — 곧은 막대가 아니다
   *   ③ 오목한 면 안쪽만 어둡다 — 머리가 파여 있어야 주걱이 아니다
   * 자루는 평면 윤곽을 밀어 만든다. 치수는 길이 = 1 로 쓴다(머리 +x).
   */
  숟가락: () => {
    const HL = 0.17, HW = 0.107, RIM = 0.045, T = 0.012;
    // ② 자루 윤곽 — [x, 반폭]. 목(0.11)이 가장 좁고 −0.22 에서 가장 넓다
    const half: readonly (readonly [number, number])[] = [
      [0.20, 0.050], [0.16, 0.024], [0.11, 0.011], [0.0, 0.018], [-0.10, 0.027],
      [-0.22, 0.032], [-0.35, 0.028], [-0.45, 0.021], [-0.49, 0.013], [-0.50, 0.0],
    ];
    const outline = new Shape();
    outline.moveTo(half[0]![0], half[0]![1]);
    for (const [x, w] of half.slice(1)) outline.lineTo(x, w);
    for (const [x, w] of [...half].reverse().slice(1)) outline.lineTo(x, -w);
    // 밀어 만든 도형은 색인이 없다 — 다른 부품(색인 있음)과 병합하려면 색인을 붙인다
    const handle = mergeVertices(new ExtrudeGeometry(outline, { depth: T, bevelEnabled: false }));
    // ① 달걀꼴 — 떠먹는 끝(+x) 쪽 폭을 넓힌다
    const egg = (g: BufferGeometry): BufferGeometry => warp(g, (x, y, z) => [x, y, z * (1 + 0.14 * (x / HL))]);
    const SILVER: RGB = [1.08, 1.04, 0.98];
    return assemble([
      // 머리 바깥 — 아래 반구를 눌러 접시처럼. 바닥에 닿는 건 이 볼록한 밑이다
      part(egg(new SphereGeometry(1, 16, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(HL, RIM, HW)),
        SILVER, [0.5 - HL, RIM, 0]),
      // ③ 오목한 안쪽 — 어둡게 비친다
      part(egg(invert(new SphereGeometry(1, 16, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(HL * 0.94, RIM * 0.8, HW * 0.94))),
        [0.74, 0.72, 0.72], [0.5 - HL, RIM + 0.001, 0]),
      // 자루 — 판을 눕히고(X +90°) 끝이 바닥에 닿게 0.055 rad 기울인다
      part(handle, SILVER, [0, 0.040, 0], [Math.PI / 2, 0, 0.055]),
    ]);
  },

  /**
   * 당근 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/당근/` (五寸 당근 옆모습 + 잎 자른 꼭지 접사)
   *
   * 앞의 것은 끝이 뾰족한 원뿔(길이 : 지름 = 1 : 0.44)에 잎 세 갈래를 세운 것이었다. 사진과 대보니:
   *   ① 길이 : 가장 굵은 지름 = **1 : 0.27** — 훨씬 가늘다. 가장 굵은 곳은 윗끝에서 **0.13**
   *   ② 끝까지 곧게 가늘어지다(1/2 에서 0.77, 3/4 에서 0.67, 0.95 에서 0.42) **뭉툭하게** 끝난다
   *   ③ 잎은 잘려 없고, 오목하게 파인 어깨 한가운데에 **짧은 초록 꼭지**(어깨 지름의 0.29)만 박혀 있다
   *   ④ 몸통을 가로로 두르는 옅은 잔주름(`TILE.CARROT`)
   * 치수는 길이 = 1 로 쓴다(끝 +x, 어깨 −x).
   */
  당근: () => {
    const R = 0.135;
    // [반지름 비, 끝에서 잰 길이] — 끝(0)에서 어깨(1)로, 어깨는 가운데로 오목하게 말려 들어간다
    const prof = evenProfile([[0.001, 0], [0.26, 0.012], [0.42, 0.05], [0.67, 0.25], [0.77, 0.5], [0.95, 0.78],
      [1.0, 0.87], [0.97, 0.95], [0.84, 0.985], [0.55, 1.0], [0.30, 0.992]].map(([k, y]) => [k! * R, y!] as const), 16)
      .map(([r, y]) => new Vector2(r, y));
    return assemble([
      // 돌림축 y 를 −x 로 눕힌다 → 끝(y=0)이 +x
      // 색 — (237,101,44) 계수가 따뜻한 빛에서 살구색으로 떴다(트랙 D). 채도를 올린다
      part(new LatheGeometry(prof, 12), [1.0, 0.36, 0.12], [0.5, R, 0], [0, 0, Math.PI / 2], TILE.CARROT),
      // ③ 초록 꼭지 — 오목한 어깨에 박혀 조금만 튀어나온다
      part(new CylinderGeometry(0.29 * R, 0.29 * R, 0.03, 8), [0.48, 0.51, 0.25], [-0.5 + 0.004, R, 0], [0, 0, Math.PI / 2]),
    ]);
  },

  /**
   * 냄비(유키히라) — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/냄비/` (中尾アルミ 打出雪平鍋 18cm, 옆모습 + 비스듬히)
   *
   * 앞의 것은 양쪽 귀가 달린 곧은 원통 냄비에 뚜껑을 비껴 얹은 것이었다. 사진과 대보니:
   *   ① 높이 : 지름 = **0.39** 의 얕은 사발 — 옆벽은 거의 곧다가 **아래 1/3 에서 크게 둥글어져**
   *      좁은 바닥(지름의 0.33)으로 간다. 뚜껑은 없다
   *   ② 귀 대신 **곧은 막대 손잡이 하나** — 몸통 지름의 0.96 길이, 굵기 0.13, 약 20° 들렸다.
   *      앞 0.28 은 몸통에 나팔처럼 붙는 알루미늄 통, 뒤 0.72 는 옅은 나무(가는 홈 둘, 끝이 둥글다)
   *   ③ 손잡이와 90° 인 두 옆의 **삼각 부리**
   *   ④ 옆면을 덮은 엇갈린 벌집 망치 자국(`TILE.HAMMERED`)
   * 치수는 몸통 지름 = 1 로 쓴다(손잡이 +x).
   */
  냄비: () => {
    const H = 0.39, WALL = 0.014;
    // ③ 부리 — ±z 옆 입술을 삼각형으로 끌어낸다. 몸통 · 안쪽 · 입술 테가 같은 식으로 휘어야 틈이 안 난다
    const spout = (g: BufferGeometry): BufferGeometry => warp(g, (x, y, z) => {
      const r = Math.hypot(x, z);
      if (r < 1e-6) return [x, y, z];
      const a = Math.abs(Math.abs(Math.atan2(x, z)) - Math.PI / 2);   // ±z 방향(손잡이와 90°)에서 0
      const off = Math.PI / 2 - a;
      const k = Math.max(0, 1 - off / 0.28) * Math.max(0, (y - 0.26) / (H - 0.26));
      const s = (r + 0.06 * k) / r;
      return [x * s, y + 0.012 * k, z * s];
    });
    const outer = [[0.001, 0], [0.165, 0], [0.30, 0.025], [0.39, 0.065], [0.44, 0.13], [0.47, 0.25], [0.50, H]]
      .map(([r, y]) => new Vector2(r!, y!));
    const inner = [[0.001, WALL], [0.16, WALL], [0.29, 0.035], [0.38, 0.072], [0.43, 0.135], [0.46, 0.25], [0.50 - WALL, H]]
      .map(([r, y]) => new Vector2(r!, y!));
    // ② 손잡이 — 몸통 벽(x=0.47, 입술 조금 아래)에서 +x 로 20° 들린 축
    const TILT = 0.35, L = 0.96, R = 0.065;
    const along = (d: number, dy = 0): [number, number, number] =>
      [0.47 + Math.cos(TILT) * d, 0.30 + Math.sin(TILT) * d + dy, 0];
    const HANDLE_ROT: readonly [number, number, number] = [0, 0, -(Math.PI / 2 - TILT)];
    // 나무와 금속 통이 같은 색으로 뭉쳤다(트랙 D) — 나무는 더 따뜻하게, 통은 조금 짙은 금속으로
    const WOODEN: RGB = [1.22, 1.05, 0.82];
    return assemble([
      part(spout(new LatheGeometry(outer, 16)), WHITE, undefined, undefined, TILE.HAMMERED),
      part(spout(invert(new LatheGeometry(inner, 16))), [0.80, 0.84, 0.88]),
      part(spout(new TorusGeometry(0.50 - WALL / 2, WALL / 2, 3, 24).rotateX(Math.PI / 2).translate(0, H, 0)), [1.08, 1.08, 1.08]),
      // 알루미늄 통 — 몸통 쪽이 나팔처럼 벌어진다
      part(new CylinderGeometry(R * 0.95, R * 1.45, L * 0.28, 10), [0.86, 0.87, 0.91], along(L * 0.14), HANDLE_ROT),
      // 금속 테 한 줄
      part(new CylinderGeometry(R * 1.05, R * 1.05, 0.018, 10), [0.86, 0.86, 0.88], along(L * 0.28), HANDLE_ROT),
      // 나무 — 0.72, 끝이 반구
      part(new CylinderGeometry(R, R, L * 0.72, 10), WOODEN, along(L * 0.64), HANDLE_ROT),
      part(new SphereGeometry(R, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), WOODEN, along(L), HANDLE_ROT),
      // 나무 끝에서 0.30 · 0.38 의 가는 홈
      ...[0.30, 0.38].map((f) =>
        part(new CylinderGeometry(R * 1.01, R * 1.01, 0.008, 10), [0.66, 0.58, 0.46], along(L - L * 0.72 * f), HANDLE_ROT)),
    ]);
  },

  /**
   * 도마 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/도마/` (日本橋木屋 히노키 360 × 180 × 30 mm)
   *
   * 앞의 것은 판 한쪽에 둥근 자루를 단 서양식 도마(두께 0.13)였다. 사진과 대보니:
   *   ① 길이 : 너비 : 두께 = **1 : 0.50 : 0.084** 의 두툼한 **통판** — 자루도 구멍도 없다
   *   ② 윗면을 길이 방향으로 곧게 지나는 가는 곧은결과 옅은 분홍 띠(`TILE.HINOKI`)
   *   ③ **짧은 끝면만 한 톤 짙은** 나뭇결 끝면(180,154,124)
   * 옅은 히노키색(232,204,165)은 나무 팔레트(7)에 곱하면 짙은 갈색이 된다 — 팔레트는 흰색.
   * 치수는 길이 = 1 로 쓴다.
   */
  도마: () => {
    const T = 0.084, W = 0.5;
    return assemble([
      part(new BoxGeometry(1.0, T, W), [0.95, 0.85, 0.71], [0, T / 2, 0], undefined, TILE.HINOKI),
      // ③ 끝면 — 판 «밖»으로 1mm 덧대야 끝면과 같은 평면이 안 된다
      ...([1, -1] as const).map((k) =>
        part(new BoxGeometry(0.003, T * 0.98, W * 0.98), [0.76, 0.64, 0.53], [k * 0.5015, T / 2, 0])),
    ]);
  },

  // ─── 화장실 ──────────────────────────────────────────────────

  /**
   * 비누 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/비누/` (牛乳石鹸 赤箱 위 · 비스듬히 · 뒷면, 90g · 130g 비교)
   *
   * 앞의 것은 눌린 타원 구에 거품 한 덩이를 얹은 것이었다. 사진과 대보니:
   *   ① 평면 길이 : 폭 ≈ **1 : 0.6** 인데 네 모서리를 **길이의 0.28** 반지름으로 둥글린 도톰한 **베개꼴** —
   *      타원이 아니라 곧은 변이 조금 남은 알약꼴이다. 두께는 길이의 0.17 이상(비스듬한 사진)이라 0.26 으로 두었다
   *   ② 윗면 한가운데 **길이의 0.30 짜리 오목한 정사각 틀**, 안에 돋을새김 소(`TILE.SOAP`)
   *   ③ 윗면은 가운데가 살짝 부풀고, 옆면 한가운데를 가는 이음 선이 두른다
   * 거품은 사진에 없다 — 뺐다. 치수는 길이 = 1 로 쓴다.
   */
  비누: () => {
    const L = 1, W = 0.6, RAD = 0.28, T = 0.26, BEVEL = 0.07;
    const plan = new Shape();
    const hx = L / 2 - BEVEL, hz = W / 2 - BEVEL, r = RAD - BEVEL;
    plan.moveTo(-hx + r, -hz);
    plan.lineTo(hx - r, -hz); plan.quadraticCurveTo(hx, -hz, hx, -hz + r);
    plan.lineTo(hx, hz - r); plan.quadraticCurveTo(hx, hz, hx - r, hz);
    plan.lineTo(-hx + r, hz); plan.quadraticCurveTo(-hx, hz, -hx, hz - r);
    plan.lineTo(-hx, -hz + r); plan.quadraticCurveTo(-hx, -hz, -hx + r, -hz);
    // 평면을 밀어 올리고 모서리를 둥글린다. 밀기 축 z 를 위(y)로 세운다
    const bar = mergeVertices(new ExtrudeGeometry(plan, {
      depth: T - BEVEL * 2, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 3, curveSegments: 7,
    }).deleteAttribute('uv').deleteAttribute('normal'));
    bar.rotateX(-Math.PI / 2).translate(0, BEVEL, 0);
    // ③ 윗면 가운데 부풂 — 위쪽 절반만 조금 올린다
    warp(bar, (x, y, z) => [x, y > T / 2 ? y + 0.03 * Math.max(0, 1 - (x / 0.5) ** 2) * Math.max(0, 1 - (z / 0.3) ** 2) : y, z]);
    return assemble([
      part(bar, [1.0, 0.98, 0.94]),
      // ② 오목한 정사각 틀 — 윗면 부풂 꼭대기에 얹은 얇은 조각
      part(new BoxGeometry(0.30, 0.004, 0.30), [0.97, 0.95, 0.91], [0, T + 0.03, 0], undefined, TILE.SOAP),
      // ③ 옆면 이음 선 — 몸통보다 1mm 큰 얇은 띠
      part(new CylinderGeometry(1, 1, 0.006, 20, 1, true).scale(0.505, 1, 0.305), [0.86, 0.84, 0.80], [0, T / 2, 0]),
    ]);
  },

  /**
   * 고무오리 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/고무오리/` (옆모습 · 정면 · 물에 뜬 모습)
   *
   * 앞의 것은 타원 몸통 위에 가는 목과 작은 머리, 뾰족한 원뿔 부리였다. 사진과 대보니:
   *   ① **공 같은 큰 머리**(몸통 길이의 0.62 폭)가 앞쪽에 얹혀 머리 : 몸 높이가 거의 반반인 눈사람꼴 —
   *      목은 따로 없고 머리가 몸통에 묻힌다. 전체 길이 : 높이 = 1 : 0.85
   *   ② 부리는 **짧고 넓적하다** — 머리 가로의 0.17 길이, 앞에서 보면 머리 폭의 0.77. 원뿔이 아니다
   *   ③ 몸통은 윗면이 평평한 **배(船) 모양**, 뒤끝이 뭉툭하게 치켜 올라간다. 옆구리에 잎꼴 날개
   *   ④ 부리 바로 뒤 까만 세로 타원 눈
   * 치수는 전체 길이 = 1 로 쓴다(부리 +x).
   */
  고무오리: () => {
    const HR = 0.28;                                               // 머리 반지름(가로 0.563)
    // ③ 배 모양 몸통 — 둥글린 상자를 뒤로 갈수록 좁히고, 밑은 양 끝을 들고, 뒤 윗모서리를 치켜 올린다
    const body = warp(soft(0.86, 0.46, 0.64, 0.45), (x, y, z) => {
      const back = Math.max(0, -x / 0.43);
      // 꼬리 — 뒤 윗모서리를 더 치켜 올린다(트랙 D 「꼬리가 안 들렸다」)
      return [x, y < 0 ? y + 0.05 * (x / 0.43) ** 2 : y + 0.12 * Math.max(0, back - 0.35), z * (1 - 0.22 * back)];
    });
    return assemble([
      part(body, WHITE, [-0.07, 0.23, 0]),
      // ① 머리 — 몸통 앞쪽 위에 묻힌 큰 공
      part(new SphereGeometry(HR, 16, 10), WHITE, [0.128, 0.854 - HR, 0]),
      // ② 넓적한 부리
      part(soft(0.11, 0.075, 0.22, 0.45), [0.91, 0.42, 0.95], [0.43, 0.555, 0]),
      // ④ 눈 — 까만 세로 타원
      ...([1, -1] as const).map((k) =>
        part(new SphereGeometry(0.04, 8, 6).scale(0.5, 1.1, 0.8), INK, [0.36, 0.60, k * 0.13], [0, k * -0.6, 0])),
      // 날개 — 옆구리 잎꼴, 몸통보다 조금 짙게
      ...([1, -1] as const).map((k) =>
        part(new SphereGeometry(1, 10, 6).scale(0.24, 0.09, 0.04), [0.92, 0.86, 0.90], [-0.08, 0.28, k * 0.28], [0, 0, 0.15])),
    ]);
  },

  /**
   * 칫솔 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/칫솔/` (ヤマト歯ブラシ ¥50 · エビス ¥30 상자 속 옆모습)
   *
   * 앞의 것은 판 둘을 이은 자루에 흰 상자 하나를 솔로 얹은 것이었다. 사진과 대보니:
   *   ① 솔 덩어리가 길이의 **0.25**, 높이가 머리 두께(0.035)의 **1.7배(0.059)** — 틈을 두고 선 **다발 11개**
   *   ② 굽힘 없는 **곧은 막대** 자루, 두 끝이 둥글고 가운데가 살짝 부푼다
   *   ③ 속이 비치는 **연파랑**(121,150,162) 자루 위 누르스름한 흰 솔(174,183,175)
   * 흰 솔은 색 팔레트(민트 · 분홍 · 파랑)에 곱하면 물든다 — 팔레트는 흰색 하나, 자루 색은 계수로.
   * 치수는 길이 = 1 로 쓴다(머리 +x).
   */
  칫솔: () => {
    // 자루 — 따뜻한 빛에서 회녹색으로 떴다(트랙 D). 하늘색 쪽으로
    const HEAD_T = 0.035, TUFT_H = 0.059, WID = 0.07, HANDLE: RGB = [0.42, 0.62, 0.82];
    // ② 자루 — 가운데가 살짝 부푼 곧은 막대
    const stick = warp(soft(1.0, HEAD_T, WID, 0.45), (x, y, z) => [x, y * (1 + 0.25 * (1 - (x / 0.5) ** 2)), z * (1 + 0.1 * (1 - (x / 0.5) ** 2))]);
    return assemble([
      part(stick, HANDLE, [0, HEAD_T / 2 + 0.004, 0]),
      // ① 솔 다발 11개 — 머리(+x 끝 0.25) 위에 틈을 두고
      ...Array.from({ length: 11 }, (_, k) =>
        part(new BoxGeometry(0.016, TUFT_H, WID * 0.86), [0.95, 0.96, 0.94], [0.5 - 0.02 - k * 0.0215, HEAD_T + TUFT_H / 2, 0])),
    ]);
  },

  /**
   * 수건 — **사진에서 잰 값으로 다시 만들었다.**
   * 근거: `.design-bounce/ref/수건/` (쇼와 얇은 파일 수건 — 개어 놓은 것 · 펼친 것 · 줄자)
   *
   * 앞의 것은 두께가 폭의 0.33 인 **층층 더미**였다. 사진과 대보니:
   *   ① 접은 수건은 너비 1 : 세로 0.72 : **두께 0.066** 의 **납작한 판** — 쇼와 수건은 얇다(「生地薄」)
   *   ② 접힌 쪽 모서리는 둥글게 말리고, 반대쪽 끝은 **한 겹이 비어져 나온다**
   *   ③ 흰 바탕에 **큰 꽃 한 송이**, 긴 가장자리 안쪽에 **파란 실** 한 줄씩(`TILE.TOWEL`)
   * 치수는 너비 = 1 로 쓴다(접힌 쪽 −z).
   */
  수건: () => {
    const T = 0.066, D = 0.72;
    return assemble([
      part(new BoxGeometry(1.0, T * 0.9, D - T), WHITE, [0, T * 0.45, T / 2], undefined, TILE.TOWEL),
      // ② 접힌 쪽 — 둥글게 말린 등
      part(new CylinderGeometry(T * 0.45, T * 0.45, 0.99, 8), [0.92, 0.92, 0.90], [0, T * 0.45, -D / 2 + T / 2], [0, 0, Math.PI / 2]),
      // 비어져 나온 한 겹 — 반대쪽 끝 바닥에 얇게
      part(new BoxGeometry(0.97, T * 0.2, 0.06), [0.94, 0.94, 0.92], [0.005, T * 0.1, D / 2 + 0.03]),
    ]);
  },

  // ─── 아이 방 ─────────────────────────────────────────────────

  /**
   * 구슬 — **사진에서 잰 값으로 다시 만들었다.** 근거: `.design-bounce/ref/구슬/` (파란 심 유리구슬)
   *   ① 속이 비치는 **연한 회녹색 유리 공**
   *   ② 한가운데를 약 30° 비스듬히 가로지르는 **파란 잎 모양 심** — 길이는 지름의 0.85
   *   ③ 위쪽 1/4 에 비친 흐린 창 반사
   * 머티리얼이 불투명이라 심을 «안에» 넣으면 안 보인다(예전 기록). 구 겉면에 인쇄로 그린다.
   */
  구슬: () => assemble([
    part(new SphereGeometry(0.5, 16, 10), [0.80, 0.90, 0.80], [0, 0.5, 0], undefined, TILE.MARBLE),
    /**
     * ④ 윤곽선 — **4% 큰 구를 뒤집어** 뒤쪽 면만 남긴다. 앞쪽은 법선이 바깥을 등져 컬링되고, 뒤쪽 안면만
     * 구슬 둘레로 비어져 나와 짙은 테가 된다. 사진의 「윤곽을 한 바퀴 두르는 짙은 테두리선」(유리의 굴절 테)이고,
     * 두 번 「공」으로 읽힌 뒤(2026-09-16 묶음 4 1·2회차) 창 반사만으로는 모자라 넣었다
     */
    part(invert(new SphereGeometry(0.52, 12, 8)), [0.30, 0.38, 0.36], [0, 0.5, 0]),
    /**
     * ③ 창 반사 — **흰색보다 밝은 조각 둘.** 판정자가 「공」이라고 했다(2026-09-16). 인쇄의 흐린 창은
     * 곱셈이라 옅은 유리 위에서 흰색을 못 넘어 안 보였다. 구 겉면을 따라 휜 작은 조각을 1% 밖에
     * 얹고 `SHINE` 으로 칠한다 — 불투명한 이 엔진에서 «유리»를 말하는 건 이 번쩍임뿐이다.
     */
    // phi 는 +z(앞)·−x(왼쪽) 사이 — 시트 카메라가 앞 오른쪽 위에서 보므로 앞 왼쪽 위에 창이 비친다
    ...[[0.80, 0.20], [1.06, 0.14]].map(([phi, w]) =>
      part(new SphereGeometry(0.505, 3, 3, phi!, w!, 0.42, 0.30), SHINE, [0, 0.5, 0])),
  ]),

  /**
   * 장난감 블록(積み木) — **사진에서 잰 값으로 다시 만들었다.** 근거: `.design-bounce/ref/장난감 블록/`
   *
   * 앞의 것은 윗면에 돌기 넷이 달린 **조립 블록**이었다. 사진은 칠한 나무 쌓기나무다:
   *   ① 정육면체 둘을 이어 붙인 **2 : 1 : 1** 직육면체
   *   ② 모서리를 짧은 변의 0.03 만큼만 살짝 둥글린 도톰한 칠
   *   ③ 한 가지 원색을 온통 칠했다 — 면마다 밝기가 뚜렷이 갈린다(조명이 낸다)
   */
  '장난감 블록': () => assemble([
    part(soft(1.0, 0.5, 0.5, 0.06), WHITE, [0, 0.25, 0], undefined, TILE.WOOD_F),
  ]),

  /**
   * 딱지(멘코) — **사진에서 잰 값으로 다시 만들었다.** 근거: `.design-bounce/ref/딱지/` (쇼와 멘코 원형 · 네모)
   *
   * 앞의 것은 두꺼운 판에 접힌 결 둘을 얹은 «접는 딱지»였다. 사진의 멘코는 **얇게 찍은 판지**다:
   *   ① 원판 — 네모 딱지 가로의 약 1.3 배 지름. 두께는 판지 한 장
   *   ② 빨간 바탕에 노란 번개 테, **굵은 검은 윤곽의 인물 얼굴** 하나(인쇄)
   *   ③ 가장자리를 두르는 무지 황갈색 판지 테
   * 원형을 고른 건 같은 버킷의 화투(네모 패)와 실루엣으로도 갈리게 하려는 것이다.
   */
  딱지: () => assemble([
    part(new CylinderGeometry(0.5, 0.5, 0.03, 24), WHITE, [0, 0.015, 0], undefined, TILE.MENKO),
    part(new TorusGeometry(0.49, 0.012, 3, 24), [0.78, 0.62, 0.42], [0, 0.03, 0], [Math.PI / 2, 0, 0]),
  ]),

  /**
   * 공책(자포니카 학습장) — **사진에서 잰 값으로 다시 만들었다.** 근거: `.design-bounce/ref/공책/` (1981·1986년판 표지)
   *
   * 앞의 것은 두께 0.09 에 철끈 고리 넷을 단 스프링 노트였다. 사진은 실로 꿰맨 얇은 학습장이다:
   *   ① 가로 : 세로 = 1 : 1.41, 두께는 가로의 **0.017** — 얇은 판
   *   ② 남색 표지에 흰 이중선 둥근 틀과 그 위 0.58 을 채운 **곤충 컬러 사진**, 위 로고 띠, 아래 이름 칸(인쇄)
   * 철끈 고리는 사진에 없다 — 뺐다. 표지 인쇄가 색을 정하므로 팔레트는 흰색.
   */
  공책: () => assemble([
    part(new BoxGeometry(0.705, 0.024, 0.995), [1.35, 1.35, 1.30], [0.004, 0.012, 0], undefined, TILE.PAPER),
    part(new BoxGeometry(0.71, 0.004, 1.0), WHITE, [0, 0.026, 0], undefined, TILE.JAPONICA),
    part(new BoxGeometry(0.71, 0.004, 1.0), [0.20, 0.26, 0.55], [0, 0.002, 0]),
  ]),

  /**
   * 곰인형 — **사진에서 잰 값으로 다시 만들었다.** 근거: `.design-bounce/ref/곰인형/` (앉은 갈색 곰인형 정면)
   *
   * 앞의 것은 몸통 구 위에 작은 머리를 올린 «곰»이었다. 사진은 인형 비율이다:
   *   ① **머리가 전체 높이의 0.4**, 위 두 모서리에 머리 너비 0.34 짜리 반원 귀
   *   ② 머리 아래쪽 38% 에 머리 너비 0.46 짜리 **크림색 주둥이**와 짙은 갈색 코
   *   ③ 앞으로 뻗은 두 다리 끝에서 정면을 보는 **크림색 발바닥**(갈색 점 셋)
   *   ④ 목의 체크무늬 리본
   * 치수는 앉은 높이 = 1 로 쓴다(얼굴이 +x).
   */
  곰인형: () => {
    const CREAM: RGB = [1.25, 1.18, 1.02], BROWN: RGB = [0.30, 0.18, 0.12];
    const HEAD_Y = 0.78, HR = 0.215;
    return assemble([
      // 몸통 — 아래가 넓은 배 모양
      part(new SphereGeometry(0.5, 14, 9).scale(0.46, 0.52, 0.52), WHITE, [0, 0.33, 0], undefined, TILE.CLOTH),
      // ① 머리 · 귀
      part(new SphereGeometry(HR, 14, 9).scale(0.95, 0.92, 1.0), WHITE, [0.02, HEAD_Y, 0], undefined, TILE.CLOTH),
      ...([1, -1] as const).flatMap((s) => [
        part(new SphereGeometry(0.075, 10, 6).scale(0.6, 1, 1), WHITE, [0.0, HEAD_Y + 0.17, s * 0.17]),
        part(new SphereGeometry(0.048, 8, 5).scale(0.5, 1, 1), CREAM, [0.03, HEAD_Y + 0.165, s * 0.165]),
      ]),
      // ② 주둥이 · 코 · 눈
      part(new SphereGeometry(0.10, 10, 7).scale(0.7, 0.78, 1.0), CREAM, [0.19, HEAD_Y - 0.05, 0]),
      part(new SphereGeometry(0.03, 6, 4).scale(0.8, 0.7, 1.1), BROWN, [0.265, HEAD_Y - 0.02, 0]),
      ...([1, -1] as const).map((s) => part(new SphereGeometry(0.022, 6, 4), [0.12, 0.08, 0.06], [0.19, HEAD_Y + 0.04, s * 0.085])),
      // ④ 목 리본 — 체크무늬
      part(new BoxGeometry(0.05, 0.05, 0.14), [1.0, 0.35, 0.30], [0.19, HEAD_Y - 0.19, 0], undefined, TILE.CLOTH),
      // 팔 둘 — 옆으로 벌어져 앞을 향한다
      ...([1, -1] as const).map((s) =>
        part(new SphereGeometry(0.09, 10, 6).scale(1.0, 1.5, 0.9), WHITE, [0.06, 0.40, s * 0.24], [s * 0.4, 0, 0], TILE.CLOTH)),
      // ③ 다리 둘 — 앞으로 뻗고 끝에 크림색 발바닥
      ...([1, -1] as const).flatMap((s) => [
        part(new SphereGeometry(0.11, 10, 7).scale(1.6, 0.95, 1.0), WHITE, [0.15, 0.10, s * 0.14], undefined, TILE.CLOTH),
        part(new CylinderGeometry(0.075, 0.075, 0.01, 12), CREAM, [0.325, 0.10, s * 0.14], [0, 0, Math.PI / 2]),
        ...([[0.035, 0.0], [-0.02, 0.03], [-0.02, -0.03]] as const).map(([dy, dz]) =>
          part(new CylinderGeometry(0.017, 0.017, 0.008, 6), BROWN, [0.332, 0.10 + dy, s * 0.14 + dz], [0, 0, Math.PI / 2])),
      ]),
    ]);
  },
};
