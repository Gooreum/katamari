import {
  type BufferGeometry,
  Color, DirectionalLight, Group, HemisphereLight, Mesh, MeshLambertMaterial,
  OrthographicCamera, Scene, Vector3, WebGLRenderer,
} from 'three';
import {
  HOUSE_TABLE, TOWN_TABLE, WORLD_TABLE, PALETTE, SHAPE_COLOR, SHAPE_IDS,
} from './world/generation';
import { buildShapeGeometries } from './world/shapes';
import { buildPrintAtlas } from './world/atlas';

/**
 * 형태 검토용 미리보기. **dev 전용 페이지다** —
 * vite build 는 index.html 만 번들하므로 배포물에 들어가지 않는다.
 *
 * **왜 게임 안에서 안 보고 따로 만드는가:**
 * 인게임에서는 63종을 찾아다녀야 하고, 5cm 공 시점에서는 2.5m 전봇대가 화면을 통째로 덮는다.
 * 형태를 형태로 판단하려면 고정된 카메라와 균일한 크기가 필요하다.
 *
 * **왜 rAF 밖에서 한 번 그리는가:**
 * 브라우저가 배경 탭의 requestAnimationFrame 을 0프레임으로 조인다.
 * 화면 검증이 매번 여기서 막혔다. 첫 프레임을 rAF 밖에서 동기로 그리면
 * 숨은 탭에서도 캔버스에 픽셀이 남아 스크린샷이 찍힌다.
 *
 * 조명은 **게임과 똑같아야 한다.** 다른 조명으로 보여주면 인게임과 다른 그림을 승인받게 된다.
 */

const params = new URLSearchParams(location.search);

/**
 * **어느 라벨 표를 볼 것인가.** `?table=town` 이면 동네 맵 표.
 * 표가 스테이지마다 달라진 뒤로 집 표만 그리면 동네 형태 20종이 화면에 안 나온다.
 */
const TABLE = params.get('table') === 'town' ? TOWN_TABLE
  : params.get('table') === 'world' ? WORLD_TABLE
  : HOUSE_TABLE;
const BUCKETS = TABLE.buckets;

/** ?row=N (0~8) 이면 그 버킷만 크게 본다. 63개를 한 화면에 넣으면 하나하나가 너무 작다. */
const rowParam = params.get('row');
const parsed = rowParam === null ? NaN : Number(rowParam);
const rowFilter = Number.isInteger(parsed) && parsed >= 0 && parsed < BUCKETS.length
  ? parsed
  : null;

/** 크기 구간 이름. generation.ts 의 LABEL_BUCKETS 주석과 같은 값이다. */
/**
 * 줄 라벨은 **표의 경계에서 계산한다.**
 * 예전엔 집 표(1cm~1.2m) 기준으로 하드코딩돼 있어서, World 표(5cm~4m)를 봐도
 * "1~2cm"라고 찍혔다 — 눈으로 검수하는 화면이 거짓말을 하고 있었다.
 */
const fmtSize = (m: number): string =>
  m < 1 ? `${Math.round(m * 100)}cm` : `${m.toFixed(m < 10 ? 2 : 1)}m`;

const RANGES: readonly string[] = Array.from({ length: BUCKETS.length }, (_, i) => {
  const step = Math.log(TABLE.max / TABLE.min) / BUCKETS.length;
  return `${fmtSize(TABLE.min * Math.exp(step * i))}~${fmtSize(TABLE.min * Math.exp(step * (i + 1)))}`;
});

const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new Scene();
scene.background = new Color(0x87ceeb);
// Game.ts 와 같은 값. 여기 숫자를 바꾸려면 저기도 같이 바꿔야 한다.
scene.add(new HemisphereLight(0xffffff, 0x3a3524, 0.42));
const sun = new DirectionalLight(0xfff2d8, 2.35);
sun.position.set(1, 2.2, 1.4);
scene.add(sun);

