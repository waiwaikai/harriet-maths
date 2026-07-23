/**
 * Engine unit tests: scheduler position/drift/flex logic, adaptivity
 * directives, recall selection. Run: npx tsx scripts/test-engines.ts
 */
import type { Bank, ProgressState, SessionRecord, Spine } from '../src/content/types';
import { advanceSpine, calendarWeekIndex, lessonDaysInWeek, planToday } from '../src/engine/scheduler';
import { nextDirective, struggleScores } from '../src/engine/adaptivity';
import { buildBonusTen, buildFridayTen, buildIndependentTen, buildWarmup, type RecallDeps } from '../src/engine/recall';
import { defaultState } from '../src/store/persistence';
import spineJson from '../content/spine.json';
import t3w1 from '../content/banks/t3-w1.json';

const spine = spineJson as Spine;
const bankW1 = t3w1 as unknown as Bank;

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.log(`FAIL  ${name} ${detail}`); }
}

function freshState(): ProgressState {
  return defaultState();
}

function lessonRec(date: string, conceptId: string, weekId: string, ftr: number): SessionRecord {
  return {
    date, mode: 'together', weekId, conceptId, total: 10, ftr,
    secondLooks: Math.min(10 - ftr, 2), parked: Math.max(0, 10 - ftr - 2),
    results: [], kind: 'lesson', directive: 'normal',
  };
}

function addSession(state: ProgressState, rec: SessionRecord): ProgressState {
  const nextSpine = advanceSpine(state, rec, spine);
  return { ...state, sessions: [...state.sessions, rec], lastSessionDate: rec.date, spine: nextSpine };
}

// ---------- calendar basics ----------
console.log('\n== scheduler: calendar ==');
check('pre-term', planToday(freshState(), '2026-07-15', spine).kind === 'pre-term');
check('weekend', planToday(freshState(), '2026-07-25', spine).kind === 'weekend');
check('holiday', planToday(freshState(), '2026-09-30', spine).kind === 'holiday');
check('after-year', planToday(freshState(), '2026-12-20', spine).kind === 'after-year');
check('W1 lesson Tue', (() => { const p = planToday(freshState(), '2026-07-21', spine); return p.kind === 'lesson' && p.week.id === 't3-w1'; })());
check('Friday revision', (() => { const p = planToday(freshState(), '2026-07-24', spine); return p.kind === 'revision'; })());
check('W1 has 3 lesson days (Tue-Thu)', lessonDaysInWeek(spine.weeks[0]) === 3, `got ${lessonDaysInWeek(spine.weeks[0])}`);
check('W2 has 4 lesson days', lessonDaysInWeek(spine.weeks[1]) === 4, `got ${lessonDaysInWeek(spine.weeks[1])}`);
check('calendarWeekIndex mid-W3', calendarWeekIndex('2026-08-05', spine) === 2);

// ---------- normal progression ----------
console.log('\n== scheduler: normal week ==');
let s = freshState();
s = addSession(s, lessonRec('2026-07-21', 'pv-1000-consolidate', 't3-w1', 7));
check('after day 1: still W1', s.spine.activeIndex === 0);
s = addSession(s, lessonRec('2026-07-22', 'pv-1000-consolidate', 't3-w1', 7));
s = addSession(s, lessonRec('2026-07-23', 'pv-1000-consolidate', 't3-w1', 7));
check('after 3 lesson days (W1 allotment): advanced to W2', s.spine.activeIndex === 1, `got ${s.spine.activeIndex}`);
check('Friday still revises W2-position week', planToday(s, '2026-07-24', spine).kind === 'revision');

// ---------- ahead of calendar: hold position, serve bonus depth days ----------
console.log('\n== scheduler: ahead of calendar ==');
// s is now: 3 lesson days done, activeIndex = 1 (W2) but calendar still W1 (Thu 23 Jul)
const pAhead = planToday(s, '2026-07-23', spine);
check('ahead: Thursday serves the CALENDAR week, not W2',
  pAhead.kind === 'lesson' && pAhead.week.id === 't3-w1', `got ${JSON.stringify(pAhead)}`);
