import { useEffect, useState } from 'react';
import type { DiagnosticMark, ProgressState, WarmupMark } from '../content/types';
import { ladders } from '../content/loadBank';
import { computeLevels } from '../engine/placement';
import { effectiveToday } from '../engine/scheduler';
import { recordDiagnostic } from '../store/progress';
import { speak, stopSpeaking } from '../voice/tts';

interface Props {
  state: ProgressState;
  setState: (s: ProgressState) => void;
  onExit: () => void;
}

type Stage = 'intro' | 'question' | 'done';

/**
 * Pre-term placement (§8): six adaptive ladders, umma-marked.
 * Staircase: climb while she's getting them; two ✗ in a ladder ends it warmly.
 * No retries, no "wrong", and Harriet never sees a score.
 */
export function Diagnostic({ state, setState, onExit }: Props) {
  const [stage, setStage] = useState<Stage>('intro');
  const [ladderIdx, setLadderIdx] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);
  const [misses, setMisses] = useState(0);
  const [marks, setMarks] = useState<DiagnosticMark[]>([]);

  const ladder = ladders[ladderIdx];
  const item = ladder?.items[itemIdx];

  useEffect(() => {
    if (stage === 'question' && item) void speak(item.say, state.settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, item?.id]);

  async function nextLadderOrFinish(fromMarks: DiagnosticMark[]) {
    if (ladderIdx + 1 < ladders.length) {
      await speak('Great work! Next game!', state.settings);
      setLadderIdx(ladderIdx + 1);
      setItemIdx(0);
      setMisses(0);
    } else {
      finish(fromMarks);
    }
  }

  function finish(fromMarks: DiagnosticMark[]) {
    const result = {
      date: effectiveToday(state.settings.dateOverride),
      marks: fromMarks,
      levels: computeLevels(fromMarks, ladders),
    };
    setState(recordDiagnostic(state, result));
    setStage('done');
    void speak('You showed Karen SO much maths today. Amazing work, Harriet!', state.settings);
  }

  async function mark(m: WarmupMark) {
    const rec: DiagnosticMark = { itemId: item.id, ladderId: ladder.id, level: item.level, conceptId: item.conceptId, mark: m };
    const nextMarks = [...marks, rec];
    setMarks(nextMarks);

    const nextMisses = m === 'cross' ? misses + 1 : misses;
    setMisses(nextMisses);

    // ladder ends after 2 misses or when its items run out
    if (nextMisses >= 2 || itemIdx + 1 >= ladder.items.length) {
      await nextLadderOrFinish(nextMarks);
    } else {
      setItemIdx(itemIdx + 1);
    }
  }

  return (
    <div className="session">
      <header className="sessionbar">
        <button className="linkish" onClick={() => { stopSpeaking(); onExit(); }}>← exit</button>
        <div className="phasedots">
          {ladders.map((l, i) => (
            <span key={l.id} className={`dot ${i === ladderIdx && stage === 'question' ? 'active' : ''} ${i < ladderIdx || stage === 'done' ? 'past' : ''}`}>
              {l.emoji}
            </span>
          ))}
        </div>
        <div className="qcount">{stage === 'question' ? `${ladderIdx + 1}/${ladders.length}` : ''}</div>
      </header>

      {stage === 'intro' && (
        <div className="card">
          <h2 className="phasetitle">🧭 Let’s see what you know!</h2>
          <div className="parentnote">
            📖 <b>Umma’s guide:</b> six little “games”, about 15 minutes. Karen reads each question aloud;
            Harriet answers out loud or on her whiteboard, and you tap one mark. Each game starts very easy
            and climbs — after two misses it moves on by itself. <b>That’s the design, not a failure</b>:
            frame it as “new game time!”. She never sees a score; your report appears in umma’s corner after.
          </div>
          <div className="markkey">✓ got it on her own &nbsp;·&nbsp; ? got there with a prompt &nbsp;·&nbsp; ✗ not yet</div>
          <button className="primary bigstart" onClick={() => setStage('question')}>Let’s play! ▶️</button>
        </div>
      )}

      {stage === 'question' && item && (
        <div className="card">
          <h2 className="phasetitle">{ladder.emoji} {ladder.title}</h2>
          <div className="qmeta">Question {itemIdx + 1}</div>
          <div className="qtext">{item.text}</div>
          <div className="warmupans">answer → {item.answer}</div>
          <button className="qspeak diagspeak" onClick={() => speak(item.say, state.settings)}>🔊 hear it again</button>
          <div className="markbtns">
            <button className="markbtn tick" onClick={() => mark('tick')}>✓</button>
            <button className="markbtn prompted" onClick={() => mark('prompted')}>?</button>
            <button className="markbtn cross" onClick={() => mark('cross')}>✗</button>
          </div>
          <div className="markkey">✓ got it &nbsp;·&nbsp; ? needed a prompt &nbsp;·&nbsp; ✗ not yet (moves on after two)</div>
        </div>
      )}

      {stage === 'done' && (
        <div className="card donecard">
          <h2 className="phasetitle">🎉 You did ALL six games!</h2>
          <div className="bigscore">🌟</div>
          <p className="introtext" style={{ textAlign: 'center' }}>You showed Karen so much maths today!</p>
          <div className="parentnote" style={{ textAlign: 'center' }}>Your placement report is now in umma’s corner.</div>
          <button className="primary" onClick={onExit}>Finish</button>
        </div>
      )}
    </div>
  );
}
