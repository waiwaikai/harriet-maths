import type { ProgressState } from '../content/types';

const KEY = 'harriet-maths';
const VERSION = 2; // v2: added spine position state

export function defaultState(): ProgressState {
  return {
    sessions: [],
    streak: 0,
    lastSessionDate: null,
    settings: { voiceName: 'Karen', rate: 0.95, dateOverride: null },
    spine: { activeIndex: null, extraDaysUsed: 0, lessonDaysDone: {} },
  };
}

export function loadState(): ProgressState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as { v: number; data: ProgressState };
    if (parsed.v !== VERSION) {
      // future: run migrations. v1: merge over defaults so new fields appear.
      return { ...defaultState(), ...parsed.data };
    }
    return { ...defaultState(), ...parsed.data, settings: { ...defaultState().settings, ...parsed.data.settings } };
  } catch {
    return defaultState();
  }
}

export function saveState(state: ProgressState): void {
  localStorage.setItem(KEY, JSON.stringify({ v: VERSION, data: state }));
}
