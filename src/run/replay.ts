/**
 * run/replay — реплеи из детерминизма.
 * Партия = конфигурация + эхо старта + список вмешательств с тиками.
 * Файл в сотни байт; воспроизведение даёт бит-в-бит ту же историю.
 */
import type { Me } from '../core/rules';
import type { ActionKind } from '../tablets/actions';
import type { ConditionSpec } from '../tablets/conditions';
import type { ArchetypeId, BiomeId, RunMode } from './setup';

/** Числовые законы Ме, которые трогает рука (угрозы — от seed, их не пишем). */
export interface MeNums {
  birthMin: number;
  birthMax: number;
  surviveMin: number;
  surviveMax: number;
  ashLifetime: number;
}

export type ReplayEvent =
  | { t: number; k: 'me'; me: MeNums }
  | { t: number; k: 'sow'; i: number; s: number }
  | { t: number; k: 'carve'; c: ConditionSpec; a: ActionKind };

export interface ReplayData {
  v: 1;
  cfg: {
    seedText: string;
    biome: BiomeId;
    archetype: ArchetypeId;
    size: number;
    mode: RunMode;
  };
  /** Прах, на котором взошёл мир (эхо прежнего). */
  echo: number[];
  events: ReplayEvent[];
}

export function meNums(me: Me): MeNums {
  return {
    birthMin: me.birthMin,
    birthMax: me.birthMax,
    surviveMin: me.surviveMin,
    surviveMax: me.surviveMax,
    ashLifetime: me.ashLifetime,
  };
}

export class ReplayRecorder {
  private data: ReplayData | null = null;

  start(cfg: ReplayData['cfg'], echo: number[]): void {
    this.data = { v: 1, cfg, echo, events: [] };
  }

  record(ev: ReplayEvent): void {
    this.data?.events.push(ev);
  }

  /** Компактный код реплея для буфера обмена. */
  encode(): string | null {
    if (!this.data) return null;
    const json = JSON.stringify(this.data);
    return `MONAS1:${btoa(unescape(encodeURIComponent(json)))}`;
  }
}

export function decodeReplay(code: string): ReplayData | null {
  try {
    const body = code.trim().replace(/^MONAS1:/, '');
    const data = JSON.parse(decodeURIComponent(escape(atob(body)))) as ReplayData;
    if (data.v !== 1 || !data.cfg || !Array.isArray(data.events)) return null;
    return data;
  } catch {
    return null;
  }
}

/** Курсор воспроизведения: отдаёт события, чей час настал. */
export class ReplayPlayer {
  private idx = 0;
  constructor(readonly data: ReplayData) {}

  due(tickNo: number): ReplayEvent[] {
    const out: ReplayEvent[] = [];
    while (this.idx < this.data.events.length) {
      const ev = this.data.events[this.idx] as ReplayEvent;
      if (ev.t > tickNo) break;
      out.push(ev);
      this.idx++;
    }
    return out;
  }
}
