import { useRef, useState } from 'react';
import type { Item, ItemResult, Settings } from '../../content/types';
import { speak, stopSpeaking } from '../../voice/tts';
import { listenOnce } from '../../voice/speechRecognition';
import { wordsToNumber } from '../../voice/numberParser';

interface Props {
  items: Item[];
  settings: Settings;
  onFinish: (results: ItemResult[]) => void;
}

type QStatus = 'pending' | 'correct' | 'second-look' | 'miss' | 'parked';
interface QState { heard: number | null; status: QStatus; }

type Stage = 'working' | 'capturing' | 'confirm' | 'readback' | 'retry-working';

const PRAISES = [
  'Nice work!',
  'Ahhhmazing!',
  'Super duper work!',
  'Fab-tastic!',
  'Great stuff!',
  'Incredible!',
  'Excellent!',
  'Love your work!',
  'Winning!',
  'You got it!',
  'Brilliant!',
];

/**
 * Page 3 — Harriet drives. All 10 questions on screen; she works on her
 * whiteboard, then one button starts the read-out: each question highlights in
 * turn, she says her answer, the app shows what it heard and moves on.
 * Then a spoken readback ("Number one — nice work!"), a look-again retry pass
 * for misses, and parks after that. Answers are never revealed.
 */
export function TenPage({ items, settings, onFinish }: Props) {
  const [qs, setQs] = useState<QState[]>(items.map(() => ({ heard: null, status: 'pending' })));
  const [stage, setStage] = useState<Stage>('working');
  const [round, setRound] = useState<1 | 2>(1);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [interim, setInterim] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const qsRef = useRef(qs);

  function updateQ(i: number, patch: Partial<QState>) {
    qsRef.current = qsRef.current.map((q, j) => (j === i ? { ...q, ...patch } : q));
    setQs(qsRef.current);
  }

  function targets(): number[] {
    return round === 1
      ? items.map((_, i) => i)
      : qsRef.current.map((q, i) => (q.status === 'miss' ? i : -1)).filter(i => i >= 0);
  }

  /** Try the main transcript, then every alternative iOS offered. */
  function parseHeard(r: { text: string; alts: string[] }): number | null {
    const n = wordsToNumber(r.text || '');
    if (n !== null) return n;
    for (const alt of r.alts) {
      const a = wordsToNumber(alt);
      if (a !== null) return a;
    }
    return null;
  }

  async function captureRun() {
    setStage('capturing');
    for (const i of targets()) {
      setActiveIdx(i);
      setInterim('');
      await speak(`Number ${i + 1}?`, settings);
      // let iOS switch the audio session from speaker to mic before listening,
      // otherwise the start of her answer gets clipped
      await pause(350);
      let n = parseHeard(await listenOnce({ timeoutMs: 9000, onInterim: setInterim }));
      if (n === null) {
        // one quiet second chance before moving on
        setInterim('');
        n = parseHeard(await listenOnce({ timeoutMs: 7000, onInterim: setInterim }));
      }
      updateQ(i, { heard: n });
    }
    setActiveIdx(null);
    setInterim('');
    setStage('confirm');
  }

  async function markAndReadback() {
    setEditIdx(null);
    setStage('readback');
    let praiseStreak = 0;
    let praiseIdx = Math.floor(Math.random() * PRAISES.length);
    const misses: number[] = [];

    for (const i of targets()) {
      setActiveIdx(i);
      const correct = qsRef.current[i].heard === items[i].answer;
      if (correct) {
        praiseStreak++;
        const line = praiseStreak >= 3 && praiseStreak % 2 === 1
          ? 'You are On. A. Roll!'
          : PRAISES[praiseIdx++ % PRAISES.length];
        updateQ(i, { status: round === 1 ? 'correct' : 'second-look' });
        await speak(`Number ${i + 1} — ${line}`, settings);
      } else {
        praiseStreak = 0;
        if (round === 1) {
          misses.push(i);
          updateQ(i, { status: 'miss' });
          await speak(`Number ${i + 1} — have another look. Check your workings carefully.`, settings);
        } else {
          updateQ(i, { status: 'parked' });
          await speak(`Number ${i + 1} — let’s look at this one together with umma later.`, settings);
        }
      }
      await pause(250);
    }
    setActiveIdx(null);

    if (round === 1 && misses.length > 0) {
      setRound(2);
      await speak(`Rework the ${misses.length === 1 ? 'orange one' : 'orange ones'} on your whiteboard, then read me your new answers!`, settings);
      setStage('retry-working');
    } else {
      await speak('All done. Great job today!', settings);
      finish();
    }
  }

  function finish() {
    const results: ItemResult[] = items.map((it, i) => {
      const q = qsRef.current[i];
      const tier = q.status === 'correct' ? 'ftr' : q.status === 'second-look' ? 'second-look' : 'parked';
      return {
        itemId: it.id, tier, answer: q.heard ?? NaN,
        heard: q.heard === null ? '(not heard)' : String(q.heard),
        text: it.text, expected: it.answer,
      };
    });
    onFinish(results);
  }

  // ---- heard-chip editing (mishear protection) ----
  function openEdit(i: number) {
    if (stage !== 'confirm' && stage !== 'working' && stage !== 'retry-working') return;
    setEditIdx(i);
    setEditVal('');
  }
  function editKey(k: string) {
    if (k === '⌫') setEditVal(v => v.slice(0, -1));
    else if (k === '✓') {
      if (editVal && editIdx !== null) updateQ(editIdx, { heard: parseInt(editVal, 10) });
      setEditIdx(null);
    } else if (editVal.length < 5) setEditVal(v => v + k);
  }

  const isDim = (i: number) => {
    if (stage === 'retry-working' || (round === 2 && (stage === 'capturing' || stage === 'confirm'))) {
      return qs[i].status !== 'miss';
    }
    return activeIdx !== null && activeIdx !== i;
  };

  const statusIcon = (s: QStatus) =>
    s === 'correct' ? '⭐' : s === 'second-look' ? '👍' : s === 'miss' ? '👀' : s === 'parked' ? '🌿' : '';

  return (
    <div>
      <h2 className="phasetitle">💪 Your ten, Harriet!</h2>
      {stage === 'working' && <div className="kidnote">Do them on your whiteboard, then read Karen your answers! 🖍️</div>}
      {stage === 'capturing' && <div className="kidnote">👂 {interim ? `…${interim}` : 'Say your answer!'}</div>}
      {stage === 'confirm' && <div className="kidnote">Tap a number if Karen heard it wrong 🔧</div>}
      {stage === 'retry-working' && <div className="kidnote">Rework the orange ones, then read me your new answers! 🧡</div>}

      <div className="qlist">
        {items.map((it, i) => (
          <div key={it.id} className={`qrow ${activeIdx === i ? 'active' : ''} ${isDim(i) ? 'dim' : ''} st-${qs[i].status}`}>
            <span className="qnum">{i + 1}</span>
            <span className="qbody">{it.text}</span>
            <button className="qspeak" onClick={() => speak(it.say, settings)} aria-label="read aloud">🔊</button>
            <span className="qmark">{statusIcon(qs[i].status)}</span>
            {(qs[i].heard !== null || stage === 'confirm') && (
              <button className={`heardchip ${qs[i].heard === null ? 'empty' : ''}`} onClick={() => openEdit(i)}>
                {qs[i].heard ?? '?'}
              </button>
            )}
          </div>
        ))}
      </div>

      {editIdx !== null && (
        <div className="card editcard">
          <div className="qmeta">Number {editIdx + 1}</div>
          <div className="editq">{items[editIdx].text}</div>
          <div className="qmeta">Type your answer:</div>
          <div className="padval">{editVal || ' '}</div>
          <div className="pad">
            {['1','2','3','4','5','6','7','8','9','⌫','0','✓'].map(k => (
              <button key={k} className={k === '✓' ? 'padkey ok' : 'padkey'} onClick={() => editKey(k)}>{k}</button>
            ))}
          </div>
        </div>
      )}

      {stage === 'working' && (
        <button className="primary bigstart" onClick={captureRun}>🎙️ Read your answers to Karen</button>
      )}
      {stage === 'confirm' && (
        <button className="primary bigstart" onClick={markAndReadback}>Mark them! ✨</button>
      )}
      {stage === 'retry-working' && (
        <button className="primary bigstart" onClick={captureRun}>🎙️ Read your new answers</button>
      )}
    </div>
  );
}

function pause(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export function stopTenAudio() {
  stopSpeaking();
}
