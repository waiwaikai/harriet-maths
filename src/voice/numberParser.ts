const ONES: Record<string, number> = {
  zero: 0, oh: 0, o: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000 };

/** "three hundred and forty two" | "342" | "three four two" → 342; null if unparseable. */
export function wordsToNumber(text: string): number | null {
  const t = text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/-/g, ' ').trim();
  if (!t) return null;

  const digitsOnly = t.replace(/[a-z\s]/g, '');
  const wordy = t.replace(/[0-9]/g, '').trim();
  if (digitsOnly && !wordy) return parseInt(digitsOnly, 10);

  const tokens = t.split(/\s+/);
  let total = 0, current = 0, sawWord = false, digitRun = '';
  for (const tk of tokens) {
    if (/^\d+$/.test(tk)) { digitRun += tk; sawWord = true; continue; }
    if (tk === 'and' || tk === 'a') continue;
    if (tk in ONES) { current += ONES[tk]; sawWord = true; }
    else if (tk in TENS) { current += TENS[tk]; sawWord = true; }
    else if (tk in SCALES) {
      const s = SCALES[tk];
      if (s === 100) current = (current || 1) * 100;
      else { total += (current || 1) * s; current = 0; }
      sawWord = true;
    }
  }
  if (digitRun && current === 0 && total === 0) return parseInt(digitRun, 10);
  if (!sawWord) return null;
  return total + current;
}
