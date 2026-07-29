import { useState } from 'react';
import type { ProgressState } from '../content/types';
import type { DayPlan } from '../engine/scheduler';
import { calendarWeekIndex, resolveActiveIndex, schoolDayLabel, toISO } from '../engine/scheduler';
import { getBank, spine } from '../content/loadBank';
import { buildPlan, gapsSummary, isComplete, LADDER_NAMES, VERDICT_LABEL, verdict } from '../engine/placement';
import { buildBackupUrl, buildProgressSummary, shareSummary } from '../engine/summary';
import { todaysSession, updateSettings } from '../store/progress';

interface Props {
  state: ProgressState;
  setState: (s: ProgressState) => void;
  plan: DayPlan;
  today: string;
  onStart: (weekId: string) => void;
  onStartDiagnostic: () => void;
}

export function Home({ state, setState, plan, today, onStart, onStartDiagnostic }: Props) {
  const [showParent, setShowParent] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const alreadyDone = todaysSession(state, today);
  const pretending = state.settings.dateOverride !== null;
  const realToday = toISO(new Date());

  const week = plan.kind === 'lesson' || plan.kind === 'revision' || plan.kind === 'flex' ? plan.week : null;
  const startable = week && getBank(week.id);
  const drift = plan.kind === 'lesson' || plan.kind === 'revision' ? plan.drift : 0;

  const ahead = plan.kind === 'lesson' ? plan.ahead ?? 0 : 0;
  const dayLabel = week ? schoolDayLabel(today, week) : '';

  const headline =
    plan.kind === 'flex' ? '🌈 Catch-up & stretch week'
    : plan.kind === 'revision' ? '📚 Friday revision'
    : plan.kind === 'lesson' && ahead > 0 ? `🚀 Bonus depth day: ${plan.week.focus}`
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
              {fmtShort(today)} · Term {week.term} · Week {week.week}
              {dayLabel ? ` · ${dayLabel}` : ''}
              {drift > 0 ? ` · 🐢 ${drift} week${drift === 1 ? '' : 's'} behind calendar` : ''}
              {ahead > 0 ? ' · 🚀 finished the week early — extra stretch until Monday' : ''}
            </div>
            {alreadyDone && (
              <div className="donetoday">
                ✅ Already done on {fmtShort(alreadyDone.date)} — ⭐{alreadyDone.ftr}/{alreadyDone.total} first try
              </div>
            )}
            {pretending && (
              <div className="pretendwarn">
                ⚠️ Pretend date is on — the app is stuck on {fmtShort(today)}, not today ({fmtShort(realToday)}).
                <button className="ghost" onClick={() => setState(updateSettings(state, { dateOverride: null }))}>
                  Use the real date
                </button>
              </div>
            )}
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
          <div className={`dayreadout ${pretending ? 'warn' : ''}`}>
            📅 App day: <b>{fmtDate(today)}</b>
            <br />
            {pretending
              ? <>⚠️ pretend date — the real date is {fmtDate(realToday)}</>
              : <>✅ this is the real date on this device</>}
          </div>
          <button
            className="ghost"
            disabled={!pretending}
            onClick={() => setState(updateSettings(state, { dateOverride: null }))}
          >
            {pretending ? '↩️ Use the real date' : '✅ Already on the real date'}
          </button>
          <label>
            Pretend today is (testing only):
            <input
              type="date"
              value={state.settings.dateOverride ?? ''}
              onChange={e => setState(updateSettings(state, { dateOverride: e.target.value || null }))}
            />
          </label>
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
          <button
            className="ghost"
            onClick={async () => {
              const outcome = await shareSummary(buildBackupUrl(state));
              setShareStatus(outcome === 'shared' ? '✅ backup link shared' : outcome === 'copied' ? '✅ backup link copied' : '⚠️ couldn’t copy');
            }}
          >
            💾 Backup / move to another device
          </button>
          <div className="parentnote">Open the backup link on the other device to carry everything across.</div>
          <div className="sessionlog">
            <b>Position:</b> {positionLine(state, today)}
            <br />
            <b>Sessions:</b>
            {state.sessions.length === 0 && <div>none yet</div>}
            {state.sessions.slice(-5).reverse().map((s, i) => (
              <div key={i}>
                {s.date} · {s.conceptId}{s.kind === 'bonus' ? ' ⚡bonus' : s.directive && s.directive !== 'normal' ? ` (${s.directive})` : ''} · ⭐{s.ftr} 👍{s.secondLooks} 🌿{s.parked} / {s.total}
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
  if (drift < 0) {
    const serving = spine.weeks[cal];
    return `${serving.id} (${serving.focus}) — finished early, on bonus depth days; ${w.id} starts ${fmtDate(w.start)}`;
  }
  return `${w.id} (${w.focus})${drift > 0 ? ` — ${drift} wk behind calendar, flex weeks will absorb` : ' — on track'}`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
}

function fmtShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}
