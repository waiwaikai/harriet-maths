import { useState } from 'react';
import type { Item, WarmupMark, WarmupResult } from '../../content/types';

interface Props {
  items: Item[];
  onDone: (marks: WarmupResult[]) => void;
}

const MARKS: { mark: WarmupMark; label: string; hint: string }[] = [
  { mark: 'tick', label: '✓', hint: 'got it' },
  { mark: 'prompted', label: '?', hint: 'needed a prompt' },
  { mark: 'cross', label: '✗', hint: 'not yet' },
];

/**
 * Page 1 — umma drives. She asks each question aloud; one tap per question.
 * tick = first-time-right · prompted = soft pass (resurfaces sooner) · cross = gap
 * (feeds the spaced-recall weighting).
 */
export function WarmupPage({ items, onDone }: Props) {
  const [marks, setMarks] = useState<Record<string, WarmupMark>>({});

  function setMark(itemId: string, mark: WarmupMark) {
    const next = { ...marks, [itemId]: mark };
    setMarks(next);
    if (Object.keys(next).length === items.length) {
      setTimeout(() => onDone(items.map(it => ({ itemId: it.id, mark: next[it.id], conceptId: it.conceptId }))), 350);
    }
  }

  return (
    <div className="card">
      <h2 className="phasetitle">🔥 Warm-up</h2>
      <div className="parentnote">📖 Umma asks these out loud, Harriet answers — tap one mark per question.</div>
      {items.map((it, i) => (
        <div key={it.id} className="warmuprow">
          <div className="warmupq">
            <span className="warmupnum">{i + 1}.</span> {it.text}
            <span className="warmupans">→ {it.answer}</span>
          </div>
          <div className="markbtns">
            {MARKS.map(m => (
              <button
                key={m.mark}
                className={`markbtn ${m.mark} ${marks[it.id] === m.mark ? 'chosen' : ''}`}
                onClick={() => setMark(it.id, m.mark)}
                aria-label={m.hint}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="markkey">✓ got it &nbsp;·&nbsp; ? needed a prompt &nbsp;·&nbsp; ✗ not yet</div>
    </div>
  );
}
