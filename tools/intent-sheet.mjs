/**
 * 의도 시트 — 「무엇을 보고, 무엇을 만들 생각인지」를 그림 한 장으로 낸다.
 *
 * 문장으로 된 명세는 항상 맞게 읽힌다. "노란 직육면체에 종이 띠"는 옳게 들리고
 * 화면에서는 금색 덩어리가 된다. 그래서 명세를 문장으로 승인받으면 어긋남이
 * 가려진 채로 통과한다. 이 도구는 승인 단위를 문장에서 그림으로 바꾼다.
 *
 * 칸 하나에 셋이 들어간다:
 *   왼쪽  실물 사진   — .design-bounce/ref/<대상>/ 의 첫 이미지. 없으면 「못 찾음」
 *   오른쪽 게임 렌더   — 목업이 아니라 «실제로 만든 것»을 게임 조명으로 찍은 것
 *   아래  살릴 것 한 줄 — ref/<대상>/intent.md 의 `- 살릴 것:` 줄
 *
 *   node tools/intent-sheet.mjs 캐러멜,달팽이,고양이 [출력경로]
 *
 * 새 의존성을 쓰지 않는다. 칸을 <img> 로 배치한 HTML 을 만들고
 * 이미 있는 tools/shot.mjs 로 한 번 더 찍어 합성한다.
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const REF_ROOT = join(ROOT, '.design-bounce', 'ref');
const OUT_DIR = join(ROOT, '.design-bounce', 'sample');
const TMP_DIR = join(ROOT, '.design-bounce', '.tmp');
const SHOT = join(HERE, 'shot.mjs');
const BASE = process.env['VIEW_BASE'] ?? 'http://localhost:5174';
/** `shot.mjs` 가 쓰는 크롬 프로필. 좀비를 잡을 때 이 경로로 찾는다 */
const PROFILE = '/tmp/cdp-shot-profile';

/** 칸 크기. 사진과 렌더가 «나란히» 보여야 다른 점이 보인다 — 위아래로 쌓으면 안 된다 */
const PHOTO = 300;
const CELL_W = PHOTO * 2 + 48;
const COLS = 3;

const IMG_EXT = /\.(png|jpe?g|webp)$/i;

/** 뷰어를 찾는다. 아직 tools/ 로 옮기지 않아 작업 디렉토리에 남아 있다 */
function findViewer() {
  const local = join(ROOT, 'tools', 'view.html');
  if (existsSync(local)) return '/tools/view.html';
  const tasks = join(ROOT, '.ai-bouncer-tasks');
  if (existsSync(tasks)) {
    for (const date of readdirSync(tasks).sort().reverse()) {
      const d = join(tasks, date);
      for (const task of readdirSync(d).sort().reverse()) {
        if (existsSync(join(d, task, 'view.html'))) {
          return `/.ai-bouncer-tasks/${date}/${task}/view.html`;
        }
      }
    }
  }
  throw new Error('게임 조명 뷰어(view.html)를 찾지 못했습니다');
}

/**
 * 좀비 크롬이 포트를 물고 있으면 다음 촬영이 통째로 매달린다.
 *
 * **프로세스 이름이 아니라 «프로필 경로»로 잡는다.** 처음엔 `Chrome for Testing` 으로
 * 찾았는데 `shot.mjs` 는 일반 `Google Chrome` 을 띄운다 — 하나도 안 죽었고,
 * 살아 있는 크롬이 프로필 디렉토리를 물고 있어서 지우기가 실패하고
 * 그다음 촬영이 전부 죽었다. `--user-data-dir` 인자로 찾으면 정확히 그놈만 잡힌다.
 */
function reapChrome() {
  try {
    execFileSync('pkill', ['-9', '-f', PROFILE], { stdio: 'ignore' });
  } catch { /* 죽일 게 없으면 pkill 이 1을 반환한다 — 정상 */ }
  // 프로세스가 파일 핸들을 놓을 틈을 준다. 안 기다리면 지우기가 실패한다
  try {
    execFileSync('sleep', ['0.4'], { stdio: 'ignore' });
  } catch { /* 무시 */ }
  rmSync(PROFILE, { recursive: true, force: true });
}

