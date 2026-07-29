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

/** Registry: conceptId → generator. */
export const generators: Record<string, Gen> = {
  'pv-1000-consolidate': generatePlaceValueItems,
  'pv-partitioning': generatePartitioningItems,
  'bonds-addsub': generateBondsItems,
  'addsub-strategies': generateAddSubItems,
  'mult-intro': generateMultItems,
};

export { seededRng, shuffle };
