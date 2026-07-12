import type { ProgressState } from '../content/types';
import type { Spine } from '../content/types';
import { LADDER_NAMES, verdict, VERDICT_LABEL } from './placement';
import { calendarWeekIndex, resolveActiveIndex } from './scheduler';

/** Plain-text progress summary for pasting into a check-in chat. */
export function buildProgressSummary(state: ProgressState, todayISO: string, spine: Spine): string {
  const lines: string[] = [];
  lines.push(`HARRIET MATHS — progress summary (${todayISO})`);
  lines.push(`Streak: ${state.streak} days · Sessions: ${state.sessions.length}`);

  const cal = calendarWeekIndex(todayISO, spine);
  if (cal >= 0) {
    const active = resolveActiveIndex(state, todayISO, spine);
    const w = spine.weeks[active];
    const drift = cal - active;
    lines.push(`Position: ${w.id} (${w.focus})${drift > 0 ? ` — ${drift} wk behind calendar` : ' — on track'}`);
  }

  if (state.diagnostic?.marks.length) {
    lines.push('', `Diagnostic (${state.diagnostic.date}):`);
    for (const [id, lvl] of Object.entries(state.diagnostic.levels)) {
      lines.push(`  ${LADDER_NAMES[id] ?? id}: rung ${lvl} (${VERDICT_LABEL[verdict(lvl)].replace(/^\S+ /, '')})`);
    }
  }

  // per-concept rollup
  const byConcept = new Map<string, { n: number; ftr: number[]; seconds: number; parked: number; directives: string[] }>();
  for (const s of state.sessions) {
    const c = byConcept.get(s.conceptId) ?? { n: 0, ftr: [], seconds: 0, parked: 0, directives: [] };
    c.n++;
    c.ftr.push(s.ftr);
    c.seconds += s.secondLooks;
    c.parked += s.parked;
    if (s.directive && s.directive !== 'normal') c.directives.push(`${s.date.slice(5)}:${s.directive}`);
    byConcept.set(s.conceptId, c);
  }
  if (byConcept.size) {
    lines.push('', 'Per concept (first-time-right per session):');
    for (const [id, c] of byConcept) {
      lines.push(`  ${id}: [${c.ftr.join(', ')}]/10 over ${c.n} session${c.n === 1 ? '' : 's'} · 👍${c.seconds} 🌿${c.parked}${c.directives.length ? ` · ${c.directives.join(' ')}` : ''}`);
    }
  }

  // recently parked questions (the "with umma later" list)
  const parkedTexts: string[] = [];
  for (const s of [...state.sessions].reverse()) {
    for (const r of s.results) {
      if (r.tier === 'parked' && r.text && !parkedTexts.includes(r.text)) parkedTexts.push(r.text);
    }
    if (parkedTexts.length >= 8) break;
  }
  if (parkedTexts.length) {
    lines.push('', 'Recently parked:');
    for (const t of parkedTexts.slice(0, 8)) lines.push(`  • ${t}`);
  }

  lines.push('', 'Recent sessions:');
  for (const s of state.sessions.slice(-8).reverse()) {
    lines.push(`  ${s.date} · ${s.kind ?? 'lesson'} · ${s.conceptId} · ⭐${s.ftr} 👍${s.secondLooks} 🌿${s.parked}/${s.total}${s.directive && s.directive !== 'normal' ? ` (${s.directive})` : ''}`);
  }

  return lines.join('\n');
}

/** Share via the iOS share sheet when available, else clipboard. Returns how it was delivered. */
export async function shareSummary(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
  } catch {
    // user cancelled the share sheet — fall through to clipboard
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