const geometries = buildShapeGeometries();
/**
 * 이름 → 지오메트리.
 *
 * 예전엔 `geometries[bucket * COLS + col]` 로 찾았다. `SHAPE_IDS` 가 집 표의
 * 버킷 순서로 7개씩 정렬돼 있다는 전제였는데, 라벨 표가 스테이지마다 달라진
 * 뒤로는 성립하지 않는다 — 동네 표는 기존 형태를 재사용하고 줄 길이도 다르다.
 */
/** 인쇄 아틀라스. 형태마다 만들면 텍스처가 88장 생긴다 — 한 장을 공유한다. */
const atlas = buildPrintAtlas();

const byName = new Map<string, BufferGeometry>(SHAPE_IDS.map((id, i) => [id, geometries[i]!]));
const rows = rowFilter === null
  ? Array.from({ length: BUCKETS.length }, (_, i) => i)
  : [rowFilter];

/**
 * 화면에 담아야 할 **가장 긴 줄의 종 수.**
 *
 * 예전엔 7 고정이었다. 집 표의 모든 줄이 정확히 7종이던 시절의 값인데,
 * 방 정체성 물건 16종이 들어오면서 15~30cm 줄이 14종이 됐다.
 * 고정값으로 두면 카메라 프레임이 좁아서 **양 끝 물건이 화면 밖으로 잘린다** —
 * 검토용 화면에서 물체가 사라지는 건 이 파일이 `FIT` 주석에 이미 적어둔 함정이다.
 */
const COLS = Math.max(...rows.map((i) => BUCKETS[i]!.length));

const SPACING = 1.6;
/** 줄 간격. 물체 높이가 1이므로 1.5면 위아래가 안 겹친다. */
const ROW_GAP = 1.5;

const turntables: Group[] = [];

rows.forEach((bucket, rowIndex) => {
  const y = -(rowIndex - (rows.length - 1) / 2) * ROW_GAP;

  const names = BUCKETS[bucket]!;
  for (let col = 0; col < names.length; col++) {
    const geo = byName.get(names[col]!);
    if (!geo) continue;
    const x = (col - (names.length - 1) / 2) * SPACING;

    const mesh = new Mesh(
      geo,
      // 게임과 같은 머티리얼 구성. vertexColors 가 켜져 있어야 정점색이 계수로 곱해진다.
      // 색은 그 형태에 **실제로 배정된 색**을 쓴다 (여러 색이면 첫 번째).
      // 예전에는 열 번호로 돌렸는데, 그러면 미리보기를 봐도 게임과 다른 색이라
      // 색 검수 자체가 성립하지 않는다.
      //
      // **인쇄 아틀라스도 같이 물린다.** 안 물리면 인쇄를 받은 형태가 여기서만
      // 민짜로 보여서 「게임과 같은 구성」이라는 위 주석이 거짓말이 된다.
      new MeshLambertMaterial({
        color: PALETTE[SHAPE_COLOR[names[col]!]?.[0] ?? 0]!,
        // 게임과 같은 음영이어야 한다 — 여기만 평면 음영이면 검수가 거짓말이 된다
        vertexColors: true,
        map: atlas,
      }),
    );
    // 지오메트리 바닥이 y=-0.5 이므로 0.5 올리면 발이 줄 기준선에 닿는다
    mesh.position.y = 0.5;

    const turntable = new Group();
    turntable.position.set(x, y, 0);
    // 3/4 뷰는 **카메라가 아니라 물체를 돌려서** 만든다.
    // 카메라에 yaw를 주면 직교 투영이어도 월드 X가 화면 X로 그대로 안 간다 —
    // 물체가 화면 밖으로 밀려나고 HTML 라벨도 어긋난다. 직접 겪었다.
    turntable.rotation.y = 0.6;
    turntable.add(mesh);
    scene.add(turntable);
    turntables.push(turntable);
  }
});

