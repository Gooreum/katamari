/**
 * 판 부팅 검사 — 여덟 판을 헤드리스로 띄워 **끝까지 지어지는지**만 본다.
 *
 * `shapecheck` 는 형태를 «지어 보고» 재지만, 판을 실제로 띄우지는 않는다.
 * 그래서 형태가 아니라 **배치·생성 쪽에서 나는 예외**(스테이지 표에 없는 이름,
 * 바닥을 못 찾는 손배치, 인쇄 칸 번호가 아틀라스 밖)는 shapecheck 를 통과한다.
 * 실제로 146종을 다시 만드는 동안 그런 것들이 두 번 났다.
 *
 * 판마다 `shot.mjs` 로 붙어 콘솔 로그를 받고 두 가지만 본다:
 *   ① `EXCEPTION` 이 한 줄도 없을 것
 *   ② 부팅 로그가 **「첫 프레임」** 까지 갈 것 (그 앞에서 멈추면 짓다가 걸린 것이다)
 *
 *   node tools/bootcheck.mjs [베이스URL]
 *
 * 개발 서버가 떠 있어야 한다. 촬영(`intent-sheet.mjs`)과 **같이 돌리면 안 된다** —
 * 둘 다 CDP 포트 9333 을 쓴다.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:5174';
const STAGES = ['star1', 'star2', 'star3', 'star4', 'star5', 'star6', 'star7', 'star8'];
const TMP = mkdtempSync(join(tmpdir(), 'bootcheck-'));

let bad = 0;
for (const stage of STAGES) {
  const out = join(TMP, `${stage}.png`);
  let log = '';
  try {
    log = execFileSync('node', [
      new URL('shot.mjs', import.meta.url).pathname,
      // **20 초를 기다린다.** 집 판(star4)은 손배치 가구가 많아 이 기계에서 첫 프레임까지
      // 29~47 초가 걸렸다 — 6 초로 잡았더니 아직 짓는 중에 캡처가 들어가 실패로 찍혔다.
      `${BASE}/?stage=${stage}`, out, '20000', '900', '600',
    ], { encoding: 'utf8', env: { ...process.env, WARMUP: '8', SHOT_TIMEOUT_MS: '300000' } });
  } catch (e) {
    console.log(`❌ ${stage} — 촬영 자체가 실패했다\n${String(e.stdout ?? '')}${String(e.stderr ?? '')}`);
    bad++;
    continue;
  }
  const ex = log.split('\n').filter((l) => l.includes('EXCEPTION'));
  const framed = log.includes('첫 프레임');
  if (ex.length > 0) {
    console.log(`❌ ${stage} — 예외 ${ex.length}건`);
    for (const l of ex.slice(0, 3)) console.log(`   ${l.trim().slice(0, 160)}`);
    bad++;
  } else if (!framed) {
    console.log(`❌ ${stage} — 부팅 로그가 「첫 프레임」까지 못 갔다`);
    for (const l of log.split('\n').slice(-6)) console.log(`   ${l.trim().slice(0, 120)}`);
    bad++;
  } else {
    const n = log.split('\n').find((l) => l.includes('물체')) ?? '';
    console.log(`✅ ${stage} — 첫 프레임 · 예외 없음 ${n.trim()}`);
  }
}
rmSync(TMP, { recursive: true, force: true });
console.log(bad === 0 ? '\n✅ 여덟 판 모두 부팅했다.' : `\n❌ ${bad}판이 부팅에서 걸렸다.`);
process.exit(bad === 0 ? 0 : 1);
