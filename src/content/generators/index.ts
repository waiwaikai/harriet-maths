import type { Item } from '../types';
import { pickInt, seededRng, shuffle } from './rng';
import { generatePlaceValueItems } from './placeValue';

type Gen = (seed: string, count: number, difficulty: 1 | 2 | 3) => Item[];

function unit(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Partitioning to 1000: standard parts, tens-counting, and non-standard regrouping at depth. */
const generatePartitioningItems: Gen = (seed, count, difficulty) => {
  const rng = seededRng(seed);
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    const id = `gen-part-${seed}-${i}`;
    const form = difficulty === 1 ? i % 2 : difficulty === 2 ? i % 3 : 2 + (i % 3);
    if (form === 0) {
      // missing part: 356 = 300 + ? + 6
      const h = pickInt(rng, 1, 9), t = pickInt(rng, 1, 9), o = pickInt(rng, 1, 9);
      const n = h * 100 + t * 10 + o;
      items.push({
        id, kind: 'plain', difficulty,
        text: `${n} = ${h * 100} + ? + ${o}. What is missing?`,
        say: `${n} equals ${h * 100}, plus something, plus ${o}. What is the missing number?`,
        answer: t * 10,
      });
    } else if (form === 1) {
      // how many tens in N0
      const t = pickInt(rng, 3, 60);
      items.push({
        id, kind: 'plain', difficulty,
        text: `How many tens make ${t * 10}?`,
        say: `How many tens make ${t * 10}?`,
        answer: t,
      });
    } else if (form === 2) {
      // non-standard: 2 hundreds and 14 tens
      const h = pickInt(rng, 1, 6), t = pickInt(rng, 11, 19);
      items.push({
        id, kind: 'plain', difficulty,
        text: `What number is ${unit(h, 'hundred')} and ${unit(t, 'ten')}?`,
        say: `What number is ${unit(h, 'hundred')}, and ${unit(t, 'ten')}?`,
        answer: h * 100 + t * 10,
      });
    } else if (form === 3) {
      // missing hundreds: ? + 40 + 7 = 647
      const h = pickInt(rng, 1, 9), t = pickInt(rng, 1, 9), o = pickInt(rng, 1, 9);
      const n = h * 100 + t * 10 + o;
      items.push({
        id, kind: 'plain', difficulty,
        text: `? + ${t * 10} + ${o} = ${n}. What is missing?`,
        say: `Something plus ${t * 10}, plus ${o}, equals ${n}. What is the missing number?`,
        answer: h * 100,
      });
    } else {
      // digit-value reasoning: the report-card focus, "what is that digit worth?"
      // digits must differ or "what is the 3 worth?" would be ambiguous
      const h = pickInt(rng, 1, 9);
      let t = pickInt(rng, 1, 9);
      while (t === h) t = (t % 9) + 1;
      let o = pickInt(rng, 1, 9);
      while (o === h || o === t) o = (o % 9) + 1;
      const n = h * 100 + t * 10 + o;
      const askHundreds = rng() < 0.5;
      items.push({
        id, kind: 'plain', difficulty,
        text: `In the number ${n}, what is the ${askHundreds ? h : t} worth?`,
        say: `In the number ${n}, what is the ${askHundreds ? h : t} worth?`,
        answer: askHundreds ? h * 100 : t * 10,
      });
    }
  }
  return items;
};

