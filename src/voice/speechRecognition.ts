export interface ListenResult {
  text: string;
  /** All alternative transcripts iOS offered (incl. interim fallback) — try each when parsing. */
  alts: string[];
  error?: string;
  timedOut?: boolean;
}

type SRConstructor = new () => SpeechRecognition;

function getSR(): SRConstructor | null {
  const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechRecognitionSupported(): boolean {
  return getSR() !== null;
}

/**
 * Single-shot recognition. iOS quirk this is built around: for short utterances
 * (a lone number) iOS often never marks a result "final" — so we keep every
 * interim transcript and fall back to the last one on end/timeout instead of
 * discarding what was heard.
 */
export function listenOnce(opts: { timeoutMs?: number; onInterim?: (text: string) => void } = {}): Promise<ListenResult> {
  const { timeoutMs = 9000, onInterim } = opts;
  return new Promise(resolve => {
    const SR = getSR();
    if (!SR) return resolve({ text: '', alts: [], error: 'unsupported' });

    const rec = new SR();
    rec.lang = 'en-AU';
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    rec.continuous = false;

    let finalText = '';
    let lastInterim = '';
    const alts: string[] = [];
    let done = false;

    const finish = (extra: Partial<ListenResult> = {}) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { rec.stop(); } catch { /* already stopped */ }
      const text = (finalText || lastInterim).trim();
      const uniqueAlts = [...new Set([...alts, lastInterim].map(a => a.trim()).filter(a => a && a !== text))];
      resolve({ text, alts: uniqueAlts, ...extra });
    };
    const timer = setTimeout(() => finish({ timedOut: true }), timeoutMs);

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        for (let a = 0; a < r.length; a++) alts.push(r[a].transcript);
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim) {
        lastInterim = interim;
        if (onInterim) onInterim(interim);
      }
      if (finalText) finish();
    };
    rec.onerror = (ev: SpeechRecognitionErrorEvent) => finish({ error: ev.error });
    rec.onend = () => finish();

    try { rec.start(); } catch { finish({ error: 'start-failed' }); }
  });
}
