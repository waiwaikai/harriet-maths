import type { Bank, DayDirective, Item, ProgressState, Spine } from '../content/types';
import { generators, seededRng, shuffle } from '../content/generators';
import { daysBetween, struggleScores } from './adaptivity';

export interface RecallDeps {
  spine: Spine;
  getBank: (weekId: string) => Bank | null;
}

/** Concepts with at least one recorded session, with the date they were last worked on. */
function coveredConcepts(state: ProgressState): { conceptId: string; weekId: string; lastDate: string }[] {
  const map = new Map<string, { conceptId: string; weekId: string; lastDate: string }>();
  for (const s of state.sessions) {
    const prev = map.get(s.conceptId);
    if (!prev || s.date > prev.lastDate) map.set(s.conceptId, { conceptId: s.conceptId, weekId: s.weekId, lastDate: s.date });
  }
  return [...map.values()];
}

/** Recall items available for a concept: authored bank items + parametric generator. */
function itemsForConcept(conceptId: string, weekId: string, deps: RecallDeps, seed: string, maxDifficulty: 1 | 2 | 3): Item[] {
  const bank = deps.getBank(weekId);
  const authored = (bank ? [...bank.warmupWins, ...bank.items] : []).filter(i => i.difficulty <= maxDifficulty);
  const gen = generators[conceptId];
  const generated = gen ? gen(`recall-${seed}-${conceptId}`, 3, Math.min(maxDifficulty, 2) as 1 | 2) : [];
  return [...authored, ...generated].map(i => ({ ...i, conceptId }));
}

/**
 * §5 three-bucket spaced warm-up: last week / 3–4 weeks ago / term-start pool,
 * weighted toward concepts with recent struggle (parks, crosses, prompts).
 * Always opens on a guaranteed win. 3 questions, deterministic per day.
 */
export function buildWarmup(state: ProgressState, currentBank: Bank, dateISO: string, deps: RecallDeps): Item[] {
  const rng = seededRng(`warmup-${dateISO}`);
  const covered = coveredConcepts(state).filter(c => c.conceptId !== currentBank.conceptId);
  // yesterday's warm-up shouldn't come round again today while the pool allows
  const recent = new Set<string>();
  for (const s of state.sessions) {
    if (daysBetween(s.date, dateISO) > 2 || s.date > dateISO) continue;
    for (const w of s.warmup ?? []) recent.add(w.itemId);
  }
  const notRecent = (pool: Item[]) => {
    const fresh = pool.filter(i => !recent.has(i.id));
    return fresh.length ? fresh : pool;
  };

  // no history yet → easy wins from the current bank
  if (covered.length === 0) {
    return shuffle(rng, currentBank.warmupWins).slice(0, 3).map(i => ({ ...i, conceptId: currentBank.conceptId }));
  }

  const struggles = struggleScores(state, dateISO);

  // bucket weight by recency + struggle boost
  const weighted = covered.map(c => {
    const days = daysBetween(c.lastDate, dateISO);
    const bucket = days <= 10 ? 0.45 : days <= 30 ? 0.35 : 0.2;
    return { ...c, weight: bucket * (1 + Math.min(struggles[c.conceptId] ?? 0, 3)) };
  });

  const picks: Item[] = [];

  // 1 · guaranteed win: least-struggled covered concept, easiest item
  const winConcept = [...weighted].sort((a, b) => (struggles[a.conceptId] ?? 0) - (struggles[b.conceptId] ?? 0))[0];
  const winPool = notRecent(itemsForConcept(winConcept.conceptId, winConcept.weekId, deps, dateISO, 1));
  if (winPool.length) picks.push(winPool[Math.floor(rng() * winPool.length)]);

  // 2–3 · weighted picks across the pool
  for (let k = 0; k < 2; k++) {
    const total = weighted.reduce((s, c) => s + c.weight, 0);
    let roll = rng() * total;
    const chosen = weighted.find(c => (roll -= c.weight) <= 0) ?? weighted[weighted.length - 1];
    const pool = notRecent(itemsForConcept(chosen.conceptId, chosen.weekId, deps, `${dateISO}-${k}`, 2)
      .filter(i => !picks.some(p => p.id === i.id)));
    if (pool.length) picks.push(pool[Math.floor(rng() * pool.length)]);
  }

  // top up from current bank if the pool ran dry
  while (picks.length < 3) {
    const fallback = currentBank.warmupWins.filter(i => !picks.some(p => p.id === i.id));
    if (!fallback.length) break;
    picks.push({ ...fallback[0], conceptId: currentBank.conceptId });
  }
  return picks.slice(0, 3);
}

/**
 * Questions she has already been asked in the last `days` days, by text.
 * A concept runs Mon–Thu, so without this the small authored pool at a given
 * difficulty repeats every single day and the week feels stuck.
 */
export function recentlyAskedTexts(state: ProgressState, dateISO: string, days = 6): Set<string> {
  const seen = new Set<string>();
  for (const s of state.sessions) {
    if (daysBetween(s.date, dateISO) > days || s.date > dateISO) continue;
    for (const r of s.results) if (r.text) seen.add(r.text);
  }
  return seen;
}

/**
 * Up to `need` items she hasn't just seen. Deliberately returns SHORT rather
 * than padding with repeats — the parametric generator fills the gap, which is
 * what keeps a Mon–Thu week feeling fresh once the authored pool is used up.
 */
