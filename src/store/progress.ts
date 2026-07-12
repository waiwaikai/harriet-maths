import type { DayDirective, ItemResult, Mode, ProgressState, SessionKind, SessionRecord, WarmupResult } from '../content/types';
import { spine } from '../content/loadBank';
import { advanceSpine } from '../engine/scheduler';
import { loadState, saveState } from './persistence';

export function recordSession(
  state: ProgressState,
  args: {
    date: string; mode: Mode; weekId: string; conceptId: string;
    results: ItemResult[]; warmup?: WarmupResult[];
    kind?: SessionKind; directive?: DayDirective;
  },
): ProgressState {
  const { results } = args;
  const rec: SessionRecord = {
    ...args,
    total: results.length,
    ftr: results.filter(r => r.tier === 'ftr').length,
    secondLooks: results.filter(r => r.tier === 'second-look').length,
    parked: results.filter(r => r.tier === 'parked').length,
  };

  // position moves before the session is appended (replays same-day don't double-count)
  const nextSpine = advanceSpine(state, rec, spine);

  const isNewDay = state.lastSessionDate !== args.date;
  const next: ProgressState = {
    ...state,
    sessions: [...state.sessions, rec],
    streak: isNewDay ? state.streak + 1 : state.streak,
    lastSessionDate: args.date,
    spine: nextSpine,
  };
  saveState(next);
  return next;
}

export function getState(): ProgressState {
  return loadState();
}

export function recordDiagnostic(state: ProgressState, diagnostic: NonNullable<ProgressState['diagnostic']>): ProgressState {
  const next = { ...state, diagnostic };
  saveState(next);
  return next;
}

export function updateSettings(state: ProgressState, patch: Partial<ProgressState['settings']>): ProgressState {
  const next = { ...state, settings: { ...state.settings, ...patch } };
  saveState(next);
  return next;
}

export function todaysSession(state: ProgressState, date: string): SessionRecord | null {
  return state.sessions.find(s => s.date === date) ?? null;
}
