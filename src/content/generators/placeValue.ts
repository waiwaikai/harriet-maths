import type { Item } from '../types';
import { pickInt, seededRng, shuffle } from './rng';

/** "1 hundred" / "2 hundreds" / "0 tens" — correct singular/plural for place-value units. */
function unit(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * Parametric drill generator for place value to 1000.
 * Deterministic per seed; difficulty widens the number range and adds
 * trickier forms (zero placeholders, crossing boundaries).
 */
export function generatePlaceValueItems(seed: string, count: number, difficulty: 1 | 2 | 3): Item[] {
  const rng = seededRng(seed);
  const items: Item[] = [];
  const forms = difficulty === 1 ? ['build-to', 'tens-ones'] as const
    : difficulty === 2 ? ['build-h', 'more-less-10', 'tens-ones'] as const
    : (['build-h', 'more-less-100', 'more-less-10', 'boundary'] as const);

  for (let i = 0; i < count; i++) {
    const form = forms[Math.floor(rng() * forms.length)];
    const id = `gen-pv-${seed}-${i}`;

    if (form === 'tens-ones') {
      const t = pickInt(rng, 2, 9), o = pickInt(rng, 1, 9);
      items.push({
        id, kind: 'plain', difficulty,
        text: `What number is ${unit(t, 'ten')} and ${unit(o, 'one')}?`,
        say: `What number is ${unit(t, 'ten')}, and ${unit(o, 'one')}?`,
        answer: t * 10 + o,
      });
    } else if (form === 'build-to') {
      const t = pickInt(rng, 1, 9), o = pickInt(rng, 0, 9);
      const n = t * 10 + o;
      items.push({
        id, kind: 'plain', difficulty,
        text: `What is 10 more than ${n}?`,
        say: `What is ten more than ${n}?`,
        answer: n + 10,
      });
    } else if (form === 'build-h') {
      const h = pickInt(rng, 1, 9), t = pickInt(rng, 0, 9), o = pickInt(rng, 0, 9);
      items.push({
        id, kind: 'plain', difficulty,
        text: `What number is ${unit(h, 'hundred')}, ${unit(t, 'ten')} and ${unit(o, 'one')}?`,
        say: `What number is ${unit(h, 'hundred')}, ${unit(t, 'ten')}, and ${unit(o, 'one')}?`,
        answer: h * 100 + t * 10 + o,
      });
    } else if (form === 'more-less-10') {
      const n = pickInt(rng, 3, 96) * 10 + pickInt(rng, 0, 9);
      const more = rng() < 0.5;
      items.push({
        id, kind: 'plain', difficulty,
        text: `What is 10 ${more ? 'more' : 'less'} than ${n}?`,
        say: `What is ten ${more ? 'more' : 'less'} than ${n}?`,
        answer: more ? n + 10 : n - 10,
      });
    } else if (form === 'more-less-100') {
      const n = pickInt(rng, 2, 8) * 100 + pickInt(rng, 0, 99);
      const more = rng() < 0.5;
      items.push({
        id, kind: 'plain', difficulty,
        text: `What is 100 ${more ? 'more' : 'less'} than ${n}?`,
        say: `What is one hundred ${more ? 'more' : 'less'} than ${n}?`,
        answer: more ? n + 100 : n - 100,
      });
    } else {
      // boundary: what comes after 199/299/... or before 300/400/...
      const h = pickInt(rng, 1, 8);
      const after = rng() < 0.5;
      items.push({
        id, kind: 'plain', difficulty,
        text: after ? `What number comes right after ${h * 100 + 99}?` : `What number comes right before ${(h + 1) * 100}?`,
        say: after ? `What number comes right after ${h * 100 + 99}?` : `What number comes right before ${(h + 1) * 100}?`,
        answer: after ? (h + 1) * 100 : (h + 1) * 100 - 1,
      });
    }
  }
  return items;
}

/** Registry: conceptId → generator. Grows as weeks are built. */
export const generators: Record<string, (seed: string, count: number, difficulty: 1 | 2 | 3) => Item[]> = {
  'pv-1000-consolidate': generatePlaceValueItems,
};

export { shuffle, seededRng };