/** Bonds & fact families: missing addends, whole-minus-part, bonds to 100 at depth. */
const generateBondsItems: Gen = (seed, count, difficulty) => {
  const rng = seededRng(seed);
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    const id = `gen-bonds-${seed}-${i}`;
    if (difficulty === 1) {
      // bonds to 10/20
      const whole = rng() < 0.5 ? 10 : 20;
      const a = pickInt(rng, 1, whole - 1);
      items.push({
        id, kind: 'plain', difficulty,
        text: `${a} + ? = ${whole}. What is missing?`,
        say: `${a} plus something makes ${whole}. What is the something?`,
        answer: whole - a,
      });
    } else if (difficulty === 2) {
      const form = i % 2;
      const whole = pickInt(rng, 11, 20);
      const part = pickInt(rng, 2, 9);
      if (form === 0) {
        items.push({
          id, kind: 'plain', difficulty,
          text: `What is ${whole} − ${part}?`,
          say: `What is ${whole} take away ${part}?`,
          answer: whole - part,
        });
      } else {
        items.push({
          id, kind: 'plain', difficulty,
          text: `${whole} − ? = ${whole - part}. What is missing?`,
          say: `${whole} take away something leaves ${whole - part}. What is the something?`,
          answer: part,
        });
      }
    } else {
      const form = i % 2;
      if (form === 0) {
        // ? − 7 = 6  (missing whole)
        const part = pickInt(rng, 3, 9), rest = pickInt(rng, 3, 9);
        items.push({
          id, kind: 'plain', difficulty,
          text: `? − ${part} = ${rest}. What is the missing number?`,
          say: `Something take away ${part} leaves ${rest}. What is the something?`,
          answer: part + rest,
        });
      } else {
        // bonds to 100 in tens
        const a = pickInt(rng, 1, 9) * 10;
        items.push({
          id, kind: 'plain', difficulty,
          text: `${a} + ? = 100. What is missing?`,
          say: `${a} plus something makes one hundred. What is the something?`,
          answer: 100 - a,
        });
      }
    }
  }
  return items;
};

/** Add/sub strategies: no-bridge → bridging ten → 2-digit ± 2-digit with bridging and missing values. */
const generateAddSubItems: Gen = (seed, count, difficulty) => {
  const rng = seededRng(seed);
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    const id = `gen-addsub-${seed}-${i}`;
    if (difficulty === 1) {
      // friendly, no bridging
      const a = pickInt(rng, 2, 7) * 10 + pickInt(rng, 1, 4);
      const b = pickInt(rng, 1, 4);
      const add = rng() < 0.5;
      items.push({
        id, kind: 'plain', difficulty,
        text: `What is ${a} ${add ? '+' : '−'} ${add ? b : b}?`,
        say: `What is ${a} ${add ? 'plus' : 'take away'} ${b}?`,
        answer: add ? a + b : a - b,
      });
    } else if (difficulty === 2) {
      // single-digit ± that always bridges a ten
      const add = rng() < 0.5;
      const ones = add ? pickInt(rng, 5, 8) : pickInt(rng, 2, 5);
      const a = pickInt(rng, 2, 8) * 10 + ones;
      const b = add ? pickInt(rng, 5, 9) : pickInt(rng, ones + 2, 9);
      items.push({
        id, kind: 'plain', difficulty,
        text: `What is ${a} ${add ? '+' : '−'} ${b}?`,
        say: `What is ${a} ${add ? 'plus' : 'take away'} ${b}?`,
        answer: add ? a + b : a - b,
      });
    } else {
      const form = i % 3;
      if (form === 0) {
        // 2-digit − 2-digit with bridging (the 42−27 shape)
        const bT = pickInt(rng, 1, 4), bO = pickInt(rng, 5, 9);
        const b = bT * 10 + bO;
        const aT = pickInt(rng, bT + 1, 8), aO = pickInt(rng, 1, bO - 1);
        const a = aT * 10 + aO;
        items.push({
          id, kind: 'plain', difficulty,
          text: `What is ${a} − ${b}?`,
          say: `What is ${a} take away ${b}?`,
          answer: a - b,
        });
      } else if (form === 1) {
        // difference framing: how many more from a to b
        const a = pickInt(rng, 2, 5) * 10 + pickInt(rng, 3, 8);
        const gap = pickInt(rng, 13, 29);
        items.push({
          id, kind: 'plain', difficulty,
          text: `How many more is ${a + gap} than ${a}?`,
          say: `How many more is ${a + gap}, than ${a}?`,
          answer: gap,
        });
      } else {
        // place-value subtraction: 304 − 10 shape
        const h = pickInt(rng, 2, 8);
        const n = h * 100 + pickInt(rng, 0, 1) * 10 + pickInt(rng, 2, 9);
        const sub10 = rng() < 0.6;
        items.push({
          id, kind: 'plain', difficulty,
          text: `What is ${n} − ${sub10 ? 10 : 100}?`,
          say: `What is ${n}, take away ${sub10 ? 'ten' : 'one hundred'}?`,
          answer: n - (sub10 ? 10 : 100),
        });
      }
    }
  }
  return items;
};

