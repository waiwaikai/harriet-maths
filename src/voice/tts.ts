let cachedVoice: SpeechSynthesisVoice | null = null;
let cachedFor = '';

function pickVoice(preferredName: string | null): SpeechSynthesisVoice | null {
  const key = preferredName ?? '';
  if (cachedVoice && cachedFor === key) return cachedVoice;
  const voices = window.speechSynthesis?.getVoices() ?? [];
  if (!voices.length) return null;
  const byName = preferredName
    ? voices.find(v => v.name.toLowerCase().includes(preferredName.toLowerCase()))
    : null;
  const au = voices.find(v => /en[-_]AU/i.test(v.lang));
  const en = voices.find(v => /^en/i.test(v.lang));
  cachedVoice = byName ?? au ?? en ?? voices[0];
  cachedFor = key;
  return cachedVoice;
}

export function ttsSupported(): boolean {
  return 'speechSynthesis' in window;
}

export function speak(text: string, opts: { voiceName: string | null; rate: number }): Promise<void> {
  return new Promise(resolve => {
    if (!ttsSupported()) return resolve();
    const synth = window.speechSynthesis;
    synth.cancel();

    let done = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    let cap: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (done) return;
      done = true;
      if (poll) clearInterval(poll);
      if (cap) clearTimeout(cap);
      resolve();
    };

    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(opts.voiceName);
    if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = opts.rate;
    u.pitch = 1.05;
    u.onend = finish;
    u.onerror = finish;

    // iOS Safari watchdog: onend is unreliable — poll actual speaking state
    // and always resolve within a hard cap so the UI can never hang on TTS.
    let sawSpeaking = false;
    poll = setInterval(() => {
      if (synth.paused) synth.resume(); // iOS quirk: synthesis silently pauses
      if (synth.speaking) sawSpeaking = true;
      else if (sawSpeaking) finish(); // finished but onend never fired
    }, 300);
    cap = setTimeout(finish, Math.min(20000, 3000 + text.length * 100));

    synth.speak(u);
  });
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

/** iOS populates voices asynchronously; call once at startup. */
export function warmVoices(): void {
  if (!ttsSupported()) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
    window.speechSynthesis.getVoices();
  };
}

export function listEnglishVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  return window.speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
}
