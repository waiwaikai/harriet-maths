import { useMemo, useState } from 'react';
import type { Bank, ItemResult, ProgressState, WarmupResult, WeekSpec } from '../content/types';
import { buildFlexTen, buildFridayTen, buildIndependentTen, buildWarmup, type RecallDeps } from '../engine/recall';
import type { DayPlan } from '../engine/scheduler';
import { getBank, spine } from '../content/loadBank';
import { recordSession } from '../store/progress';
import { stopSpeaking } from '../voice/tts';
import { WarmupPage } from './together/WarmupPage';
import { ConceptPage } from './together/ConceptPage';
import { TenPage } from './together/TenPage';

interface Props {
  bank: Bank;
  week: WeekSpec;
  plan: DayPlan;
  dateISO: string;
  state: ProgressState;
  setState: (s: ProgressState) => void;
  onExit: () => void;
}

const deps: RecallDeps = { spine, getBank };

/** Together mode: 3 pages — warm-up (umma) → concept/recap (umma) → Harriet's 10 (kid). */
export function Session({ bank, week, plan, dateISO, state, setState, onExit }: Props) {
  const kind = plan.kind === 'revision' ? 'revision' : plan.kind === 'flex' ? 'flex' : 'lesson';
  const directive = plan.kind === 'lesson' ? plan.directive : 'normal';

  const warmup = useMemo(() => buildWarmup(state, bank, dateISO, deps), [bank, dateISO]);
  const ten = useMemo(() => {
    if (kind === 'revision') return buildFridayTen(state, bank, week.id, dateISO);
    if (kind === 'flex') return buildFlexTen(state, bank, dateISO, deps);
    return buildIndependentTen(bank, dateISO, directive);
  }, [bank, dateISO, kind, directive]);

  const [page, setPage] = useState<1 | 2 | 3>(1);
  const [warmupMarks, setWarmupMarks] = useState<WarmupResult[]>([]);
  const [finalResults, setFinalResults] = useState<ItemResult[] | null>(null);

  function handleFinish(results: ItemResult[]) {
    const next = recordSession(state, {
      date: dateISO, mode: 'together', weekId: week.id, conceptId: bank.conceptId,
      results, warmup: warmupMarks, kind, directive,
    });
    setState(next);
    setFinalResults(results);
  }

  const ftr = finalResults?.filter(r => r.tier === 'ftr').length ?? 0;
  const seconds = finalResults?.filter(r => r.tier === 'second-look').length ?? 0;
  const parked = finalResults?.filter(r => r.tier === 'parked').length ?? 0;

  // this week's parked/second-look items, for the revision recap
  const weekStruggles = useMemo(() => {
    const seen = new Set<string>();
    return state.sessions
      .filter(s => s.weekId === week.id)
      .flatMap(s => s.results)
      .filter(r => r.tier !== 'ftr' && r.text && !seen.has(r.text) && (seen.add(r.text), true));
  }, [state.sessions, week.id]);

  return (
    <div className="session">
      <header className="sessionbar">
        <button className="linkish" onClick={() => { stopSpeaking(); onExit(); }}>← exit</button>
        <div className="phasedots">
          {([1, 2, 3] as const).map(p => (
            <span key={p} className={`dot ${page === p && !finalResults ? 'active' : ''} ${page > p || finalResults ? 'past' : ''}`}>
              {p === 1 ? '🔥' : p === 2 ? '📖' : '💪'}
            </span>
          ))}
        </div>
        <div className="qcount" />
      </header>

      {finalResults ? (
        <div className="card donecard">
          <h2 className="phasetitle">🎉 All done!</h2>
          <div className="bigscore">{ftr + seconds} / {ten.length}</div>
          <div className="scoredetail">
            <div>⭐ First try: <b>{ftr}</b></div>
            {seconds > 0 && <div>👍 After a look: <b>{seconds}</b></div>}
            {parked > 0 && <div>🌿 With umma later: <b>{parked}</b></div>}
          </div>
          <div className="streak">🔥 Streak: {state.streak} day{state.streak === 1 ? '' : 's'}</div>
          <button className="primary" onClick={onExit}>Finish</button>
        </div>
      ) : page === 1 ? (
        <WarmupPage items={warmup} onDone={marks => { setWarmupMarks(marks); setPage(2); }} />
      ) : page === 2 ? (
        kind === 'lesson' ? (
          <ConceptPage bank={bank} focus={week.focus} directive={directive} settings={state.settings} onNext={() => setPage(3)} />
        ) : (
          <div className="card">
            <h2 className="phasetitle">{kind === 'flex' ? '🌈 Catch-up & stretch week' : '📚 Friday revision'}</h2>
            <div className="todayhead">{kind === 'flex' ? 'Revision across everything so far' : `This week: ${week.focus}`}</div>
            <p className="introtext">
              {kind === 'flex'
                ? 'No new concept — today sweeps back across the term, leaning on anything she found tricky.'
                : 'No new concept on Fridays — her 10 leans on the questions she didn’t get first-time this week, plus fresh ones.'}
            </p>
            {weekStruggles.length > 0 && (
              <>
                <div className="parentnote">🌿 Worth a quick chat before she starts:</div>
                <ul className="strugglelist">
                  {weekStruggles.slice(0, 5).map((r, i) => <li key={i}>{r.text}</li>)}
                </ul>
              </>
            )}
            <button className="primary bigstart" onClick={() => setPage(3)}>Make Harriet’s 10 questions →</button>
          </div>
        )
      ) : (
        <TenPage items={ten} settings={state.settings} onFinish={handleFinish} />
      )}
    </div>
  );
}
