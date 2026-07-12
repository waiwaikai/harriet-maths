import type { DayDirective, ProgressState, SessionRecord } from '../content/types';

/** Lesson sessions for a concept, oldest first. */
export function lessonSessionsFor(state: ProgressState, conceptId: string): SessionRecord[] {
  return state.sessions
    .filter(s => s.conceptId === conceptId && (s.kind ?? 'lesson') === 'lesson')
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * §8 triggers → how to pitch the NEXT lesson on this concept.
 *  - depth:   ≥9/10 first-time-right immediately, or ≥8/10 across two sessions
 *             → harder problem types, not more of the same (never races ahead).
 *  - reteach: ≤4/10 → demo again (parent nudged to a different model), gentler questions.
 *  - normal:  everything else, incl. 5–7/10 hold — fresh questions at standard pitch.
 */
export function nextDirective(state: ProgressState, conceptId: string): DayDirective {
  const sessions = lessonSessionsFor(state, conceptId);
  if (sessions.length === 0) return 'normal';
  const last = sessions[sessions.length - 1];
  if (last.ftr <= 4) return 'reteach';
  if (last.ftr >= 9) return 'depth';
  const prev = sessions[sessions.length - 2];
  if (prev && last.ftr >= 8 && prev.ftr >= 8) return 'depth';
  return 'normal';
}

/**
 * At the end of a concept's allotted days: stretch into next week (capped at
 * one week by the caller) only for genuine struggle. 5–7/10 holds finish the
 * week and move on — the concept keeps getting recycled through warm-ups and
 * Fridays instead of stalling the calendar.
 */
export function isStruggling(lastSession: SessionRecord): boolean {
  return lastSession.ftr <= 4;
}

/**
 * Struggle score per concept for recall weighting. Recent parks and crosses
 * weigh heaviest; everything decays with a ~2-week half-life.
 */
export function struggleScores(state: ProgressState, todayISO: string): Record<string, number> {
  const scores: Record<string, number> = {};
  const add = (conceptId: string | undefined, amount: number, dateISO: string) => {
    if (!conceptId) return;
    const days = Math.max(0, daysBetween(dateISO, todayISO));
    const decayed = amount * Math.pow(0.5, days / 14);
    scores[conceptId] = (scores[conceptId] ?? 0) + decayed;
  };

  for (const s of state.sessions) {
    add(s.conceptId, s.parked * 3 + s.secondLooks * 1.5, s.date);
    for (const w of s.warmup ?? []) {
      if (w.mark === 'cross') add(w.conceptId, 3, s.date);
      else if (w.mark === 'prompted') add(w.conceptId, 1.5, s.date);
    }
  }
  // pre-term diagnostic seeds the weighting so re-emphasis starts from day one
  for (const m of state.diagnostic?.marks ?? []) {
    if (m.mark === 'cross') add(m.conceptId, 3, state.diagnostic!.date);
    else if (m.mark === 'prompted') add(m.conceptId, 1.5, state.diagnostic!.date);
  }
  return scores;
}

export function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split('-').map(Number);
  const [ty, tm, td] = toISO.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}