function shoot(url, out, waitMs, w, h, js = '') {
  reapChrome();
  execFileSync('node', [SHOT, url, out, String(waitMs), String(w), String(h), js], {
    stdio: 'inherit', cwd: ROOT,
  });
}

/**
 * 뷰어의 안내문과 이름표를 지운다. **렌더 칸에 이름이 찍히면 안 된다** —
 * 「이게 뭐로 보이나」를 재는 판정이 뒤따르는데, 그림에 답이 적혀 있으면 무효다.
 */
const HIDE_HUD = "for (const id of ['hud','labels']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }";

/**
 * ref/<대상>/ 의 대표 이미지. 없으면 null.
 *
 * 한 대상에 사진이 여럿일 수 있다(정면·측면·자가 같이 찍힌 것). 그중 **무엇을 기준으로
 * 만들 것인지**는 판단이므로 파일 이름으로 밝힌다 — `main.*` 이 있으면 그것,
 * 없으면 사전순 첫 장. 이름순 우연에 맡기면 갑 사진 옆에 알맹이 렌더가 붙는다(실제로 그랬다).
 */
function refPhoto(target) {
  const dir = join(REF_ROOT, target);
  if (!existsSync(dir)) return null;
  const imgs = readdirSync(dir).filter((f) => IMG_EXT.test(f)).sort();
  const hit = imgs.find((f) => /^main\./i.test(f)) ?? imgs[0];
  return hit ? join(dir, hit) : null;
}

/**
 * intent.md 에서 「살릴 것」 한 줄. 없으면 「못 찾음」 여부에 따라 다른 문구.
 * 여기서 «없음»을 조용히 빈칸으로 넘기지 않는다 — 안 적었다는 사실 자체가 정보다.
 */
function keepLine(target) {
  const f = join(REF_ROOT, target, 'intent.md');
  if (!existsSync(f)) return { text: 'intent.md 없음 — 아직 보지 않았다', missing: true };
  const body = readFileSync(f, 'utf8');
  const keep = body.split('\n').find((l) => l.trim().startsWith('- 살릴 것:'));
  if (keep) return { text: keep.replace(/^\s*-\s*살릴 것:\s*/, ''), missing: false };
  if (/못 찾았다/.test(body)) return { text: '레퍼런스를 못 찾았다 — 대기열', missing: true };
  return { text: '「살릴 것」이 비어 있다', missing: true };
}