check('ahead: served as a depth day with ahead flag',
  pAhead.kind === 'lesson' && pAhead.directive === 'depth' && pAhead.ahead === 1);
const pAheadFri = planToday(s, '2026-07-24', spine);
check('ahead: Friday revision stays on the calendar week',
  pAheadFri.kind === 'revision' && pAheadFri.week.id === 't3-w1', `got ${JSON.stringify(pAheadFri)}`);
const pMon = planToday(s, '2026-07-27', spine);
check('ahead: Monday next week back to planned W2 content',
  pMon.kind === 'lesson' && pMon.week.id === 't3-w2' && (pMon.ahead ?? 0) === 0, `got ${JSON.stringify(pMon)}`);
// parent-facing position lines lead with the week being SERVED, not the internal mastery week
import { buildProgressSummary } from '../src/engine/summary';
const aheadSummary = buildProgressSummary(s, '2026-07-24', spine);
const posLine = aheadSummary.split('\n').find(l => l.startsWith('Position:'))!;
check('ahead: summary position line leads with the calendar week',
  posLine.startsWith('Position: t3-w1'), posLine);
check('ahead: summary says when the next week starts', posLine.includes('t3-w2 starts 2026-07-27'), posLine);

// a depth day served while ahead consumes nothing and never advances further
// (sessions cleared so the same-day replay guard doesn't mask the ahead guard)
const spAheadDay = advanceSpine({ ...s, sessions: [] }, lessonRec('2026-07-23', 'pv-partitioning', 't3-w1', 9), spine);
check('ahead: extra day does not consume lesson days or advance',
  spAheadDay.activeIndex === 1 && (spAheadDay.lessonDaysDone['pv-partitioning'] ?? 0) === 0);

// replay same day must not double-advance
let s2 = freshState();
s2 = addSession(s2, lessonRec('2026-07-21', 'pv-1000-consolidate', 't3-w1', 7));
const spReplay = advanceSpine(s2, lessonRec('2026-07-21', 'pv-1000-consolidate', 't3-w1', 9), spine);
check('same-day replay does not advance', spReplay.lessonDaysDone['pv-1000-consolidate'] === 1);

// ---------- struggle: extension capped at one week ----------
console.log('\n== scheduler: struggle extension ==');
s = freshState();
s = addSession(s, lessonRec('2026-07-21', 'pv-1000-consolidate', 't3-w1', 3));
s = addSession(s, lessonRec('2026-07-22', 'pv-1000-consolidate', 't3-w1', 3));
s = addSession(s, lessonRec('2026-07-23', 'pv-1000-consolidate', 't3-w1', 3));
check('struggling at week end: extends instead of advancing', s.spine.activeIndex === 0 && s.spine.extraDaysUsed === 1);
s = addSession(s, lessonRec('2026-07-27', 'pv-1000-consolidate', 't3-w1', 3));
s = addSession(s, lessonRec('2026-07-28', 'pv-1000-consolidate', 't3-w1', 3));
s = addSession(s, lessonRec('2026-07-29', 'pv-1000-consolidate', 't3-w1', 3));
check('extension cap reached (3 extra = W1 length): advances despite struggle', s.spine.activeIndex === 1, `idx=${s.spine.activeIndex} extra=${s.spine.extraDaysUsed}`);
// she's now doing W2's concept while the calendar rolls into W3 → drift shows next week
check('drift of 1 week visible next calendar week', calendarWeekIndex('2026-08-03', spine) - s.spine.activeIndex! === 1);

