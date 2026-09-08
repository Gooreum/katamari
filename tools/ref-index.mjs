/**
 * `.design-bounce/ref/` 를 훑어 `tools/ref-index.json` 을 만든다.
 *
 * `tools/sheet.html` 은 브라우저에서 도는 정적 페이지라 디렉토리를 못 읽는다.
 * 사진 경로와 「살릴 것」 한 줄을 미리 뽑아 둔다.
 *
 * **레퍼런스가 늘거나 intent.md 를 고치면 다시 돌린다.**
 *
 *   node tools/ref-index.mjs
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const REF_ROOT = join(ROOT, '.design-bounce', 'ref');
const OUT = join(HERE, 'ref-index.json');

const IMG = /\.(png|jpe?g|webp)$/i;

if (!existsSync(REF_ROOT)) {
  writeFileSync(OUT, '{}\n');
  console.log('레퍼런스 디렉토리가 없다 — 빈 목록을 썼다');
  process.exit(0);
}

const index = {};
for (const target of readdirSync(REF_ROOT).sort()) {
  const dir = join(REF_ROOT, target);
  if (!existsSync(join(dir, 'intent.md'))) continue;

  const imgs = readdirSync(dir).filter((f) => IMG.test(f)).sort();
  // `main.*` 이 있으면 그것. 「무엇을 기준으로 만들 것인가」는 판단이라 이름으로 밝힌다
  const hit = imgs.find((f) => /^main\./i.test(f)) ?? imgs[0];

  const body = readFileSync(join(dir, 'intent.md'), 'utf8');
  const keepLine = body.split('\n').find((l) => l.trim().startsWith('- 살릴 것:'));
  const keep = keepLine
    ? keepLine.replace(/^\s*-\s*살릴 것:\s*/, '')
    : (/못 찾았다/.test(body) ? '레퍼런스를 못 찾았다 — 대기열' : null);

  index[target] = {
    // 개발 서버가 저장소 루트를 그대로 서빙하므로 절대 경로로 준다
    photo: hit ? `/.design-bounce/ref/${encodeURIComponent(target)}/${encodeURIComponent(hit)}` : null,
    src: hit ?? null,
    keep,
  };
}

writeFileSync(OUT, `${JSON.stringify(index, null, 2)}\n`);
console.log(`${Object.keys(index).length}개 대상 — ${OUT}`);
for (const [k, v] of Object.entries(index)) {
  console.log(`  ${k.padEnd(12)} ${v.photo ? '사진 있음' : '사진 없음'} · ${v.keep ? '살릴 것 있음' : '살릴 것 없음'}`);
}
