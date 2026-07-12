import type { Bank, Concept, Ladder, Spine } from './types';
import spineJson from '../../content/spine.json';
import conceptsJson from '../../content/concepts.json';
import diagnosticJson from '../../content/diagnostic.json';
import t3w1 from '../../content/banks/t3-w1.json';
import t3w2 from '../../content/banks/t3-w2.json';
import t3w3 from '../../content/banks/t3-w3.json';
import t3w4 from '../../content/banks/t3-w4.json';
import t3w5 from '../../content/banks/t3-w5.json';

export const spine = spineJson as Spine;
export const concepts = (conceptsJson as { concepts: Concept[] }).concepts;
export const ladders = (diagnosticJson as { ladders: Ladder[] }).ladders;

const banks: Record<string, Bank> = {
  't3-w1': t3w1 as Bank,
  't3-w2': t3w2 as Bank,
  't3-w3': t3w3 as Bank,
  't3-w4': t3w4 as Bank,
  't3-w5': t3w5 as Bank,
};

export function getBank(weekId: string): Bank | null {
  return banks[weekId] ?? null;
}

export function getConcept(id: string): Concept | null {
  return concepts.find(c => c.id === id) ?? null;
}