// recovery mid-extension advances promptly
let sr = freshState();
sr = addSession(sr, lessonRec('2026-07-21', 'pv-1000-consolidate', 't3-w1', 3));
sr = addSession(sr, lessonRec('2026-07-22', 'pv-1000-consolidate', 't3-w1', 3));
sr = addSession(sr, lessonRec('2026-07-23', 'pv-1000-consolidate', 't3-w1', 3)); // extend
sr = addSession(sr, lessonRec('2026-07-27', 'pv-1000-consolidate', 't3-w1', 7)); // recovered
check('recovery during extension: advances', sr.spine.activeIndex === 1, `idx=${sr.spine.activeIndex}`);

// ---------- flex absorption ----------
console.log('\n== scheduler: flex absorption ==');
// finishing W9's concept a week late, during calendar W10 (the flex week):
// remaining W10 days run as flex revision, then Term 4 starts on time — drift absorbed.
let sf = freshState();
sf.spine = { activeIndex: 8, extraDaysUsed: 0, lessonDaysDone: { 'sub-23digit': 3 } };
const recW9 = lessonRec('2026-09-22', 'sub-23digit', 't3-w9', 7); // calendar = W10 (idx 9)
const spF = advanceSpine(sf, recW9, spine);
check('late W9 finish: lands in the flex week', spF.activeIndex === 9, `got ${spF.activeIndex}`);
const sAfter = { ...sf, spine: spF };
check('rest of flex week runs as flex revision', planToday(sAfter, '2026-09-23', spine).kind === 'flex');
const pT4 = planToday(sAfter, '2026-10-13', spine);
check('Term 4 W1 starts on time — drift fully absorbed', pT4.kind === 'lesson' && pT4.week.id === 't4-w1', `got ${JSON.stringify(pT4)}`);
// severely behind: calendar already past the flex week → advance slides through it
let sPast = freshState();
sPast.spine = { activeIndex: 8, extraDaysUsed: 0, lessonDaysDone: { 'sub-23digit': 3 } };
const spPast = advanceSpine(sPast, lessonRec('2026-10-14', 'sub-23digit', 't3-w9', 7), spine);
check('calendar already past flex: advance skips it to t4-w1', spPast.activeIndex === 10, `got ${spPast.activeIndex}`);
// on-track flex week runs as flex
let sOn = freshState();
sOn.spine = { activeIndex: 9, extraDaysUsed: 0, lessonDaysDone: {} };
const pFlex = planToday(sOn, '2026-09-22', spine);
check('on-track flex week plans as flex', pFlex.kind === 'flex');

// ---------- adaptivity directives ----------
console.log('\n== adaptivity ==');
let sa = freshState();
check('no history → normal', nextDirective(sa, 'pv-1000-consolidate') === 'normal');
sa = addSession(sa, lessonRec('2026-07-21', 'pv-1000-consolidate', 't3-w1', 9));
check('9/10 immediately → depth', nextDirective(sa, 'pv-1000-consolidate') === 'depth');
sa = freshState();
sa = addSession(sa, lessonRec('2026-07-21', 'pv-1000-consolidate', 't3-w1', 8));
check('one 8/10 → normal (needs two)', nextDirective(sa, 'pv-1000-consolidate') === 'normal');
sa = addSession(sa, lessonRec('2026-07-22', 'pv-1000-consolidate', 't3-w1', 8));
check('8/10 twice → depth', nextDirective(sa, 'pv-1000-consolidate') === 'depth');
sa = addSession(sa, lessonRec('2026-07-23', 'pv-1000-consolidate', 't3-w1', 4));
check('≤4/10 → reteach', nextDirective(sa, 'pv-1000-consolidate') === 'reteach');
sa = addSession(sa, lessonRec('2026-07-27', 'pv-1000-consolidate', 't3-w1', 6));
check('5–7/10 → normal (hold)', nextDirective(sa, 'pv-1000-consolidate') === 'normal');

