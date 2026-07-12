import { useState } from 'react';
import { listenOnce, speechRecognitionSupported } from '../voice/speechRecognition';
import { wordsToNumber } from '../voice/numberParser';

interface Props {
  onAnswer: (n: number, heard?: string) => void;
  disabled?: boolean;
}

// remembered across questions within the session so the child picks once
let padPreferred = false;

/**
 * The single choke point for all answer input (voice-primary, pad fallback).
 * The "look again" loop lives above this — it just captures one number.
 */
export function AnswerCapture({ onAnswer, disabled }: Props) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [pad, setPad] = useState('');
  const [showPad, setShowPadState] = useState(padPreferred || !speechRecognitionSupported());
  const setShowPad = (v: boolean) => { padPreferred = v; setShowPadState(v); };

  async function startListening() {
    if (listening || disabled) return;
    setListening(true);
    setInterim('');
    const r = await listenOnce({ onInterim: setInterim });
    setListening(false);
    setInterim('');
    if (r.error && r.error !== 'no-speech') {
      setShowPad(true);
      return;
    }
    let n = wordsToNumber(r.text || '');
    if (n === null) {
      for (const alt of r.alts) {
        n = wordsToNumber(alt);
        if (n !== null) break;
      }
    }
    if (n !== null) onAnswer(n, r.text);
  }

  function padKey(k: string) {
    if (disabled) return;
    if (k === '⌫') setPad(p => p.slice(0, -1));
    else if (k === '✓') {
      if (pad) { onAnswer(parseInt(pad, 10), `pad:${pad}`); setPad(''); }
    } else if (pad.length < 5) setPad(p => p + k);
  }

  return (
    <div className="capture">
      {speechRecognitionSupported() && (
        <button
          className={`mic ${listening ? 'listening' : ''}`}
          onClick={startListening}
          disabled={disabled || listening}
        >
          {listening ? '👂 Listening…' : '🎙️ Say your answer'}
        </button>
      )}
      {interim && <div className="interim">…{interim}</div>}

      {!showPad && speechRecognitionSupported() && (
        <button className="linkish" onClick={() => setShowPad(true)}>type it instead</button>
      )}

      {showPad && (
        <div className="padwrap">
          <div className="padval">{pad || ' '}</div>
          <div className="pad">
            {['1','2','3','4','5','6','7','8','9','⌫','0','✓'].map(k => (
              <button key={k} className={k === '✓' ? 'padkey ok' : 'padkey'} onClick={() => padKey(k)} disabled={disabled}>
                {k}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
