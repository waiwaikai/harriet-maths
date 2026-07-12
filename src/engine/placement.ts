import type { DiagnosticMark, DiagnosticResult, Ladder } from '../content/types';

/** Highest rung with a clean ✓ per ladder (a ? doesn't lift the level, a ✗ never does). */
export function computeLevels(marks: DiagnosticMark[], ladders: Ladder[]): Record<string, number> {
  const levels: Record<string, number> = {};
  for (const ladder of ladders) {
    const ticks = marks.filter(m => m.ladderId === ladder.id && m.mark === 'tick');
    levels[ladder.id] = ticks.length ? Math.max(...ticks.map(m => m.level)) : 0;
  }
  return levels;
}

export type StrandVerdict = 'gap' | 'developing' | 'on-track' | 'strong';

/** Year-2 mid-year baseline sits around rung 3–4 of each ladder. */
export function verdict(level: number): StrandVerdict {
  if (level <= 1) return 'gap';
  if (level <= 2) return 'developing';
  if (level <= 4) return 'on-track';
  return 'strong';
}

export const VERDICT_LABEL: Record<StrandVerdict, string> = {
  'gap': '🔴 needs front-loading',
  'developing': '🟠 developing',
  'on-track': '🟢 on track',
  'strong': '⭐ strong',
};

export const LADDER_NAMES: Record<string, string> = {
  counting: 'Counting & number sense',
  placevalue: 'Place value',
  bonds: 'Number bonds',
  addsub: 'Addition & subtraction',
  fractions: 'Halves & quarters',
  mult: 'Multiplication readiness',
};

export interface PlanLine {
  period: string;
  topic: string;
  note: string;
}

/** Rule-based recommended plan for T3/T4, from diagnostic levels. */
export function buildPlan(levels: Record<string, number>): PlanLine[] {
  const v = (id: string) => verdict(levels[id] ?? 0);
  const lines: PlanLine[] = [];

  const pv = v('placevalue');
  lines.push({
    period: 'T3 W1–2',
    topic: 'Place value to 1000',
    note: pv === 'strong'
      ? 'She’s ahead here — expect depth days quickly; let the app stretch her rather than lingering.'
      : pv === 'on-track'
        ? 'As planned. Lean on “what is this digit worth?” questions — the report card’s exact focus.'
        : 'Priority consolidation. Take W1 slowly with blocks before symbols; expect some practice-again days.',
  });

  const bd = v('bonds');
  lines.push({
    period: 'T3 W3',
    topic: 'Number bonds & add–sub relationship',
    note: bd === 'strong' || bd === 'on-track'
      ? 'As planned — bonds are the foundation the subtraction weeks stand on, so don’t skip it even if it feels easy.'
      : 'Give this full weight — weak bonds are usually the real cause of subtraction struggles later.',
  });

  const as = v('addsub');
  lines.push({
    period: 'T3 W4 + W8–9',
    topic: 'Add/sub strategies → 2–3 digit written',
    note: as === 'gap' || as === 'developing'
      ? 'The stretch of the year (matches what you’ve seen with 42−27). Expect the 1-week extension to trigger here — that’s by design, and flex week T3 W10 will absorb it. Warm-ups will keep re-surfacing subtraction all term.'
      : 'Watch bridging-ten subtraction specifically; the app will up-weight anything she misses.',
  });

  const ml = v('mult');
  lines.push({
    period: 'T3 W5–6 + T4 W1–3',
    topic: 'Multiplication & division',
    note: ml === 'strong'
      ? 'Her comfort zone, as you suspected — expect depth days and use them; arrays can carry harder reasoning problems.'
      : 'As planned.',
  });

  const fr = v('fractions');
  lines.push({
    period: 'T3 W6 + T4 W4',
    topic: 'Fractions (lengths → number line)',
    note: fr === 'gap' || fr === 'developing'
      ? 'Do the T3 W6 fraction work concretely (paper folding) so the T4 number-line week lands.'
      : 'As planned.',
  });

  lines.push({
    period: 'T4 W5',
    topic: 'Decimals (place value to 2dp)',
    note: pv === 'gap' || pv === 'developing'
      ? 'Decimals lean entirely on place value — if PV is still shaky by November, spend the flex week (T4 W9) here.'
      : 'Should follow naturally from her place-value base.',
  });

  lines.push({
    period: 'Flex weeks (T3 W10, T4 W9)',
    topic: 'Buffer',
    note: 'Absorb any drift from stretched weeks or sick days; if unused, they run as revision + extension automatically.',
  });

  return lines;
}

/** One-line gaps summary for seeding conversations (and the report header). */
export function gapsSummary(levels: Record<string, number>): string[] {
  return Object.entries(levels)
    .filter(([, lvl]) => verdict(lvl) === 'gap' || verdict(lvl) === 'developing')
    .map(([id]) => LADDER_NAMES[id] ?? id);
}

export function isComplete(d: DiagnosticResult | null | undefined): boolean {
  return !!d && d.marks.length > 0;
}
