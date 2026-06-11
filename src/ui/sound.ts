/**
 * ui/sound — звук мира на чистом Web Audio, без файлов.
 * Гул поля дышит плотностью жизни, события звучат колоколами,
 * шторм — низким рокотом. Тишина — тоже звук (Сфайрос).
 */
import type { Stage } from '../run/stages';

export type SoundEvent = 'form' | 'mind' | 'storm' | 'tablet' | 'sow' | 'end';

/**
 * Генеративная музыка: лад зависит от фазы партии.
 * Genesis — пентатоника (невинность), Морфогенез — дориан (строительство),
 * Разум — лидийский (свет), Шторм — фригийский (тревога), развязка — эолийский.
 */
const SCALES: Record<Stage, number[]> = {
  genesis: [0, 2, 4, 7, 9],
  morpho: [0, 2, 3, 5, 7, 9, 10],
  mind: [0, 2, 4, 6, 7, 9, 11],
  crisis: [0, 1, 3, 5, 7, 8, 10],
  respite: [0, 2, 4, 7, 9],
  aftermath: [0, 2, 3, 5, 7, 8, 10],
};
const ROOT_HZ = 220;

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private droneOscA: OscillatorNode | null = null;
  private droneOscB: OscillatorNode | null = null;
  muted = false;

  /** Запускается только по жесту игрока (правило автоплея браузеров). */
  init(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(ctx.destination);

      // Гул поля: две расстроенные синусоиды через низкий фильтр.
      this.droneGain = ctx.createGain();
      this.droneGain.gain.value = 0;
      this.droneFilter = ctx.createBiquadFilter();
      this.droneFilter.type = 'lowpass';
      this.droneFilter.frequency.value = 220;
      this.droneOscA = ctx.createOscillator();
      this.droneOscA.frequency.value = 55;
      this.droneOscB = ctx.createOscillator();
      this.droneOscB.frequency.value = 55.7;
      this.droneOscA.connect(this.droneFilter);
      this.droneOscB.connect(this.droneFilter);
      this.droneFilter.connect(this.droneGain);
      this.droneGain.connect(this.master);
      this.droneOscA.start();
      this.droneOscB.start();
    } catch {
      this.ctx = null; // мир останется немым — не страшно
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.linearRampToValueAtTime(
        this.muted ? 0 : 0.5,
        this.ctx.currentTime + 0.2,
      );
    }
    return this.muted;
  }

  /** Дыхание поля: вызывается изредка (раз в ~0.5 с). */
  ambient(density: number, energy: number, stage: Stage): void {
    if (!this.ctx || !this.droneGain || !this.droneFilter || !this.droneOscA || !this.droneOscB) return;
    const t = this.ctx.currentTime;

    // Перезвон жизни: чем гуще поле, тем чаще нота из лада фазы.
    // Презентация, не симуляция — Math.random здесь допустим.
    if (!this.muted && Math.random() < Math.min(0.55, density * 2.2)) {
      const scale = SCALES[stage];
      const deg = scale[Math.floor(Math.random() * scale.length)] as number;
      const octave = Math.random() < 0.3 ? 2 : 1;
      const freq = ROOT_HZ * octave * Math.pow(2, deg / 12);
      this.pluck(freq, stage === 'crisis' ? 0.05 : 0.04);
    }
    const hush = stage === 'aftermath' ? 0.6 : 1;
    this.droneGain.gain.linearRampToValueAtTime(Math.min(0.16, density * 0.5) * hush, t + 0.5);
    this.droneFilter.frequency.linearRampToValueAtTime(140 + density * 900, t + 0.5);
    // Голод опускает тон мира.
    const base = energy < 25 ? 49 : 55;
    this.droneOscA.frequency.linearRampToValueAtTime(base, t + 0.5);
    this.droneOscB.frequency.linearRampToValueAtTime(base + 0.7, t + 0.5);
  }

  event(kind: SoundEvent): void {
    if (!this.ctx || !this.master) return;
    switch (kind) {
      case 'form':
        this.bell(660, 1.4, 0.18);
        break;
      case 'mind':
        this.bell(880, 1.8, 0.16);
        this.bell(1320, 2.2, 0.1, 0.15);
        break;
      case 'storm':
        this.rumble();
        break;
      case 'tablet':
        this.bell(523, 0.8, 0.14);
        this.bell(392, 1.2, 0.1, 0.12);
        break;
      case 'sow':
        this.bell(990, 0.12, 0.08);
        break;
      case 'end':
        this.bell(440, 2.5, 0.15);
        this.bell(330, 3, 0.12, 0.3);
        break;
    }
  }

  /**
   * §16.2 Голоса клеток: электрический язык слышен.
   * Вызывается раз в ~0.5 с со счётом слов за последний тик.
   */
  voices(alarm: number, call: number, hunger: number): void {
    if (!this.ctx || !this.master || this.muted) return;
    // ТРЕВОГА — резкие высокие клики, стаккато (до 3 за раз).
    const clicks = Math.min(3, Math.ceil(alarm / 8));
    for (let k = 0; k < clicks; k++) {
      const t = this.ctx.currentTime + k * 0.07;
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 1500 + (k * 180);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(Math.min(0.06, 0.015 + alarm * 0.002), t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.08);
    }
    // ЗОВ — мягкое восходящее глиссандо.
    if (call > 3 && Math.random() < 0.5) {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, t);
      osc.frequency.linearRampToValueAtTime(880, t + 0.25);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.04, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.4);
    }
    // ГОЛОД — глухой низкий пульс.
    if (hunger > 10 && Math.random() < 0.6) {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 82;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(Math.min(0.09, 0.02 + hunger * 0.0015), t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.35);
    }
  }

  /** Короткая щипковая нота — голос генеративной музыки. */
  private pluck(freq: number, vol: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.8);
  }

  private bell(freq: number, decay: number, vol: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + decay + 0.1);
  }

  private rumble(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const dur = 2.5;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 120;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }
}