// struggle scores decay + warmup marks count
let ss = freshState();
const recStruggle = lessonRec('2026-07-21', 'pv-1000-consolidate', 't3-w1', 5);
recStruggle.warmup = [{ itemId: 'x', mark: 'cross', conceptId: 'bonds-addsub' }];
ss = addSession(ss, recStruggle);
const scores = struggleScores(ss, '2026-07-22');
check('parks feed struggle score', (scores['pv-1000-consolidate'] ?? 0) > 0);
check('warmup cross attributed to its concept', (scores['bonds-addsub'] ?? 0) > 2.5);
const scoresLater = struggleScores(ss, '2026-08-20');
check('struggle decays over time', (scoresLater['pv-1000-consolidate'] ?? 0) < (scores['pv-1000-consolidate'] ?? 0));

// ---------- recall ----------
console.log('\n== recall ==');
const deps: RecallDeps = { spine, getBank: (weekId) => (weekId === 't3-w1' ? bankW1 : null) };
let sw = freshState();
const w0 = buildWarmup(sw, bankW1, '2026-07-21', deps);
check('no history: 3 warmup wins from current bank', w0.length === 3 && w0.every(i => bankW1.warmupWins.some(w => w.id === i.id)));

// history on W1, now working W2 (different concept) → warmup draws from W1
sw = addSession(sw, lessonRec('2026-07-21', 'pv-1000-consolidate', 't3-w1', 7));
const fakeW2Bank: Bank = { ...bankW1, bankId: 't3-w2', conceptId: 'pv-partitioning' };
const w1 = buildWarmup(sw, fakeW2Bank, '2026-07-28', deps);
check('with history: 3 items, tagged with source concept', w1.length === 3 && w1.every(i => i.conceptId !== undefined));
check('with history: draws from covered concept pool', w1.some(i => i.conceptId === 'pv-1000-consolidate'));
const w1b = buildWarmup(sw, fakeW2Bank, '2026-07-28', deps);
check('warmup deterministic per date', JSON.stringify(w1.map(i => i.id)) === JSON.stringify(w1b.map(i => i.id)));

// Friday: struggled items re-asked
let sfri = freshState();
const recMiss = lessonRec('2026-07-21', 'pv-1000-consolidate', 't3-w1', 8);
recMiss.results = [
  { itemId: 'w1-a1', tier: 'parked', answer: 300, text: 'Harriet has 3 boxes of 100 stickers and 5 loose stickers. How many stickers altogether?', expected: 305 },
  { itemId: 'w1-a2', tier: 'second-look', answer: 240, text: 'The library has 2 shelves of 100 books and 4 stacks of 10 books. How many books?', expected: 240 },
  { itemId: 'w1-a4', tier: 'ftr', answer: 43, text: 'shells', expected: 43 },
];
sfri = addSession(sfri, recMiss);
const fri = buildFridayTen(sfri, bankW1, 't3-w1', '2026-07-24');
check('Friday has 10 items', fri.length === 10, `got ${fri.length}`);
check('Friday re-asks parked item', fri.some(i => i.answer === 305 && i.id.startsWith('retry-')));
check('Friday re-asks second-look item', fri.some(i => i.id === 'retry-w1-a2'));
check('Friday does not re-ask first-time-right item', !fri.some(i => i.id === 'retry-w1-a4'));
check('Friday items unique texts', new Set(fri.map(i => i.text)).size === fri.length);

// ---------- bonus ten ----------
console.log('\n== recall: bonus ten ==');
const firstTen = buildIndependentTen(bankW1, '2026-07-23', 'normal');
const bonus = buildBonusTen(bankW1, '2026-07-23', 'normal', firstTen);
check('bonus: 10 items', bonus.length === 10, `got ${bonus.length}`);
check('bonus: no repeats from the first set', !bonus.some(b => firstTen.some(f => f.text === b.text)));
check('bonus: pitched harder (all difficulty 3 after a normal set)', bonus.every(i => i.difficulty === 3));
check('bonus: deterministic per day',
  JSON.stringify(buildBonusTen(bankW1, '2026-07-23', 'normal', firstTen)) === JSON.stringify(bonus));