/**
 * 화면에서 내용이 차지할 비율.
 *
 * 스크린샷 도구가 뷰포트 전체가 아니라 **좌상단 80%×80%** 만 잘라 담는다(실측).
 * 가운데 정렬을 유지하면서 62%만 쓰면 20~81% 구간에 놓여 캡처에 다 들어오고,
 * 사람이 브라우저로 봐도 여백만 넉넉할 뿐 어색하지 않다.
 * 가장자리까지 채우면 검토용 그림에서 물체가 사라진다 — 실제로 승용차와 아래 두 줄이 잘렸다.
 */
const FIT = 0.62;

/**
 * 카메라는 yaw 없이 **아래로만** 기울인다. 그래야 화면 X가 월드 X에 정확히 비례하고
 * HTML 라벨을 화면 좌표로 정확히 맞출 수 있다.
 */
const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
camera.position.set(0, 2.6, 40);
camera.lookAt(0, 0.15, 0);

function resize(): void {
  const w = innerWidth;
  const h = innerHeight;
  // 내용 크기 (월드 단위). 물체 높이가 1이므로 줄 수 × 간격 + 여유.
  const contentW = COLS * SPACING + SPACING;
  const contentH = rows.length * ROW_GAP + 1.4;
  // 가로·세로 각각 FIT 비율에 맞추고 둘 중 큰 쪽을 쓴다 — 작은 쪽을 쓰면 반대 축이 넘친다.
  const halfW = Math.max(
    contentW / (2 * FIT),
    (contentH / (2 * FIT)) * (w / h),
  );
  camera.left = -halfW;
  camera.right = halfW;
  camera.top = halfW * (h / w);
  camera.bottom = -halfW * (h / w);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

const PROBE = new Vector3();

/** 월드 좌표를 화면 픽셀로. 라벨을 눈대중 %로 두면 종횡비가 바뀔 때마다 어긋난다. */
function project(worldX: number, worldY: number): { x: number; y: number } {
  camera.updateMatrixWorld(true);
  const v = PROBE.set(worldX, worldY, 0).project(camera);
  return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
}

/**
 * 라벨 배치.
 * - 한 줄 보기(`?row=N`): 물체 아래에 7종 이름
 * - 전체 보기: 줄마다 왼쪽에 크기 구간
 */
function layoutLabels(): void {
  const labels = document.getElementById('labels')!;
  const sideLabels = document.getElementById('rows')!;
  labels.textContent = '';
  sideLabels.textContent = '';

  if (rowFilter !== null) {
    const half = ((COLS - 1) / 2) * SPACING + SPACING / 2;
    const left = project(-half, 0).x;
    const right = project(half, 0).x;
    labels.style.left = `${left}px`;
    labels.style.width = `${right - left}px`;
    labels.style.top = `${project(0, -0.55).y + 10}px`;
    for (const name of BUCKETS[rowFilter]!) {
      const d = document.createElement('div');
      d.textContent = name;
      labels.appendChild(d);
    }
    return;
  }

  rows.forEach((bucket, rowIndex) => {
    const y = -(rowIndex - (rows.length - 1) / 2) * ROW_GAP;
    const d = document.createElement('div');
    d.className = 'rowlabel';
    d.textContent = RANGES[bucket]!;
    d.style.top = `${project(0, y).y - 8}px`;
    sideLabels.appendChild(d);
  });
}

resize();
layoutLabels();
addEventListener('resize', () => { resize(); layoutLabels(); });

const title = document.getElementById('title');
if (title) {
  title.textContent = rowFilter === null
    ? `형태 ${SHAPE_IDS.length}종 · 줄 = 크기 구간 · ?row=0~8 로 한 줄 확대`
    : `${RANGES[rowFilter]} · ${BUCKETS[rowFilter]!.length}종 · 조명은 게임과 동일`;
}

// ─── 첫 프레임: rAF 밖에서 동기로. 배경 탭에서도 픽셀이 남는다 ───
renderer.render(scene, camera);
console.log(`[shapes] ${turntables.length}개 렌더 (${rows.length}줄) · 첫 프레임 동기 완료`);

// ─── 이후 회전. 보이는 탭에서만 의미가 있다 ───
let t = 0;
function frame(): void {
  t += 0.006;
  for (const g of turntables) g.rotation.y = t;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