/** Multiplication intro: skip counting, equal groups, arrays; missing factors and mixed reasoning at depth. */
const generateMultItems: Gen = (seed, count, difficulty) => {
  const rng = seededRng(seed);
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    const id = `gen-mult-${seed}-${i}`;
    if (difficulty === 1) {
      const step = [2, 5, 10][pickInt(rng, 0, 2)];
      const start = pickInt(rng, 1, 3);
      items.push({
        id, kind: 'plain', difficulty,
        text: `Skip counting by ${step}s: ${start * step}, ${(start + 1) * step}, ${(start + 2) * step} … what comes next?`,
        say: `Skip counting by ${step}s. ${start * step}, ${(start + 1) * step}, ${(start + 2) * step}. What comes next?`,
        answer: (start + 3) * step,
      });
    } else if (difficulty === 2) {
      const form = i % 3;
      const groups = pickInt(rng, 2, 6);
      const each = [2, 3, 4, 5, 10][pickInt(rng, 0, 4)];
      if (form === 0) {
        items.push({
          id, kind: 'plain', difficulty,
          text: `What is ${groups} groups of ${each}?`,
          say: `What is ${groups} groups of ${each}?`,
          answer: groups * each,
        });
      } else if (form === 1) {
        items.push({
          id, kind: 'plain', difficulty,
          text: `${groups} rows of ${each} dots. How many dots?`,
          say: `${groups} rows of ${each} dots. How many dots altogether?`,
          answer: groups * each,
        });
      } else {
        const bags = pickInt(rng, 2, 6);
        const per = [2, 3, 5, 10][pickInt(rng, 0, 3)];
        items.push({
          id, kind: 'plain', difficulty,
          text: `${bags} bags with ${per} apples in each. How many apples?`,
          say: `${bags} bags, with ${per} apples in each bag. How many apples altogether?`,
          answer: bags * per,
        });
      }
    } else {
      const form = i % 3;
      if (form === 0) {
        // missing factor
        const each = [2, 3, 4, 5][pickInt(rng, 0, 3)];
        const groups = pickInt(rng, 3, 9);
        items.push({
          id, kind: 'plain', difficulty,
          text: `? groups of ${each} make ${groups * each}. How many groups?`,
          say: `Some groups of ${each} make ${groups * each}. How many groups?`,
          answer: groups,
        });
      } else if (form === 1) {
        // array rows × cols
        const rows = pickInt(rng, 3, 6), cols = pickInt(rng, 3, 8);
        items.push({
          id, kind: 'plain', difficulty,
          text: `An array has ${rows} rows of ${cols}. How many altogether?`,
          say: `An array has ${rows} rows of ${cols}. How many altogether?`,
          answer: rows * cols,
        });
      } else {
        // groups plus extras
        const groups = pickInt(rng, 3, 6), each = pickInt(rng, 3, 6), extra = pickInt(rng, 1, 4);
        items.push({
          id, kind: 'plain', difficulty,
          text: `${groups} groups of ${each}, plus ${extra} extra. How many altogether?`,
          say: `${groups} groups of ${each}, plus ${extra} extra. How many altogether?`,
          answer: groups * each + extra,
        });
      }
    }
  }
  return items;
};