function dataUri(path) {
  const b64 = readFileSync(path).toString('base64');
  const ext = (path.match(IMG_EXT)?.[1] ?? 'png').toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${b64}`;
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function cellHtml(cell, i) {
  const left = cell.photo
    ? `<img src="${dataUri(cell.photo)}" alt="">`
    : '<div class="none">못 찾음</div>';
  const src = cell.photo ? basename(cell.photo) : '레퍼런스 없음';
  return `
  <figure class="cell">
    <header><b>${i + 1}</b> ${esc(cell.target)}</header>
    <div class="pair">
      <div class="pane">${left}<figcaption>실물 — ${esc(src)}</figcaption></div>
      <div class="pane"><img src="${dataUri(cell.render)}" alt=""><figcaption>내가 만든 것</figcaption></div>
    </div>
    <p class="keep${cell.keep.missing ? ' warn' : ''}">살릴 것: ${esc(cell.keep.text)}</p>
  </figure>`;
}

function sheetHtml(cells) {
  return `<!doctype html><meta charset="utf-8">
<style>
  :root { color-scheme: light }
  body { margin: 0; padding: 22px; background: #14130f; color: #f2ede1;
         font: 15px/1.5 -apple-system, "Apple SD Gothic Neo", sans-serif; }
  h1 { margin: 0 0 4px; font-size: 20px; letter-spacing: -.01em }
  .sub { margin: 0 0 18px; font-size: 13px; color: #9c968a }
  .grid { display: grid; grid-template-columns: repeat(${COLS}, ${CELL_W}px); gap: 18px }
  .cell { margin: 0; background: #201e19; border: 1px solid #35322a; border-radius: 10px;
          padding: 12px; }
  .cell header { font-size: 15px; margin-bottom: 9px; color: #f2ede1 }
  .cell header b { display: inline-block; min-width: 22px; height: 22px; line-height: 22px;
          text-align: center; background: #c8a24a; color: #1a1813; border-radius: 5px;
          margin-right: 7px; font-size: 13px }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px }
  .pane { display: flex; flex-direction: column; gap: 5px }
  .pane img { width: ${PHOTO}px; height: ${PHOTO}px; object-fit: contain;
          background: #f6f3ec; border-radius: 6px }
  .none { width: ${PHOTO}px; height: ${PHOTO}px; display: grid; place-items: center;
          background: #2b2822; border: 1px dashed #5c564a; border-radius: 6px;
          color: #8d8677; font-size: 14px }
  figcaption { font-size: 11px; color: #8d8677 }
  .keep { margin: 11px 0 0; font-size: 13px; color: #ddd6c6 }
  .keep.warn { color: #e0a24a }
</style>
<h1>의도 시트</h1>
<p class="sub">왼쪽은 내가 보고 온 실물, 오른쪽은 실제로 만든 것을 게임 조명으로 찍은 것.
아닌 번호만 불러 주세요.</p>
<div class="grid">${cells.map(cellHtml).join('')}</div>`;
}

function main() {
  const [arg, outArg] = process.argv.slice(2);
  if (!arg) {
    console.error('사용법: node tools/intent-sheet.mjs <대상1,대상2,...> [출력경로]');
    console.error('예:     node tools/intent-sheet.mjs 캐러멜,달팽이,고양이');
    process.exit(1);
  }
  const targets = arg.split(',').map((t) => t.trim()).filter(Boolean);
  if (targets.length === 0) {
    console.error('대상이 비어 있습니다');
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(TMP_DIR, { recursive: true });
  const viewer = findViewer();

  const cells = targets.map((target, i) => {
    const render = join(TMP_DIR, `render-${i}.png`);
    /**
     * **크기를 칸마다 맞춘다.** 뷰어 기본값은 「실제 놓이는 크기」라 1.6cm 짜리는
     * 화면에서 점이 되고 1.2m 짜리는 꽉 찬다. 시트는 «알아볼 수 있는가»를 보는
     * 것이므로 크기 차이가 섞이면 답이 오염된다.
     */
    const url = `${BASE}${viewer}?only=${encodeURIComponent(target)}&size=0.9&tilt=0.25`;
    console.log(`[${i + 1}/${targets.length}] ${target} 렌더`);
    shoot(url, render, 4500, PHOTO * 2, PHOTO * 2, HIDE_HUD);
    if (!existsSync(render)) throw new Error(`${target} 렌더 실패 — ${url}`);
    return { target, render, photo: refPhoto(target), keep: keepLine(target) };
  });

  const html = join(TMP_DIR, 'sheet.html');
  writeFileSync(html, sheetHtml(cells));

  const rows = Math.ceil(cells.length / COLS);
  const w = Math.min(cells.length, COLS) * (CELL_W + 18) + 44;
  /**
   * 칸 하나 = 안쪽 여백 24 + 머리글 39 + 사진 PHOTO + 설명 21 + 「살릴 것」 31 + 칸 사이 18.
   * 처음엔 120 만 더했다가 **「살릴 것」 줄이 통째로 잘렸다** — 시트의 핵심이 그 줄인데.
   */
  const h = rows * (PHOTO + 155) + 140;
  const out = outArg ? resolve(outArg) : join(OUT_DIR, 'sheet-1.png');
  console.log('시트 합성');
  shoot(`file://${html}`, out, 900, w, h);

  const missing = cells.filter((c) => !c.photo).map((c) => c.target);
  console.log(`\n시트: ${out}`);
  console.log(`칸 ${cells.length}개 · 레퍼런스 없음 ${missing.length}개${missing.length ? ` (${missing.join(', ')})` : ''}`);
}

main();