const reteachTen = buildIndependentTen(bankW1, '2026-07-23', 'reteach');
const bonusAfterReteach = buildBonusTen(bankW1, '2026-07-23', 'reteach', reteachTen);
check('bonus after reteach: one notch up, not depth', bonusAfterReteach.every(i => i.difficulty === 2));
// a bonus session never moves the spine position
let sb = freshState();
sb = addSession(sb, lessonRec('2026-07-21', 'pv-1000-consolidate', 't3-w1', 7));
const bonusRec: SessionRecord = { ...lessonRec('2026-07-22', 'pv-1000-consolidate', 't3-w1', 6), kind: 'bonus' };
const spBonus = advanceSpine(sb, bonusRec, spine);
check('bonus session does not consume a lesson day',
  (spBonus.lessonDaysDone['pv-1000-consolidate'] ?? 0) === 1 && spBonus.activeIndex === 0);

// ---------- placement ----------
console.log('\n== placement ==');
import type { DiagnosticMark, Ladder } from '../src/content/types';
import { buildPlan, computeLevels, gapsSummary, verdict } from '../src/engine/placement';
import diagnosticJson from '../content/diagnostic.json';

const ladders = (diagnosticJson as { ladders: Ladder[] }).ladders;
check('6 ladders authored', ladders.length === 6);
check('every diag item has a spine concept', ladders.every(l => l.items.every(i => i.conceptId.length > 0)));
check('ladders end on multiplication (her strength)', ladders[ladders.length - 1].id === 'mult');
check('addsub ladder includes 42−27 and 407−10', (() => {
  const as = ladders.find(l => l.id === 'addsub')!;
  return as.items.some(i => i.text.includes('42')) && as.items.some(i => i.text.includes('407'));
})());

const dm = (ladderId: string, level: number, mark: 'tick' | 'prompted' | 'cross'): DiagnosticMark =>
  ({ itemId: `${ladderId}-${level}`, ladderId, level, conceptId: 'x', mark });
const lv = computeLevels([
  dm('counting', 1, 'tick'), dm('counting', 2, 'tick'), dm('counting', 3, 'cross'), dm('counting', 4, 'cross'),
  dm('addsub', 1, 'tick'), dm('addsub', 2, 'prompted'), dm('addsub', 3, 'cross'), dm('addsub', 4, 'cross'),
  dm('mult', 1, 'tick'), dm('mult', 2, 'tick'), dm('mult', 3, 'tick'), dm('mult', 4, 'tick'), dm('mult', 5, 'tick'), dm('mult', 6, 'tick'),
], ladders);
check('level = highest clean tick (prompts/crosses don’t lift)', lv['counting'] === 2 && lv['addsub'] === 1 && lv['mult'] === 6);
check('unattempted ladder = level 0', lv['bonds'] === 0);
check('verdicts: 1→gap, 2→developing, 4→on-track, 6→strong',
  verdict(1) === 'gap' && verdict(2) === 'developing' && verdict(4) === 'on-track' && verdict(6) === 'strong');
check('gaps summary names weak strands', gapsSummary(lv).length >= 2);
const planLines = buildPlan(lv);
check('plan covers T3+T4+flex', planLines.length === 7);
check('weak addsub plan flags the stretch', planLines.some(l => l.note.includes('stretch of the year')));

// diagnostic marks seed struggle scores
let sd = freshState();
sd.diagnostic = {
  date: '2026-07-12',
  marks: [{ itemId: 'as6', ladderId: 'addsub', level: 6, conceptId: 'sub-23digit', mark: 'cross' }],
  levels: {},
};
const seedScores = struggleScores(sd, '2026-07-21');
check('diagnostic cross seeds warm-up weighting for its concept', (seedScores['sub-23digit'] ?? 0) > 1.5);

