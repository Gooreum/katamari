import {
  BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { ShapeIdMid } from './generation';
import { assemble, hollow, DARK, GLASS, METAL, PAPER, part, WHITE, WOOD, soft, lip,
} from './shapes.kit';
import { TILE } from './atlas';

const LIE_X: readonly [number, number, number] = [0, 0, Math.PI / 2];
const LIE_Z: readonly [number, number, number] = [Math.PI / 2, 0, 0];

/**
 * 버킷 3~5 (8~60cm) 형태 — 원작 타케다 저택 물건.
 *
 * 이 구간이 **화면에서 제일 오래 보인다.** 공이 8cm를 넘긴 뒤부터 30cm까지가
 * 집 맵 플레이의 대부분이고, 그때 눈높이에 있는 게 이 21종이다.
 * 그래서 작은 것들보다 부품을 한두 개 더 쓴다 — 손잡이, 뚜껑, 다리 같은 것.
 */
export const MID_BUILDERS: Record<ShapeIdMid, () => BufferGeometry> = {
  // ─── 버킷 3 (8~15cm) ─────────────────────────────────────────

  소시지: () => assemble([
    // 양끝이 묶인 원기둥. 끝을 원뿔로 막아야 소시지가 된다 (8.3cm)
    part(new CylinderGeometry(0.22, 0.22, 0.66, 14), WHITE, [0, 0.22, 0], LIE_X),
    part(new SphereGeometry(0.22, 12, 8), WHITE, [0.33, 0.22, 0]),
    part(new SphereGeometry(0.22, 12, 8), WHITE, [-0.33, 0.22, 0]),
    part(new CylinderGeometry(0.06, 0.06, 0.10, 6), PAPER, [0.47, 0.22, 0], LIE_X),
  ]),

  껌: () => assemble([
    // 은박에 싸인 판형 껌 (8.5cm)
    part(soft(0.90, 0.10, 0.32, 0.3), WHITE, [0, 0.05, 0]),
    part(soft(0.62, 0.11, 0.33, 0.3), WHITE, [0.10, 0.05, 0], undefined, TILE.GUM),
    part(soft(0.10, 0.09, 0.30, 0.3), PAPER, [-0.44, 0.05, 0]),
  ]),

  달팽이: () => assemble([
    // 껍데기(토러스 두 겹) + 몸통 + 더듬이. 원작 마당의 9.8cm
    part(new TorusGeometry(0.24, 0.13, 5, 14), WHITE, [0.06, 0.32, 0], LIE_Z),
    part(new TorusGeometry(0.11, 0.09, 4, 9), WHITE, [0.06, 0.32, 0], LIE_Z),
    part(new SphereGeometry(0.14, 12, 8), [0.72, 0.66, 0.5], [-0.28, 0.14, 0]),
    part(soft(0.44, 0.14, 0.20, 0.45), [0.72, 0.66, 0.5], [-0.12, 0.07, 0]),
    part(new CylinderGeometry(0.02, 0.02, 0.18, 6), [0.72, 0.66, 0.5], [-0.34, 0.26, 0.06], [0, 0, 0.35]),
    part(new CylinderGeometry(0.02, 0.02, 0.18, 6), [0.72, 0.66, 0.5], [-0.34, 0.26, -0.06], [0, 0, 0.35]),
  ]),

  '캐러멜 상자': () => assemble([
    // 세워둔 갑 (11.3cm). 뚜껑 단이 있어야 상자가 아니라 캐러멜 갑이다
    part(soft(0.44, 0.90, 0.24, 0.16), WHITE, [0, 0.45, 0], undefined, TILE.CARAMEL),
    part(soft(0.46, 0.16, 0.26, 0.2), PAPER, [0, 0.82, 0]),
    part(new BoxGeometry(0.40, 0.34, 0.02), [0.85, 0.45, 0.15], [0, 0.42, 0.13]),
  ]),

  사과: () => assemble([
    part(new SphereGeometry(0.46, 16, 10), WHITE, [0, 0.44, 0]),
    // 꼭지가 파인 자리. 구만 두면 공이지 사과가 아니다
    part(new CylinderGeometry(0.035, 0.03, 0.22, 6), WOOD, [0, 0.90, 0], [0, 0, 0.16]),
    part(new BoxGeometry(0.22, 0.02, 0.12), [0.35, 0.55, 0.25], [0.14, 0.92, 0], [0, 0.3, 0.2]),
  ]),

  /**
   * 찻잔 (10cm). **속이 파여 있어야 컵이다** — 통짜 원기둥은 덩어리다.
   *
   * 화면으로 두 번 고쳤다. 처음엔 **받침이 컵보다 커서 비행접시로 보였고**
   * (받침 지름 0.80, 컵 높이 0.44 — `normalize()` 가 받침을 최장축으로 잡아 컵을
   * 55%로 눌렀다), 받침을 줄였더니 이번엔 폭이 컵과 같아져 **챙 넓은 모자**가 됐다.
   * 유노미는 원래 **손잡이가 없고 세로로 길다** — 그렇게 세우니 컵으로 읽힌다.
   */
  찻잔: () => assemble([
    // 유노미 몸통. **세로가 길어야 컵이다** — 받침과 폭이 같으면 챙 넓은 모자가 된다
    ...hollow(0.26, 0.19, 0.72, 0.03, 0.055, 20, WHITE, [0.88, 0.86, 0.80], TILE.TEACUP),
    // 담긴 차. **안이 보여야 판 게 보인다** — 캐비티 바닥보다 위, 테두리보다 아래
    part(new CylinderGeometry(0.222, 0.222, 0.01, 20), [0.40, 0.30, 0.15], [0, 0.52, 0]),
    // 받침 — 얕게 파서 접시로 읽히게. 컵보다 넓지만 아주 얇다
    part(new CylinderGeometry(0.33, 0.31, 0.028, 20), WHITE, [0, 0.014, 0]),
    part(new TorusGeometry(0.315, 0.016, 5, 20), WHITE, [0, 0.028, 0], LIE_Z),
  ]),

  전구: () => assemble([
    part(new SphereGeometry(0.36, 16, 10), GLASS, [0, 0.52, 0]),
    // 목 + 나사 소켓. 소켓이 없으면 그냥 유리공이다
    part(new CylinderGeometry(0.16, 0.24, 0.16, 14), GLASS, [0, 0.20, 0]),
    part(new CylinderGeometry(0.15, 0.15, 0.22, 14), METAL, [0, 0.11, 0]),
    part(new SphereGeometry(0.06, 6, 4), DARK, [0, 0.02, 0]),
  ]),

  // ─── 버킷 4 (15~30cm) ────────────────────────────────────────

  찌라시: () => assemble([
    // 바닥에 떨어져 살짝 휜 낱장 (16.8cm). 각도가 다른 판 셋이면 '버려진' 게 된다
    // **완전 평면은 공 눈높이에서 선 한 줄이다.** 종이는 실제로 바닥에 딱 안 붙는다 —
    // 모서리가 말려 올라간다. 낱장을 기울여 «면»이 보이게 한다
    part(new BoxGeometry(0.94, 0.014, 0.68), WHITE, [0, 0.012, 0], [0.05, 0, 0.03], TILE.FLYER),
    part(new BoxGeometry(0.60, 0.014, 0.52), WHITE, [0.16, 0.06, 0.06], [0.22, 0.2, 0.10], TILE.FLYER),
    part(new BoxGeometry(0.34, 0.014, 0.30), [0.85, 0.3, 0.25], [-0.26, 0.05, -0.14], [-0.30, -0.4, 0.14]),
  ]),

  신문: () => assemble([
    // 접어서 쌓아둔 신문 (21.5cm). 층이 보여야 한 장이 아니라 신문이다
    part(new BoxGeometry(0.92, 0.10, 0.62), WHITE, [0, 0.05, 0]),
    part(new BoxGeometry(0.88, 0.08, 0.58), PAPER, [0.02, 0.13, 0.01], [0, 0.05, 0]),
    part(new BoxGeometry(0.84, 0.06, 0.54), WHITE, [-0.02, 0.19, -0.01], [0, -0.04, 0], TILE.NEWSPAPER),
    // 접힌 등
    part(new CylinderGeometry(0.05, 0.05, 0.62, 6), PAPER, [-0.44, 0.10, 0], LIE_Z),
    part(new BoxGeometry(0.50, 0.02, 0.10), DARK, [0.10, 0.23, 0.10]),
  ]),

  연필깎이: () => assemble([
    // 손잡이 달린 탁상형 (26.2cm). 원작 아이 방에 있다
    part(soft(0.60, 0.46, 0.44, 0.18), WHITE, [0, 0.23, 0], undefined, TILE.SHARPENER),
    part(soft(0.66, 0.12, 0.50, 0.3), DARK, [0, 0.06, 0]),
    // 연필 꽂는 구멍
    part(new CylinderGeometry(0.09, 0.09, 0.10, 8), DARK, [-0.32, 0.30, 0], LIE_X),
    // 크랭크 손잡이
    part(new CylinderGeometry(0.05, 0.05, 0.20, 7), METAL, [0.34, 0.30, 0], LIE_X),
    part(soft(0.05, 0.30, 0.05, 0.3), METAL, [0.44, 0.38, 0]),
    part(new CylinderGeometry(0.07, 0.07, 0.12, 7), WOOD, [0.44, 0.52, 0], LIE_X),
  ]),

  'RC 컨트롤러': () => assemble([
    // 안테나 세운 조종기 (30.1cm). 안테나가 실루엣의 전부다
    part(soft(0.56, 0.30, 0.40, 0.2), WHITE, [0, 0.15, 0]),
    part(soft(0.60, 0.08, 0.44, 0.25), WHITE, [0, 0.29, 0], undefined, TILE.RC),
    part(new CylinderGeometry(0.10, 0.10, 0.06, 8), DARK, [-0.16, 0.35, 0]),
    part(new CylinderGeometry(0.10, 0.10, 0.06, 8), DARK, [0.16, 0.35, 0]),
    part(new CylinderGeometry(0.03, 0.02, 0.58, 6), METAL, [0.24, 0.62, -0.12]),
    part(new SphereGeometry(0.035, 6, 4), [0.9, 0.3, 0.2], [0.24, 0.92, -0.12]),
  ]),

  접시: () => assemble([
    // **얕은 웅덩이가 접시의 정체다.** 원반은 코스터고, 깊이 파면 사발이 된다
    ...hollow(0.50, 0.38, 0.15, 0.045, 0.055, 20, WHITE, [0.90, 0.92, 0.96], TILE.PLATE),
    // 굽 — 접시를 살짝 띄운다
    part(new CylinderGeometry(0.24, 0.26, 0.05, 16), WHITE, [0, 0.025, 0]),
    // 청색 테두리 — 흰 원반을 «접시»로 만드는 건 이 띠다
    part(new TorusGeometry(0.475, 0.022, 5, 20), [0.55, 0.62, 0.75], [0, 0.14, 0], LIE_Z),
  ]),

  슬리퍼: () => assemble([
    // 밑창 + 발등 띠. 실내 슬리퍼라 뒤가 트여 있다.
    //
    // 앞뒤를 원기둥으로 둥글렸더니 그 원기둥이 옆에서 큰 원반으로 보여서
    // **아령처럼** 나왔다. 둥글리는 건 발가락 쪽만, 그것도 납작한 원기둥으로 한다.
    part(soft(0.74, 0.09, 0.34, 0.4), WHITE, [-0.05, 0.045, 0]),
    part(new CylinderGeometry(0.17, 0.17, 0.09, 14), WHITE, [0.32, 0.045, 0]),
    // 발등 띠 — 폭 방향으로 걸친 아치. 축이 X여야 발등을 덮는다
    part(new TorusGeometry(0.17, 0.045, 4, 10, Math.PI), WHITE, [0.16, 0.08, 0], [0, 0, 0]),
    part(new BoxGeometry(0.20, 0.04, 0.34), WHITE, [0.16, 0.24, 0]),
  ]),

  우유팩: () => assemble([
    // 1L 게이블탑 (19.5cm). **지붕 경사가 없으면 그냥 상자다** — 원작 거실에서
    // 이 실루엣과 소 그림 인쇄가 우유팩을 우유팩으로 만든다.
    part(soft(0.46, 0.66, 0.46, 0.1), WHITE, [0, 0.33, 0], undefined, TILE.MILK),
    // **지붕에는 인쇄를 안 넣는다.** 넣었더니 색 띠가 몸통 위에 한 번 더 나와서
    // 팩이 두 칸으로 잘려 보였다. 인쇄는 몸통 한 벌이면 충분하다.
    part(new BoxGeometry(0.46, 0.26, 0.24), WHITE, [0, 0.76, 0.11], [0.7, 0, 0]),
    part(new BoxGeometry(0.46, 0.26, 0.24), WHITE, [0, 0.76, -0.11], [-0.7, 0, 0]),
    // 접힌 마루. 지붕 둘이 만나는 자리를 덮어야 틈이 안 보인다
    part(new BoxGeometry(0.46, 0.10, 0.04), PAPER, [0, 0.91, 0]),
  ]),

  '두루마리 휴지': () => assemble([
    part(new CylinderGeometry(0.42, 0.42, 0.52, 20), WHITE, [0, 0.26, 0]),
    // 심지 구멍. 어두운 안쪽이 보여야 두루마리다
    part(new CylinderGeometry(0.13, 0.13, 0.56, 14), [0.55, 0.48, 0.38], [0, 0.26, 0]),
    // 풀린 자락
    part(new BoxGeometry(0.02, 0.34, 0.44), PAPER, [0.42, 0.17, 0], [0, 0, -0.12]),
  ]),

  // ─── 버킷 5 (30~60cm) ────────────────────────────────────────

  /**
   * 네모 방석 — 자부톤 (40cm).
   *
   * **직육면체 둘을 포갠 웨딩케이크였다.** 스폰 정면에 넷이 상을 둘러싸고 있어서
   * 「너무 각져 보인다」의 첫 번째 증거물이 이것이다. 화면에서는 모서리가 칼처럼
   * 선 콘크리트 블록이었다.
   *
   * 방석은 속에 솜이 든 물건이라 **모서리가 없고 가운데가 부푼다** — 그 둘이
   * 방석의 전부다. 위 판을 「더 작은 상자」로 얹던 걸 «눌린 구»로 바꾼 게 부픔이고,
   * 모따기를 최대(0.45)로 준 게 모서리다. 둘 중 하나만 하면 여전히
   * 「모서리 둥근 블록」에서 못 벗어난다.
   */
  방석: () => assemble([
    part(soft(0.92, 0.19, 0.92, 0.45), WHITE, [0, 0.095, 0]),
    // 솜의 부픔 — 눌린 구.
    //
    // **밑면 밖으로 나가면 안 된다.** 처음엔 0.34 로 눌러서 구의 아래가 몸통 바닥보다
    // 2cm 내려갔고, 그러면 `normalize()` 가 그 «돔의 밑»을 y=−0.5 로 잡아서
    // 방석이 바닥에서 2cm 뜬 채로 놓인다. 검사가 두께비 0.320 으로 잡았다.
    part(new SphereGeometry(0.44, 14, 8).scale(1, 0.22, 1), WHITE, [0, 0.115, 0]),
    // 시접 — 옆구리를 한 바퀴 도는 띠. 「천을 꿰맸다」가 여기서 나온다
    part(new TorusGeometry(0.44, 0.022, 5, 18), PAPER, [0, 0.085, 0], LIE_Z),
    part(new SphereGeometry(0.05, 6, 5), PAPER, [0.42, 0.06, 0.42]),
    part(new SphereGeometry(0.05, 6, 5), PAPER, [-0.42, 0.06, 0.42]),
    part(new SphereGeometry(0.05, 6, 5), PAPER, [0.42, 0.06, -0.42]),
    part(new SphereGeometry(0.05, 6, 5), PAPER, [-0.42, 0.06, -0.42]),
  ]),

  백팩: () => assemble([
    // 원작 아이 방의 란도셀. 뚜껑과 어깨끈이 실루엣이다
    part(soft(0.62, 0.72, 0.40, 0.3), WHITE, [0, 0.36, 0]),
    part(soft(0.64, 0.30, 0.42, 0.3), WHITE, [0, 0.62, 0.02]),
    part(soft(0.16, 0.08, 0.06, 0.3), METAL, [0, 0.48, 0.22]),
    // 어깨끈
    part(new TorusGeometry(0.20, 0.045, 4, 9, Math.PI), WHITE, [0.18, 0.44, -0.20], [0, 0, 0]),
    part(new TorusGeometry(0.20, 0.045, 4, 9, Math.PI), WHITE, [-0.18, 0.44, -0.20], [0, 0, 0]),
  ]),

  휴지통: () => assemble([
    // **진짜로 판다.** 예전엔 어두운 원반을 위에 얹어 「비어 있는 척」만 했다
    ...hollow(0.42, 0.32, 0.80, 0.03, 0.05, 20, WHITE, [0.34, 0.36, 0.40]),
    // 구겨진 종이 한 덩이 — 통 «안»이 보인다는 걸 확실히 한다
    part(new SphereGeometry(0.16, 10, 7), PAPER, [0.06, 0.20, -0.04]),
  ]),

  전화기: () => assemble([
    // 다이얼식 탁상 전화. 원작 복도에 있는 그 검은 것
    part(soft(0.80, 0.24, 0.56, 0.25), WHITE, [0, 0.12, 0]),
    part(new CylinderGeometry(0.24, 0.24, 0.06, 14), DARK, [0, 0.26, -0.06]),
    part(new CylinderGeometry(0.09, 0.09, 0.08, 8), WHITE, [0, 0.30, -0.06]),
    // 수화기 — 가운데 잘록한 막대
    part(soft(0.66, 0.14, 0.14, 0.35), WHITE, [0, 0.31, 0.20]),
    part(soft(0.20, 0.20, 0.20, 0.3), WHITE, [0.30, 0.34, 0.20]),
    part(soft(0.20, 0.20, 0.20, 0.3), WHITE, [-0.30, 0.34, 0.20]),
  ]),

  밥솥: () => assemble([
    part(new CylinderGeometry(0.44, 0.44, 0.52, 20), WHITE, [0, 0.28, 0]),
    // 뚜껑 + 손잡이 + 김 구멍
    part(new CylinderGeometry(0.46, 0.44, 0.14, 20), WHITE, [0, 0.60, 0]),
    part(new CylinderGeometry(0.10, 0.10, 0.10, 8), DARK, [0, 0.71, 0]),
    part(soft(0.16, 0.10, 0.10, 0.3), DARK, [0.46, 0.34, 0]),
    part(soft(0.16, 0.10, 0.10, 0.3), DARK, [-0.46, 0.34, 0]),
    part(new BoxGeometry(0.30, 0.10, 0.02), DARK, [0, 0.30, 0.44]),
  ]),

  화분: () => assemble([
    // 뒷마당의 토마토 화분. 흙과 줄기가 있어야 화분이다.
    // **파야 흙이 «담긴» 것으로 보인다** — 통짜 위에 얹은 흙은 뚜껑이다
    ...hollow(0.38, 0.28, 0.52, 0.035, 0.06, 20, WHITE, [0.42, 0.30, 0.22]),
    part(new CylinderGeometry(0.33, 0.33, 0.04, 20), [0.28, 0.22, 0.16], [0, 0.40, 0]),
    part(new CylinderGeometry(0.03, 0.025, 0.44, 6), [0.35, 0.55, 0.25], [0, 0.64, 0]),
    part(new SphereGeometry(0.13, 12, 8), [0.35, 0.55, 0.25], [0.06, 0.84, 0]),
  ]),

  /**
   * 주전자. **뚜껑이 몸통보다 넓게 얹혀 턱이 진다.**
   *
   * 예전엔 몸통 위 반지름과 뚜껑 아래 반지름이 **똑같이 0.36** 이었다. 20면짜리라
   * 이미 충분히 둥근데도 화면에서 몸통과 뚜껑이 «하나의 녹은 돔»으로 보인 이유가
   * 그것이다 — 같은 반지름으로 만나면 기하학적으로 한 연속면이고,
   * `flatShading` 이 꺼진 이 씬에서는 그 자리에 아무 선도 안 생긴다.
   * 면 수를 올려도 안 고쳐진다. 필요한 건 **경계**다.
   */
  주전자: () => assemble([
    part(new CylinderGeometry(0.36, 0.40, 0.44, 20), WHITE, [0, 0.24, 0]),
    // 테 — 여기서 그림자가 한 줄 생긴다. 이 한 조각이 「부품이 둘이다」를 말한다
    part(lip(0.36, 0.035, 20), WHITE, [0, 0.4775, 0]),
    part(new CylinderGeometry(0.28, 0.34, 0.11, 20), WHITE, [0, 0.55, 0]),
    part(new CylinderGeometry(0.07, 0.07, 0.08, 12), DARK, [0, 0.645, 0]),
    // 주둥이 — 이게 없으면 냄비다
    part(new CylinderGeometry(0.05, 0.09, 0.34, 10), WHITE, [0.36, 0.40, 0], [0, 0, -0.9]),
    // 손잡이
    part(new TorusGeometry(0.30, 0.035, 4, 10, Math.PI), METAL, [0, 0.54, 0], [0, Math.PI / 2, 0]),
  ]),
};
