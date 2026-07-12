import { useState } from 'react';
import type { Bank, Settings } from '../../content/types';
import { speak } from '../../voice/tts';
import { BaseTenBlocks } from '../../components/BaseTenBlocks';

import type { DayDirective } from '../../content/types';

interface Props {
  bank: Bank;
  focus: string;
  directive: DayDirective;
  settings: Settings;
  onNext: () => void;
}

/**
 * Page 2 — umma drives. Key concept, the "show" example (tap-through, narrated
 * unless muted), then two do-together scripts. One button out: make Harriet's 10.
 */
export function ConceptPage({ bank, focus, directive, settings, onNext }: Props) {
  const [demoStep, setDemoStep] = useState(-1);
  const [muted, setMuted] = useState(false);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  async function say(text: string) {
    if (!muted) await speak(text, settings);
  }

  async function stepTo(i: number) {
    setDemoStep(i);
    const step = bank.demo.steps[i];
    if (step) await say(step.say);
  }

  return (
    <div>
      <div className="card">
        <h2 className="phasetitle">📖 Today’s concept</h2>
        {directive === 'depth' && (
          <div className="directive depth">🌟 She’s flying with this — today stretches her with trickier problem types. The demo is optional; skip to the do-togethers if she’s keen.</div>
        )}
        {directive === 'reteach' && (
          <div className="directive reteach">🔁 Yesterday was tough — run the show example again, and try a different model this time (draw it, or use pasta/LEGO as blocks). Her questions today are gentler.</div>
        )}
        <div className="todayhead">{focus}</div>
        <p className="introtext">{bank.parentIntro}</p>
        <div className="wedomodel">👀 <b>Watch for:</b> {bank.watchFor}</div>
      </div>

      <div className="card demo">
        <div className="cardhead">
          <h3>🎬 Show her: {bank.demo.title}</h3>
          <button className="linkish" onClick={() => setMuted(!muted)}>{muted ? '🔇 muted' : '🔊 sound on'}</button>
        </div>
        {demoStep === -1 ? (
          <button className="primary" onClick={async () => { await say(bank.demo.say); stepTo(0); }}>
            ▶️ Start the show example
          </button>
        ) : (
          <>
            {bank.demo.steps[demoStep].blocks
              ? <BaseTenBlocks {...bank.demo.steps[demoStep].blocks!} />
              : <div className="demoshow">{bank.demo.steps[demoStep].show}</div>}
            <div className="democaption">{bank.demo.steps[demoStep].caption}</div>
            {demoStep + 1 < bank.demo.steps.length
              ? <button className="primary" onClick={() => stepTo(demoStep + 1)}>Next →</button>
              : <button className="ghost" onClick={() => stepTo(0)}>↻ Show it again</button>}
          </>
        )}
      </div>

      {bank.weDo.map((ex, i) => (
        <div key={i} className="card wedo">
          <h3>🤝 Do together — {i + 1} of {bank.weDo.length}</h3>
          <div className="wedoproblem">{ex.problem}</div>
          <div className="wedomodel">🧱 {ex.model}</div>
          <ol className="wedosteps">
            {ex.steps.map((s, j) => <li key={j}>{s}</li>)}
          </ol>
          {revealed[i]
            ? <div className="wedoanswer">✅ {ex.answer}</div>
            : <button className="ghost" onClick={() => setRevealed({ ...revealed, [i]: true })}>Show answer</button>}
        </div>
      ))}

      <button className="primary bigstart" onClick={onNext}>
        Make Harriet’s 10 questions →
      </button>
    </div>
  );
}
