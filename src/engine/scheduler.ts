import type { DayDirective, ProgressState, SessionRecord, Spine, SpineState, WeekSpec } from '../content/types';
import { isStruggling, nextDirective } from './adaptivity';

export type DayPlan =
  | { kind: 'pre-term'; termStart: string }
  | { kind: 'holiday'; nextTermStart: string }
  | { kind: 'weekend' }
  | { kind: 'after-year' }
  | { kind: 'lesson'; week: WeekSpec; directive: DayDirective; drift: number; ahead?: number }
  | { kind: 'revision'; week: WeekSpec; drift: number }
  | { kind: 'flex'; week: WeekSpec };

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "Today" honouring the pretend-date override. */
export function effectiveToday(dateOverride: string | null): string {
  return dateOverride ?? toISO(new Date());
}

/** Index of the calendar week containing iso; if between weeks, the last week that started. -1 pre-term. */
export function calendarWeekIndex(iso: string, spine: Spine): number {
  let idx = -1;
  for (let i = 0; i < spine.weeks.length; i++) {
    if (spine.weeks[i].start <= iso) idx = i;
    else break;
  }
  return idx;
}

/** Mon–Thu school days inside a week's date range (Friday is the revision day). */
export function lessonDaysInWeek(week: WeekSpec): number {
  let n = 0;
  const d = parseISO(week.start);
  const end = parseISO(week.end);
  while (d <= end) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 4) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

/**
 * Which school day of the week this date is, e.g. "Day 4 of 4".
 * Fridays are the revision day and sit outside the Mon–Thu lesson run.
 */
export function schoolDayLabel(iso: string, week: WeekSpec): string {
  const dow = parseISO(iso).getDay();
  if (dow === 5) return 'Friday · revision';
  const total = lessonDaysInWeek(week);
  let n = 0;
  const d = parseISO(week.start);
  const end = parseISO(week.end);
  while (d <= end) {
    const wd = d.getDay();
    if (wd >= 1 && wd <= 4) {
      n++;
      if (toISO(d) === iso) return `Day ${n} of ${total}`;
    }
    d.setDate(d.getDate() + 1);
  }
  return '';
}

/** Once the calendar has moved past a flex week, the position slides through it — that's the absorption. */
function skipStaleFlex(idx: number, cal: number, spine: Spine): number {
  while (spine.weeks[idx]?.flex && cal > idx) idx++;
  return Math.min(Math.max(idx, 0), spine.weeks.length - 1);
}

/** Where the sequence actually is today (mastery position, calendar as fallback, stale flex absorbed). */
export function resolveActiveIndex(state: ProgressState, todayISO: string, spine: Spine): number {
  const cal = calendarWeekIndex(todayISO, spine);
  const idx = state.spine.activeIndex ?? cal;
  return skipStaleFlex(Math.min(Math.max(idx, 0), spine.weeks.length - 1), cal, spine);
}

export function planToday(state: ProgressState, todayISO: string, spine: Spine): DayPlan {
  const date = parseISO(todayISO);
  const dow = date.getDay(); // 0 Sun … 6 Sat
  const firstTerm = spine.terms[0];
  const lastTerm = spine.terms[spine.terms.length - 1];

  if (todayISO < firstTerm.start) return { kind: 'pre-term', termStart: firstTerm.start };
  if (todayISO > lastTerm.end) return { kind: 'after-year' };
  if (dow === 0 || dow === 6) return { kind: 'weekend' };

  const inTerm = spine.terms.some(t => todayISO >= t.start && todayISO <= t.end);
  if (!inTerm) {
    const nextTerm = spine.terms.find(t => t.start > todayISO);
    return nextTerm ? { kind: 'holiday', nextTermStart: nextTerm.start } : { kind: 'after-year' };
  }

  const cal = calendarWeekIndex(todayISO, spine);
  const active = resolveActiveIndex(state, todayISO, spine);

  // Mastery may finish a week's allotted days before the calendar does (short
  // weeks especially). The position never races ahead: hold it and serve the
  // CALENDAR week as bonus depth days until the calendar catches up.
  if (active > cal && cal >= 0) {
    const calWeek = spine.weeks[cal];
    if (calWeek.flex) return { kind: 'flex', week: calWeek };
    if (dow === 5) return { kind: 'revision', week: calWeek, drift: 0 };
    return { kind: 'lesson', week: calWeek, directive: 'depth', drift: 0, ahead: active - cal };
  }

  const week = spine.weeks[active];
  const drift = Math.max(0, cal - active);

  // an on-track flex week runs as revision/extension all week
  if (week.flex && drift === 0) return { kind: 'flex', week };

  if (dow === 5) return { kind: 'revision', week, drift };
  return { kind: 'lesson', week, directive: nextDirective(state, week.conceptId), drift };
}

/**
 * Advance the mastery position after a completed lesson session (§8):
 * - one lesson day consumed per school day (replays don't double-count);
 * - at the end of the concept's allotted days: struggling (≤4/10) stretches the
 *   concept up to one extra week; otherwise advance;
 * - when advancing while behind the calendar, flex weeks are skipped — they
 *   absorb the drift.
 */
export function advanceSpine(
  state: ProgressState,
  rec: Pick<SessionRecord, 'date' | 'ftr' | 'kind'>,
  spine: Spine,
): SpineState {
  const sp: SpineState = {
    ...state.spine,
    lessonDaysDone: { ...state.spine.lessonDaysDone },
  };
  if ((rec.kind ?? 'lesson') !== 'lesson') return sp;
  // only the first session of a day moves the position
  if (state.sessions.some(s => s.date === rec.date)) return sp;

  const cal = calendarWeekIndex(rec.date, spine);
  if (sp.activeIndex === null) sp.activeIndex = Math.max(cal, 0);
  sp.activeIndex = skipStaleFlex(sp.activeIndex, cal, spine);
  // already ahead of the calendar: today ran as a bonus depth day on the
  // calendar week — it consumes no lesson days and never advances further
  if (sp.activeIndex > cal) return sp;
  const week = spine.weeks[sp.activeIndex];
  if (!week || week.flex) return sp; // an on-track flex week holds no concept to advance

  const done = (sp.lessonDaysDone[week.conceptId] ?? 0) + 1;
  sp.lessonDaysDone[week.conceptId] = done;

  const allotted = lessonDaysInWeek(week) + sp.extraDaysUsed;
  if (done >= allotted) {
    const extendCap = lessonDaysInWeek(week); // "cap at 1 week delay"
    if (isStruggling(rec as SessionRecord) && sp.extraDaysUsed < extendCap) {
      sp.extraDaysUsed += 1;
    } else {
      sp.activeIndex += 1;
      sp.extraDaysUsed = 0;
      // absorb drift into flex weeks
      while (spine.weeks[sp.activeIndex]?.flex && cal > sp.activeIndex) {
        sp.activeIndex += 1;
      }
      if (sp.activeIndex >= spine.weeks.length) sp.activeIndex = spine.weeks.length - 1;
    }
  }
  return sp;
}