/** Division & fractions: sharing, grouping, unit fractions of a quantity. */
const generateDivFracItems: Gen = (seed, count, difficulty) => {
  const rng = seededRng(seed);
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    const id = `gen-divfrac-${seed}-${i}`;
    if (difficulty === 1) {
      if (i % 2 === 0) {
        const half = pickInt(rng, 2, 10);
        items.push({ id, kind: 'plain', difficulty, text: `What is half of ${half * 2}?`, say: `What is half of ${half * 2}?`, answer: half });
      } else {
        const each = pickInt(rng, 2, 6);
        items.push({ id, kind: 'plain', difficulty, text: `${each * 2} shared between 2. How many each?`, say: `${each * 2} shared between two. How many each?`, answer: each });
      }
    } else if (difficulty === 2) {
      const divisor = [2, 3, 4, 5, 10][pickInt(rng, 0, 4)];
      const quotient = pickInt(rng, 2, 9);
      const total = divisor * quotient;
      const form = i % 3;
      if (form === 0) {
        items.push({ id, kind: 'plain', difficulty, text: `${total} shared between ${divisor}. How many each?`, say: `${total} shared between ${divisor}. How many each?`, answer: quotient });
      } else if (form === 1) {
        items.push({ id, kind: 'plain', difficulty, text: `How many groups of ${divisor} are in ${total}?`, say: `How many groups of ${divisor} are in ${total}?`, answer: quotient });
      } else {
        const q = pickInt(rng, 2, 8);
        items.push({ id, kind: 'plain', difficulty, text: `What is a quarter of ${q * 4}?`, say: `What is a quarter of ${q * 4}?`, answer: q });
      }
    } else {
      const form = i % 4;
      if (form === 0) {
        const divisor = [3, 4, 5, 6, 10][pickInt(rng, 0, 4)];
        const quotient = pickInt(rng, 3, 9);
        items.push({ id, kind: 'plain', difficulty, text: `? ÷ ${divisor} = ${quotient}. What is the missing number?`, say: `Something divided by ${divisor} equals ${quotient}. What is the something?`, answer: divisor * quotient });
      } else if (form === 1) {
        const e = pickInt(rng, 2, 6);
        items.push({ id, kind: 'plain', difficulty, text: `What is an eighth of ${e * 8}?`, say: `What is an eighth of ${e * 8}?`, answer: e });
      } else if (form === 2) {
        const plates = pickInt(rng, 3, 5);
        const each = pickInt(rng, 4, 7);
        items.push({
          id, kind: 'story', difficulty,
          text: `${plates * each} cupcakes are shared onto ${plates} plates, then 1 more is put on each plate. How many on each plate?`,
          say: `${plates * each} cupcakes are shared equally onto ${plates} plates. Then one more is put on each plate. How many cupcakes on each plate?`,
          answer: each + 1,
        });
      } else {
        const pieces = [3, 4, 5, 6][pickInt(rng, 0, 3)];
        const len = pieces * pickInt(rng, 4, 12);
        items.push({
          id, kind: 'story', difficulty,
          text: `A ribbon ${len} cm long is cut into ${pieces} equal pieces. How long is each piece?`,
          say: `A ribbon ${len} centimetres long is cut into ${pieces} equal pieces. How long is each piece?`,
          answer: len / pieces,
        });
      }
    }
  }
  return items;
};

// ---- spoken forms for big numbers (TTS reads long digit strings unreliably) ----
const ONES_W = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS_W = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function below100(n: number): string {
  if (n < 20) return ONES_W[n];
  const t = Math.floor(n / 10), o = n % 10;
  return TENS_W[t] + (o ? ' ' + ONES_W[o] : '');
}
function below1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  if (!h) return below100(n);
  return `${ONES_W[h]} hundred${r ? ' and ' + below100(r) : ''}`;
}
/** 0–99,999 in words: 27506 → "twenty seven thousand five hundred and six". */
export function inWords(n: number): string {
  if (n < 1000) return below1000(n);
  const th = Math.floor(n / 1000), r = n % 1000;
  const head = `${below1000(th)} thousand`;
  if (!r) return head;
  return head + (r < 100 ? ' and ' : ' ') + below1000(r);
}