// ---------- content sanity: all authored banks ----------
console.log('\n== content: banks ==');
import { generators } from '../src/content/generators';
import t3w2 from '../content/banks/t3-w2.json';
import t3w3 from '../content/banks/t3-w3.json';
import t3w4 from '../content/banks/t3-w4.json';
import t3w5 from '../content/banks/t3-w5.json';

const allBanks = [
  ['t3-w1', bankW1],
  ['t3-w2', t3w2 as unknown as Bank],
  ['t3-w3', t3w3 as unknown as Bank],
  ['t3-w4', t3w4 as unknown as Bank],
  ['t3-w5', t3w5 as unknown as Bank],
] as const;

for (const [id, b] of allBanks) {
  const items = [...b.items, ...b.warmupWins];
  const ids = items.map(i => i.id);
  check(`${id}: unique item ids`, new Set(ids).size === ids.length);
  check(`${id}: all items numeric answers`, items.every(i => typeof i.answer === 'number' && Number.isFinite(i.answer)));
  check(`${id}: difficulties in 1–3`, items.every(i => i.difficulty >= 1 && i.difficulty <= 3));
  check(`${id}: has demo steps + 2 weDo + intro`, b.demo.steps.length >= 3 && b.weDo.length === 2 && b.parentIntro.length > 40);
  check(`${id}: warm-up wins are difficulty 1`, b.warmupWins.every(i => i.difficulty === 1));
  check(`${id}: has a generator`, typeof generators[b.conceptId] === 'function');
  check(`${id}: stretch band exists (d3 items)`, b.items.some(i => i.difficulty === 3));
}

// hand-verified answer spot checks (authored arithmetic)
console.log('\n== content: answer spot checks ==');
const findItem = (b: Bank, id: string) => [...b.items, ...b.warmupWins].find(i => i.id === id)!;
check('w2-a6: 2 hundreds 14 tens 3 ones = 343', findItem(allBanks[1][1], 'w2-a6').answer === 343);
check('w2-a8: 460 eggs, 30 cartons done → 16 left', findItem(allBanks[1][1], 'w2-a8').answer === 16);
check('w3-a6: 25 baked, 16 left → 9 eaten', findItem(allBanks[2][1], 'w3-a6').answer === 9);
check('w4-a5: 52−26 = 26', findItem(allBanks[3][1], 'w4-a5').answer === 26);
check('w4-a8: 62−25+8 = 45', findItem(allBanks[3][1], 'w4-a8').answer === 45);
check('w4-a9: 304−10 = 294', findItem(allBanks[3][1], 'w4-a9').answer === 294);
check('w5-a7: 4×5−2 = 18', findItem(allBanks[4][1], 'w5-a7').answer === 18);

// ---------- generators: verifiable arithmetic across difficulties ----------
console.log('\n== content: generators ==');
for (const conceptId of Object.keys(generators)) {
  for (const d of [1, 2, 3] as const) {
    const items = generators[conceptId](`test-${conceptId}`, 12, d);
    check(`${conceptId} d${d}: 12 items, numeric answers, non-negative`,
      items.length === 12 && items.every(i => Number.isFinite(i.answer) && i.answer >= 0));
    check(`${conceptId} d${d}: deterministic`,
      JSON.stringify(generators[conceptId](`test-${conceptId}`, 12, d)) === JSON.stringify(items));
  }
}
// bridging guarantee: every d3 addsub subtraction of the 42−27 shape actually bridges
const asItems = generators['addsub-strategies']('bridge-check', 30, 3)
  .map(i => i.text.match(/^What is (\d\d) − (\d\d)\?$/))
  .filter((m): m is RegExpMatchArray => m !== null);
check('addsub d3 two-digit subtractions all bridge (ones of a < ones of b)',
  asItems.length > 0 && asItems.every(m => parseInt(m[1], 10) % 10 < parseInt(m[2], 10) % 10));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
