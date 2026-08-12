/**
 * 절차적 효과음. 에셋 없음, WebAudio만.
 *
 * 흡수음의 핵심은 **연속으로 먹을 때 음이 올라가는 것**이다.
 * 원작의 그 상승하는 차임이 "잘 하고 있다"는 신호 역할을 한다.
 * 단발음을 반복 재생하면 기관총 소리가 되어버린다.
 */

/** 펜타토닉 — 아무 순서로 겹쳐도 불협이 안 난다 */
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const MIN_INTERVAL = 0.035;   // 초. 이보다 촘촘하면 버린다
const CHAIN_RESET = 0.45;     // 이만큼 쉬면 음계가 처음으로

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastAt = -1;
  private chain = 0;
  private muted = false;

  constructor() {
    // 자동재생 정책: 첫 사용자 입력 전에는 컨텍스트를 못 만든다
    const unlock = () => {
      this.ensure();
      removeEventListener('pointerdown', unlock);
      removeEventListener('keydown', unlock);
    };
    addEventListener('pointerdown', unlock, { once: false });
    addEventListener('keydown', unlock, { once: false });
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') this.toggleMute();
    });
  }

  private ensure(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.22;
  }

  /**
   * 흡수음. 작은 걸 먹으면 높고 짧게, 큰 걸 먹으면 낮고 길게.
   * 연속으로 먹으면 음계를 타고 올라간다.
   */
  absorb(relativeSize: number): void {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;

    const now = ctx.currentTime;
    if (now - this.lastAt < MIN_INTERVAL) return;   // 몰아서 먹을 때 방어
    this.chain = now - this.lastAt > CHAIN_RESET ? 0 : Math.min(this.chain + 1, SCALE.length - 1);
    this.lastAt = now;

    // 상대 크기가 클수록 낮은 옥타브에서 시작
    const octave = relativeSize > 0.5 ? -12 : relativeSize > 0.2 ? 0 : 12;
    const semitone = SCALE[this.chain]! + octave;
    const freq = 330 * 2 ** (semitone / 12);
    const dur = 0.09 + relativeSize * 0.14;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + dur * 0.8);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + dur);

    osc.connect(gain).connect(this.master!);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  /** 충돌음. 필터 걸린 노이즈 버스트 — 둔탁한 '텅'. */
  thud(strength: number): void {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const now = ctx.currentTime;
    const dur = 0.16 + strength * 0.12;

    const frames = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900 - strength * 400, now);

    const gain = ctx.createGain();
    gain.gain.value = 0.35 + strength * 0.45;

    src.connect(filter).connect(gain).connect(this.master!);
    src.start(now);
  }
}