function unseen(rng: () => number, pool: Item[], need: number, recent: Set<string>): Item[] {
  return shuffle(rng, pool.filter(i => !recent.has(i.text))).slice(0, need);
}

/** The independent 10 for a lesson day, pitched by the adaptivity directive. */
export function buildIndependentTen(
  bank: Bank,
  dateISO: string,
  directive: DayDirective = 'normal',
  recent: Set<string> = new Set(),
): Item[] {
  const rng = seededRng(`youdo-${dateISO}-${bank.bankId}-${directive}`);
  const gen = generators[bank.conceptId];
  const band: 1 | 2 | 3 = directive === 'reteach' ? 1 : directive === 'depth' ? 3 : 2;
  const authoredPool = directive === 'reteach'
    ? bank.items.filter(i => i.difficulty <= 2)
    : directive === 'depth'
      ? bank.items.filter(i => i.difficulty >= 3)
      : bank.items;
  // Deliberately modest: a concept runs Mon–Thu and authored items never repeat
  // within the week, so taking only a few a day keeps story-framed questions
  // (her literacy on-ramp) present every day instead of all on Monday.
  const wantAuthored = directive === 'normal' ? 3 : 2;

  const authored = unseen(rng, authoredPool, wantAuthored, recent);
  const taken = new Set([...authored.map(i => i.text), ...recent]);
  // over-generate so filtering out repeats still leaves a full set
  const generated = (gen ? gen(`${dateISO}-${bank.bankId}-${directive}`, 40, band) : [])
    .filter(i => !taken.has(i.text))
    .filter((i, idx, arr) => arr.findIndex(o => o.text === i.text) === idx)
    .slice(0, 10 - authored.length);

  const out = [...authored, ...generated];
  // only if both pools ran dry does anything she's already seen come back
  if (out.length < 10) {
    for (const i of shuffle(rng, [...authoredPool, ...(gen ? gen(`${dateISO}-${bank.bankId}-fill`, 40, band) : [])])) {
      if (out.length >= 10) break;
      if (!out.some(o => o.text === i.text)) out.push(i);
    }
  }
  return shuffle(rng, out);
}

/**
 * The optional "10 more" after the daily set: same concept, one notch harder
 * than the first ten, never repeating a question she just saw.
 */
export function buildBonusTen(bank: Bank, dateISO: string, firstDirective: DayDirective, exclude: Item[]): Item[] {
  const rng = seededRng(`bonus-${dateISO}-${bank.bankId}`);
  const gen = generators[bank.conceptId];
  const used = new Set(exclude.map(i => i.text));
  const difficulty: 1 | 2 | 3 = firstDirective === 'reteach' ? 2 : 3;
  const authored = shuffle(rng, bank.items.filter(i => i.difficulty === difficulty && !used.has(i.text))).slice(0, 4);
  const generated = (gen ? gen(`bonus-${dateISO}-${bank.bankId}`, 12, difficulty) : [])
    .filter(i => !used.has(i.text) && !authored.some(a => a.text === i.text));
  return shuffle(rng, [...authored, ...generated]).slice(0, 10);
}

/**
 * Friday: this week's content, front-loading the exact questions she didn't
 * get first-time-right this week, topped up with fresh variants.
 */
export function buildFridayTen(state: ProgressState, bank: Bank, weekId: string, dateISO: string): Item[] {
  const rng = seededRng(`friday-${dateISO}-${weekId}`);

  const struggled: Item[] = [];
  const seen = new Set<string>();
  const weekSessions = state.sessions
    .filter(s => s.weekId === weekId)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const s of weekSessions) {
    for (const r of s.results) {
      if (r.tier !== 'ftr' && r.text && r.expected !== undefined && !seen.has(r.text)) {
        seen.add(r.text);
        struggled.push({
          id: `retry-${r.itemId}`, kind: 'plain', text: r.text, say: r.text,
          answer: r.expected, difficulty: 2, conceptId: bank.conceptId,
        });
      }
    }
  }

  const picked = struggled.slice(0, 6);
  const fresh = [
    ...shuffle(rng, bank.items.filter(i => !picked.some(p => p.text === i.text))).slice(0, 3),
    ...(generators[bank.conceptId] ? generators[bank.conceptId](`${dateISO}-friday`, 10, 2) : []),
  ].filter(i => !seen.has(i.text));

  return shuffle(rng, [...picked, ...fresh.slice(0, 10 - picked.length)]);
}

/** Flex-week sessions: a Friday-style sweep across every concept covered so far, weighted to struggle. */
export function buildFlexTen(state: ProgressState, currentBank: Bank, dateISO: string, deps: RecallDeps): Item[] {
  const rng = seededRng(`flex-${dateISO}`);
  const covered = coveredConcepts(state);
  if (covered.length === 0) return buildIndependentTen(currentBank, dateISO);

  const struggles = struggleScores(state, dateISO);
  const ranked = [...covered].sort((a, b) => (struggles[b.conceptId] ?? 0) - (struggles[a.conceptId] ?? 0));

  const picks: Item[] = [];
  let round = 0;
  while (picks.length < 10 && round < 6) {
    for (const c of ranked) {
      if (picks.length >= 10) break;
      const pool = itemsForConcept(c.conceptId, c.weekId, deps, `${dateISO}-${round}`, 2)
        .filter(i => !picks.some(p => p.id === i.id || p.text === i.text));
      if (pool.length) picks.push(pool[Math.floor(rng() * pool.length)]);
    }
    round++;
  }
  return shuffle(rng, picks).slice(0, 10);
}
