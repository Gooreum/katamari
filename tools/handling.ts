/**
 * 조작 응답 검사기.  `npm run handling`
 *
 * **이 도구가 필요한 이유:**
 * `curve` 는 "얼마나 빨리 커지는가"를 본다. 이건 "커진 다음에 조종이 되는가"를 본다.
 * 둘은 완전히 다른 문제고, 실제로 곡선은 멀쩡한데 후반 조작이 망가져 있었다.
 *
 * 핵심 지표는 절대 거리가 아니라 **정지 거리 / 자기 지름 비율**이다.
 * 40m짜리 공이 10m 미끄러지는 건 자연스럽지만, 5cm 공이 10m 미끄러지면 재앙이다.
 * 크기가 6천 배 차이 나는 게임에서는 비율로 봐야 한다.
 */
import { TUNING, speedAt } from '../src/game/tuning';

/**
 * 정지거리/지름 상한.
 *
 * 이 값을 넘으면 "키를 놨는데 자기 몸통보다 더 미끄러진다"는 뜻이고,
 * 그 시점부터 플레이어는 조종이 아니라 예측을 해야 한다.
 */
const RATIO_MAX = 1.2;

/**
 * 이 지름 이하는 판정에서 뺀다.
 *
 * `baseSpeed`(0.45 m/s)는 크기와 무관한 상수라 아주 작을 때 속도를 지배한다.
 * 5cm 공은 자기 지름의 9배 속도로 움직이므로 비율이 클 수밖에 없다 —
 * 이건 버그가 아니라 "작을 때는 쌩쌩하다"는 의도된 감각이다.
 */
const TINY_DIAMETER = 0.06;

/** 게임(`Katamari.drive()`)과 **같은 식**이어야 한다. 다르면 도구가 거짓말을 한다. */
function responseRate(radius: number): number {
  const effRadius = radius / (1 + radius / TUNING.dragKnee);
  return TUNING.accelRate / (1 + effRadius * TUNING.massDrag);
}

const LADDER = [TUNING.startRadius, 0.25, 0.5, 2, 5, 10, 20, 40];

console.log(`\n${'═'.repeat(74)}`);
console.log('조작 응답 — 크기별');
console.log('═'.repeat(74));
console.log('  지름        최고속도    응답 τ     정지 거리    지름 대비');

const fmt = (m: number): string => (m < 1 ? `${(m * 100).toFixed(1)}cm` : `${m.toFixed(1)}m`);

let violations = 0;
const rows: Array<{ d: number; ratio: number }> = [];

for (const r of LADDER) {
  const diameter = r * 2;
  const v = speedAt(r);
  const tau = 1 / responseRate(r);
  // 지수 감쇠는 시간상수 τ 동안 초기 속도의 (1 - 1/e) 만큼 줄고,
  // 남은 이동 거리의 적분이 정확히 v·τ 다.
  const stop = v * tau;
  const ratio = stop / diameter;
  rows.push({ d: diameter, ratio });

  const tiny = diameter <= TINY_DIAMETER;
  let flag = '  ';
  if (tiny) flag = '  (예외)';
  else if (ratio > RATIO_MAX) { flag = '  ❌'; violations++; }

  console.log(
    `  ${fmt(diameter).padStart(8)}  ${v.toFixed(2).padStart(8)}m/s` +
    `${tau.toFixed(3).padStart(9)}초` +
    `${fmt(stop).padStart(11)}` +
    `${ratio.toFixed(2).padStart(11)}배${flag}`,
  );
}

console.log(`\n${'─'.repeat(74)}`);
const judged = rows.filter((x) => x.d > TINY_DIAMETER);
const worst = judged.reduce((a, b) => (b.ratio > a.ratio ? b : a));
console.log(`  판정 대상: 지름 ${fmt(TINY_DIAMETER)} 초과 ${judged.length}개`);
console.log(`  최악: 지름 ${fmt(worst.d)} 에서 ${worst.ratio.toFixed(2)}배 (상한 ${RATIO_MAX})`);
console.log(`  지름 ${fmt(TINY_DIAMETER)} 이하는 baseSpeed(${TUNING.baseSpeed})가 속도를 지배해서 예외입니다.`);

console.log('');
if (violations > 0) {
  console.log(`❌ 상한 초과 ${violations}건 — 큰 공이 자기 몸통보다 더 미끄러집니다.\n`);
  process.exit(1);
}
console.log('✅ 모든 크기에서 정지 거리가 지름의 ' + RATIO_MAX + '배 이하입니다.\n');
