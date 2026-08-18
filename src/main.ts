import './styles.css';
import { Game } from './game/Game';
import { Hud } from './ui/Hud';
import { HOUSE_STAGES, stageFromSlug, stageSearch, type StageNav } from './game/Stage';
import { loadCleared } from './game/Progress';
import { StageSelect } from './ui/StageSelect';
import { KING } from './narrative/script.king';
import type { CityData } from './world/cityData';

/**
 * 지역 데이터는 동적 import로 가져온다 — 실제 OSM 데이터는 수 MB라
 * 번들에 넣으면 초기 로딩이 무거워진다.
 * ?district=jamsil 로 OSM 실측 도시로 바꿀 수 있다.
 */
// JSON import는 구조적으로 추론되어 튜플 타입([number, number])과 안 맞는다.
// 스키마는 도구가 보장하므로 여기서는 단언한다.
const DISTRICTS: Record<string, () => Promise<{ default: unknown }>> = {
  // 기본. 원작 타케다 저택 1층 — 코드로 만들어서 수십 KB밖에 안 든다
  house: () => import('./world/stage.house').then((m) => ({ default: m.buildHouseStage() })),
  // OSM 실측 잠실. 기본에서 뺐지만 지운 건 아니다 (2.9MB, 동적 import라 안 부르면 안 받는다)
  jamsil: () => import('./world/city.jamsil.json'),
};

/**
 * 판 전환은 **리로드**다 (`StageNav` 주석 참고).
 * 같은 URL로 이동하는 경우(다시하기)는 브라우저가 무시할 수 있어 명시적으로 리로드한다.
 */
function navigate(id: string | null): void {
  const search = stageSearch(location.search, id);
  if (search === location.search) location.reload();
  else location.href = `${location.pathname}${search}`;
}

const nav: StageNav = {
  go: (rule) => navigate(rule.id),
  select: () => navigate(null),
};

function fatal(stage: string, err: unknown): void {
  const el = document.createElement('pre');
  el.className = 'fatal';
  el.textContent = `부팅 실패 (${stage})\n\n${err instanceof Error ? err.stack ?? err.message : String(err)}`;
  document.body.appendChild(el);
  console.error(`[boot] ${stage} 실패`, err);
}

addEventListener('error', (e) => fatal('런타임', e.error ?? e.message));
addEventListener('unhandledrejection', (e) => fatal('Promise', e.reason));

async function boot(): Promise<void> {
  const mark = (s: string) => console.log(`[boot] ${s} ${performance.now().toFixed(0)}ms`);
  mark('시작');
  const params = new URLSearchParams(location.search);
  const slug = params.get('district') ?? 'house';

  /**
   * **`?stage`가 없으면 선택 화면부터.** 원작도 왕의 방에서 별을 고르고 내려간다.
   *
   * 지형 로드보다 **먼저** 온다 — 고르기만 할 화면에 잠실 2.9MB를 받을 이유가 없다.
   * `?stage=star1`이 붙어 있으면 통째로 건너뛴다. 도구·e2e·판 전환이 그 문으로 들어온다.
   */
  if (params.get('stage') === null) {
    new StageSelect().show(HOUSE_STAGES, loadCleared(), KING.select, (rule) => nav.go(rule));
    mark('스테이지 선택');
    return;
  }

  // ?nocity=1 로 지형을 빼고 띄울 수 있다 — 문제 범위를 좁힐 때 쓴다
  let city: CityData | null = null;
  if (!params.has('nocity')) {
    try {
      const loader = DISTRICTS[slug] ?? DISTRICTS['house']!;
      city = (await loader()).default as CityData;
      mark(`지형 로드 (건물 ${city.buildings.length}채)`);
    } catch (err) {
      console.warn('[boot] 지형 데이터를 못 읽었습니다.', err);
    }
  }

  // **OSM 표기는 OSM을 쓸 때만 단다.** ODbL이 요구하는 건 실제로 그 데이터를
  // 쓸 때고, 손배치 스테이지에 붙여두면 그냥 거짓말이다.
  const credit = document.getElementById('credit');
  if (credit) credit.textContent = slug === 'house' ? '' : '지형 © OpenStreetMap contributors';

  const canvas = document.getElementById('view') as HTMLCanvasElement;
  if (!canvas) throw new Error('#view 캔버스를 찾을 수 없습니다');

  let game: Game;
  try {
    // 여기까지 왔다는 건 ?stage 가 있다는 뜻이다 (없으면 위에서 선택 화면으로 빠진다).
    // 모르는 슬러그는 기존대로 1번으로 떨어진다.
    const rule = stageFromSlug(params.get('stage'));
    game = new Game(canvas, new Hud(), city, rule);
    mark('Game 생성');
  } catch (err) {
    fatal('Game 생성', err);
    return;
  }
  game.start();
  mark('첫 프레임');
}

boot().catch((err) => fatal('boot', err));

addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') location.reload();
});
