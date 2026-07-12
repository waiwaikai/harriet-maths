import { useEffect, useRef, useState } from 'react';
import type { Item, ItemResult, Settings } from '../content/types';
import { speak } from '../voice/tts';
import { AnswerCapture } from './AnswerCapture';

interface Props {
  item: Item;
  index: number;
  total: number;
  settings: Settings;
  readAloud: boolean;
  onDone: (result: ItemResult) => void;
}

type Phase = 'asking' | 'capturing' | 'look-again' | 'celebrating' | 'parking';

/**
 * Runs one question through the §7 marking loop:
 * miss 1 → warm prompt + re-read the question → rework → one retry;
 * miss 2 → park warmly ("with umma later"). Never says "wrong".
 */
export function QuestionRunner({ item, index, total, settings, readAloud, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>('asking');
  const [attempt, setAttempt] = useState(0);
  const [feedback, setFeedback] = useState('');
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    // capture is available immediately — TTS reads in parallel and must never
    // gate the answer UI (iOS TTS events are unreliable)
    setPhase('capturing');
    setAttempt(0);
    setFeedback('');
    if (readAloud) void speak(item.say, settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  async function handleAnswer(n: number, heard?: string) {
    if (doneRef.current) return;
    if (n === item.answer) {
      doneRef.current = true;
      const tier = attempt === 0 ? 'ftr' : 'second-look';
      setPhase('celebrating');
      setFeedback(attempt === 0 ? '⭐ Nice work!' : '👍 You got it!');
      await speak(attempt === 0 ? 'Nice work!' : 'You got it. Well done!', settings);
      onDone({ itemId: item.id, tier, answer: n, heard });
    } else if (attempt === 0) {
      setAttempt(1);
      setPhase('look-again');
      setFeedback('👀 Have another look — check your workings carefully.');
      await speak('Have another look. Check your workings carefully.', settings);
      await new Promise(r => setTimeout(r, 350));
      await speak(item.say, settings);
      setPhase('capturing');
    } else {
      doneRef.current = true;
      setPhase('parking');
      setFeedback('🌿 Let’s look at this one together with umma later.');
      await speak('Let’s look at this one together with umma later.', settings);
      onDone({ itemId: item.id, tier: 'parked', answer: n, heard });
    }
  }

  return (
    <div className="question card">
      <div className="qmeta">Question {index + 1} of {total}</div>
      <div className="qtext">{item.text}</div>
      {phase === 'capturing' && <AnswerCapture onAnswer={handleAnswer} />}
      {feedback && <div className={`feedback ${phase}`}>{feedback}</div>}
    </div>
  );
}
