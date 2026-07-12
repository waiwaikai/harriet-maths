import { useState } from 'react';
import type { ProgressState } from '../content/types';
import type { DayPlan } from '../engine/scheduler';
import { calendarWeekIndex, effectiveToday, resolveActiveIndex } from '../engine/scheduler';
import { getBank, spine } from '../content/loadBank';
import { buildPlan, gapsSummary, isComplete, LADDER_NAMES, VERDICT_LABEL, verdict } from '../engine/placement';
import { buildProgressSummary, shareSummary } from '../engine/summary';
import { todaysSession, updateSettings } from '../store/progress';

interface Props {
  state: ProgressState;
  setState: (s: ProgressState) => void;
  plan: DayPlan;
  onStart: (weekId: string) => void;
  onStartDiagnostic: () => void;
}

export function Home({ state, setState, plan, onStart, onStartDiagnostic }: Props) {
  const [showParent, setShowParent] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const today = effectiveToday(state.settings.dateOverride);
  const alreadyDone = todaysSession(state, today);

  const week = plan.kind === 'lesson' || plan.kind === 'revision' || plan.kind === 'flex' ? plan.week : null;
  const startable = week && getBank(week.id);
  const drift = plan.kind === 'lesson' || plan.kind === 'revision' ? plan.drift : 0;

  const headline =
    plan.kind === 'flex' ? '🌈 Catch-up & stretch week'
    : plan.kind === 'revision' ? '📚 Friday revision'
    : plan.kind === 'lesson' && plan.directive === 'depth' ? `🌟 Depth day: ${plan.week.focus}`
    : plan.kind === 'lesson' && plan.directive === 'reteach' ? `🔁 Practice-again day: ${plan.week.focus}`
    : plan.kind === 'lesson' ? `Today: ${plan.week.focus}`
    : '';

  return (
    <div className="home">
      <h1 className="apptitle">Harriet is a Maths Whiz! 🦘</h1>
      <div className="streakbadge">🔥 {state.streak} day streak</div>

      <div className="card todaycard">
        {plan.kind === 'pre-term' && (
          <>
            <div className="todayhead">School starts {fmtDate(plan.termStart)}</div>
            {isComplete(state.diagnostic) ? (
              <>
                <p>✅ Placement diagnostic done — the report is in umma’s corner. See you on day one! 💛</p>
                <button className="ghost" onClick={onStartDiagnostic}>Redo the diagnostic</button>
              </>
            ) : (
              <>
                <p>Before term starts: a one-off placement session — six little games, ~15 minutes, umma marks.</p>
                <button className="primary bigstart" onClick={onStartDiagnostic}>🧭 Do the placement games</button>
              </>
            )}
          </>
        )}
        {plan.kind === 'weekend' && <div className="todayhead">It’s the weekend — no maths today! 🏖️</div>}
        {plan.kind === 'holiday' && <div className="todayhead">School holidays! Back {fmtDate(plan.nextTermStart)} 🌈</div>}
        {plan.kind === 'after-year' && <div className="todayhead">The year is finished — amazing work! 🎓</div>}
        {week && (
          <>
            <div className="todayhead">{headline}</div>
            <div className="todaysub">
              Term {week.term} · Week {week.week}
              {drift > 0 ? ` · 🐢 ${drift} week${drift === 1 ? '' : 's'} behind calendar` : ''}
              {alreadyDone ? ' · ✅ done today!' : ''}
            </div>
            {startable ? (
              <button className="primary bigstart" onClick={() => onStart(week.id)}>
                {alreadyDone ? 'Play again ▶️' : 'Start! ▶️'}
              </button>
            ) : (
              <p className="parentnote">⚠️ No question bank built for {week.id} yet.</p>
            )}
          </>
        )}
      </div>

      <button className="linkish parenttoggle" onClick={() => setShowParent(!showParent)}>
        {showParent ? 'hide' : ''} umma’s corner ⚙️
      </button>

      {showParent && (
        <div className="card parentcard">
          <label>
            Pretend today is:
            <input
              type="date"
              value={state.settings.dateOverride ?? ''}
              onChange={e => setState(updateSettings(state, { dateOverride: e.target.value || null }))}
            />
          </label>
          <button className="ghost" onClick={() => setState(updateSettings(state, { dateOverride: '2026-07-21' }))}>
            Jump to Term 3 Week 1 (Tue 21 Jul)
          </button>
          {state.settings.dateOverride && (
            <button className="ghost" onClick={() => setState(updateSettings(state, { dateOverride: null }))}>
              Back to real today
            </button>
          )}
          {isComplete(state.diagnostic) && (
            <div className="diagreport">
              <b>🧭 Placement report ({state.diagnostic!.date})</b>
              {Object.entries(state.diagnostic!.levels).map(([id, lvl]) => (
                <div key={id} className="diagline">
                  {LADDER_NAMES[id] ?? id}: {VERDICT_LABEL[verdict(lvl)]} <span className="diaglvl">(rung {lvl})</span>
                </div>
              ))}
              {gapsSummary(state.diagnostic!.levels).length > 0 && (
                <div className="diagline"><b>Front-load:</b> {gapsSummary(state.diagnostic!.levels).join(', ')} — already up-weighted in warm-ups.</div>
              )}
              <b style={{ display: 'block', marginTop: 8 }}>📋 Recommended plan</b>
              {buildPlan(state.diagnostic!.levels).map((l, i) => (
                <div key={i} className="diagline"><b>{l.period}</b> · {l.topic} — {l.note}</div>
              ))}
            </div>
          )}
          <button
            className="ghost"
            onClick={async () => {
              const outcome = await shareSummary(buildProgressSummary(state, today, spine));
              setShareStatus(outcome === 'shared' ? '✅ shared' : outcome === 'copied' ? '✅ copied — paste it to Claude' : '⚠️ couldn’t copy — screenshot instead');
            }}
          >
            📋 Copy progress summary {shareStatus && `· ${shareStatus}`}
          </button>
          <div className="sessionlog">
            <b>Position:</b> {positionLine(state, today)}
            <br />
            <b>Sessions:</b>
            {state.sessions.length === 0 && <div>none yet</div>}
            {state.sessions.slice(-5).reverse().map((s, i) => (
              <div key={i}>
                {s.date} · {s.conceptId}{s.directive && s.directive !== 'normal' ? ` (${s.directive})` : ''} · ⭐{s.ftr} 👍{s.secondLooks} 🌿{s.parked} / {s.total}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function positionLine(state: ProgressState, today: string): string {
  const cal = calendarWeekIndex(today, spine);
  if (cal < 0) return 'term not started';
  const active = resolveActiveIndex(state, today, spine);
  const w = spine.weeks[active];
  const drift = cal - active;
  return `${w.id} (${w.focus})${drift > 0 ? ` — ${drift} wk behind calendar, flex weeks will absorb` : ' — on track'}`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
}
