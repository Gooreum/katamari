import './styles.css';
import { Game } from './game/Game';
import { Hud } from './ui/Hud';
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

  const canvas = document.getElementById('view') as HTMLCanvasElement;
  if (!canvas) throw new Error('#view 캔버스를 찾을 수 없습니다');

  let game: Game;
  try {
    game = new Game(canvas, new Hud(), city);
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