/** Place value to tens of thousands: digit values, and steps across 1000/10000 boundaries. */
const generatePv10000Items: Gen = (seed, count, difficulty) => {
  const rng = seededRng(seed);
  const items: Item[] = [];
  /** Distinct digits so "what is the 6 worth?" can never be ambiguous. */
  const distinct = (howMany: number): number[] => {
    const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const first = pickInt(rng, 1, 9);
    pool.splice(pool.indexOf(first), 1);
    const out = [first];
    while (out.length < howMany) {
      const idx = pickInt(rng, 0, pool.length - 1);
      out.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return out;
  };

  for (let i = 0; i < count; i++) {
    const id = `gen-pv10k-${seed}-${i}`;
    if (difficulty === 1) {
      if (i % 2 === 0) {
        const th = pickInt(rng, 1, 8);
        items.push({ id, kind: 'plain', difficulty, text: `What is 1,000 more than ${(th * 1000).toLocaleString()}?`, say: `What is one thousand more than ${inWords(th * 1000)}?`, answer: (th + 1) * 1000 });
      } else {
        const h = pickInt(rng, 2, 9);
        items.push({ id, kind: 'plain', difficulty, text: `How many hundreds make ${h * 100}?`, say: `How many hundreds make ${inWords(h * 100)}?`, answer: h });
      }
    } else if (difficulty === 2) {
      const [a, b, c, d] = distinct(4);
      const n = a * 1000 + b * 100 + c * 10 + d;
      const form = i % 3;
      if (form === 0) {
        items.push({
          id, kind: 'plain', difficulty,
          text: `What number is ${unit(a, 'thousand')}, ${unit(b, 'hundred')}, ${unit(c, 'ten')} and ${unit(d, 'one')}?`,
          say: `What number is ${unit(a, 'thousand')}, ${unit(b, 'hundred')}, ${unit(c, 'ten')}, and ${unit(d, 'one')}?`,
          answer: n,
        });
      } else if (form === 1) {
        items.push({ id, kind: 'plain', difficulty, text: `In ${n.toLocaleString()} — what is the ${b} worth?`, say: `In ${inWords(n)}. What is the ${b} worth?`, answer: b * 100 });
      } else {
        items.push({ id, kind: 'plain', difficulty, text: `What is 1,000 more than ${n.toLocaleString()}?`, say: `What is one thousand more than ${inWords(n)}?`, answer: n + 1000 });
      }
    } else {
      const form = i % 5;
      if (form === 0) {
        const [a, b, c, d, e] = distinct(5);
        const n = a * 10000 + b * 1000 + c * 100 + d * 10 + e;
        items.push({ id, kind: 'plain', difficulty, text: `In ${n.toLocaleString()} — what is the ${b} worth?`, say: `In ${inWords(n)}. What is the ${b} worth?`, answer: b * 1000 });
      } else if (form === 1) {
        const th = pickInt(rng, 2, 9);
        items.push({ id, kind: 'plain', difficulty, text: `What number is 1 less than ${(th * 1000).toLocaleString()}?`, say: `What number is one less than ${inWords(th * 1000)}?`, answer: th * 1000 - 1 });
      } else if (form === 2) {
        const n = pickInt(rng, 2, 8) * 1000 + pickInt(rng, 90, 99) * 10 + pickInt(rng, 0, 9);
        items.push({ id, kind: 'plain', difficulty, text: `What is 100 more than ${n.toLocaleString()}?`, say: `What is one hundred more than ${inWords(n)}?`, answer: n + 100 });
      } else if (form === 3) {
        const th = pickInt(rng, 12, 89);
        items.push({ id, kind: 'plain', difficulty, text: `How many thousands are in ${(th * 1000).toLocaleString()}?`, say: `How many thousands are in ${inWords(th * 1000)}?`, answer: th });
      } else {
        const n = pickInt(rng, 3, 9) * 1000 + pickInt(rng, 0, 9) * 10;
        items.push({ id, kind: 'plain', difficulty, text: `What is 1,000 less than ${n.toLocaleString()}?`, say: `What is one thousand less than ${inWords(n)}?`, answer: n - 1000 });
      }
    }
  }
  return items;
};

/** 2–3 digit addition: split/jump strategies, missing addends, near-hundred compensation. */
const generateAdd23Items: Gen = (seed, count, difficulty) => {
  const rng = seededRng(seed);
  const items: Item[] = [];
  const sum = (a: number, b: number, id: string, difficulty: 1 | 2 | 3): Item => ({
    id, kind: 'plain', difficulty,
    text: `What is ${a} + ${b}?`,
    say: `What is ${inWords(a)} plus ${inWords(b)}?`,
    answer: a + b,
  });

  for (let i = 0; i < count; i++) {
    const id = `gen-add23-${seed}-${i}`;
    if (difficulty === 1) {
      if (i % 2 === 0) items.push(sum(pickInt(rng, 2, 8) * 10, pickInt(rng, 2, 6) * 10, id, difficulty));
      else items.push(sum(pickInt(rng, 21, 79), 10, id, difficulty));
    } else if (difficulty === 2) {
      // two-digit + two-digit that bridges a ten
      const aO = pickInt(rng, 4, 8), bO = pickInt(rng, 10 - aO + 1, 9);
      items.push(sum(pickInt(rng, 2, 6) * 10 + aO, pickInt(rng, 1, 3) * 10 + bO, id, difficulty));
    } else {
      const form = i % 4;
      if (form === 0) {
        items.push(sum(pickInt(rng, 12, 48) * 10 + pickInt(rng, 1, 9), pickInt(rng, 11, 39) * 10 + pickInt(rng, 1, 9), id, difficulty));
      } else if (form === 1) {
        const near = [99, 199, 299][pickInt(rng, 0, 2)];
        items.push(sum(pickInt(rng, 3, 9) * 10 + pickInt(rng, 1, 9), near, id, difficulty));
      } else if (form === 2) {
        const total = pickInt(rng, 8, 19) * 10 + pickInt(rng, 1, 9);
        const known = pickInt(rng, 2, 6) * 10 + pickInt(rng, 1, 9);
        items.push({
          id, kind: 'plain', difficulty,
          text: `? + ${known} = ${total}. What is the missing number?`,
          say: `Something plus ${inWords(known)} equals ${inWords(total)}. What is the missing number?`,
          answer: total - known,
        });
      } else {
        const a = pickInt(rng, 11, 39) * 10, b = pickInt(rng, 6, 19) * 10, c = pickInt(rng, 2, 9) * 10;
        items.push({
          id, kind: 'plain', difficulty,
          text: `Add ${a}, ${b} and ${c}.`,
          say: `Add together: ${inWords(a)}, ${inWords(b)}, and ${inWords(c)}.`,
          answer: a + b + c,
        });
      }
    }
  }
  return items;
};

/** 2–3 digit subtraction: her diagnostic gap — bridging, differences, zeros, compensation. */
const generateSub23Items: Gen = (seed, count, difficulty) => {
  const rng = seededRng(seed);
  const items: Item[] = [];
  const take = (a: number, b: number, id: string, difficulty: 1 | 2 | 3): Item => ({
    id, kind: 'plain', difficulty,
    text: `What is ${a} − ${b}?`,
    say: `What is ${inWords(a)} take away ${inWords(b)}?`,
    answer: a - b,
  });

  for (let i = 0; i < count; i++) {
    const id = `gen-sub23-${seed}-${i}`;
    if (difficulty === 1) {
      if (i % 2 === 0) items.push(take(pickInt(rng, 4, 9) * 10, pickInt(rng, 1, 3) * 10, id, difficulty));
      else items.push(take(pickInt(rng, 3, 9) * 10 + pickInt(rng, 1, 5), pickInt(rng, 1, 5), id, difficulty));
    } else if (difficulty === 2) {
      // two-digit − two-digit that bridges (ones of a smaller than ones of b)
      const aO = pickInt(rng, 1, 5), bO = pickInt(rng, aO + 2, 9);
      const bT = pickInt(rng, 1, 3), aT = pickInt(rng, bT + 1, 8);
      items.push(take(aT * 10 + aO, bT * 10 + bO, id, difficulty));
    } else {
      const form = i % 5;
      if (form === 0) {
        // three-digit − three-digit needing regrouping
        const bO = pickInt(rng, 5, 9), aO = pickInt(rng, 0, bO - 1);
        const b = pickInt(rng, 1, 3) * 100 + pickInt(rng, 2, 8) * 10 + bO;
        const a = pickInt(rng, 4, 8) * 100 + pickInt(rng, 0, 9) * 10 + aO;
        items.push(take(a, b, id, difficulty));
      } else if (form === 1) {
        // difference framing — counting up is the fast road
        const small = pickInt(rng, 12, 28) * 10 + pickInt(rng, 1, 9);
        const gap = pickInt(rng, 14, 89);
        items.push({
          id, kind: 'plain', difficulty,
          text: `What is the difference between ${small} and ${small + gap}?`,
          say: `What is the difference between ${inWords(small)}, and ${inWords(small + gap)}?`,
          answer: gap,
        });
      } else if (form === 2) {
        // near-hundred compensation
        const near = [99, 199][pickInt(rng, 0, 1)];
        items.push(take(pickInt(rng, 3, 9) * 100 + pickInt(rng, 0, 9) * 10 + pickInt(rng, 0, 9), near, id, difficulty));
      } else if (form === 3) {
        // zeros in the middle — 604 − 8, 405 − 10
        const n = pickInt(rng, 3, 9) * 100 + pickInt(rng, 0, 9);
        const sub = i % 2 === 0 ? pickInt(rng, 2, 9) : 10;
        items.push(take(n, sub, id, difficulty));
      } else {
        // missing minuend
        const b = pickInt(rng, 2, 7) * 10 + pickInt(rng, 1, 9);
        const rest = pickInt(rng, 2, 8) * 10 + pickInt(rng, 1, 9);
        items.push({
          id, kind: 'plain', difficulty,
          text: `? − ${b} = ${rest}. What is the missing number?`,
          say: `Something take away ${inWords(b)} leaves ${inWords(rest)}. What is the something?`,
          answer: b + rest,
        });
      }
    }
  }
  return items;
};

/** Term 3 revision: a rolling mix drawn from every concept covered this term. */
const generateT3RevisionItems: Gen = (seed, count, difficulty) => {
  const sources = [
    'pv-1000-consolidate', 'pv-partitioning', 'bonds-addsub', 'addsub-strategies',
    'mult-intro', 'div-fractions-intro', 'pv-10000s', 'add-23digit', 'sub-23digit',
  ];
  const out: Item[] = [];
  for (let i = 0; out.length < count && i < count * 4; i++) {
    const conceptId = sources[i % sources.length];
    const gen = generators[conceptId];
    if (!gen) continue;
    const [item] = gen(`${seed}-${conceptId}-${i}`, 1, difficulty);
    if (item && !out.some(o => o.text === item.text)) out.push({ ...item, id: `gen-t3rev-${seed}-${out.length}` });
  }
  return out.slice(0, count);
};

/** Registry: conceptId → generator. */
export const generators: Record<string, Gen> = {
  'pv-1000-consolidate': generatePlaceValueItems,
  'pv-partitioning': generatePartitioningItems,
  'bonds-addsub': generateBondsItems,
  'addsub-strategies': generateAddSubItems,
  'mult-intro': generateMultItems,
  'div-fractions-intro': generateDivFracItems,
  'pv-10000s': generatePv10000Items,
  'add-23digit': generateAdd23Items,
  'sub-23digit': generateSub23Items,
  't3-revision': generateT3RevisionItems,
};

export { seededRng, shuffle };
