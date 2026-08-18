/**
 * 실시간 대기 스크린샷. `--virtual-time-budget` 은 이 게임에서 안 끝난다
 * (rAF 루프가 계속 도는 동안 가상시간이 안 흐른다). 그래서 CDP로 직접 붙어
 * 진짜 시간만큼 기다렸다가 찍는다. Node 22+ 의 내장 WebSocket 을 쓴다.
 *
 *   node shot.mjs <url> <out.png> [waitMs] [width] [height] [js]
 */
import { spawn } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';

const [, , url, out, waitMs = '4000', w = '1280', h = '800', js = ''] = process.argv;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = '/tmp/cdp-shot-profile';
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  `--user-data-dir=${PROFILE}`, '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--disable-extensions', '--disable-sync',
  '--remote-debugging-port=9333', `--window-size=${w},${h}`, '--hide-scrollbars',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9333/json/list');
      const list = await r.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch { /* 아직 안 떴다 */ }
    await sleep(250);
  }
  throw new Error('CDP 엔드포인트를 못 찾았다');
}

const page = await targets();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled') {
    logs.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    logs.push('EXCEPTION ' + (m.params.exceptionDetails?.exception?.description ?? ''));
  }
};
const send = (method, params = {}) => new Promise((res) => {
  const i = ++id; pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url });
await sleep(Number(waitMs));
if (js) await send('Runtime.evaluate', { expression: js, awaitPromise: true });

// **캡처가 프레임을 강제한다.** 헤드리스에는 컴포지터가 없어서 rAF 가 한 번 돌고
// 멈춘다 (그래서 --virtual-time-budget 도 이 게임에서는 안 끝난다).
// 버리는 캡처를 반복해서 시뮬을 원하는 프레임 수만큼 굴린 뒤 마지막 장을 쓴다.
const warm = Number(process.env.WARMUP ?? 30);
for (let i = 0; i < warm; i++) {
  await send('Page.captureScreenshot', { format: 'png' });
  await sleep(16);
}
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log(`저장: ${out}`);
for (const l of logs) console.log('  ' + l);
ws.close();
chrome.kill('SIGKILL');
process.exit(0);
